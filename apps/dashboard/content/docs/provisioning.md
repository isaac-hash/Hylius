# Server Provisioning

Before you can deploy any application, your VPS must be provisioned with Docker, its firewall configured, and the Hylius Agent installed.

You can provision a server directly from the **Dashboard** or by using the `hylius setup` command in the CLI.

---

## Provisioning from the Dashboard

When you click **Provision** on a server card in the Dashboard:
1. The dashboard connects via SSH to your VPS.
2. It installs Docker, Railpack, and sets up UFW.
3. It installs and starts the **Hylius Agent** (`hylius-agent`) systemd service.
4. From then on, deployments are routed securely over WebSockets via the agent.

## Provisioning via CLI (`hylius setup`)

When you run `hylius setup` locally, the CLI connects to your VPS over SSH and:

1. **Detects the OS** — Ubuntu, Debian, or Alpine Linux
2. **Installs Docker Engine** — including `docker-compose-plugin` (the modern `docker compose` v2 CLI)
3. **Installs Railpack** — a zero-config container builder
4. **Configures UFW Firewall** — opens ports `22` (SSH), `80` (HTTP), and `443` (HTTPS)

> [!NOTE]
> The CLI setup tool uses SSH for all operations and **does not** install the Hylius Agent. The agent is strictly used by the web dashboard.

---

## Running `hylius setup`

Navigate to any directory and run:

```bash
hylius setup
```

### Interactive Prompts

If run locally (not in CI), the CLI will walk you through:

```
? VPS Host IP:           › 203.0.113.42
? VPS Username:          › root
? SSH Port:              › 22
? Authentication Method: › SSH Key  (or Password)
? Path to Private Key:   › ~/.ssh/id_rsa
```

After connecting, Hylius will ask:

```
? Setup basic firewall (UFW) and allow SSH/HTTP/HTTPS? (Y/n)
```

Accept to have UFW auto-configured.

---

## Authentication Options

### SSH Key (Recommended)

Paste the path to your private key when prompted. The key must already be registered in `~/.ssh/authorized_keys` on your server.

```bash
# If you haven't added your key yet, run this from your local machine:
ssh-copy-id -i ~/.ssh/id_rsa.pub root@YOUR_VPS_IP
```

### Password

You can authenticate with a password if SSH key auth isn't set up. Hylius uses `sudo -S` internally to run privileged commands — your password is never logged in plain text.

---

## Environment Variable Mode (for CI/CD)

When the `CI` or `GITHUB_ACTIONS` environment variable is set, `hylius setup` switches into **headless mode** — skipping all prompts and reading from environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `HYLIUS_HOST` | VPS IP address | Yes |
| `HYLIUS_USER` | SSH username | No (defaults to `root`) |
| `HYLIUS_PORT` | SSH port | No (defaults to `22`) |
| `HYLIUS_SSH_KEY` | Full private key content | One of these is required |
| `HYLIUS_SSH_KEY_PATH` | Path to private key file | One of these is required |
| `HYLIUS_PASSWORD` | SSH password | One of these is required |

---

## What Gets Installed

### Docker (Ubuntu/Debian)
```
apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Docker (Alpine Linux)
```
apk add docker docker-cli-compose
```

### Railpack
```bash
curl -fsSL https://railpack.com/install.sh | bash
```

Railpack is what allows Hylius to build apps **without a Dockerfile**. It auto-detects Node.js, Python, PHP, Go, and more. If Railpack installation fails, Hylius will fall back to Dockerfile-based builds.

### UFW Firewall
```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

> [!IMPORTANT]
> If you run apps on custom ports (e.g., port `3000` or `8080`), you will need to open those ports manually on the firewall:
> ```bash
> ufw allow 3000/tcp
> ```
> See the [Firewall Troubleshooting Guide](./troubleshooting.md) for details.

---

## After Setup

Once provisioning is complete, you'll see:

```
✅ Server provisioning complete!
You can now deploy your apps using: hylius deploy
```

Your server is now ready. 

**Pro Tip:** Before deploying your first app, head over to the **Marketplace** in the Dashboard to 1-click install platform-level tools like Traffic Analytics (Umami) and Error Tracking (GlitchTip) onto your new server. Any apps you deploy afterwards will automatically be integrated with them!

Head to the [Deployment Guide](./deploying.md) to ship your first app.
