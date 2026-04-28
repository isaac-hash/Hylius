#!/bin/bash
# Hylius Agent Installer
# Usage: curl -sSL https://raw.githubusercontent.com/Hylius-org/hylius-agent/main/install.sh | bash -s -- \
#          --token <TOKEN> --server-url <URL> --server-id <ID>
set -e

AGENT_VERSION="latest"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/hylius"
SERVICE_NAME="hylius-agent"
REPO="Hylius-org/hylius-agent"

# Parse args
TOKEN=""
SERVER_URL=""
SERVER_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)      TOKEN="$2";      shift 2 ;;
    --server-url) SERVER_URL="$2"; shift 2 ;;
    --server-id)  SERVER_ID="$2";  shift 2 ;;
    --version)    AGENT_VERSION="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$TOKEN" || -z "$SERVER_URL" || -z "$SERVER_ID" ]]; then
  echo "Error: --token, --server-url, and --server-id are required."
  exit 1
fi

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

echo "==> Installing Hylius Agent (linux/$ARCH)"

# Determine download URL
if [[ "$AGENT_VERSION" == "latest" ]]; then
  DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/hylius-agent-linux-${ARCH}"
else
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${AGENT_VERSION}/hylius-agent-linux-${ARCH}"
fi

echo "==> Downloading from $DOWNLOAD_URL"
curl -sSL -o /tmp/hylius-agent "$DOWNLOAD_URL"
chmod +x /tmp/hylius-agent
mv /tmp/hylius-agent "${INSTALL_DIR}/hylius-agent"

echo "==> Writing config to ${CONFIG_DIR}/agent.yaml"
mkdir -p "$CONFIG_DIR"
cat > "${CONFIG_DIR}/agent.yaml" <<EOF
server_id: ${SERVER_ID}
token: ${TOKEN}
server_url: ${SERVER_URL}
log_level: info
EOF
chmod 600 "${CONFIG_DIR}/agent.yaml"

echo "==> Creating systemd service"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Hylius Agent
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/hylius-agent --config ${CONFIG_DIR}/agent.yaml
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hylius-agent

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo ""
echo "✅ Hylius Agent installed and running!"
echo "   Check status: systemctl status hylius-agent"
echo "   View logs:    journalctl -u hylius-agent -f"
