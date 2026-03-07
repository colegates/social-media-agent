'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full appearance-none rounded-lg border px-3 py-2 pr-9 text-sm shadow-xs transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2" />
    </div>
  );
}

export { Select };
