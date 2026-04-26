package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/Hylius-org/hylius-agent/internal/agent"
	"github.com/Hylius-org/hylius-agent/internal/config"
)

const version = "0.1.0"

func main() {
	configPath := flag.String("config", "/etc/hylius/agent.yaml", "Path to agent config file")
	showVersion := flag.Bool("version", false, "Show version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("hylius-agent v%s\n", version)
		os.Exit(0)
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Hylius Agent v%s starting (serverId: %s)", version, cfg.ServerID)

	a := agent.New(cfg, version)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down...")
		a.Stop()
	}()

	a.Run()
}
