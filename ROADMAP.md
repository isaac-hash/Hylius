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
| Auto-HTTPS | Automatic SSL for all domains | ✅ Done (Caddy) | ✅ Done |
| Git Webhooks | Auto-deploy on `git push` from dashboard | ✅ Done (GitHub App) | ✅ Done |
| Commit Status Checks | Report deploy status back to GitHub with link | ❌ Missing | 🔴 Critical |
| Environment Variables UI | Per-environment env var editor | ⚠️ Partial (JSON string in `envVars` field) | 🟡 Medium |
| Persistent Build Logs | Permanent, searchable logs | ⚠️ Partial (`logPath` field exists but unused) | 🟡 Medium |
| Framework Detection | Auto-detect Next.js, Vite, etc. | ⚠️ Partial (railpack handles this) | 🟡 Medium |

### Hylius's Core Advantage (Preserve These)

- **100% Agent-less**: Zero footprint on target servers — SSH in, execute, disconnect
- **User-owned infrastructure**: No lock-in, standard Docker images
- **Passive monitoring**: `docker stats` via SSH, no agents eating RAM
- **Build offloading**: CI builds (GitHub Actions / GitLab CI / Bitbucket Pipelines) → registry pull on VPS

---

## Priority Roadmap

| Phase | Feature | What It Unlocks | Effort | Detailed Plan |
|-------|---------|-----------------|--------|---------------|
| **Phase 1** | 🔒 **Domain + SSL (Caddy)** | Production-grade URLs, HTTPS | Medium | ✅ Done |
| **Phase 2** | 🔗 **GitHub App + Webhooks** | Auto-deploy on push from dashboard | Medium | ✅ Done |
| **Phase 3** | 🏗️ **CI-Build via Dagger + GHCR** | Offload builds to CI compute, VPS only runs finished images | Medium | ✅ Done |
| **Phase 3.5** | 🌐 **Multi-Git-Provider (GitLab + Bitbucket)** | Same offloaded-build flow for GitLab and Bitbucket users | Medium | Pending |
| **Phase 3.5b** | 🔑 **Environment Variables UI** | Per-project env var editor, .env paste-import, masked secrets | Low | ✅ Done |
| **Phase 4** | 👁️ **Preview Deployments** | Per-branch URLs (requires Phase 1 + 2) | High | ✅ Done |
| **Phase 5** | 📊 **Monitoring Dashboard** | Charts from existing `getPulse` data | Medium | Pending |
| **Phase 6** | 💾 **Build Logs + Commit Statuses** | Vercel-style deploy status on GitHub/GitLab/Bitbucket, real-time log viewer | Medium | Pending |
| **Phase 7** | 🗄️ **Database Management** | Deploy Postgres/MySQL/Redis alongside apps | High | Pending |
| **Phase 8** | 📦 **One-Click Templates** | WordPress, Ghost, etc. | Low | Pending |

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

## Phase 3 Summary: CI-Build via Dagger + GHCR

> **Goal**: Offload expensive Docker builds from cheap VPSs to GitHub's free infrastructure (2,000 min/month). Use Dagger as the build engine so pipelines are programmable, cached, and CI-provider agnostic from day one.

### Core Philosophy

The VPS should only ever be a **runtime**, not a build machine. Every strategy that currently builds on the VPS (railpack, nixpacks, dockerfile, pm2) gets replaced by: build in CI → push image → VPS does `docker pull` only.

### Architecture

1. **`ci-generate.ts` adds a `--dagger` flag** that generates 3 files instead of raw YAML:
   - `.dagger/dagger.json` — Dagger module config
   - `.dagger/src/index.ts` — The actual pipeline (auto-detects Dockerfile / railpack / nixpacks, builds image, pushes to registry, calls Hylius webhook)
   - A thin CI wrapper (`.github/workflows/hylius.yml`) — just calls `dagger call build-and-push`
2. **Build flow**: CI runner → Dagger engine → detect project type → build image → push to GHCR
3. **Dashboard webhook** (`/api/webhooks/deploy-complete`) receives build-complete event → SSHs into VPS → `docker pull && docker run`
4. **Result**: VPS only downloads pre-built layers — near-zero CPU spike during deploy

### Why Dagger over raw GitHub Actions YAML

| Property | Raw GitHub Actions YAML | Dagger |
|----------|------------------------|--------|
| Logic language | YAML | TypeScript (same as Hylius core) |
| Caching | Manual cache actions | Automatic content-addressed caching |
| CI portability | GitHub only | GitHub, GitLab, Bitbucket, local |
| Local debugging | Push and pray | `dagger call build-and-push` locally |
| Build speed (repeat) | ~3–5 min | ~30–60 sec (layers cached) |

### Non-Containerized Projects (railpack/nixpacks)

For projects without a Dockerfile, the Dagger module runs railpack or nixpacks in **generate mode** (produces a Dockerfile without needing a Docker daemon), then Dagger builds from that Dockerfile natively using its own BuildKit. No Docker-in-Docker, no VPS build load.

```
Project has no Dockerfile?
  → railpack generate  (runs in CI, outputs Dockerfile)
  → Dagger builds from generated Dockerfile
  → Image pushed to GHCR
  → VPS: docker pull + run ✅
```

### The "Killer" Selling Point

> *"Dokploy makes your $3/month VPS choke trying to compile your Next.js app. Hylius offloads the build to GitHub's servers for free. Your VPS just downloads the finished image in 5 seconds."*

---

## Phase 3.5 Summary: Multi-Git-Provider Support (GitLab + Bitbucket)

> **Goal**: Extend the platform beyond GitHub so users on GitLab or Bitbucket get the same auto-deploy + offloaded-build experience. Since all three platforms provide free CI compute, the Dagger module is identical — only the thin CI wrapper differs.

### Why This Comes Right After Phase 3

The Dagger architecture makes multi-provider support almost free to add. The `.dagger/src/index.ts` build pipeline is **identical** for all three platforms. The only difference is:
- Which CI YAML wrapper gets generated
- Which container registry the image is pushed to
- How the platform OAuth and webhooks are configured

### Architecture

1. **New OAuth connections** in the dashboard: GitLab OAuth App + Bitbucket OAuth 2.0 (alongside existing GitHub App)
2. **Provider detection**: Project stores `gitProvider` field → routing logic selects the right CI wrapper, registry, and webhook auth
3. **CI wrappers generated per platform** (same Dagger module, different thin YAML):
   - GitHub → `.github/workflows/hylius.yml` → image pushed to GHCR
   - GitLab → `.gitlab-ci.yml` → image pushed to GitLab Container Registry
   - Bitbucket → `bitbucket-pipelines.yml` → image pushed to DockerHub
4. **New services**: `gitlab.service.ts`, `bitbucket.service.ts`, unified `git-provider.service.ts` router
5. **Schema additions**: `gitProvider`, `gitlabProjectId`, `gitlabRepoFullName`, `bitbucketWorkspace`, `bitbucketRepoSlug`, `dockerhubUsername` on `Project`

### Registry Strategy

| Provider | Registry | Auth |
|----------|----------|------|
| GitHub | GHCR (`ghcr.io`) | `GITHUB_TOKEN` — built-in, zero config for user |
| GitLab | GitLab Registry (`registry.gitlab.com`) | `CI_REGISTRY_USER/PASSWORD` — built-in GitLab vars |
| Bitbucket | DockerHub (`docker.io`) | User provides `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` |

> **Future**: A Hylius-managed registry removes the DockerHub dependency for Bitbucket users entirely and gives full control over the registry layer.

### Build Order

1. **GitLab first** — native registry, similar OAuth flow to GitHub App, better free CI tier than Bitbucket
2. **Bitbucket second** — DockerHub as registry requirement initially
3. **Hylius-managed registry later** — when scale justifies owning the registry

---
## Phase 7 Summary: Build Logs + Commit Statuses

> **Goal**: Report deployment status back to GitHub (like Vercel) and provide a deployment detail page with real-time build logs.

### What Users See

1. **On GitHub**: After a push, a commit status check appears — "Hylius — Building..." (pending) → "Hylius — Deployment has completed" (success) with a **Details** link
2. **On Hylius**: Clicking "Details" opens `/deployments/[id]` — a page showing commit info, deploy status, duration, and a **live terminal log viewer**

### Architecture

1. **GitHub Commit Status API** (`POST /repos/{owner}/{repo}/statuses/{sha}`) — post `pending` before deploy, `success`/`failure` after
2. **GitHub Deployments API** — create deployment records with environment info (Production/Preview)
3. **Log Storage** — save build output to `Deployment.logContent` field in DB
4. **SSE Streaming** — `/api/deployments/[id]/logs` endpoint streams live logs during active builds
5. **Deployment Detail Page** — terminal-style UI at `/deployments/[id]` with auto-scroll

---

## Architectural Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Reverse Proxy** | Caddy (not Nginx + Certbot) | Automatic HTTPS, zero config, ~20MB RAM, aligns with agent-less philosophy |
| **Git Integration** | GitHub App (not OAuth) | Fine-grained permissions, webhook support, temp tokens |
| **Build Location** | GitHub Actions (not on VPS) | Free 2,000 min/month, VPS stays idle during builds |
| **Registry** | GHCR (GitHub Container Registry) | Free for public repos, integrated with GitHub Actions |
| **Monitoring** | SSH-based `docker stats` polling | Zero agents, zero footprint, uses existing SSH connection |
