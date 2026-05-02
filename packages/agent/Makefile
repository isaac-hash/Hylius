BINARY_NAME=hylius-agent
BUILD_DIR=dist
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "0.1.0")
LDFLAGS=-ldflags "-X main.version=$(VERSION) -s -w"

# Dev VPS targets — update these IPs as you add servers
DEV_SERVERS=root@77.68.50.227 root@77.68.54.204

.PHONY: all build clean linux-amd64 linux-arm64 deploy-dev deploy-single

all: linux-amd64 linux-arm64

linux-amd64:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .

linux-arm64:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 .

build:
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) .

# Build + push to all dev VPSes and restart the agent service
deploy-dev: linux-amd64
	@echo "==> Deploying to dev servers: $(DEV_SERVERS)"
	@for server in $(DEV_SERVERS); do \
		echo "  --> $$server"; \
		scp $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 $$server:/tmp/hylius-agent-new; \
		ssh $$server "mv /tmp/hylius-agent-new /usr/local/bin/hylius-agent && chmod +x /usr/local/bin/hylius-agent && systemctl restart hylius-agent && systemctl is-active hylius-agent"; \
	done
	@echo "✅ All dev servers updated."

# Build + push to a single server: make deploy-single SERVER=root@<ip>
deploy-single: linux-amd64
	@if [ -z "$(SERVER)" ]; then echo "Usage: make deploy-single SERVER=root@<ip>"; exit 1; fi
	@echo "==> Deploying to $(SERVER)"
	scp $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 $(SERVER):/tmp/hylius-agent-new
	ssh $(SERVER) "mv /tmp/hylius-agent-new /usr/local/bin/hylius-agent && chmod +x /usr/local/bin/hylius-agent && systemctl restart hylius-agent && systemctl is-active hylius-agent"
	@echo "✅ $(SERVER) updated."

clean:
	rm -rf $(BUILD_DIR)

tidy:
	go mod tidy

test:
	go test ./...
