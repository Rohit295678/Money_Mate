import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // better-sqlite3 is a native Node.js addon — keep it server-side only
      config.externals = [...(config.externals ?? []), "better-sqlite3"];
    }
    return config;
  },
};

export default nextConfig;
