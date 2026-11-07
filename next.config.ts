import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PDF.js loads worker code at run time, which bundling breaks.
  serverExternalPackages: ["unpdf", "@react-pdf/renderer"],
  // Read from disk when a PDF is made, so tracing cannot find them on its own.
  outputFileTracingIncludes: {
    "/cv/versions/[id]/pdf": ["./assets/fonts/**"],
    "/cover-letters/[id]/pdf": ["./assets/fonts/**"],
  },
  experimental: {
    // CV files go through a server action. The app enforces the real limit of 4 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
