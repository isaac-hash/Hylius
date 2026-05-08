package agent

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/Hylius-org/hylius-agent/internal/config"
	"github.com/Hylius-org/hylius-agent/internal/metrics"
	"github.com/Hylius-org/hylius-agent/internal/uptime"
)

// Message is the top-level envelope for all WebSocket messages
type Message struct {
	Type      string          `json:"type"`
	CommandID string          `json:"commandId,omitempty"`
	Action    string          `json:"action,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	// Command result fields
	Data     string `json:"data,omitempty"`
	Done     bool   `json:"done,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exitCode,omitempty"`
	// Auth / heartbeat fields
	ServerID string  `json:"serverId,omitempty"`
	Token    string  `json:"token,omitempty"`
	CPU      float64 `json:"cpu"`
	Memory   float64 `json:"memory"`
	Disk     float64 `json:"disk"`
	Uptime   int64   `json:"uptime"`
	Version  string  `json:"version,omitempty"`
	UptimeMonitors map[string]string `json:"uptimeMonitors,omitempty"`
}

// Agent is the main coordinator
type Agent struct {
	cfg           *config.Config
	version       string
	conn          *websocket.Conn
	send          chan Message
	stop          chan struct{}
	uptimeChecker *uptime.Checker
	// active streaming cancels: commandId → cancel func
	streams   map[string]func()
	streamsMu sync.Mutex
}

func New(cfg *config.Config, version string) *Agent {
	a := &Agent{
		cfg:     cfg,
		version: version,
		send:    make(chan Message, 256),
		stop:    make(chan struct{}),
		streams: make(map[string]func()),
	}

	a.uptimeChecker = uptime.NewChecker(func(monitorID, status, errorMessage string, autoHealed bool) {
		payload, _ := json.Marshal(map[string]interface{}{
			"monitorId":  monitorID,
			"status":     status,
			"error":      errorMessage,
			"autoHealed": autoHealed,
		})
		a.send <- Message{
			Type:    "uptime_incident",
			Payload: payload,
		}
	})

	return a
}

func (a *Agent) Run() {
	for {
		select {
		case <-a.stop:
			return
		default:
		}

		if err := a.connect(); err != nil {
			log.Printf("[agent] Connection failed: %v — retrying in 5s", err)
			time.Sleep(5 * time.Second)
			continue
		}

		log.Printf("[agent] Connected to %s", a.cfg.ServerURL)
		a.runLoop()

		select {
		case <-a.stop:
			return
		default:
			log.Println("[agent] Disconnected — reconnecting in 5s")
			time.Sleep(5 * time.Second)
		}
	}
}

func (a *Agent) Stop() {
	close(a.stop)
	if a.conn != nil {
		a.conn.Close()
	}
}

func (a *Agent) connect() error {
	wsURL := strings.TrimRight(a.cfg.ServerURL, "/") + "/agent-ws"
	// Replace http/https with ws/wss
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
	wsURL = strings.Replace(wsURL, "http://", "ws://", 1)

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return err
	}
	a.conn = conn

	// Authenticate immediately
	return conn.WriteJSON(Message{
		Type:     "auth",
		ServerID: a.cfg.ServerID,
		Token:    a.cfg.Token,
		Version:  a.version,
	})
}

func (a *Agent) runLoop() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go a.heartbeatLoop(ctx)
	go a.writePump(ctx)
	a.readPump() // blocking
}

func (a *Agent) heartbeatLoop(ctx context.Context) {
	// Send an immediate heartbeat on connect, then every 30s
	a.sendHeartbeat()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			a.sendHeartbeat()
		case <-ctx.Done():
			return
		case <-a.stop:
			return
		}
	}
}

func (a *Agent) sendHeartbeat() {
	m, err := metrics.Collect()
	if err != nil {
		m = &metrics.Snapshot{}
	}
	a.send <- Message{
		Type:           "heartbeat",
		ServerID:       a.cfg.ServerID,
		CPU:            m.CPU,
		Memory:         m.Memory,
		Disk:           m.Disk,
		Uptime:         m.Uptime,
		Version:        a.version,
		UptimeMonitors: a.uptimeChecker.GetStatuses(),
	}
}

func (a *Agent) writePump(ctx context.Context) {
	for {
		select {
		case msg := <-a.send:
			if err := a.conn.WriteJSON(msg); err != nil {
				log.Printf("[agent] Write error: %v", err)
				return
			}
		case <-ctx.Done():
			return
		case <-a.stop:
			return
		}
	}
}

func (a *Agent) readPump() {
	defer a.conn.Close()
	for {
		var msg Message
		if err := a.conn.ReadJSON(&msg); err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				log.Printf("[agent] Read error: %v", err)
			}
			return
		}
		go a.dispatch(msg)
	}
}

func (a *Agent) dispatch(msg Message) {
	if msg.Type != "command" {
		return
	}
	switch msg.Action {
	case "exec":
		a.handleExec(msg)
	case "get-metrics":
		a.handleGetMetrics(msg)
	case "stream-logs":
		a.handleStreamLogs(msg)
	case "stop-stream":
		a.handleStopStream(msg)
	case "deploy":
		a.handleDeploy(msg)
	case "setup":
		a.handleSetup(msg)
	case "provision-db":
		a.handleProvisionDB(msg)
	case "destroy-db":
		a.handleDestroyDB(msg)
	case "configure-caddy":
		a.handleConfigureCaddy(msg)
	case "start-uptime":
		a.handleStartUptime(msg)
	case "stop-uptime":
		a.handleStopUptime(msg)
	case "install-glitchtip":
		a.handleInstallGlitchtip(msg)
	case "uninstall-glitchtip":
		a.handleUninstallGlitchtip(msg)
	default:
		a.sendError(msg.CommandID, "unknown action: "+msg.Action)
	}
}

func (a *Agent) handleStartUptime(msg Message) {
	var m uptime.Monitor
	if err := json.Unmarshal(msg.Payload, &m); err != nil {
		a.sendError(msg.CommandID, "invalid payload: "+err.Error())
		return
	}
	a.uptimeChecker.StartMonitor(m)
	a.sendDone(msg.CommandID, 0)
}

func (a *Agent) handleStopUptime(msg Message) {
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		a.sendError(msg.CommandID, "invalid payload: "+err.Error())
		return
	}
	a.uptimeChecker.StopMonitor(payload.ID)
	a.sendDone(msg.CommandID, 0)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (a *Agent) sendChunk(commandID, data string) {
	a.send <- Message{Type: "command_result", CommandID: commandID, Data: data}
}

func (a *Agent) sendDone(commandID string, exitCode int) {
	a.send <- Message{Type: "command_done", CommandID: commandID, ExitCode: exitCode, Done: true}
}

func (a *Agent) sendError(commandID, errMsg string) {
	a.send <- Message{Type: "command_error", CommandID: commandID, Error: errMsg}
}

func (a *Agent) registerStream(commandID string, cancel func()) {
	a.streamsMu.Lock()
	a.streams[commandID] = cancel
	a.streamsMu.Unlock()
}

func (a *Agent) cancelStream(commandID string) {
	a.streamsMu.Lock()
	if cancel, ok := a.streams[commandID]; ok {
		cancel()
		delete(a.streams, commandID)
	}
	a.streamsMu.Unlock()
}
