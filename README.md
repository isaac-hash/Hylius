# Hylius

Hylius is an advanced infrastructure and deployment platform that brings a Vercel-like experience to your own servers. Featuring a comprehensive, beautiful web dashboard and a powerful backing agent-less CLI, Hylius makes it easy to manage servers, deploy projects with zero downtime, and automate your CI/CD pipelines.

## Features

- 🖥️ **Comprehensive Web Dashboard:** A centralized, modern interface for managing servers, projects, deployments, users, and organizations.
- 🔗 **Beautiful UI & Real-Time Deployments:** Includes dynamic status tracking and live-streaming deployment logs right in your browser.
- 🛠️ **Seamless Server Provisioning:** Add a raw VPS and let Hylius automatically configure Docker, firewall rules, and dependencies.
- 🔒 **Auto-HTTPS:** Automatic SSL certificate provisioning via Caddy for all your connected domains.
- 🚢 **Atomic Deployments:** Zero-downtime pushes to your VPS with intelligent rollback capabilities.
- 🐙 **First-Class GitHub Integration:** Auto-deploy on `git push` via a dedicated GitHub App webhook integration.
- 🏗️ **CI/CD Automation:** Scaffolds GitHub Actions workflows so you can offload builds to GitHub and pull pre-built images to your servers.
- 💼 **Built-In Billing & Subscriptions:** Integrated payment plans via Flutterwave and Paystack for platform monetization.
- 🤖 **Agent-less Architecture:** Passive, zero-footprint monitoring (SSH-based `docker stats` polling) keeps your servers clean and lightweight.
- 🔍 **Smart Runtime Strategy:** Auto-detects frameworks (Next.js, Vite, Node.js, Python, Go, Java, PHP) and scaffolds appropriate Docker Compose/Dockerfile assets automatically.

## Why Hylius?

Hylius was built to solve the "expensive build" problem of self-hosted PaaS solutions. While other platforms make your VPS choke during deployments, Hylius offloads the heavy lifting to the cloud.

### Comparison

| Feature | **Hylius** | Dokploy / Coolify | Vercel |
| :--- | :--- | :--- | :--- |
| **Build Location** | **GitHub Actions (Free Cloud)** | Local VPS (Heavy CPU usage) | Managed |
| **Server Footprint** | **Zero (Agent-less SSH)** | 200MB - 1GB+ (Agents/Panels) | N/A |
| **HTTPS/SSL** | Automatic (Caddy) | Traefik / Nginx | Automatic |
| **Infrastructure** | Your own $5 VPS | Your own VPS | Proprietary SaaS |
| **Lock-in** | **None (Pure Docker)** | Low | High |
| **Pricing** | Self-hosted / Fixed | Self-hosted | Per-seat / Bandwidth |

**The Hylius Advantage:** Others install heavy agents on your server and build code locally, which can crash small VPS instances. Hylius uses **SSH and GitHub Container Registry (GHCR)** to deliver pre-built images, keeping your production server fast and idle even during large deployments.

## CLI Installation


### Using npm

```bash
npm install -g hylius
```

### From Source

```bash
# Clone the repository
git clone https://github.com/isaac-hash/hylius.git
cd hylius

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```


## Usage

### Initialize a Project

```bash
# Initialize with automatic detection
hylius init

# Skip Docker initialization
hylius init --skip-docker

# Skip CI workflow generation
hylius init --skip-ci
```

### Start Development Environment

```bash
# Start in foreground
hylius dev

# Start in detached mode
hylius dev -d

# Enable hot-reload (watch mode)
hylius dev --watch
```

### Build Production Image

```bash
hylius build
```

### Deploy to VPS

Hylius allows you to manage your own servers with ease.

```bash
# Prepare a fresh VPS
hylius setup

# Deploy code directly
hylius deploy

# Generate GitHub Actions workflow
hylius ci-generate
```

For detailed instructions on server setup and automation, see the [CI/CD & Deployment Guide](docs/CI-CD.md).

This will create Docker images with tags:
- `<project-name>:latest`
- `<project-name>:<git-hash>` (if in a git repository)

## Supported Project Types

- **Next.js** - Server-side rendered React applications
- **Vite** - Modern frontend tooling (React, Vue, Svelte)
- **Node.js** - Express, NestJS, and other Node.js frameworks
- **Python** - Flask, Django, FastAPI
- **Go** - Go applications with hot-reload
- **Java** - Maven-based Spring Boot applications
- **PHP** - Apache-based PHP applications

## Project Structure

```
hylius/
├── apps/
│   └── dashboard/        # Next.js dashboard + API routes + realtime deployment UI
├── packages/
│   ├── core/             # Shared deployment, setup, monitoring, SSH logic
│   └── cli/              # `hylius` CLI package
├── docs/
└── package.json          # npm workspaces root
```

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run built version
npm start

# Try the colored output examples
npx tsx examples/colored-output.ts
```

## Terminal Output Features

This CLI uses **chalk** for colored output and **ora** for loading spinners:

- ✅ Success messages in green
- ❌ Error messages in red  
- ⚠️ Warnings in yellow
- 📘 Info messages in blue/cyan
- 🔄 Animated spinners for long-running operations
- 📊 Real-time streaming output from Docker commands

See `examples/colored-output.ts` for comprehensive examples of all coloring options.

## Configuration

hylius creates a `hylius.yaml` file in your project:

```yaml
project_name: my-app
type: node
```

## License

MIT
