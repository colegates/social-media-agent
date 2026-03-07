'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TopicsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="text-destructive mb-4 h-12 w-12" />
      <h2 className="mb-2 text-lg font-semibold">Failed to load topics</h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Something went wrong while loading your topics. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
