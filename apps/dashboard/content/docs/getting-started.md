# Getting Started with Hylius

Hylius is a self-hosted deployment platform that lets you deploy any application to your own VPS with the same ease as Vercel or Render — without giving up control of your infrastructure.

---

## How It Works

Hylius gives you two ways to deploy:

- **Hylius Dashboard** — a web UI where you connect servers, import GitHub repos, trigger deploys, and manage env vars visually
- **Hylius CLI** — a command-line tool for provisioning, deploying, and generating CI/CD pipelines

Both methods connect to your VPS over SSH, clone your repo, build a Docker image (or use Railpack if you have no Dockerfile), and run it — with zero-downtime atomic deploys. Every deployment is versioned and symlink-swapped, so rollbacks are instant.

---

## Prerequisites

Before you begin, you'll need:

- A Linux VPS (Ubuntu 22.04+, Debian, or Alpine recommended) with SSH access
- [Node.js 18+](https://nodejs.org/) installed **on your local machine**
- Your VPS's **IP address**, **SSH username**, and either a **password** or an **SSH private key**
- A Git repository containing your project (GitHub, GitLab, Codeberg, etc.)

---

## Installation

Install the Hylius CLI globally via npm:

```bash
npm install -g hylius
```

Verify the installation:

```bash
hylius --version
```

---

## Quick Start (3 steps)

### Step 1 — Provision your VPS

Run `hylius setup` once to install Docker, Railpack, and configure your server's firewall:

```bash
hylius setup
```

The CLI will prompt you for your VPS credentials. See [Server Provisioning](./provisioning.md) for full details.

### Step 2 — Deploy your app

Navigate to your project directory and run:

```bash
hylius deploy
```

The CLI will ask for your VPS connection details and Git repo URL, then deploy atomically with zero downtime.

### Step 3 — (Optional) Automate with CI/CD

To deploy automatically on every `git push`, generate a GitHub Actions workflow:

```bash
hylius ci-generate
```

See the [CI/CD Guide](./CI-CD.md) for the full workflow.

---

## Command Reference

| Command | Description |
|---------|-------------|
| `hylius setup` | Provision a fresh VPS with Docker + security hardening |
| `hylius deploy` | Deploy your app to your VPS (interactive or headless) |
| `hylius ci-generate` | Generate GitHub Actions workflow files |
| `hylius ci-generate --dagger` | Generate a Dagger-powered pipeline (GHCR builds + preview deploys) |
| `hylius ci-generate --full` | Generate setup + deploy pipeline |

---

## Supported Frameworks

Hylius auto-detects your project type using [Railpack](https://railpack.com) and generates the optimal Docker config:

| Framework | Detection Signal |
|-----------|-----------------|
| **Next.js** | `next.config.*` file |
| **Vite** | `vite.config.ts/js` file |
| **Node.js** | `package.json` |
| **Python / FastAPI** | `requirements.txt`, `pyproject.toml` |
| **Laravel** | `composer.json` + `artisan` |
| **Go** | `go.mod` |
| **Java** | `pom.xml` |
| **Generic PHP** | `composer.json` |

If Hylius detects no framework, it will prompt Docker's built-in `docker init` command to guide configuration.

> [!NOTE]
> You can bypass auto-detection and use your own `Dockerfile` or `compose.yaml`. Hylius will always prefer existing Docker files over auto-generated ones.

---

## Next Steps

- [Using the Dashboard →](./dashboard)
- [Provisioning a VPS →](./provisioning)
- [Deploying Your App →](./deploying)
- [Automating with CI/CD →](./CI-CD)
- [Common Issues & Fixes →](./troubleshooting)
