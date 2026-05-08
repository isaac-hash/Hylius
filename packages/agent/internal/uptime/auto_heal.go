package uptime

import (
	"fmt"
	"os/exec"
)

// RestartContainer runs 'docker restart <containerName>'
func RestartContainer(containerName string) error {
	cmd := exec.Command("docker", "restart", containerName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to restart container %s: %v, output: %s", containerName, err, string(output))
	}
	return nil
}
