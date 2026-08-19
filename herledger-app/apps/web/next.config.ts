import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@herledger/sdk", "@herledger/config", "@herledger/db"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
