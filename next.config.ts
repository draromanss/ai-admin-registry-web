import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? "/ai-admin-registry-web" : "";

const nextConfig: NextConfig = {
  ...(isGitHubPages ? { output: "export" as const } : {}),
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: {
    tsconfigPath: isGitHubPages ? "tsconfig.pages.json" : "tsconfig.json",
  },
};

export default nextConfig;
