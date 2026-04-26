package metrics

import (
	"bufio"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Snapshot holds a point-in-time system metrics reading
type Snapshot struct {
	CPU    float64 `json:"cpu"`    // percentage 0-100
	Memory float64 `json:"memory"` // percentage 0-100
	Disk   float64 `json:"disk"`   // percentage 0-100
	Uptime int64   `json:"uptime"` // seconds
}

var (
	lastCPUStat []uint64
	cpuMu       sync.Mutex
)

// Collect gathers current system metrics.
// CPU is measured continuously between Collect() calls for an accurate average.
func Collect() (*Snapshot, error) {
	return &Snapshot{
		CPU:    getCPU(),
		Memory: getMemory(),
		Disk:   getDisk(),
		Uptime: getUptime(),
	}, nil
}

func getCPU() float64 {
	cpuMu.Lock()
	defer cpuMu.Unlock()

	current := readCPUStat()
	if current == nil || len(current) < 4 {
		return 0
	}

	// First time setup or if state was lost
	if lastCPUStat == nil {
		lastCPUStat = current
		time.Sleep(500 * time.Millisecond)
		current = readCPUStat()
		if current == nil {
			return 0
		}
	}

	sum := func(s []uint64) uint64 {
		var t uint64
		for _, v := range s {
			t += v
		}
		return t
	}
	
	total1, total2 := sum(lastCPUStat), sum(current)
	idle1, idle2 := lastCPUStat[3], current[3]
	
	// Store current as last for the next heartbeat
	lastCPUStat = current

	totalDiff := float64(total2 - total1)
	if totalDiff <= 0 {
		return 0
	}
	
	usage := (1 - float64(idle2-idle1)/totalDiff) * 100
	if usage < 0 {
		return 0
	}
	return usage
}

func readCPUStat() []uint64 {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return nil
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)[1:]
		vals := make([]uint64, len(fields))
		for i, fv := range fields {
			vals[i], _ = strconv.ParseUint(fv, 10, 64)
		}
		return vals
	}
	return nil
}

func getMemory() float64 {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0
	}
	defer f.Close()
	var total, available uint64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		val, _ := strconv.ParseUint(fields[1], 10, 64)
		switch fields[0] {
		case "MemTotal:":
			total = val
		case "MemAvailable:":
			available = val
		}
	}
	if total == 0 {
		return 0
	}
	return float64(total-available) / float64(total) * 100
}

func getDisk() float64 {
	out, err := exec.Command("df", "-BK", "/").Output()
	if err != nil {
		return 0
	}
	lines := strings.Split(string(out), "\n")
	if len(lines) < 2 {
		return 0
	}
	fields := strings.Fields(lines[1])
	if len(fields) < 5 {
		return 0
	}
	pct := strings.TrimSuffix(fields[4], "%")
	val, _ := strconv.ParseFloat(pct, 64)
	return val
}

func getUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0
	}
	f, _ := strconv.ParseFloat(fields[0], 64)
	return int64(f)
}
