'use client';

import { Button } from '@/components/ui/button';

export default function IdeasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <p className="text-destructive mb-2 font-medium">Failed to load content ideas</p>
      <p className="text-muted-foreground mb-4 text-sm">{error.message}</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
