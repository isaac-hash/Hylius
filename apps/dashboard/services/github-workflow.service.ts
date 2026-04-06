import { getInstallationOctokit } from './github.service';

const getWorkflowYaml = (branch: string) => `name: Hylius Build & Deploy via GHCR

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
      - name: Build and push image
        run: |
          REPO_LOWER=$(echo "\${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          IMAGE="ghcr.io/$REPO_LOWER:\${{ github.sha }}"
          
          if [ -f "Dockerfile" ]; then
            echo "Dockerfile found! Building with native Docker..."
            docker build -t $IMAGE .
          else
            echo "No Dockerfile found. Installing Railpack..."
            curl -sSL https://railpack.com/install.sh | bash
            
            # Fetch Build Env variables from Hylius Dashboard
            HYLIUS_BASE_URL=$(echo "\${{ secrets.HYLIUS_WEBHOOK_URL }}" | sed 's|/api/webhooks/deploy-complete||')
            curl -s -H "Authorization: Bearer \${{ secrets.HYLIUS_API_TOKEN }}" "$HYLIUS_BASE_URL/api/webhooks/env?repo=\${{ github.repository }}" > .hylius.env
            
            export $(grep -v '^#' .hylius.env | xargs)
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

export async function autoProvisionWorkflow(
  installationId: number,
  repoFullName: string, // e.g., "isaac-hash/my-app"
  branch: string = 'main'
): Promise<boolean> {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoFullName.split('/');
  const path = '.github/workflows/hylius-ghcr.yml';

  try {
    // 1. Check if the file already exists to get its SHA (required for updating)
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
      // 404 means the file doesn't exist yet, which is fine
      if (e.status !== 404) {
        console.warn(`[GitHub Workflow] Could not check existing file: ${e.message}`);
      }
    }

    // 2. Create or update the file
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `ci: add Hylius GHCR build workflow for ${branch}`,
      content: Buffer.from(getWorkflowYaml(branch)).toString('base64'),
      branch,
      sha, // If it exists, we must provide the sha to overwrite it
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
  branch: string = 'main'
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

// ─── Dagger workflow & module file templates ─────────────────────────────────

const getDaggerWorkflowYaml = (branch: string) => `name: Hylius Dagger CI

on:
  push:
    branches: [${branch}]
  pull_request:
    branches: [${branch}]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        run: echo "\${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u \${{ github.actor }} --password-stdin

      - name: Fetch Build Env from Hylius Dashboard
        id: fetch-env
        run: |
          if [ -n "\${{ secrets.HYLIUS_WEBHOOK_URL }}" ]; then
            HYLIUS_BASE_URL=$(echo "\${{ secrets.HYLIUS_WEBHOOK_URL }}" | sed 's|/api/webhooks/deploy-complete||')
            curl -s -f -H "Authorization: Bearer \${{ secrets.HYLIUS_API_TOKEN }}" \\
              "$HYLIUS_BASE_URL/api/webhooks/env?repo=\${{ github.repository }}" > .hylius.env || true
          fi
          if [ -s .hylius.env ]; then
            grep -v '^#' .hylius.env | awk 'NF' >> \$GITHUB_ENV
          fi

      # Path A: Dockerfile exists → build & push via Dagger
      - name: Build & push via Dagger (Dockerfile found)
        if: hashFiles('Dockerfile') != ''
        uses: dagger/dagger-for-github@v7
        with:
          verb: call
          args: build-and-push --source=. --registry=ghcr.io --image=ghcr.io/\${{ github.repository }} --tag=\${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.sha }} --webhook-url=\${{ secrets.HYLIUS_WEBHOOK_URL }} --webhook-token=\${{ secrets.HYLIUS_API_TOKEN }} --repo=\${{ github.repository }} --sha=\${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }} --ref=\${{ github.ref }} --pr-number="\${{ github.event.pull_request.number }}" --github-token=env:GITHUB_TOKEN
          module: .dagger
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

      # Path B: No Dockerfile → build with Railpack
      - name: Set up Docker Buildx
        if: hashFiles('Dockerfile') == ''
        uses: docker/setup-buildx-action@v3

      - name: Build & push image with Railpack (no Dockerfile)
        if: hashFiles('Dockerfile') == ''
        run: |
          curl -sSL https://railpack.com/install.sh | bash
          IMAGE_TAG=\${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.sha }}
          IMAGE_FULL="ghcr.io/\${{ github.repository }}:$IMAGE_TAG"
          IMAGE_FULL=$(echo "$IMAGE_FULL" | tr '[:upper:]' '[:lower:]')
          railpack prepare --plan-out /tmp/railpack-plan.json .
          docker buildx build --build-arg BUILDKIT_SYNTAX=ghcr.io/railwayapp/railpack-frontend -f /tmp/railpack-plan.json --tag "$IMAGE_FULL" --push .
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

      - name: Notify Hylius Dashboard
        if: hashFiles('Dockerfile') == ''
        run: |
          IMAGE_TAG=\${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.pull_request.number) || github.sha }}
          IMAGE_FULL="ghcr.io/\${{ github.repository }}:$IMAGE_TAG"
          IMAGE_FULL=$(echo "$IMAGE_FULL" | tr '[:upper:]' '[:lower:]')
          SHA_VAL=\${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
          curl -fsSL -X POST "\${{ secrets.HYLIUS_WEBHOOK_URL }}" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer \${{ secrets.HYLIUS_API_TOKEN }}" \\
            -H "ngrok-skip-browser-warning: 69420" \\
            -d "{\\"image\\": \\"$IMAGE_FULL\\", \\"sha\\": \\"$SHA_VAL\\", \\"repo\\": \\"\${{ github.repository }}\\", \\"ref\\": \\"\${{ github.ref }}\\", \\"prNumber\\": \\"\${{ github.event.pull_request.number }}\\"}"
`;

const DAGGER_MODULE_JSON = JSON.stringify({ name: 'hylius-pipeline', sdk: 'typescript', engineVersion: '0.15.4' }, null, 2);

const DAGGER_PACKAGE_JSON = JSON.stringify({
  name: 'hylius-pipeline',
  description: 'Hylius CI/CD pipeline powered by Dagger',
  version: '1.0.0',
  main: 'src/index.ts',
  scripts: {},
  dependencies: { '@dagger.io/dagger': '^0.15.4' },
}, null, 2);

const DAGGER_TSCONFIG = JSON.stringify({
  compilerOptions: { target: 'ES2020', module: 'Node16', moduleResolution: 'Node16', esModuleInterop: true, strict: true, outDir: 'dist', skipLibCheck: true },
  include: ['src/**/*'],
}, null, 2);

const DAGGER_PIPELINE_TS = `import { dag, Directory, Secret, object, func } from "@dagger.io/dagger";

@object()
export class HyliusPipeline {
  @func()
  async buildAndPush(
    source: Directory,
    registry: string,
    image: string,
    tag: string,
    webhookUrl: string,
    webhookToken: string,
    repo: string,
    sha: string,
    ref: string,
    prNumber: string,
    githubToken: Secret,
  ): Promise<string> {
    const imageFull = \`\${image.toLowerCase()}:\${tag}\`;
    const built = dag.container().build(source).withRegistryAuth("ghcr.io", "github-actions", githubToken);
    const digest = await built.publish(imageFull);
    await this.notifyHylius({ webhookUrl, webhookToken, image: imageFull, sha, repo, ref, prNumber });
    return \`Published \${imageFull} @ \${digest}\`;
  }

  private async notifyHylius(opts: { webhookUrl: string; webhookToken: string; image: string; sha: string; repo: string; ref: string; prNumber: string }): Promise<void> {
    await dag.container().from("curlimages/curl:latest").withExec([
      "curl", "-fsSL", "-X", "POST", opts.webhookUrl,
      "-H", "Content-Type: application/json",
      "-H", \`Authorization: Bearer \${opts.webhookToken}\`,
      "-d", JSON.stringify({ image: opts.image, sha: opts.sha, repo: opts.repo, ref: opts.ref, prNumber: opts.prNumber }),
    ]).sync();
  }
}
`;

// ─── autoProvisionDaggerWorkflow ─────────────────────────────────────────────

/**
 * Creates a PR on the user's repo that adds all Dagger CI/CD files:
 *  - .github/workflows/hylius-dagger.yml
 *  - .dagger/dagger.json
 *  - .dagger/src/index.ts
 *  - .dagger/tsconfig.json
 *  - .dagger/package.json
 *
 * Opens the PR from `hylius/dagger-ci` → target branch so the user can review/merge it.
 */
export async function autoProvisionDaggerWorkflow(
    installationId: number,
    repoFullName: string,
    branch: string = 'main'
): Promise<{ prUrl: string } | null> {
    console.log(`[GitHub Workflow] Provisioning Dagger CI for ${repoFullName} (branch: ${branch})`);
    const octokit = await getInstallationOctokit(installationId);
    const [owner, repo] = repoFullName.split('/');
    const newBranch = 'hylius/dagger-ci';

    try {
        // 1. Get the SHA of the HEAD commit on the target branch
        const { data: refData } = await octokit.git.getRef({
            owner, repo,
            ref: `heads/${branch}`,
        });
        const baseSha = refData.object.sha;

        // 2. Create (or reset) the working branch
        try {
            await octokit.git.createRef({
                owner, repo,
                ref: `refs/heads/${newBranch}`,
                sha: baseSha,
            });
        } catch (e: any) {
            // Branch already exists — update it to point at the latest base SHA
            if (e.status === 422) {
                await octokit.git.updateRef({
                    owner, repo,
                    ref: `heads/${newBranch}`,
                    sha: baseSha,
                    force: true,
                });
            } else {
                throw e;
            }
        }

        // 3. Build the Git tree with all five files
        const files = [
            { path: '.github/workflows/hylius-dagger.yml', content: getDaggerWorkflowYaml(branch) },
            { path: '.dagger/dagger.json',                 content: DAGGER_MODULE_JSON },
            { path: '.dagger/src/index.ts',                content: DAGGER_PIPELINE_TS },
            { path: '.dagger/tsconfig.json',               content: DAGGER_TSCONFIG },
            { path: '.dagger/package.json',                content: DAGGER_PACKAGE_JSON },
        ];

        const { data: treeData } = await octokit.git.createTree({
            owner, repo,
            base_tree: baseSha,
            tree: files.map(f => ({
                path: f.path,
                mode: '100644' as const,
                type: 'blob' as const,
                content: f.content,
            })),
        });

        // 4. Create a commit on top of baseSha
        const { data: commitData } = await octokit.git.createCommit({
            owner, repo,
            message: 'ci: add Hylius Dagger CI/CD pipeline',
            tree: treeData.sha,
            parents: [baseSha],
        });

        // 5. Advance the working branch to the new commit
        await octokit.git.updateRef({
            owner, repo,
            ref: `heads/${newBranch}`,
            sha: commitData.sha,
        });

        // 6. Check if a PR already exists for this branch
        const { data: existingPrs } = await octokit.pulls.list({
            owner, repo,
            head: `${owner}:${newBranch}`,
            base: branch,
            state: 'open',
        });

        let prUrl: string;
        if (existingPrs.length > 0) {
            prUrl = existingPrs[0].html_url;
            console.log(`[GitHub Workflow] Updated existing Dagger CI PR: ${prUrl}`);
        } else {
            // 7. Open the PR
            const { data: pr } = await octokit.pulls.create({
                owner, repo,
                title: '🚀 Add Hylius Dagger CI/CD Pipeline',
                body: [
                    '## Hylius Dagger CI/CD Setup',
                    '',
                    'This PR adds the necessary files to enable automated Docker image builds powered by [Dagger](https://dagger.io/).',
                    '',
                    '### What\'s included',
                    '- `.github/workflows/hylius-dagger.yml` — GitHub Actions workflow that builds and pushes your Docker image to GHCR on every push',
                    '- `.dagger/` — Dagger TypeScript module for the build pipeline',
                    '',
                    '### Next steps',
                    '1. **Merge this PR** to activate the CI/CD pipeline',
                    '2. Add the following secrets to your repo (**Settings → Secrets → Actions**):',
                    '   - `HYLIUS_WEBHOOK_URL` — your Hylius dashboard webhook URL',
                    '   - `HYLIUS_API_TOKEN` — your Hylius API token',
                    '3. Every push to `' + branch + '` will now automatically build and deploy your app! 🎉',
                    '',
                    '_Generated by [Hylius](https://hylius.dev)_',
                ].join('\n'),
                head: newBranch,
                base: branch,
            });
            prUrl = pr.html_url;
            console.log(`[GitHub Workflow] Opened Dagger CI PR: ${prUrl}`);
        }

        return { prUrl };
    } catch (error: any) {
        console.error(`[GitHub Workflow] Failed to provision Dagger workflow for ${repoFullName}:`, error);
        return null;
    }
}


