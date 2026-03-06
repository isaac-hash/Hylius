import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ssh2", "@hylius/core", "node-ssh", "@octokit/auth-app", "@octokit/rest", "@octokit/webhooks"],
};

export default nextConfig;
