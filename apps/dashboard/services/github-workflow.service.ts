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

