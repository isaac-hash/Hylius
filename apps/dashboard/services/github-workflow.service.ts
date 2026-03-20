import { getInstallationOctokit } from './github.service';

// ─── Dagger Template Helpers ─────────────────────────────────────────────────

const getDaggerWorkflowYaml = (branch: string) => `name: Hylius Dagger CI

on:
  push:
    branches: [${branch}]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Build & push image via Dagger
        uses: dagger/dagger-for-github@v7
        with:
          verb: call
          args: build-and-push --source=. --registry=ghcr.io --image=ghcr.io/\${{ github.repository }} --tag=\${{ github.sha }} --webhook-url=\${{ secrets.HYLIUS_WEBHOOK_URL }} --webhook-token=\${{ secrets.HYLIUS_API_TOKEN }} --repo=\${{ github.repository }} --sha=\${{ github.sha }} --ref=\${{ github.ref }}
          module: .dagger
        env:
          DAGGER_CLOUD_TOKEN: \${{ secrets.DAGGER_CLOUD_TOKEN }}
          _EXPERIMENTAL_DAGGER_RUNNER_HOST: \${{ secrets.DAGGER_RUNNER_HOST }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

const getDaggerModuleJson = () => JSON.stringify({
  name: 'hylius-pipeline',
  sdk: 'typescript',
  engineVersion: '0.15.0',
}, null, 2);

const getDaggerPackageJson = () => JSON.stringify({
  name: 'hylius-pipeline',
  description: 'Hylius CI/CD pipeline powered by Dagger',
  version: '1.0.0',
  main: 'src/index.ts',
  scripts: {},
  dependencies: {
    '@dagger.io/dagger': '^0.15.0',
  },
}, null, 2);

const getDaggerTsConfig = () => JSON.stringify({
  compilerOptions: {
    target: 'ES2020',
    module: 'Node16',
    moduleResolution: 'Node16',
    esModuleInterop: true,
    strict: true,
    outDir: 'dist',
    skipLibCheck: true,
  },
  include: ['src/**/*'],
}, null, 2);

const getDaggerPipelineTs = () => `import {
  dag,
  Container,
  Directory,
  Secret,
  object,
  func,
  argument,
} from "@dagger.io/dagger";

@object()
export class HyliusPipeline {
  /**
   * Build a Docker image and push it to a container registry,
   * then notify the Hylius dashboard to trigger a VPS deployment.
   */
  @func()
  async buildAndPush(
    /** Source code directory */
    source: Directory,
    /** Registry hostname (e.g. ghcr.io) */
    registry: string,
    /** Full image name without tag (e.g. ghcr.io/owner/repo) */
    image: string,
    /** Image tag (e.g. git SHA) */
    tag: string,
    /** Hylius dashboard webhook URL */
    webhookUrl: string,
    /** Hylius API token */
    webhookToken: string,
    /** GitHub repo full name (e.g. owner/repo) */
    repo: string,
    /** Git commit SHA */
    sha: string,
    /** Git ref (e.g. refs/heads/main) */
    ref: string,
  ): Promise<string> {
    const imageFull = \`\${image.toLowerCase()}:\${tag}\`;

    // Build the image
    const built = await this.buildImage(source, imageFull);

    // Push to registry
    const digest = await built.publish(imageFull);

    // Notify Hylius dashboard to trigger VPS pull
    await this.notifyHylius({ webhookUrl, webhookToken, image: imageFull, sha, repo, ref });

    return \`Published \${imageFull} @ \${digest}\`;
  }

  /** Detect project type and build a Docker image. */
  private async buildImage(source: Directory, imageTag: string): Promise<Container> {
    const entries = await source.entries();

    if (entries.includes("Dockerfile")) {
      // Native Docker build
      return dag.container().build(source);
    }

    // No Dockerfile — generate one with Railpack, then build
    const withDockerfile = await dag
      .container()
      .from("node:20-alpine")
      // Install Railpack
      .withExec(["sh", "-c", "curl -sSL https://railpack.com/install.sh | sh"])
      .withMountedDirectory("/app", source)
      .withWorkdir("/app")
      // Generate Dockerfile without needing a Docker daemon
      .withExec(["railpack", "generate"])
      .directory("/app");

    return dag.container().build(withDockerfile);
  }

  /** Call the Hylius webhook to trigger a VPS deployment. */
  private async notifyHylius(opts: {
    webhookUrl: string;
    webhookToken: string;
    image: string;
    sha: string;
    repo: string;
    ref: string;
  }): Promise<void> {
    const payload = JSON.stringify({
      image: opts.image,
      sha: opts.sha,
      repo: opts.repo,
      ref: opts.ref,
    });

    await dag
      .container()
      .from("curlimages/curl:latest")
      .withExec([
        "curl", "-fsSL",
        "-X", "POST", opts.webhookUrl,
        "-H", "Content-Type: application/json",
        "-H", \`Authorization: Bearer \${opts.webhookToken}\`,
        "-d", payload,
      ])
      .sync();
  }
}
`;

// ─── Legacy Raw-YAML Templates (kept for backward compat) ────────────────────

const getLegacyWorkflowYaml = (branch: string) => `name: Hylius Build & Deploy via GHCR

on:
  push:
    branches: [${branch}]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - name: Start BuildKit
        run: |
          docker run -d --name buildkitd --privileged moby/buildkit:latest
          echo "BUILDKIT_HOST=docker-container://buildkitd" >> $GITHUB_ENV
      - name: Setup Railpack (if needed)
        run: |
          if [ ! -f "Dockerfile" ]; then
            echo "No Dockerfile found. Installing Railpack..."
            curl -sSL https://railpack.com/install.sh | bash
          fi
      - name: Build and push image
        run: |
          REPO_LOWER=$(echo "\${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          IMAGE="ghcr.io/$REPO_LOWER:\${{ github.sha }}"
          
          if [ -f "Dockerfile" ]; then
            echo "Dockerfile found! Building with native Docker..."
            docker build -t $IMAGE .
          else
            echo "Building with Railpack..."
            railpack build . --name $IMAGE
          fi
          
          docker push $IMAGE
      - name: Notify Hylius
        run: |
          REPO_LOWER=$(echo "\${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          curl -X POST "\$HYLIUS_WEBHOOK" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer \$HYLIUS_TOKEN" \\
            -d "{\\"image\\":\\"ghcr.io/$REPO_LOWER:\${{ github.sha }}\\",\\"sha\\":\\"\${{ github.sha }}\\",\\"repo\\":\\"\${{ github.repository }}\\",\\"ref\\":\\"\${{ github.ref }}\\"}"
        env:
          HYLIUS_WEBHOOK: \${{ secrets.HYLIUS_WEBHOOK_URL }}
          HYLIUS_TOKEN: \${{ secrets.HYLIUS_API_TOKEN }}
`;

// ─── Dagger PR provisioning ───────────────────────────────────────────────────

/**
 * Auto-provision a Dagger CI pipeline by opening a Pull Request on the user's repo.
 * Returns the PR URL so the dashboard can show it to the user.
 *
 * Files committed (on branch `hylius/setup-dagger-ci`):
 *   .github/workflows/hylius-dagger.yml
 *   .dagger/dagger.json
 *   .dagger/src/index.ts
 *   .dagger/tsconfig.json
 *   .dagger/package.json
 */
export async function autoProvisionDaggerWorkflow(
  installationId: number,
  repoFullName: string,  // e.g. "isaac-hash/my-app"
  branch: string = 'main',
): Promise<{ prUrl: string; prNumber: number } | null> {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoFullName.split('/');
  const prBranch = 'hylius/setup-dagger-ci';

  try {
    // 1. Get the current HEAD SHA of the target branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const baseSha = refData.object.sha;

    // 2. Create or reset the PR branch
    try {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${prBranch}`,
        sha: baseSha,
      });
    } catch (e: any) {
      // Branch already exists — update it to point at current base HEAD
      if (e.status === 422) {
        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${prBranch}`,
          sha: baseSha,
          force: true,
        });
      } else {
        throw e;
      }
    }

    // 3. Create a git tree with all 5 files atomically
    const files = [
      {
        path: '.github/workflows/hylius-dagger.yml',
        content: getDaggerWorkflowYaml(branch),
      },
      {
        path: '.dagger/dagger.json',
        content: getDaggerModuleJson(),
      },
      {
        path: '.dagger/src/index.ts',
        content: getDaggerPipelineTs(),
      },
      {
        path: '.dagger/tsconfig.json',
        content: getDaggerTsConfig(),
      },
      {
        path: '.dagger/package.json',
        content: getDaggerPackageJson(),
      },
    ];

    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseSha,
      tree: files.map((f) => ({
        path: f.path,
        mode: '100644' as const,
        type: 'blob' as const,
        content: f.content,
      })),
    });

    // 4. Create the commit
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo,
      message: 'ci: add Hylius Dagger build pipeline\n\nThis PR adds a Dagger-powered CI/CD pipeline that:\n- Builds your Docker image on GitHub Actions (not on your VPS)\n- Pushes the image to GHCR\n- Notifies your Hylius dashboard to trigger a zero-CPU-spike pull & deploy on your VPS\n\nSee https://dagger.io for more info on the build engine.',
      tree: tree.sha,
      parents: [baseSha],
    });

    // 5. Update PR branch to point at new commit
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${prBranch}`,
      sha: commit.sha,
    });

    // 6. Open (or find existing) Pull Request
    const existingPRs = await octokit.pulls.list({
      owner,
      repo,
      head: `${owner}:${prBranch}`,
      state: 'open',
    });

    let prUrl: string;
    let prNumber: number;

    if (existingPRs.data.length > 0) {
      prUrl = existingPRs.data[0].html_url;
      prNumber = existingPRs.data[0].number;
    } else {
      const { data: pr } = await octokit.pulls.create({
        owner,
        repo,
        title: 'ci: add Hylius Dagger build pipeline',
        body: `## Hylius Dagger CI Pipeline 🚀\n\nThis PR sets up your CI/CD pipeline powered by [Dagger](https://dagger.io).\n\n### What this adds\n\n| File | Purpose |\n|------|---------|\n| \`.github/workflows/hylius-dagger.yml\` | GitHub Actions wrapper (calls Dagger) |\n| \`.dagger/src/index.ts\` | Build pipeline logic in TypeScript |\n| \`.dagger/dagger.json\` | Dagger module config |\n\n### How it works\n1. You push code → GitHub Actions triggers\n2. Dagger builds your Docker image (auto-detects Dockerfile or uses Railpack)\n3. Image is pushed to GHCR\n4. Hylius notifies your VPS to pull the image — zero build load on your server\n\n### Required secrets\nBefore merging, make sure you have added these to your repo secrets:\n- \`HYLIUS_WEBHOOK_URL\`\n- \`HYLIUS_API_TOKEN\`\n\n### Merge when ready\nOnce you merge this PR, every push to \`${branch}\` will automatically build and deploy. ✅`,
        head: prBranch,
        base: branch,
      });
      prUrl = pr.html_url;
      prNumber = pr.number;
    }

    console.log(`[Dagger Workflow] PR opened: ${prUrl}`);
    return { prUrl, prNumber };

  } catch (error: any) {
    console.error(`[Dagger Workflow] Failed to provision for ${repoFullName}:`, error);
    return null;
  }
}

// ─── Legacy provisioning functions (backward compat) ─────────────────────────

export async function autoProvisionWorkflow(
  installationId: number,
  repoFullName: string,
  branch: string = 'main',
): Promise<boolean> {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoFullName.split('/');
  const path = '.github/workflows/hylius-ghcr.yml';

  try {
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      if (data && !Array.isArray(data) && 'sha' in data) {
        sha = data.sha;
      }
    } catch (e: any) {
      if (e.status !== 404) {
        console.warn(`[GitHub Workflow] Could not check existing file: ${e.message}`);
      }
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `ci: add Hylius GHCR build workflow for ${branch}`,
      content: Buffer.from(getLegacyWorkflowYaml(branch)).toString('base64'),
      branch,
      sha,
    });

    console.log(`[GitHub Workflow] Successfully provisioned workflow for ${repoFullName}`);
    return true;

  } catch (error: any) {
    console.error(`[GitHub Workflow] Failed to provision workflow for ${repoFullName}:`, error);
    return false;
  }
}

const getComposeWorkflowYaml = (branch: string) => `name: Hylius Docker Compose CI

on:
  push:
    branches: [${branch}]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - name: Build and push Compose services
        run: |
          export REGISTRY_IMAGE=$(echo "ghcr.io/\${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          export TAG=\${{ github.sha }}
          
          # Check for docker-compose.yml or compose.yaml
          COMPOSE_FILE="docker-compose.yml"
          if [ -f "compose.yaml" ]; then
            COMPOSE_FILE="compose.yaml"
          fi
          
          docker compose -f $COMPOSE_FILE build
          docker compose -f $COMPOSE_FILE push
      - name: Notify Hylius
        run: |
          REPO_LOWER=$(echo "\${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          curl -X POST "\$HYLIUS_WEBHOOK" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer \$HYLIUS_TOKEN" \\
            -d "{\\"sha\\":\\"\${{ github.sha }}\\",\\"repo\\":\\"\${{ github.repository }}\\",\\"ref\\":\\"\${{ github.ref }}\\",\\"compose\\":true}"
        env:
          HYLIUS_WEBHOOK: \${{ secrets.HYLIUS_WEBHOOK_URL }}
          HYLIUS_TOKEN: \${{ secrets.HYLIUS_API_TOKEN }}
`;

export async function autoProvisionComposeWorkflow(
  installationId: number,
  repoFullName: string,
  branch: string = 'main',
): Promise<boolean> {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoFullName.split('/');
  const path = '.github/workflows/hylius-compose.yml';

  try {
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      if (data && !Array.isArray(data) && 'sha' in data) {
        sha = data.sha;
      }
    } catch (e: any) {
      if (e.status !== 404) {
        console.warn(`[GitHub Workflow] Could not check existing file: ${e.message}`);
      }
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `ci: add Hylius Compose build workflow for ${branch}`,
      content: Buffer.from(getComposeWorkflowYaml(branch)).toString('base64'),
      branch,
      sha,
    });

    console.log(`[GitHub Workflow] Successfully provisioned compose workflow for ${repoFullName}`);
    return true;

  } catch (error: any) {
    console.error(`[GitHub Workflow] Failed to provision compose workflow for ${repoFullName}:`, error);
    return false;
  }
}
