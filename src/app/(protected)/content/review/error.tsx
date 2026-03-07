'use client';

import { Button } from '@/components/ui/button';

export default function ReviewQueueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <p className="text-muted-foreground text-sm">Failed to load review queue.</p>
      <Button onClick={reset} size="sm" variant="outline">
        Try again
      </Button>
    </div>
  );
}
