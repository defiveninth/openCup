import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Table sessions and workspace data are request-specific and must stay fresh.
  cacheComponents: false,
  output: "standalone",
  experimental: { cpus: 1 },
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async redirects() {
    return [
      { source: "/controller", destination: "/admin", permanent: false },
      { source: "/staff", destination: "/admin", permanent: false },
      {
        source: "/r/:restaurantSlug/t/:tableId",
        destination: "/restaurant?slug=:restaurantSlug&table=:tableId",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
