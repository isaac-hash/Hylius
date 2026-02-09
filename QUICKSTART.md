# Quick Start Guide

This guide will help you get hylis TypeScript up and running and pushed to GitHub.

## Prerequisites

- Node.js 18+ installed
- Git installed
- GitHub account

## Step-by-Step Setup

### 1. Download and Setup

```bash
# Create project directory
mkdir hylis-ts
cd hylis-ts

# Download all the files from the outputs folder
# Place them in the correct structure as shown in README.md

# Install dependencies
npm install
```

### 2. Verify Installation

```bash
# Build the project
npm run build

# Test it works
npm run dev -- --help

# Try the colored output examples
npx tsx examples/colored-output.ts
```

You should see colorful output! 🎨

### 3. Push to GitHub

#### Option A: Using the setup script (Recommended)

**On Mac/Linux:**
```bash
chmod +x setup-git.sh
./setup-git.sh
```

**On Windows:**
```bash
setup-git.bat
```

Then follow the instructions printed by the script.

#### Option B: Manual setup

```bash
# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: hylis TypeScript CLI"

# Create repository on GitHub, then:
git branch -M main
git remote add origin https://github.com/isaac-hash/hylis.git
git push -u origin main
```

### 4. Install Globally (Optional)

To use `hylis` command anywhere on your system:

```bash
npm link
```

Now you can run:
```bash
hylis --help
hylis init
hylis dev
hylis build
```

### 5. Publish to npm (Optional)

If you want others to install via `npm install -g hylis`:

```bash
# Login to npm
npm login

# Publish (make sure to update package name if 'hylis' is taken)
npm publish
```

## Testing Your CLI

Create a test project:

```bash
# Create a test Node.js project
mkdir test-project
cd test-project
npm init -y

# Initialize with hylis
hylis init

# Start development
hylis dev
```

## Troubleshooting

### "Cannot find module" errors
- Make sure you ran `npm install`
- Try deleting `node_modules` and running `npm install` again

### TypeScript errors
- Run `npm run build` to compile
- Check `tsconfig.json` is present

### Git errors
- Make sure git is installed: `git --version`
- Check you're authenticated with GitHub

### Permission errors on scripts
- On Mac/Linux: `chmod +x setup-git.sh`
- On Windows: Run as administrator if needed

## Next Steps

1. ⭐ Star the repository
2. 📝 Customize the templates in `src/templates/index.ts`
3. 🎨 Adjust colors in the command files
4. 📚 Add more project type detection
5. 🚀 Add more commands (deploy, test, etc.)

## Need Help?

- Check the README.md for detailed documentation
- Look at `examples/colored-output.ts` for coloring examples
- Open an issue on GitHub

Happy coding! 🎉
