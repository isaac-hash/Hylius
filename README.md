# hylius

Hylius is a monorepo that includes a Docker/deployment CLI and a web dashboard for managing servers, projects, and deployments.

## Features

- 🔍 Automatic project type detection (Node.js, Python, Go, Java, PHP)
- 🐳 Optimized Docker configurations for different frameworks
- 🚀 Quick development environment setup
- 📦 Production-ready build configurations
- 🛠️ **Server Provisioning** (`hylius setup`) - Automatic Docker/Firewall setup
- 🚢 **Atomic Deployment** (`hylius deploy`) - Zero-downtime push to VPS
- 📦 **Smart runtime deploy strategy** - Auto uses Docker Compose / Dockerfile and can scaffold Node/Next.js Docker artifacts on deploy when missing
- 🤖 **CI/CD Automation** (`hylius ci-generate`) - Quick GitHub Actions scaffolding
- 🎨 **Beautiful colored terminal output with spinners**
- 📊 **Real-time streaming command output**
- 🖥️ **Dashboard UI** (`apps/dashboard`) for server, project, billing, and deployment management

## Installation


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
