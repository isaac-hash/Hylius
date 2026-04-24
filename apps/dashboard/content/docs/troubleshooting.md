# Troubleshooting & Common Issues

Answers to the most common problems when using the Hylius CLI and platform.

---

## Deployment Failures

### App is unreachable after a successful deploy

Your container started and the deploy succeeded, but `curl http://YOUR_VPS_IP` times out or returns a connection refused error.

**Cause 1 — App is binding to `127.0.0.1` instead of `0.0.0.0`**

Docker port mapping only works when your app listens on all network interfaces (`0.0.0.0`). If your app binds to `localhost`/`127.0.0.1`, traffic from outside the container can't reach it.

Fix it in your code before deploying:

```python
# FastAPI / Uvicorn
uvicorn.run(app, host="0.0.0.0", port=8000)  # ✅ Correct
uvicorn.run(app, host="127.0.0.1", port=8000) # ❌ Wrong — unreachable
```

```js
// Express
app.listen(3000, '0.0.0.0');  // ✅ Correct
app.listen(3000);              // ✅ Also fine — Node defaults to 0.0.0.0
```

**Cause 2 — Firewall blocking your app's port**

UFW only opens ports 22, 80, and 443 by default. If your app runs on a custom port (e.g., 3000, 8000, 8080), you must open it manually:

```bash
ssh root@YOUR_VPS_IP
ufw allow 3000/tcp
ufw reload
```

**Cause 3 — Container exited immediately**

SSH into your VPS and check the container logs:

```bash
ssh root@YOUR_VPS_IP
docker ps -a                        # Find your container name/ID
docker logs <container-name>        # View startup errors
```

---

### `pdo_pgsql` driver not found (Laravel + PostgreSQL)

```
SQLSTATE[HY000] [2002] Connection refused — could not find driver
```

Laravel projects only ship with the MySQL/SQLite drivers by default. Tell Railpack/Nixpacks to install the Postgres extension by adding it to `composer.json`:

```bash
composer require ext-pdo_pgsql
```

Or manually add it to `composer.json`:

```json
"require": {
    "php": "^8.2",
    "ext-pdo_pgsql": "*"
}
```

Commit and push (or click **Redeploy** in the Hylius dashboard). The builder will pick up the new requirement and install the extension.

---

### Build fails with "Railpack installation failed"

This is **non-critical**. If Railpack fails to install during `hylius setup`, Hylius will fall back to Dockerfile-based builds for any project that has a `Dockerfile`.

To manually install Railpack on your VPS:

```bash
curl -fsSL https://railpack.com/install.sh | bash
```

If your project has no `Dockerfile`, add one. See [Deployment Guide → Deployment Strategies](./deploying.md#deployment-strategies).

---

### `tar: not found` on Windows

When running `hylius deploy` with a local source path (`./`), Hylius uses `tar` to bundle your project. Windows ships with `tar.exe` since Windows 10 build 1803.

If you see this error, ensure `tar` is in your `PATH`:

```powershell
where tar
# Should output: C:\Windows\System32\tar.exe
```

If not available, install [Git for Windows](https://git-scm.com/) which includes `tar`, or use WSL.

---

## SSH & Connection Issues

### `ECONNREFUSED` or `ssh: connect to host ... port 22: Connection refused`

- Confirm your VPS IP is correct
- Confirm the SSH port (default is 22; some providers use a custom port)
- Confirm port 22 is open in your cloud provider's firewall (not just UFW)

Many cloud providers have a **separate network-level firewall** (e.g., DigitalOcean Firewalls, Hetzner Cloud Firewall, AWS Security Groups) that is independent of UFW. Make sure port 22 is open there too.

---

### Authentication Fails — `All configured authentication methods failed`

If you chose **SSH Key** auth, verify:

1. Your public key is in `~/.ssh/authorized_keys` on the VPS:
   ```bash
   cat ~/.ssh/authorized_keys
   ```
2. The permissions on that file are correct:
   ```bash
   chmod 600 ~/.ssh/authorized_keys
   chmod 700 ~/.ssh
   ```
3. The key you're providing to `hylius` matches what's on the server

To add your key to a new VPS:
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub root@YOUR_VPS_IP
```

---

### `HYLIUS_SSH_KEY` multi-line format in GitHub Secrets

GitHub Secrets do not support raw newlines in the UI input box. When setting `HYLIUS_SSH_KEY`, paste the **entire** key content including header/footer lines:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAA...
...AAAB
-----END OPENSSH PRIVATE KEY-----
```

GitHub will preserve the newlines internally when the secret is injected into your workflow's environment.

---

## CI/CD Issues

### GitHub Actions workflow runs but deploy step fails silently

Check that all required secrets are set. Missing secrets appear as **empty strings**, not errors. Required:
- `HYLIUS_HOST`
- `HYLIUS_USER`
- `HYLIUS_SSH_KEY` (or `HYLIUS_PASSWORD`)
- `HYLIUS_TARGET_PATH`
- `HYLIUS_REPO_URL`

Navigate to **Repository → Settings → Secrets and variables → Actions** to verify.

---

### Dagger pipeline returns 403 Forbidden after deploy

If your app is a static frontend (Vite, Next.js static export) built with the Railpack fallback path, Nginx may return 403 because it can't find the `index.html` in the expected location.

Consult the [Railpack docs](https://railpack.com/) on how to configure the static output directory for your framework, or add a `Dockerfile` that correctly copies your build output to the right path.

---

### Preview deployments not working (Dagger pipeline)

Ensure `HYLIUS_WEBHOOK_URL` and `HYLIUS_API_TOKEN` are set as repository secrets. Preview deployments require the Hylius dashboard to be running and reachable from GitHub Actions.

The dashboard's webhook must be at a publicly accessible URL (not `localhost`). If you're running the dashboard locally for testing, use [ngrok](https://ngrok.com/) to expose it.

---

## Environment Variable Issues

### App can't read my `.env` file after deploy

Hylius CLI does not manage `.env` files. You need to create your `.env` on the VPS manually:

```bash
ssh root@YOUR_VPS_IP
nano /var/www/my-app/.env
# Paste your env vars, save and exit
```

Make sure your `compose.yaml` references it:

```yaml
services:
  app:
    env_file:
      - .env
```

If you use the **Hylius Dashboard**, env vars are managed through the web UI and injected into your build at CI time — you don't need a manual `.env` file.

---

## Getting More Help

- Check the [GitHub repository](https://github.com/isaac-hash/hylius) for open issues
- Review your container logs: `docker logs <container-name>`
- Review the Hylius dashboard deployment logs under **Projects → Deployments**
