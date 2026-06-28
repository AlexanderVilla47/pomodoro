import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "pg", "better-auth"],
};

export default nextConfig;
