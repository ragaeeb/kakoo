import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the API routes to use Node.js APIs (fs, child_process, etc.)
  // Next.js App Router API routes run in Node.js runtime by default.
  serverExternalPackages: ["fluent-ffmpeg"],

  // Increase the body size limit for API routes (audio files can be large)
  experimental: {},
};

export default nextConfig;
