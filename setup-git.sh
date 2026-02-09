#!/bin/bash

# hylis TypeScript - GitHub Setup Script
# This script helps you initialize git and push to GitHub

echo "🚀 hylis TypeScript - GitHub Setup"
echo "===================================="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    echo "✅ Git initialized"
else
    echo "✅ Git repository already exists"
fi

# Add all files
echo "📝 Staging files..."
git add .

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: hylis TypeScript CLI

- Converted from Go to TypeScript
- Using Commander.js for CLI framework
- Added chalk for colored output
- Added ora for loading spinners
- Supports Node.js, Python, Go, Java, PHP projects
- Auto-generates Docker configs and GitHub Actions workflows"

echo ""
echo "✅ Local repository ready!"
echo ""
echo "📋 Next steps:"
echo "=============="
echo ""
echo "1. Create a new repository on GitHub:"
echo "   https://github.com/new"
echo ""
echo "2. Run these commands (replace YOUR_USERNAME and REPO_NAME):"
echo ""
echo "   git branch -M main"
echo "   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git"
echo "   git push -u origin main"
echo ""
echo "Or if you want to use SSH:"
echo ""
echo "   git branch -M main"
echo "   git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git"
echo "   git push -u origin main"
echo ""
echo "3. (Optional) Set up GitHub Actions:"
echo "   - The .github/workflows/ci.yaml is already included"
echo "   - It will run automatically on push/PR"
echo ""
