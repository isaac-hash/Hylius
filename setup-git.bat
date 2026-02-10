@echo off
REM hylius TypeScript - GitHub Setup Script (Windows)
REM This script helps you initialize git and push to GitHub

echo.
echo 🚀 hylius TypeScript - GitHub Setup
echo ====================================
echo.

REM Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Git is not installed. Please install git first.
    exit /b 1
)

REM Initialize git if not already initialized
if not exist ".git" (
    echo 📦 Initializing git repository...
    git init
    echo ✅ Git initialized
) else (
    echo ✅ Git repository already exists
)

REM Add all files
echo 📝 Staging files...
git add .

REM Create initial commit
echo 💾 Creating initial commit...
git commit -m "Initial commit: hylius TypeScript CLI" -m "" -m "- Converted from Go to TypeScript" -m "- Using Commander.js for CLI framework" -m "- Added chalk for colored output" -m "- Added ora for loading spinners" -m "- Supports Node.js, Python, Go, Java, PHP projects" -m "- Auto-generates Docker configs and GitHub Actions workflows"

echo.
echo ✅ Local repository ready!
echo.
echo 📋 Next steps:
echo ==============
echo.
echo 1. Create a new repository on GitHub:
echo    https://github.com/new
echo.
echo 2. Run these commands (replace YOUR_USERNAME and REPO_NAME):
echo.
echo    git branch -M main
echo    git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
echo    git push -u origin main
echo.
echo Or if you want to use SSH:
echo.
echo    git branch -M main
echo    git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git
echo    git push -u origin main
echo.
echo 3. (Optional) Set up GitHub Actions:
echo    - The .github/workflows/ci.yaml is already included
echo    - It will run automatically on push/PR
echo.

pause
