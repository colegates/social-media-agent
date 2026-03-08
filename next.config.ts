import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ?? '',
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? '',
  },

  // Disable powered-by header to avoid revealing the stack
  poweredByHeader: false,

  // Image optimisation: allow R2 bucket domain
  images: {
    remotePatterns: [
      // Cloudflare R2 public bucket URL (set at runtime)
      ...(process.env.R2_PUBLIC_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
            },
          ]
        : []),
    ],
  },

  // API body size limits
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
};

// NOTE: withSentryConfig is intentionally not used here.
// @sentry/nextjs v10's automatic OpenTelemetry instrumentation is incompatible
// with Next.js 16 server components. Sentry is initialised manually via
// sentry.client.config.ts and sentry.server.config.ts instead.
export default nextConfig;
