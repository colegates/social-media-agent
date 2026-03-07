'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Sentry captures errors automatically via sentry.client.config.ts instrumentation.
    // In development, surface the error to the console for debugging.
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[GlobalError]', error.message, error.digest);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <AlertTriangle className="text-destructive h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="text-muted-foreground mb-4 font-mono text-xs">Error ID: {error.digest}</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset}>Try again</Button>
          <a
            href="/"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted hover:text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
