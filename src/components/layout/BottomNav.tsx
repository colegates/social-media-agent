'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookMarked, FileText, Settings, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/topics', label: 'Topics', icon: BookMarked },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/settings/automation', label: 'Automation', icon: Bot },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="border-border bg-background fixed right-0 bottom-0 left-0 z-50 border-t md:hidden">
      <div className="grid h-16 grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/settings'
              ? pathname === '/settings' ||
                pathname.startsWith('/settings/api-keys') ||
                pathname.startsWith('/settings/style')
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
