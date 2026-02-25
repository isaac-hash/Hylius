# Hylius — Testing Walkthrough

Complete guide to testing the CLI, GitHub Actions CI/CD, and Dashboard implementations.

---

## Prerequisites

| Requirement | Check |
|---|---|
| **Node.js** ≥ 18 | `node --version` |
| **Docker Desktop** | `docker --version` |
| **Git** | `git --version` |
| **act** (local GHA runner) | `act --version` |
| **Postman** | For Dashboard API testing |
| **npm workspaces** | Run from repo root `c:\Users\HP\Documents\Anvil` |

```powershell
# Install all workspace dependencies from repo root
npm install
```

---

## 1. CLI Testing

The CLI lives in [packages/cli](file:///c:/Users/HP/Documents/Anvil/packages/cli). Run commands via `npm run dev --` from the CLI package directory.

### 1.1 `hylius init` — Project Detection + Docker Config

Tests project type detection and generates Dockerfile, compose.yaml, hylius.yaml, and CI workflow.

```powershell
# Create a test directory with a dummy project
mkdir C:\temp\hylius-test-project
cd C:\temp\hylius-test-project
npm init -y

# Run init (from CLI package)
cd C:\Users\HP\Documents\Anvil\packages\cli
npm run dev -- init
```

**Expected output:**
- ✅ Detects project type (node, vite, next, python, etc.)
- ✅ Creates `Dockerfile`, `compose.yaml`, `.dockerignore`
- ✅ Creates `hylius.yaml`
- ✅ Creates `.github/workflows/ci.yaml`

**Flags to test:**
```powershell
npm run dev -- init --skip-docker   # Skips Docker file generation
npm run dev -- init --skip-ci       # Skips GitHub Actions workflow
```

**Cleanup:**
```powershell
Remove-Item -Recurse -Force C:\temp\hylius-test-project
```

---

### 1.2 `hylius setup` — Server Provisioning (Mock VPS)

Tests SSH connection and server provisioning. Uses a local Docker container as a mock VPS.

**Step 1 — Start Mock VPS:**
```powershell
docker run -d --name mock-vps -p 2222:22 alpine sh -c "apk add --no-cache openssh-server && ssh-keygen -A && echo 'root:password' | chpasswd && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && /usr/sbin/sshd -D"
```

**Step 2 — Run setup:**
```powershell
cd C:\Users\HP\Documents\Anvil\packages\cli
npm run dev -- setup
```

**Interactive prompts — enter:**
| Prompt | Value |
|---|---|
| Host | `127.0.0.1` |
| Username | `root` |
| Port | `2222` |
| Auth Method | `Password` |
| Password | `password` |

**Expected:** ✅ SSH connects, provisions Docker + Git on the mock VPS.

---

### 1.3 `hylius deploy` — Atomic Deployment (Mock VPS)

Tests the full deploy pipeline: SSH → clone → build → symlink release.

```powershell
cd C:\Users\HP\Documents\Anvil\packages\cli
npm run dev -- deploy
```

**Interactive prompts — enter:**
| Prompt | Value |
|---|---|
| Host | `127.0.0.1` |
| Username | `root` |
| Port | `2222` |
| Target Path | `/var/www/hylius-test` |
| Repo URL | Any public repo, e.g. `https://github.com/isaac-hash/hylius.git` |
| Auth Method | `Password` |

**Expected:**
- ✅ Creates timestamped release directory
- ✅ Clones repo into release folder
- ✅ Symlinks `current` → latest release
- ✅ Reports release ID, duration, commit hash

**Verify on mock VPS:**
```powershell
docker exec mock-vps ls -la /var/www/hylius-test
docker exec mock-vps ls /var/www/hylius-test/releases
```

---

### 1.4 `hylius build` — Docker Image Build

```powershell
# Navigate to a project directory that has a Dockerfile
cd C:\temp\hylius-test-project   # or any project with Dockerfile
cd C:\Users\HP\Documents\Anvil\packages\cli
npm run dev -- build
```

**Expected:** ✅ Builds Docker image tagged with `projectname:latest` and `projectname:<git-hash>`

---

### 1.5 `hylius dev` — Development Environment

```powershell
# Navigate to a project with compose.yaml
cd C:\temp\hylius-test-project
cd C:\Users\HP\Documents\Anvil\packages\cli
npm run dev -- dev
```

**Expected:** ✅ Runs `docker compose up --build` with streaming output.

**Flags:**
```powershell
npm run dev -- dev --detach   # Run in background
npm run dev -- dev --watch    # Hot-reload mode
```

---

### 1.6 `hylius ci-generate` — GitHub Actions Workflow Generator

```powershell
cd C:\Users\HP\Documents\Anvil\packages\cli
npm run dev -- ci-generate
```

**Interactive prompts:**
- Choose: `Deploy Only (recommended)` → creates `.github/workflows/hylius-deploy.yml`
- Or: `Full Pipeline (Setup + Deploy)` → creates `.github/workflows/hylius-pipeline.yml`

**Flag shortcut:**
```powershell
npm run dev -- ci-generate --full   # Skips prompt, generates full pipeline
```

**Expected:** ✅ Creates workflow file with proper secrets template and setup instructions.

---

### Mock VPS Cleanup

```powershell
docker rm -f mock-vps
```

---

## 2. GitHub Actions CI/CD Testing (with `act`)

Test workflows locally using [act](https://github.com/nektos/act) (v0.2.84 installed) before pushing to GitHub.

Two workflow templates exist in [.github/workflows](file:///c:/Users/HP/Documents/Anvil/.github/workflows):

| File | Purpose |
|---|---|
| `ci.yaml` | Build + push Docker image on push/PR to main |
| `hylius-deploy.yml` | Deploy to VPS via Hylius on push to main |

### 2.1 Local Testing with `act`

**Dry run — list available jobs:**
```powershell
cd C:\Users\HP\Documents\Anvil
act -l
```

**Run the CI workflow (push event):**
```powershell
act push
```

**Run a specific workflow file:**
```powershell
act push -W .github/workflows/ci.yaml
act push -W .github/workflows/hylius-deploy.yml
```

**Run a specific job:**
```powershell
act push -j build-and-push        # CI workflow
act push -j deploy                 # Deploy workflow
```

### 2.2 Providing Secrets to `act`

Create a `.secrets` file in the repo root (already in `.gitignore`):

```ini
# .secrets (DO NOT COMMIT)
DOCKER_USERNAME=your-dockerhub-username
DOCKER_PASSWORD=your-dockerhub-token
HYLIUS_HOST=127.0.0.1
HYLIUS_USER=root
HYLIUS_SSH_KEY=your-ssh-private-key
HYLIUS_TARGET_PATH=/var/www/myapp
HYLIUS_REPO_URL=https://github.com/isaac-hash/hylius.git
HYLIUS_PORT=2222
```

Then run with secrets:
```powershell
act push --secret-file .secrets
```

### 2.3 Testing Deploy Workflow Against Mock VPS

```powershell
# 1. Start mock VPS
docker run -d --name mock-vps -p 2222:22 alpine sh -c "apk add --no-cache openssh-server && ssh-keygen -A && echo 'root:password' | chpasswd && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && /usr/sbin/sshd -D"

# 2. Run the deploy workflow locally
act push -W .github/workflows/hylius-deploy.yml --secret-file .secrets

# 3. Cleanup
docker rm -f mock-vps
```

### 2.4 Push to GitHub (Remote Run)

Once local tests pass, configure **GitHub Repo → Settings → Secrets → Actions** with the same secrets from `.secrets`, then:

```powershell
git add .
git commit -m "test: trigger CI/CD"
git push origin main
```

Verify runs in the **GitHub → Actions** tab.

---

## 3. Dashboard Testing

The dashboard lives in [apps/dashboard](file:///c:/Users/HP/Documents/Anvil/apps/dashboard).

### 3.1 Setup & Start

```powershell
cd C:\Users\HP\Documents\Anvil\apps\dashboard

# Generate Prisma client (if not done)
npx prisma generate

# Apply migrations (creates SQLite dev DB)
npx prisma migrate dev

# Start dev server
npm run dev
```

**Expected:** ✅ Server starts at `http://localhost:3000`

---

### 3.2 Postman Setup

Create a Postman collection called **Hylius Dashboard** with base URL `http://localhost:3000`.

**Environment variables to set up:**
| Variable | Initial Value |
|---|---|
| `base_url` | `http://localhost:3000` |
| `token` | _(leave empty, auto-set after register/login)_ |
| `server_id` | _(leave empty, auto-set after create server)_ |
| `project_id` | _(leave empty, auto-set after create project)_ |

> [!TIP]
> On the register and login requests, add this **Post-response Script** to auto-capture the token:
> ```javascript
> const res = pm.response.json();
> if (res.token) pm.environment.set("token", res.token);
> ```

For all authenticated requests, set the **Authorization** header:
- Type: `Bearer Token`
- Token: `{{token}}`

---

### 3.3 Auth API Requests

**1. Register** — `POST {{base_url}}/api/auth/register`
```json
{
  "email": "test@hylius.com",
  "password": "SecurePass123",
  "orgName": "Test Org"
}
```
✅ Returns `token`, `user` (with `role: OWNER`), `organization` (with `slug: test-org`)

**2. Login** — `POST {{base_url}}/api/auth/login`
```json
{
  "email": "test@hylius.com",
  "password": "SecurePass123"
}
```
✅ Returns `token` + user/org info

**3. Get Me** — `GET {{base_url}}/api/auth/me` _(Auth: Bearer `{{token}}`)_

✅ Returns current user + organization

---

### 3.4 Server CRUD — `{{base_url}}/api/servers` (Auth required)

**POST** — Create server (SSH key gets encrypted at rest):
```json
{
  "name": "Test VPS",
  "ip": "127.0.0.1",
  "username": "root",
  "port": 2222,
  "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----",
  "osType": "Alpine"
}
```
✅ Response does NOT contain `privateKeyEncrypted` or `keyIv`

> [!TIP]
> Add Post-response script: `pm.environment.set("server_id", pm.response.json().id);`

**GET** — Lists only servers in your organization

---

### 3.5 Project CRUD — `{{base_url}}/api/projects` (Auth required)

**POST** — Create project:
```json
{
  "name": "My App",
  "repoUrl": "https://github.com/isaac-hash/hylius.git",
  "branch": "main",
  "deployPath": "/var/www/myapp",
  "serverId": "{{server_id}}"
}
```
✅ Verifies server belongs to same org before creating

**GET** — Lists only projects in your organization

---

### 3.6 Deployments — `GET {{base_url}}/api/deployments` (Auth required)

✅ Returns deployments scoped to your org (via project relationship)

Optional query param: `?projectId={{project_id}}`

---

### 3.7 Auth Rejection Tests

Create two requests in Postman to verify security:

1. **No auth** — `GET {{base_url}}/api/servers` with no Authorization header → ✅ `401`
2. **Bad token** — `GET {{base_url}}/api/servers` with `Bearer invalid-token` → ✅ `401`

---

### 3.8 End-to-End Dashboard UI Testing (Browser)

> [!NOTE]
> Requires the Mock VPS running, provisioned with Docker, and configured with an SSH Key.

**Step 1: Start and Prepare the Mock VPS**
Start the container:
```powershell
docker run -d --name mock-vps -p 2222:22 alpine sh -c "apk add --no-cache openssh-server && ssh-keygen -A && echo 'root:password' | chpasswd && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && /usr/sbin/sshd -D"
```

Provision it with Docker (headless CI mode skips interactive prompts):
```powershell
$env:CI="true"; $env:HYLIUS_HOST="127.0.0.1"; $env:HYLIUS_USER="root"; $env:HYLIUS_PORT="2222"; $env:HYLIUS_PASSWORD="password"; cd packages/cli; npm run dev -- setup; cd ../..
```

Generate a private SSH key and authorize it on the Mock VPS:
```powershell
ssh-keygen -t rsa -b 4096 -f ./mock_vps_key -N '""'
docker exec mock-vps mkdir -p /root/.ssh
docker cp ./mock_vps_key.pub mock-vps:/root/.ssh/authorized_keys
docker exec mock-vps chown -R root:root /root/.ssh
docker exec mock-vps chmod 700 /root/.ssh
docker exec mock-vps chmod 600 /root/.ssh/authorized_keys
```
*(Keep the contents of `./mock_vps_key` ready to paste into the Dashboard).*

**Step 2: Dashboard UI Walkthrough**
1. **Register & Eye Toggle:** Open `http://localhost:3000/register`.
   - Enter an Organization Name, Email, and Password.
   - ✅ **Eye Toggle Test:** Click the "Eye" icon inside the password field. Ensure the password becomes visible/hidden when toggled.
   - Click **Sign up**.
2. **Add Server:** Click **+ Add Server**.
   - **Name:** `Fresh VPS`
   - **IP Address:** `127.0.0.1`
   - **Port:** `2233` (assuming a fresh mock container on this port)
   - **Username:** `root`
   - **Private Key:** Paste your private SSH key.
   - Click **Connect Server**.
3. **Provision Server:** On the new server card, click the blue **Provision** button.
   - ✅ **Expected:** A terminal modal pops up and starts streaming Docker installation logs in real time.
   - Wait for the message: `✅ Server provisioning complete!`
   - Click **Close & Continue**.
4. **Add Project:** Click **+ Project** on the provisioned server.
   - **Name:** `React App`
   - **Repository URL:** `https://github.com/isaac-hash/react2`
   - **Deploy Path:** `/app`
   - Click **Add Project**.
5. **Deploy:** Navigate to the **Deployments** tab.
   - Click **Deploy Now**.
   - ✅ **Expected:** The console streams the build and deploy process to the newly provisioned server.

---

### 3.9 Inspect Database

```powershell
cd C:\Users\HP\Documents\Anvil\apps\dashboard
npx prisma studio
```

Opens browser UI at `http://localhost:5555` to inspect all tables.

---

## Quick Reference

| Component | Start Command | Test With |
|---|---|---|
| **CLI** | `cd packages/cli && npm run dev -- <command>` | Mock VPS (Docker) |
| **GitHub Actions** | `act push` or push to `main` | `act` locally, GitHub Actions remotely |
| **Dashboard** | `cd apps/dashboard && npm run dev` | Postman + Browser |
