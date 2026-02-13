This updated document serves as the comprehensive \"Master Plan\" for
**Hylius**. It integrates the newly discussed **Deployment Trinity**
(CLI, GitHub Actions, and Dashboard) and provides a visual architecture
for the user interface.

**Hylius: The \"Bring Your Own Server\" (BYOS) Ecosystem**

**Concept:** The professional developer's alternative to PaaS
(Vercel/Render). Providing a premium deployment and monitoring
experience on the user\'s private hardware.

**1. The Deployment Trinity (Core Architecture)**

Hylius provides three distinct ways to get code from a machine to a VPS,
ensuring it fits any workflow.

  --------------------------------------------------------------------------------
  **Method**      **Interface**   **Mechanism**         **Use Case**
  --------------- --------------- --------------------- --------------------------
  **CLI Deploy**  hylius deploy   Direct SSH from local Rapid prototyping,
                                  machine to VPS.       hotfixes, solo dev work.

  **CI/CD         GitHub Actions  Triggered via Git     Production-grade
  Deploy**                        push; uses GitHub     automation and team
                                  Secrets.              workflows.

  **Dashboard**   Web UI          Centralized control   Visual management,
                                  panel via Webhooks.   monitoring, and
                                                        \"one-click\" deploys.
  --------------------------------------------------------------------------------

**2. Updated Feature Roadmap**

**A. Core Build & Deploy (Current & Planned)**

-   **Atomic Deployment:** Zero-downtime \"Symlink Swapping\" logic.

-   **Environment Agnostic:** Smart detection of process.env.CI to
    switch between interactive and headless modes.

-   **Automated Server Provisioning:** hylius setup-server to install
    Node, PM2, and Nginx on raw Linux boxes.

**B. Monitoring & Observability (\"The Vercel Feel\")**

-   **Live Build Streams:** Real-time terminal output in the browser/CLI
    via WebSockets.

-   **Agent-less Metrics:** Remote execution of Linux commands (df,
    free, top) returned as JSON for dashboard graphs.

-   **App Health Tracking:** Automated HTTP pinging to ensure the site
    is live (200 OK).

-   **Log Management:** Streaming journalctl or PM2 logs directly to the
    user\'s view.

**C. Security & Secrets**

-   **SSH-First:** Prioritizes local SSH Agents and Public Key
    Authentication.

-   **Secure Vault:** Integration with keytar (native OS keychain) for
    local credential storage.

-   **Secret Masking:** Automatically redacting API keys and passwords
    in logs.

**3. The Hylius Dashboard: Visual Wireframe**

To mimic the \"premium\" feel of Vercel/Pxxl, the dashboard is divided
into three main views:

**View 1: Project Overview (The \"Mission Control\")**

-   **Header:** Project Name (e.g., hylius-web-app), Deployment URL, and
    a pulsing \"Live\" status badge.

-   **Deployment List:** A vertical feed of recent deploys showing:

    -   Commit Message (\"Update landing page\")

    -   Branch (main)

    -   Status (Success/Failed/Building)

    -   Timestamp.

-   **Action Button:** A prominent \"Deploy Now\" button to manually
    trigger a build.

**View 2: Real-time Monitoring (The \"Pulse\")**

-   **Visual Graphs:** Clean, minimalist line charts showing:

    -   **CPU Usage:** % load over time.

    -   **RAM Usage:** MB used vs. MB available.

    -   **Traffic:** Status code counts (2xx vs 4xx).

-   **Process Table:** Showing uptime and restart counts for the Node.js
    process.

**View 3: Live Logs (The \"Debugger\")**

-   **Terminal Interface:** An embedded xterm.js window.

-   **Live Stream:** A \"Tail Logs\" toggle that opens a persistent SSH
    pipe to the server.

-   **Search/Filter:** Ability to grep through logs for \"Error\" or
    \"404\" directly from the UI.

**4. Strategic Positioning (USP)**

-   **Vercel Experience, VPS Prices:** Users get the UI/UX of a \$20/mo
    platform on a \$5/mo server.

-   **No Vendor Lock-in:** The code stays on the user\'s server. If they
    stop using Hylius, their app stays running.

-   **Privacy First:** Unlike managed platforms, Hylius (in
    \"Self-Hosted\" mode) never sees the user\'s proprietary data or
    traffic logs.

**5. Technical Stack for Implementation**

-   **CLI:** Node.js, commander, node-ssh, inquirer.

-   **Dashboard:** Next.js (Frontend), Tailwind/Shadcn (UI),
    Prisma/Postgres (Database).

-   **Communication:** Socket.io for log streaming; Webhooks for Git
    integration.

**Next Implementation Step:**

Would you like to start with the **CLI\'s deployment logic** (writing
the SSH directory upload function) or the **Dashboard\'s database
schema** (how to store server/project data)?

To understand where **Hylius** sits in the ecosystem, it\'s best to look
at it as a \"Modern SSH Orchestrator.\"

While **Vercel** is a luxury hotel where you don\'t have to clean your
room (but pay a premium), and **Dokploy** is a DIY apartment complex you
build yourself using Docker, **Hylius** is like a high-tech toolkit that
lets you manage your own private house with the efficiency of a hotel.

**Comparison Table: Hylius vs. The World**

  ------------------------------------------------------------------------------
  **Feature**          **Vercel /       **Dokploy /         **Hylius**
                       Pxxl**           Coolify**           
  -------------------- ---------------- ------------------- --------------------
  **Model**            Managed PaaS     Self-Hosted PaaS    **BYOS (Bring Your
                       (SaaS)                               Own Server)**

  **Pricing**          High             Free (Self-hosted)  **Free (Tool) +
                       (Usage-based)                        Cheap VPS**

  **Infrastructure**   Proprietary      Docker-centric      **SSH-centric
                       Cloud            (Containers)        (Native or Docker)**

  **Setup Level**      Zero             Moderate (Install   **Low (CLI / Push to
                       (Auto-magic)     Panel)              Deploy)**

  **Resource Usage**   N/A              High (\~1GB RAM for **Minimal
                                        Panel)              (Agent-less SSH)**

  **Control**          Locked           Full                **Absolute Root
                                                            Access**
  ------------------------------------------------------------------------------

**1. The Giants: Vercel, Render, Pxxl**

These are **Managed Platforms**. They are incredible for speed but
\"trap\" you in their ecosystem.

-   **Why they win:** They handle everything (SSL, CDN, DDoS protection,
    DBs) with zero configuration.

-   **The \"Hylius\" Angle:** Hylius aims to give the *feeling* of these
    platforms (the dashboard, the logs, the ease) without the \"Vercel
    Tax.\" You aren\'t paying for the platform; you\'re just using the
    tool.

**2. The Self-Hosted Heavies: Dokploy & Coolify**

**Dokploy** and **Coolify** have become the gold standard for
self-hosting in 2025/2026. They essentially turn your VPS into a private
Vercel.

-   **The Catch:** These tools are **heavy**. You have to install a
    massive dashboard (a \"panel\") on your server before you even
    deploy your first app. On a tiny \$5/mo server with 1GB of RAM,
    Dokploy/Coolify can sometimes take up 40% of your resources just to
    keep the dashboard running.

-   **The \"Hylius\" Angle:** Hylius is **lightweight**. Because it uses
    SSH, it doesn\'t *need* a heavy agent running on your server 24/7.
    Hylius \"reaches in\" from the outside (CLI or GitHub Actions). This
    makes it perfect for developers who want to squeeze every drop of
    performance out of a cheap VPS.

**3. The Minimalists: Dokku & Kamal**

-   **Dokku:** A \"mini-Heroku\" for your server. It\'s very powerful
    but is primarily CLI-only and has a steep learning curve for
    beginners.

-   **Kamal:** Built by the Basecamp/37signals team. It's a CLI-first
    tool that uses Docker. It's great but lacks a native \"Vercel-like\"
    dashboard for monitoring.

-   **The \"Hylius\" Angle:** You are building the **Trinity** (CLI +
    GitHub Actions + Dashboard). Most minimalists skip the Dashboard,
    and most Dashboard tools skip the CLI workflow. Hylius bridges both.

**Where Hylius Wins (Your Unique Selling Point)**

1.  **Native over Docker (Optional):** Most competitors *force* you to
    use Docker. Hylius can deploy \"Bare Metal\" (straight to the OS),
    which is faster and uses less RAM for small apps.

2.  **The \"Trinity\" Workflow:** \* **Devs** love the CLI (hylius
    deploy).

    -   **Teams** love the GitHub Action.

    -   **Clients/Managers** love the Dashboard.

3.  **No \"Phone Home\":** In its most secure mode, Hylius is just a
    bridge. Your data doesn\'t have to sit on Hylius\'s database---it
    stays on your server and your local machine.

**The Verdict: Who is Hylius for?**

Hylius is for the **\"Pragmatic Developer.\"** \* You\'re too big for
Vercel\'s free tier.

-   You\'re too small to need a massive Dokploy/Kubernetes cluster.

-   You just want to push code to a \$5 VPS and see your logs in a
    pretty dashboard.

**Would you like me to focus the next part of the roadmap on the
\"Agent-less\" monitoring, which would be your biggest technical
advantage over Dokploy?**
