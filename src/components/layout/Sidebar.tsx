'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookMarked, FileText, Settings, Zap, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/topics', label: 'Topics', icon: BookMarked },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/content/library', label: 'Library', icon: Library },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-border bg-background hidden border-r md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
      {/* Logo */}
      <div className="border-border flex h-16 items-center gap-2 border-b px-6">
        <Zap className="text-primary h-6 w-6" />
        <span className="text-lg font-semibold">Social Agent</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User menu at bottom */}
      <div className="border-border border-t p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
