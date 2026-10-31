import type { NextConfig } from "next";

// The browser only talks to this Next.js server; /api/* is proxied to FastAPI.
// So phones on the same network need just one address (http://<pc-ip>:3000).
const BACKEND = process.env.SELF_AI_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // local models can take minutes on a slow PC
    proxyTimeout: 600_000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};

export default nextConfig;
