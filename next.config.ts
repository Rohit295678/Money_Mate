import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Cache all navigation routes so the app shell loads offline
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "moneymate-cache",
        expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig: NextConfig = {
  webpack: (config: { externals: string[] }) => {
    config.externals = [...(config.externals || []), "better-sqlite3"];
    return config;
  },
};

export default withPWA(nextConfig);
