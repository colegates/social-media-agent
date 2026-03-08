import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Set the environment
  environment: process.env.NODE_ENV,

  // Custom error context: attach user/request information to events
  beforeSend(event, hint) {
    // Sanitise any sensitive fields
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    // Suppress NEXT_NOT_FOUND errors (normal Next.js 404 flow)
    const err = hint.originalException;
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
      return null;
    }
    return event;
  },
});
