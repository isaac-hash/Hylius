package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
)

type streamLogsPayload struct {
	ContainerName string `json:"containerName"`
	ProjectName   string `json:"projectName"`
}

type stopStreamPayload struct {
	StreamCommandID string `json:"streamCommandId"`
}

// handleStreamLogs starts streaming docker or PM2 logs for a container.
// The stream runs until the client sends stop-stream or disconnects.
func (a *Agent) handleStreamLogs(msg Message) {
	var p streamLogsPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		a.sendError(msg.CommandID, "invalid stream-logs payload: "+err.Error())
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	a.registerStream(msg.CommandID, cancel)

	go func() {
		defer a.cancelStream(msg.CommandID)

		containerName := p.ContainerName
		if containerName == "" && p.ProjectName != "" {
			containerName = p.ProjectName + "-app"
		}

		// Determine log source: docker container or PM2
		checkCmd := exec.CommandContext(ctx, "docker", "inspect", "--format={{.State.Running}}", containerName)
		out, err := checkCmd.Output()
		isDocker := err == nil && string(out) == "true\n"

		var cmd *exec.Cmd
		if isDocker {
			cmd = exec.CommandContext(ctx, "docker", "logs", "--tail", "100", "--follow", containerName)
		} else if p.ProjectName != "" {
			cmd = exec.CommandContext(ctx, "pm2", "logs", p.ProjectName, "--nocolor", "--lines", "100")
		} else {
			a.sendError(msg.CommandID, fmt.Sprintf("container %s not found and no projectName provided", containerName))
			return
		}

		// Combine stdout + stderr
		cmd.Stderr = cmd.Stdout
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			a.sendError(msg.CommandID, "pipe error: "+err.Error())
			return
		}

		if err := cmd.Start(); err != nil {
			a.sendError(msg.CommandID, "log stream start failed: "+err.Error())
			return
		}

		a.sendChunk(msg.CommandID, "\x1b[36m[Hylius] Log stream connected\x1b[0m\n")

		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			select {
			case <-ctx.Done():
				cmd.Process.Kill()
				return
			default:
				a.sendChunk(msg.CommandID, scanner.Text()+"\n")
			}
		}

		cmd.Wait()
		a.sendChunk(msg.CommandID, "\x1b[33m[Hylius] Log stream ended\x1b[0m\n")
		a.sendDone(msg.CommandID, 0)
	}()
}

// handleStopStream cancels an active log stream.
func (a *Agent) handleStopStream(msg Message) {
	var p stopStreamPayload
	if err := json.Unmarshal(msg.Payload, &p); err != nil {
		a.sendError(msg.CommandID, "invalid stop-stream payload: "+err.Error())
		return
	}
	a.cancelStream(p.StreamCommandID)
	a.sendDone(msg.CommandID, 0)
}
