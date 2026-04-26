BINARY_NAME=hylius-agent
BUILD_DIR=dist
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "0.1.0")
LDFLAGS=-ldflags "-X main.version=$(VERSION) -s -w"

.PHONY: all build clean linux-amd64 linux-arm64

all: linux-amd64 linux-arm64

linux-amd64:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .

linux-arm64:
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 .

build:
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) .

clean:
	rm -rf $(BUILD_DIR)

tidy:
	go mod tidy

test:
	go test ./...
