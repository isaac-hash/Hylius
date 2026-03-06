# Privacy Policy

**Hylius Platform**
*Last updated: March 6, 2026*

## Overview

Hylius is a managed hosting platform that deploys your code to your own VPS servers. This policy describes what information we collect, access, and how it is used.

## Data We Collect

### Account Data
- **Email address** and **name** — Used for authentication and account management
- **Organization name** — Used to group users, servers, and projects

### Server Data
- **VPS IP address, port, and username** — Used to connect via SSH for deployments and monitoring
- **SSH keys or passwords** — Encrypted at rest using AES-256-CBC; decrypted only in-memory during operations

### GitHub Data (via GitHub App)
When you install the Hylius GitHub App, we access:

| Permission | Access Level | Purpose |
|------------|-------------|---------|
| **Repository contents** | Read | Clone your code to deploy it to your VPS |
| **Metadata** | Read | List repository names, branches, and languages |

We also receive **push webhook events** to trigger automatic deployments.

We store:
- **GitHub Installation ID** — Links your GitHub account to your Hylius organization
- **GitHub account login** — Displayed in the dashboard for identification
- **Repository full name** — e.g. `user/repo`, used to match push events to projects

### Deployment Data
- **Build logs and deploy history** — Stored for debugging and audit purposes
- **Deploy URLs** — The resulting URLs of your deployments

## Data We Do Not Collect
- We do **not** store your source code on our servers (it is cloned directly to your VPS via SSH)
- We do **not** store GitHub personal access tokens
- We do **not** sell data to third parties
- We do **not** collect analytics or telemetry from your VPS servers

## Security

- SSH credentials are encrypted at rest using **AES-256-CBC** and decrypted only in-memory
- All communication with GitHub uses **HTTPS** and temporary installation access tokens that expire after 1 hour
- Dashboard authentication uses **bcrypt-hashed passwords** and **JWT tokens**
- All API endpoints require authentication

## Data Retention

- Account and project data is retained as long as your account is active
- Deployment logs are retained indefinitely for audit purposes
- Deleting a project removes associated deployment records and domain configurations
- Uninstalling the GitHub App immediately revokes our access to your repositories

## Contact

For privacy questions, reach out at [github.com/isaac-hash/Anvil](https://github.com/isaac-hash/Anvil) or email the Hylius team.
