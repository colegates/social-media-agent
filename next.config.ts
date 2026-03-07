import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

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

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only upload source maps in production CI builds
  silent: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Tunnels Sentry requests through /monitoring to avoid ad blockers
  tunnelRoute: '/monitoring',
});
