# Hylius CI/CD & Deployment Guide

Hylius provides a **Deployment Trinity** that lets you manage your own servers with the same ease as platforms like Vercel or Render — while keeping full control of your infrastructure.

---

## 1. The Deployment Trinity

| Method | Best For | Trigger |
|--------|----------|---------|
| **`hylius deploy`** | Rapid iteration, hotfixes, local bundles | You run it from your machine |
| **GitHub Actions CI/CD** | Teams, production-grade automation | Every `git push` |
| **Hylius Dashboard** | Visual management, monitoring, env vars | Web UI |

---

## 2. Server Provisioning (`hylius setup`)

Before you can deploy, your VPS must be prepared with Docker and security hardening. See the full [Provisioning Guide](./provisioning.md) for details.

```bash
hylius setup
```

**What it does:**
- Detects OS (Ubuntu, Debian, or Alpine)
- Installs Docker Engine and Docker Compose plugin
- Installs Railpack (zero-config container builder — no Dockerfile needed)
- Configures UFW firewall to allow ports `22`, `80`, and `443`

> [!NOTE]
> You only need to run `hylius setup` **once per server**. All subsequent deploys use `hylius deploy`.

**Headless/CI Mode:**  
When `CI=true` or `GITHUB_ACTIONS=true` is set, setup skips all prompts and reads from environment variables: `HYLIUS_HOST`, `HYLIUS_USER`, `HYLIUS_PORT`, `HYLIUS_PASSWORD`, `HYLIUS_SSH_KEY`.

---

## 3. Manual Deployment (`hylius deploy`)

Push your code directly to your VPS from the command line.

```bash
hylius deploy
```

**How it works:**
1. Clones your Git repo into a timestamped release directory on the VPS
2. Builds a Docker image using `Dockerfile` → Railpack (in that order)
3. Starts the new container(s)
4. **Atomically symlink-swaps** to the new release (zero-downtime)
5. Old container is gracefully stopped

**Deployment strategy auto-detection:**

| What exists in your repo | Strategy used |
|--------------------------|---------------|
| `compose.yaml` | Docker Compose (`docker compose up -d --build`) |
| `Dockerfile` only | Single container build |
| Neither | Railpack auto-generates Docker config |

See the full [Deployment Guide](./deploying.md) for framework-specific tips.

---

## 4. GitHub Actions CI/CD (`hylius ci-generate`)

Automate deployments so that every `git push` to `main` updates your server.

### Step 1 — Generate the workflow

Run the following in your project root:

```bash
hylius ci-generate
```

You'll be prompted to choose a template:

- **Deploy Only** (recommended) → creates `.github/workflows/hylius-deploy.yml`
- **Full Pipeline (Setup + Deploy)** → creates `.github/workflows/hylius-pipeline.yml`

Or skip the prompt with a flag:

```bash
hylius ci-generate --full   # Full pipeline
```

### Step 2 — Configure GitHub Secrets

Go to your GitHub Repository → **Settings** → **Secrets and variables** → **Actions** and add:

| Secret | Description | Required |
|--------|-------------|----------|
| `HYLIUS_HOST` | Your VPS IP address | ✅ Yes |
| `HYLIUS_USER` | SSH username (e.g., `root`) | ✅ Yes |
| `HYLIUS_SSH_KEY` | Full SSH private key content | ✅ Yes |
| `HYLIUS_TARGET_PATH` | Deploy path on VPS (e.g., `/var/www/my-app`) | ✅ Yes |
| `HYLIUS_REPO_URL` | Git repo URL (e.g., `https://github.com/user/repo.git`) | ✅ Yes |
| `HYLIUS_PASSWORD` | SSH password (only if not using keys) | ❌ Optional |
| `HYLIUS_PORT` | SSH port (defaults to `22`) | ❌ Optional |

> [!TIP]
> To get your SSH private key content, run:
> ```bash
> cat ~/.ssh/id_rsa
> ```
> Copy the **entire output**, including the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines, and paste it as the `HYLIUS_SSH_KEY` secret.

### Step 3 — Push and watch it deploy

Commit and push the generated workflow file:

```bash
git add .github/workflows/hylius-deploy.yml
git commit -m "ci: add hylius deploy workflow"
git push
```

Every subsequent push to `main` will automatically deploy your app.

---

## 5. Dagger CI Pipeline (`hylius ci-generate --dagger`)

For teams that need **GHCR image builds**, **pull request preview deployments**, and **build caching**, Hylius offers a Dagger-powered pipeline.

```bash
hylius ci-generate --dagger
# or target a specific branch:
hylius ci-generate --dagger --branch production
```

**What gets created:**

| File | Purpose |
|------|---------|
| `.github/workflows/hylius-dagger.yml` | GitHub Actions workflow |
| `.dagger/dagger.json` | Dagger module manifest |
| `.dagger/src/index.ts` | Dagger pipeline (TypeScript) |
| `.dagger/tsconfig.json` | TypeScript config for Dagger module |
| `.dagger/package.json` | Dagger module dependencies |

**How the Dagger pipeline works:**

```
git push → GitHub Actions → Dagger → builds image → pushes to ghcr.io → 
  notifies Hylius Dashboard → Dashboard pulls image → zero-downtime swap
```

**Required secrets for Dagger:**

| Secret | Description |
|--------|-------------|
| `HYLIUS_WEBHOOK_URL` | Your Hylius dashboard deploy webhook URL |
| `HYLIUS_API_TOKEN` | Your Hylius API token (from dashboard) |

> [!NOTE]
> The Dagger pipeline builds your image and pushes it to **GitHub Container Registry (GHCR)** for free. It then notifies the Hylius dashboard, which pulls the image onto your VPS. Your SSH credentials are **never** needed in GitHub Secrets when using this method.

**Automatic fallback:**  
If your repo has no `Dockerfile`, the pipeline automatically falls back to **Railpack** to build and push the image — no extra configuration needed.

---

## 6. Full Pipeline (`hylius ci-generate --full`)

The full pipeline template includes an optional `setup` job that runs `hylius setup` before deploying:

```yaml
# Triggered via GitHub UI (workflow_dispatch) with run_setup: true
jobs:
  setup:
    if: github.event.inputs.run_setup == 'true'
    ...
  deploy:
    needs: [setup]
    if: always() && (needs.setup.result == 'success' || needs.setup.result == 'skipped')
    ...
```

This lets you provision and deploy in one click from the GitHub Actions UI when setting up a brand-new server.

---

## 7. Local CI/CD Testing (Advanced)

Test your GitHub Actions workflow locally using [nektos/act](https://github.com/nektos/act) and a local Hylius mock VPS.

### Start a mock VPS

```bash
docker run -d --name mock-vps -p 2222:22 \
  alpine sh -c "apk add --no-cache openssh-server && \
  ssh-keygen -A && \
  echo 'root:password' | chpasswd && \
  /usr/sbin/sshd -D"
```

### Run the workflow with `act`

```bash
act push \
  -W .github/workflows/hylius-deploy.yml \
  --secret HYLIUS_HOST=127.0.0.1 \
  --secret HYLIUS_PORT=2222 \
  --secret HYLIUS_USER=root \
  --secret HYLIUS_PASSWORD=password \
  --secret HYLIUS_TARGET_PATH=/var/www/my-app \
  --secret HYLIUS_REPO_URL=https://github.com/your-org/your-repo.git
```

---

## 🛡️ Security Best Practices

- **Use SSH keys over passwords** whenever possible
- **Never commit your `.env` file** — set secrets through the GitHub Secrets UI
- Secrets are passed as environment variables and are **never logged in plain text**
- The Dagger pipeline uses `GITHUB_TOKEN` (automatically provided) for GHCR auth — no personal token needed
- Hylius's headless mode is designed around GitHub's encrypted secrets — not plain-text environment files
