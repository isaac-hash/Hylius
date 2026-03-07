import { getInstallationOctokit } from './github.service';

const WORKFLOW_YAML = `name: Hylius Build & Deploy via GHCR

on:
  push:
    branches: [main]

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
      - name: Install Railpack
        run: curl -sSL https://railpack.com/install.sh | bash
      - name: Build and push image with Railpack
        run: |
          railpack build . --name ghcr.io/\${{ github.repository }}:\${{ github.sha }}
          docker push ghcr.io/\${{ github.repository }}:\${{ github.sha }}
      - name: Notify Hylius
        run: |
          curl -X POST "\$HYLIUS_WEBHOOK" \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer \$HYLIUS_TOKEN" \\
            -d '{"image":"ghcr.io/\${{ github.repository }}:\${{ github.sha }}","sha":"\${{ github.sha }}","repo":"\${{ github.repository }}","ref":"\${{ github.ref }}"}'
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
    } catch (e: unknown) {
      // 404 means the file doesn't exist yet, which is fine
      if ((e as any).status !== 404) {
        console.warn(`[GitHub Workflow] Could not check existing file: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. Create or update the file
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: 'ci: add Hylius GHCR build workflow',
      content: Buffer.from(WORKFLOW_YAML).toString('base64'),
      branch,
      sha, // If it exists, we must provide the sha to overwrite it
    });

    console.log(`[GitHub Workflow] Successfully provisioned workflow for ${repoFullName}`);
    return true;

  } catch (error: unknown) {
    console.error(`[GitHub Workflow] Failed to provision workflow for ${repoFullName}@${branch}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}
