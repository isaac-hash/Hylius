# Implementation Plan - Local Folder Deployment Support

Enable users to deploy code directly from their local system to a VPS (via SFTP bundling) or from a remote Git repository (via `git clone`), providing flexibility for different development workflows.

## User Review Required

> [!IMPORTANT]
> **Docker in Mock VPS**: To enable "live" Docker deployments inside the mock VPS, the container must be started with the host's Docker socket mounted (`-v /var/run/docker.sock:/var/run/docker.sock`) and in `--privileged` mode. This allows the CLI to interact with a working Docker daemon on the server.

> [!NOTE]
> `hylius setup` has been updated to automatically attempt to start the Docker service after installation on Alpine, Ubuntu, and Debian.

> [!TIP]
> **Dual Support**: This implementation is fully backward compatible. If you provide a Git URL (e.g., `https://github.com/...`), Hylius will use the original `git clone` deployment flow. If you provide a local path (e.g., `.`), it will use the new "push-and-bundle" flow.

## Proposed Changes

### Core Package

#### [MODIFY] [ssh/client.ts](file:///c:/Users/HP/Documents/Anvil/packages/core/src/ssh/client.ts)
- Add an [uploadFile](file:///c:/Users/HP/Documents/Anvil/packages/core/src/ssh/client.ts#80-91) method using SFTP from the `ssh2` library.

#### [MODIFY] [deploy.ts](file:///c:/Users/HP/Documents/Anvil/packages/core/src/deploy.ts)
- Add logic to handle cases where `project.repoUrl` is flagged as a local path or where a local source is provided.
- If it's a local deployment, skip `git clone` and instead expect a bundle to be uploaded and extracted.

### CLI Package

#### [MODIFY] [commands/deploy.ts](file:///c:/Users/HP/Documents/Anvil/packages/cli/src/commands/deploy.ts)
- Detect if the provided `repoUrl` is a local directory (e.g., starts with `./`, `/`, or is `.`).
- If local, bundle the directory (excluding `node_modules`, `.git`, etc.) as a tarball.
- Upload and use the tarball for deployment on the VPS.

## Verification Plan

### Manual Verification - Two-Stage Testing

#### Phase A: Testing the Setup (Install logic)
Goal: Verify that `hylius setup` correctly installs Docker and starts services on a fresh, realistic Linux environment.
1.  **Start Systemd-enabled Mock VPS**:
    ```powershell
    docker rm -f vps-setup-test
    docker run -d --name vps-setup-test --privileged -p 4444:22 jrei/systemd-ubuntu
    # Install SSH inside the container as it's not present by default
    docker exec vps-setup-test bash -c "apt-get update && apt-get install -y openssh-server && echo 'root:password' | chpasswd && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && service ssh start"
    ```
2.  **Run `hylius setup`**:
    ```powershell
    npm run dev -- setup
    ```
    (Host: `127.0.0.1`, Port: `4444`, Password: `password`)
    Verify that it successfully installs Docker and uses `systemctl` to start the service.

#### Phase B: Testing the Deployment (Docker Run logic)
Goal: Verify the local bundling, upload, and container start flow.
1.  **Start Socket-Mounted Mock VPS**:
    ```powershell
    docker rm -f vps-deploy-test
    docker run -d --privileged --name vps-deploy-test -p 3333:22 -v /var/run/docker.sock:/var/run/docker.sock alpine sh -c "apk add --no-cache openssh-server && ssh-keygen -A && echo 'root:password' | chpasswd && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && /usr/sbin/sshd -D"
    ```
2.  **Run `hylius deploy`**:
    ```powershell
    npm run dev -- deploy
    ```
    (Choose `.` for repo, and use port `3333`)
    Verify that the deployment is successful and "live" on the mock server.
