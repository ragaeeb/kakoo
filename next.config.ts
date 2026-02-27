import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the API routes to use Node.js APIs (fs, child_process, etc.)
  // Next.js App Router API routes run in Node.js runtime by default.
  serverExternalPackages: ["fluent-ffmpeg"],

  // SSE requires no response buffering — experimental flag for future use
  experimental: {},
};

export default nextConfig;
