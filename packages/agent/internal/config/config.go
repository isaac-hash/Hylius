package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

// Config holds all agent configuration, loaded from /etc/hylius/agent.yaml
type Config struct {
	ServerID  string `yaml:"server_id"`
	Token     string `yaml:"token"`
	ServerURL string `yaml:"server_url"` // e.g. wss://dashboard.hylius.icu
	LogLevel  string `yaml:"log_level"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.LogLevel == "" {
		cfg.LogLevel = "info"
	}
	return &cfg, nil
}
