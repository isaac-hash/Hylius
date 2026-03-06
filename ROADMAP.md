# Hylius: Consolidated Technical Roadmap

> Distilled from `next_steps.md` and `steps.md`. This is the single source of truth for what Hylius has, what it's missing, and the order in which to build it.

---

## What's Built Today

| Layer | What Works | Key Files |
|-------|-----------|-----------|
| **Core Engine** | Deploy (5 strategies: docker-compose, dockerfile, railpack, nixpacks, pm2), Setup (VPS provisioning), Monitoring (SSH pulse), Rollback (symlink swap) | `packages/core/src/deploy.ts`, `setup.ts`, `monitoring.ts`, `rollback.ts` |
| **CLI** | `init`, `deploy`, `setup`, `build`, `dev`, `ci-generate` | `packages/cli/src/commands/` |
| **Dashboard** | Auth (register/login/session), Admin panel (users, orgs, plans, transactions), Billing (Flutterwave + Paystack), Server/Project CRUD, Real-time deploy via Socket.io | `apps/dashboard/` |
| **Schema** | 10 models: Organization, User, Session, Server, Project, Deployment, Metric, Plan, Subscription, Payment, ApiToken, AuditLog | `apps/dashboard/prisma/schema.prisma` |
| **CI/CD** | GitHub Actions workflow generator (deploy-only + full pipeline) | `packages/cli/src/commands/ci-generate.ts` |

---

## Competitive Gap Analysis

### vs. Dokploy

| Feature | Dokploy | Hylius Status | Priority |
|---------|---------|---------------|----------|
| Custom Domains + SSL | Traefik auto-config, Let's Encrypt | ❌ Missing | 🔴 Critical |
| Database Management | Deploy MySQL, Postgres, Redis, MongoDB | ❌ Missing | 🟡 Medium |
| Automated Backups | DB + file backups to S3/R2 | ❌ Missing | 🟡 Medium |
| One-Click Templates | WordPress, Ghost, etc. | ❌ Missing | 🟢 Nice-to-have |
| Docker Compose (multi-service) | Native multi-service compose | ⚠️ Partial (single container focus) | 🟡 Medium |
| Multi-server routing | Deploy same app across servers | ❌ Missing | 🟢 Future |

### vs. Vercel

| Feature | Vercel | Hylius Status | Priority |
|---------|--------|---------------|----------|
| Preview Deployments | Every PR gets a unique URL | ❌ Missing | 🔴 Critical |
| Auto-HTTPS | Automatic SSL for all domains | ❌ Missing | 🔴 Critical |
| Git Webhooks | Auto-deploy on `git push` from dashboard | ❌ Missing | 🔴 Critical |
| Environment Variables UI | Per-environment env var editor | ⚠️ Partial (JSON string in `envVars` field) | 🟡 Medium |
| Persistent Build Logs | Permanent, searchable logs | ⚠️ Partial (`logPath` field exists but unused) | 🟡 Medium |
| Framework Detection | Auto-detect Next.js, Vite, etc. | ⚠️ Partial (railpack handles this) | 🟡 Medium |

### Hylius's Core Advantage (Preserve These)

- **100% Agent-less**: Zero footprint on target servers — SSH in, execute, disconnect
- **User-owned infrastructure**: No lock-in, standard Docker images
- **Passive monitoring**: `docker stats` via SSH, no agents eating RAM
- **Build offloading** (planned): GitHub Actions builds → GHCR pull on VPS

---

## Priority Roadmap

| Phase | Feature | What It Unlocks | Effort | Detailed Plan |
|-------|---------|-----------------|--------|---------------|
| **Phase 1** | 🔒 **Domain + SSL (Caddy)** | Production-grade URLs, HTTPS | Medium | ✅ See below |
| **Phase 2** | 🔗 **GitHub App + Webhooks** | Auto-deploy on push from dashboard | Medium | ✅ See below |
| **Phase 3** | 🏗️ **CI-Build via GitHub Actions + GHCR** | Offload builds, zero-downtime pulls | Medium | Pending |
| **Phase 4** | 👁️ **Preview Deployments** | Per-branch URLs (requires Phase 1 + 2) | High | Pending |
| **Phase 5** | 🌍 **Environment Variables UI** | Per-environment editor, secrets management | Low | Pending |
| **Phase 6** | 📊 **Monitoring Dashboard** | Charts from existing `getPulse` data | Medium | Pending |
| **Phase 7** | 💾 **Persistent Build Logs** | Stored, searchable, replayable logs | Medium | Pending |
| **Phase 8** | 🗄️ **Database Management** | Deploy Postgres/MySQL/Redis alongside apps | High | Pending |
| **Phase 9** | 📦 **One-Click Templates** | WordPress, Ghost, etc. | Low | Pending |

---

## Phase 2 Summary: GitHub App + Webhooks

> **Goal**: Allow users to connect their GitHub repos via the Dashboard (instead of CLI-only), and auto-deploy on `git push`.

### Architecture

1. **Register a GitHub App** ("Hylius") with permissions: Contents (read), Metadata (read), Webhooks (read/write)
2. **User installs the app** on their repos → Dashboard receives `installation_id`
3. **Backend uses Octokit** (`@octokit/auth-app`) to generate temporary access tokens from `installation_id`
4. **Webhook endpoint** (`/api/webhooks/github`) receives push events → triggers deploy pipeline
5. **Schema additions**: `GitHubInstallation` model (installationId, userId, repos, accessLevel)

### Why GitHub App > OAuth

- Fine-grained repo permissions (select specific repos, not entire account)
- GitHub pushes events to you (webhooks) — no polling needed
- Temporary tokens (1-hour expiry, not permanent personal access tokens)

---

## Phase 3 Summary: CI-Build via GitHub Actions + GHCR

> **Goal**: Offload expensive Docker builds from cheap VPSs to GitHub's free infrastructure (2,000 min/month).

### Architecture

1. **`ci-generate.ts` produces a new workflow type**: Build with Railpack → Push to GHCR → Notify Hylius
2. **Dashboard webhook** receives build-complete event, SSHs into VPS, runs `docker compose pull && docker compose up -d`
3. **Result**: VPS only downloads pre-built layers — near-zero CPU spike during deploy

### The "Killer" Selling Point

> *"Dokploy makes your $3/month VPS choke trying to compile your Next.js app. Hylius offloads the build to GitHub's servers for free. Your VPS just downloads the finished image in 5 seconds."*

---

## Architectural Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Reverse Proxy** | Caddy (not Nginx + Certbot) | Automatic HTTPS, zero config, ~20MB RAM, aligns with agent-less philosophy |
| **Git Integration** | GitHub App (not OAuth) | Fine-grained permissions, webhook support, temp tokens |
| **Build Location** | GitHub Actions (not on VPS) | Free 2,000 min/month, VPS stays idle during builds |
| **Registry** | GHCR (GitHub Container Registry) | Free for public repos, integrated with GitHub Actions |
| **Monitoring** | SSH-based `docker stats` polling | Zero agents, zero footprint, uses existing SSH connection |
