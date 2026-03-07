'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Check, ArrowRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data: { url?: string; topicId?: string; contentId?: string };
}

const TYPE_COLORS: Record<string, string> = {
  new_trends: 'bg-blue-500',
  ideas_ready: 'bg-purple-500',
  content_generated: 'bg-green-500',
  review_needed: 'bg-yellow-500',
  auto_published: 'bg-emerald-500',
  error: 'bg-red-500',
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=5&unreadOnly=false');
      if (!res.ok) return;
      const { data, meta } = await res.json();
      setItems(data ?? []);
      setUnreadCount(meta?.unreadCount ?? 0);
    } catch {
      // Silent — bell is non-critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function markOneRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-accent focus-visible:ring-ring/50 relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />

        {/* Notification list */}
        {items.length === 0 ? (
          <div className="text-muted-foreground px-4 py-8 text-center text-sm">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onRead={() => markOneRead(item.id)}
              />
            ))}
          </div>
        )}

        <DropdownMenuSeparator className="m-0" />

        {/* Footer */}
        <div className="px-4 py-2">
          <Link
            href="/notifications"
            className="text-primary flex items-center gap-1 text-sm hover:underline"
          >
            View all notifications
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: () => void;
}) {
  const dotColor = TYPE_COLORS[item.type] ?? 'bg-gray-400';
  const href = item.data?.url ?? '/notifications';

  function handleClick() {
    if (!item.isRead) onRead();
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        'flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent',
        !item.isRead && 'bg-primary/5'
      )}
    >
      <div className="mt-1.5 shrink-0">
        <div className={cn('h-2 w-2 rounded-full', dotColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-medium', item.isRead && 'text-muted-foreground font-normal')}>
          {item.title}
        </p>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{item.body}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {new Date(item.createdAt).toLocaleString()}
        </p>
      </div>
    </Link>
  );
}
