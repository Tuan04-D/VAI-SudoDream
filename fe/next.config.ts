import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
    if (!target) return [];
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: "/backend/:path*", destination: `${target}/:path*` }],
    };
  },
};

export default nextConfig;
