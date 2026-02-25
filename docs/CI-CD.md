# Hylius CI/CD & Deployment Guide

Hylius provides a **Deployment Trinity** that allows you to manage your own servers with the same ease as platforms like Vercel or Render.

## 1. The Deployment Trinity

| Method | Best For | Mechanism |
|--------|----------|-----------|
| **CLI Deploy** | Rapid prototyping, hotfixes | Direct SSH from local to VPS |
| **CI/CD Deploy** | Teams, production-grade automation | GitHub Actions + GitHub Secrets |
| **Dashboard** | Visual management, monitoring | Web UI (In Development) |

---

## 2. Server Provisioning (`hylius setup`)

Before you can deploy, your VPS needs to be prepared. Hylius automates the installation of Docker and basic security hardening.

```bash
hylius setup
```

**What it does:**
- Detects OS (Ubuntu, Debian, or Alpine).
- Installs Docker Engine and Docker Compose.
- Configures Firewall (UFW) to allow SSH (22), HTTP (80), and HTTPS (443).

**Headless Mode (CI/CD):**
If you run this in a CI environment (like GitHub Actions), it will skip all prompts and use environment variables:
- `HYLIUS_HOST`, `HYLIUS_USER`, `HYLIUS_PORT`, `HYLIUS_PASSWORD`, `HYLIUS_SSH_KEY`.

---

## 3. Manual Deployment (`hylius deploy`)

Push your local code directly to your VPS.

```bash
hylius deploy
```

**Features:**
- **Atomic Deployment:** Uses a "Symlink Swap" logic to ensure zero-downtime.
- **Strategy Auto-Detection:** Defaults to Docker Compose when `compose.yaml` exists, Dockerfile when `Dockerfile` exists, and PM2/Node otherwise.
- **Release Safety:** Every deploy goes to a release directory and then symlink-swaps to `current`.

---

## 4. GitHub Actions CI/CD (`hylius ci-generate`)

Automate your deployments so that Every `git push` to `main` updates your server.

### Step 1: Generate the Workflow
Run the following command in your project root:

```bash
hylius ci-generate
```

This will create `.github/workflows/hylius-deploy.yml` (or `hylius-pipeline.yml`).

### Step 2: Configure GitHub Secrets
Go to your GitHub Repository → **Settings** → **Secrets and variables** → **Actions** and add these secrets:

| Secret | Description | Required |
|--------|-------------|----------|
| `HYLIUS_HOST` | Your VPS IP address | Yes |
| `HYLIUS_USER` | SSH username (e.g., `root`) | Yes |
| `HYLIUS_SSH_KEY` | Full SSH private key content | Yes |
| `HYLIUS_TARGET_PATH` | Path on VPS (e.g., `/var/www/my-app`) | Yes |
| `HYLIUS_PASSWORD` | SSH password (if not using keys) | No |
| `HYLIUS_PORT` | SSH port (defaults to `22`) | No |

> [!TIP]
> To get your private key content, run `cat ~/.ssh/id_rsa`. Copy the *entire* output, including the `-----BEGIN...` and `-----END...` lines.

---

## 5. Local CI/CD Testing (Advanced)

You can test your GitHub Actions workflow locally using [nektos/act](https://github.com/nektos/act) and a mock VPS container.

1. **Start a Mock VPS:**
   ```bash
   docker run -d --name mock-vps -p 2222:22 alpine sh -c "apk add --no-cache openssh-server && ssh-keygen -A && echo 'root:password' | chpasswd && /usr/sbin/sshd -D"
   ```

2. **Run Act:**
   ```bash
   act push -W .github/workflows/hylius-deploy.yml --secret HYLIUS_HOST=172.17.0.2 ...
   ```

---

## 🛡️ Security

Hylius prioritizes **SSH-First** security.
- We recommend using **SSH Keys** over passwords.
- Secrets are never logged in plain text.
- Headless mode relies on encrypted environment variables/secrets.
