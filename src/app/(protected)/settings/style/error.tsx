'use client';

import { Button } from '@/components/ui/button';

export default function StyleSettingsError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground mb-4 text-sm">
          Something went wrong loading the style settings.
        </p>
        <Button onClick={reset} variant="outline" size="sm">
          Try again
        </Button>
      </div>
    </div>
  );
}
