---
description: Start a local mock VPS container for Hylius testing
---
To test Hylius `setup` and `deploy` commands locally without a real VPS, follow these steps:

1. **Start the Mock Server**:
   Run this command in a terminal to create a fresh Alpine Linux container with SSH root access:
   ```powershell
   docker run -d --name mock-vps -p 2222:22 alpine sh -c "apk add --no-cache openssh-server && ssh-keygen -A && echo 'root:password' | chpasswd && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && /usr/sbin/sshd -D"
   ```

2. **Test Provisioning (`setup`)**:
   Run `npm run dev -- setup` and use these credentials:
   - **Host**: `127.0.0.1`
   - **User**: `root`
   - **Port**: `2222`
   - **Auth**: `Password`
   - **Password**: `password`

3. **Test Deployment (`deploy`)**:
   Run `npm run dev -- deploy` and use the same credentials. Hylius will automatically detect your project and deploy it as a container.

4. **Verify**:
   Check if files were uploaded:
   ```powershell
   docker exec mock-vps ls -R /var/www/hylius-test
   ```

5. **Stop & Remove**:
   ```powershell
   docker rm -f mock-vps
   ```
