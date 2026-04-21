

const nextConfig: any = {
  serverExternalPackages: ["ssh2", "@hylius/core", "node-ssh", "@octokit/auth-app", "@octokit/rest", "@octokit/webhooks"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
