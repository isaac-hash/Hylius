# Using the Hylius Dashboard

The Hylius Dashboard is a web-based control panel for managing your servers, projects, deployments, and environment variables — all in one place. It complements the CLI by providing a visual interface for the same workflows.

---

## Overview

After signing up and logging in, you'll land on the **Dashboard** page. From here you can:

- **Connect VPS servers** to Hylius
- **Add projects** (manually or imported from GitHub)
- **Provision servers** with Docker in one click
- **Trigger deployments** and watch live logs in a terminal
- **Manage environment variables**, domains, and databases
- **View deployment history** with status, commit hash, and duration

The sidebar navigation includes:

| Section | Description |
|---------|-------------|
| **Dashboard** | Your servers and projects overview |
| **Deployments** | Trigger deploys, view live logs, and browse history |
| **Billing** | Manage your plan, payment methods, and invoices |

---

## 1. Connecting a Server

Before you can deploy anything, connect your VPS to Hylius.

### Step 1 — Click "Add Server"

From the Dashboard, click the **+ Add Server** button in the top-right corner.

### Step 2 — Fill in server details

The **Connect New Server** modal will ask for:

| Field | Description | Example |
|-------|-------------|---------|
| **Server Name** | A friendly label for this VPS | `My Production VPS` |
| **IP Address** | The public IP of your server | `203.0.113.42` |
| **Port** | SSH port (usually 22) | `22` |
| **Username** | SSH user | `root` |
| **Private Key** | Paste the full contents of your SSH private key | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

Click **Connect Server** and Hylius will verify the connection.

### Step 3 — Provision the server

Once connected, click the **Provision** button on the server card. This opens a live terminal that runs `hylius setup` on your VPS — installing Docker, Railpack, and configuring the firewall, all in real-time.

You only need to provision once per server.

---

## 2. Adding a Project

Each project represents one application deployed to one server. You can add projects manually or import them directly from GitHub.

### Manual Mode

Click **+ Project** on any server card, then fill in:

| Field | Description | Required |
|-------|-------------|----------|
| **Project Name** | Name for this project | ✅ |
| **Repository URL** | Git clone URL | ✅ |
| **Branch** | Git branch to deploy | No (defaults to `main`) |
| **Deploy Path** | Path on the VPS where the app lives | ✅ |
| **Build Command** | Custom build command | No |
| **Start Command** | Custom start command | No |

### Import from GitHub

Click the **Import from GitHub** tab to connect your GitHub account via the Hylius GitHub App. Once installed, you'll see a searchable list of your repositories.

Select a repo and Hylius will auto-fill:
- Project name (from the repo name)
- Repository URL (the git clone URL)
- Branch (the default branch)
- Deploy path (`/var/www/<repo-name>`)

### Deployment Strategy

When importing from GitHub, you can choose a deployment strategy:

| Strategy | How it works |
|----------|-------------|
| **Build on Server (Auto-detect)** | Clones the repo on your VPS and builds with Docker Compose, Dockerfile, or Railpack |
| **Build on Server (Docker Compose)** | Uses `docker compose up -d --build` on the server |
| **Build with Dagger (Recommended)** | Builds on GitHub Actions via Dagger, pushes to GHCR, and deploys to your VPS with zero CPU load |
| **Build on GitHub Actions (Native Docker)** | Builds a Docker image on GitHub Actions and pushes to GHCR |
| **Build on GitHub Actions (Docker Compose)** | Same as above but uses Docker Compose |

For the **Dagger** and **GitHub Actions** strategies, Hylius will automatically:
1. Generate a deployment API token
2. Open a **Pull Request** in your GitHub repo with the CI/CD workflow files
3. Provide you with the `HYLIUS_WEBHOOK_URL` and `HYLIUS_API_TOKEN` to add as GitHub Secrets

---

## 3. Deploying from the Dashboard

### One-Click Deploy

Navigate to the **Deployments** page from the sidebar. You'll see:

1. A **project selector** dropdown at the top
2. A **Deploy Now** button
3. A **Live Console** terminal
4. A **Deployment History** sidebar

Select a project and click **Deploy Now**. The live console will stream real-time build and deploy logs — just like running `hylius deploy` in your terminal, but from your browser.

### Automatic Deploys (CI/CD)

If you set up a GitHub-integrated deployment strategy (Dagger, GHCR, or Compose Registry), every push to your main branch will:

1. Trigger a build on GitHub Actions
2. Push the Docker image to GitHub Container Registry (GHCR)
3. Send a webhook to the Hylius Dashboard
4. The Dashboard pulls the new image onto your VPS and performs an atomic zero-downtime deploy

You can watch this happen in real-time on the Deployments page.

---

## 4. Server Details & Management

Click a server name (or **View Details**) on the Dashboard to access the server detail page. From here you can manage:

### Projects

View all projects deployed to this server. Each project card shows:
- Project name and status
- Repository URL and branch
- Last deployment info

### Environment Variables

Click on a project to open the **Environment Variables** editor. You can:
- Add, edit, and remove environment variables
- Variables are securely stored in the Hylius database
- For Dagger/GitHub Actions builds, env vars are fetched at build time via the `/api/webhooks/env` endpoint

### Domains

Manage custom domains for your projects through the **Domain Manager**. Configure:
- Custom domain names
- SSL/TLS settings
- Reverse proxy configuration

### Databases

The **Database Manager** lets you provision and manage databases for your projects.

### Monitoring & Metrics

The server detail page includes live charts for:
- CPU usage
- Memory usage
- Disk usage
- Network I/O

### Container Logs

View real-time container logs from any running project using the built-in **Project Logs Terminal**. This streams `docker logs` output directly to your browser.

---

## 5. GitHub Integration

Hylius integrates with GitHub via a GitHub App. This enables:

- **Repository import** — browse and select repos directly from the dashboard
- **Automatic CI/CD** — Hylius can open PRs with deployment workflows
- **Webhook-based deploys** — GitHub Actions notifies Hylius when a build completes

### Setting Up GitHub Integration

1. Go to the **Add Project** modal and select **Import from GitHub**
2. Click **Connect GitHub** — this redirects you to install the Hylius GitHub App
3. Authorize the app for your account/organization
4. Return to the dashboard and your repositories will appear

The integration requires no personal access tokens — it uses the GitHub App's installation token, which is automatically managed.

---

## 6. API Tokens

The Dashboard provides an API token system for authenticating CI/CD pipelines and webhooks:

- Tokens are generated automatically when you select a Dagger or GHCR deployment strategy
- You can also manually generate tokens from the dashboard
- Tokens are used as the `HYLIUS_API_TOKEN` secret in GitHub Actions

---

## Dashboard vs. CLI

Both tools manage the same infrastructure. Use whichever fits your workflow:

| Feature | Dashboard | CLI |
|---------|-----------|-----|
| Add servers | ✅ UI form | ✅ `hylius setup` |
| Deploy apps | ✅ One-click + live logs | ✅ `hylius deploy` |
| GitHub import | ✅ Built-in | ❌ |
| Env var management | ✅ Visual editor | ❌ (manual `.env` files) |
| Deployment history | ✅ Visual timeline | ❌ |
| CI/CD workflow generation | ✅ Auto-PR to GitHub | ✅ `hylius ci-generate` |
| Server metrics | ✅ CPU/RAM/Disk charts | ❌ |
| Container logs | ✅ Live in browser | ❌ (SSH manually) |
| Domain management | ✅ Built-in | ❌ |
| Database management | ✅ Built-in | ❌ |

---

## Next Steps

- [Getting Started with the CLI →](./getting-started)
- [CI/CD & Automation →](./CI-CD)
- [Troubleshooting →](./troubleshooting)
