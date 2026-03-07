'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ApiKeysError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="text-destructive mb-4 h-10 w-10" />
        <h2 className="mb-2 text-lg font-semibold">Failed to load API keys</h2>
        <p className="text-muted-foreground mb-6 text-sm">{error.message}</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
