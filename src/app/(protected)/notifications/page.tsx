'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data: { url?: string };
}

const TYPE_COLORS: Record<string, string> = {
  new_trends: 'bg-blue-500',
  ideas_ready: 'bg-purple-500',
  content_generated: 'bg-green-500',
  review_needed: 'bg-yellow-500',
  auto_published: 'bg-emerald-500',
  error: 'bg-red-500',
};

const TYPE_LABELS: Record<string, string> = {
  new_trends: 'New Trends',
  ideas_ready: 'Ideas Ready',
  content_generated: 'Content Generated',
  review_needed: 'Review Needed',
  auto_published: 'Auto-Published',
  error: 'Error',
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const fetchPage = useCallback(
    async (offset: number) => {
      const res = await fetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) return;
      const { data, meta } = await res.json();
      setItems((prev) => (offset === 0 ? data : [...prev, ...data]));
      setUnreadCount(meta?.unreadCount ?? 0);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    },
    []
  );

  useEffect(() => {
    fetchPage(0).finally(() => setLoading(false));
  }, [fetchPage]);

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function markOneRead(id: string) {
    if (items.find((n) => n.id === id)?.isRead) return;
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage * PAGE_SIZE);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground text-sm">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <Check className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed py-16 text-center">
          <Bell className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="border-border divide-border divide-y overflow-hidden rounded-xl border">
          {items.map((item, idx) => {
            const dotColor = TYPE_COLORS[item.type] ?? 'bg-gray-400';
            const label = TYPE_LABELS[item.type] ?? item.type;
            const href = item.data?.url ?? '#';

            return (
              <div
                key={item.id}
                className={cn(
                  'flex gap-4 px-4 py-4 transition-colors',
                  !item.isRead && 'bg-primary/5',
                  'hover:bg-accent cursor-pointer'
                )}
                onClick={() => markOneRead(item.id)}
              >
                <div className="mt-1.5 shrink-0">
                  <div className={cn('h-2.5 w-2.5 rounded-full', dotColor)} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('text-sm font-medium', item.isRead && 'text-muted-foreground font-normal')}>
                      {item.title}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{item.body}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    {href !== '#' && (
                      <Link
                        href={href}
                        className="text-primary flex items-center gap-1 text-xs hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && items.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
