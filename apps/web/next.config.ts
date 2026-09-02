import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.0.148"],
  images: { remotePatterns: [{ protocol:"https",hostname:"qzgadlmlcsugwjshypwo.supabase.co" }] },
};

export default nextConfig;
