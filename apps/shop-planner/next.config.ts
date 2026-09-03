import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/nullscape-tools/shop-planner",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
