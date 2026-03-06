'use client';

import { Zap } from 'lucide-react';
import { UserMenu } from './UserMenu';

interface MobileHeaderProps {
  title?: string;
}

export function MobileHeader({ title }: MobileHeaderProps) {
  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4 md:hidden">
      <div className="flex items-center gap-2">
        <Zap className="text-primary h-5 w-5" />
        <span className="font-semibold">{title ?? 'Social Agent'}</span>
      </div>
      <UserMenu />
    </header>
  );
}
