import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Vinext classifies multipart route-handler requests as possible Server
    // Actions before dispatching them. Leave room for the 15 MB video plus
    // multipart framing so /api/media reaches its own type and size checks.
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
