package uptime

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Monitor struct {
	ID            string `json:"id"`
	Endpoint      string `json:"endpoint"`
	Type          string `json:"type"` // "HTTP" or "TCP"
	Interval      int    `json:"interval"`
	AutoHeal      bool   `json:"autoHeal"`
	ContainerName string `json:"containerName"`
}

type IncidentCallback func(monitorID, status, errorMessage string, autoHealed bool)

type Checker struct {
	monitors   map[string]*monitorState
	mu         sync.Mutex
	onIncident IncidentCallback
	httpClient *http.Client
}

type monitorState struct {
	monitor       Monitor
	consecutiveErr int
	isDown        bool
	stop          chan struct{}
}

func NewChecker(onIncident IncidentCallback) *Checker {
	return &Checker{
		monitors:   make(map[string]*monitorState),
		onIncident: onIncident,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Checker) StartMonitor(m Monitor) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// If already exists, stop the old one
	if state, exists := c.monitors[m.ID]; exists {
		close(state.stop)
	}

	state := &monitorState{
		monitor: m,
		stop:    make(chan struct{}),
	}
	c.monitors[m.ID] = state

	go c.runLoop(state)
	log.Printf("[uptime] Started monitoring %s (%s)", m.ID, m.Endpoint)
}

func (c *Checker) StopMonitor(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if state, exists := c.monitors[id]; exists {
		close(state.stop)
		delete(c.monitors, id)
		log.Printf("[uptime] Stopped monitoring %s", id)
	}
}

func (c *Checker) GetStatuses() map[string]string {
	c.mu.Lock()
	defer c.mu.Unlock()

	statuses := make(map[string]string)
	for id, state := range c.monitors {
		if state.isDown {
			statuses[id] = "OFFLINE"
		} else {
			statuses[id] = "ONLINE"
		}
	}
	return statuses
}

func (c *Checker) runLoop(state *monitorState) {
	interval := time.Duration(state.monitor.Interval) * time.Second
	if interval < 10*time.Second {
		interval = 30 * time.Second // enforce minimum
	}

	// Initial check
	c.checkOnce(state)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.checkOnce(state)
		case <-state.stop:
			return
		}
	}
}

func (c *Checker) checkOnce(state *monitorState) {
	err := c.performCheck(state.monitor)
	
	c.mu.Lock()
	defer c.mu.Unlock()

	if err != nil {
		state.consecutiveErr++
		// If it's the 3rd consecutive error and we weren't already down, trigger incident
		if state.consecutiveErr == 3 && !state.isDown {
			state.isDown = true
			errMsg := err.Error()
			log.Printf("[uptime] Monitor %s is DOWN: %s", state.monitor.ID, errMsg)
			
			autoHealed := false
			if state.monitor.AutoHeal && state.monitor.ContainerName != "" {
				log.Printf("[uptime] Auto-healing %s...", state.monitor.ContainerName)
				if healErr := RestartContainer(state.monitor.ContainerName); healErr == nil {
					autoHealed = true
				} else {
					log.Printf("[uptime] Auto-heal failed: %v", healErr)
				}
			}

			// Run callback asynchronously to avoid blocking
			go c.onIncident(state.monitor.ID, "OFFLINE", errMsg, autoHealed)
		}
	} else {
		// Recovery
		if state.isDown {
			state.isDown = false
			log.Printf("[uptime] Monitor %s recovered", state.monitor.ID)
			go c.onIncident(state.monitor.ID, "ONLINE", "", false)
		}
		state.consecutiveErr = 0
	}
}

func (c *Checker) performCheck(m Monitor) error {
	if strings.ToUpper(m.Type) == "TCP" {
		conn, err := net.DialTimeout("tcp", m.Endpoint, 10*time.Second)
		if err != nil {
			return err
		}
		conn.Close()
		return nil
	}

	// Default to HTTP
	url := m.Endpoint
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		url = "http://" + url
	}
	
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return nil
}
