# hylius

A CLI tool to initialize and manage Docker configurations for development projects with beautiful colored terminal output.

## Features

- 🔍 Automatic project type detection (Node.js, Python, Go, Java, PHP)
- 🐳 Optimized Docker configurations for different frameworks
- 🚀 Quick development environment setup
- 📦 Production-ready build configurations
- ⚙️ Automatic CI/CD workflow generation
- 🎨 **Beautiful colored terminal output with spinners**
- 📊 **Real-time streaming command output**

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
├── src/
│   ├── commands/
│   │   ├── root.ts      # Main CLI program
│   │   ├── init.ts      # Init command
│   │   ├── dev.ts       # Dev command
│   │   └── build.ts     # Build command
│   ├── utils/
│   │   ├── config.ts    # Config file handling
│   │   └── detect.ts    # Project type detection
│   ├── templates/
│   │   └── index.ts     # Docker/compose templates
│   └── index.ts         # Entry point
├── package.json
├── tsconfig.json
└── README.md
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
