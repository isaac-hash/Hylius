import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ssh2", "@hylius/core", "node-ssh"],
};

export default nextConfig;
