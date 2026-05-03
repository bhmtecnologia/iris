import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  disable: isDev,
});

const config: NextConfig = isDev ? nextConfig : withSerwist(nextConfig);

export default withSentryConfig(config, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  // Tunnel client errors through our origin to bypass ad blockers (production only).
  tunnelRoute: isDev ? undefined : "/monitoring",
});
