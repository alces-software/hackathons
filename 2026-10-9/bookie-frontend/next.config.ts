import type { NextConfig } from "next";

// The live ledger listens on the core's websocket at /ws. The browser can't
// read API_URL, so hand it the same address with the scheme swapped, unless
// NEXT_PUBLIC_WS_URL says otherwise.
const wsUrl =
  process.env.NEXT_PUBLIC_WS_URL ??
  (process.env.API_URL
    ? `${process.env.API_URL.replace(/^http/, "ws")}/ws`
    : "ws://localhost:3000/api/v1/ws");

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_WS_URL: wsUrl,
  },
  experimental: {
    agentFeedback: true,
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
