import type { NextConfig } from "next";

const pagesBuild = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = pagesBuild ? {
  output: "export",
  trailingSlash: true,
  basePath: "/nullscape-tools/compendium",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
} : {};

export default nextConfig;
