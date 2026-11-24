import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = (
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");

    return [
      "/papers",
      "/papers/:id",
      "/papers/:id/file",
      "/papers/:id/questions",
      "/search",
      "/trends/:module",
      "/repeated-questions/:module",
    ].map((path) => ({
      source: `/api${path}`,
      destination: `${backend}${path}`,
    }));
  },
};

export default nextConfig;
