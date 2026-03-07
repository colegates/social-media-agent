'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, XCircle, ClipboardCheck, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  type: string;
  status: string;
  content?: string | null;
  storageUrl?: string | null;
  thumbnailUrl?: string | null;
  aiToolUsed?: string | null;
  createdAt: string;
  contentIdeaId: string;
  metadata: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  blog_article: 'Blog Article',
  social_copy: 'Social Copy',
  carousel: 'Carousel',
};

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content?status=completed&limit=50');
      if (!res.ok) return;
      const { data } = await res.json();
      setItems(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function approveItems(ids: string[]) {
    setProcessing(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/content/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          })
        )
      );
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } finally {
      setProcessing(false);
    }
  }

  async function rejectItems(ids: string[]) {
    setProcessing(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/content/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'failed' }),
          })
        )
      );
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Review Queue</h1>
            <p className="text-muted-foreground text-sm">
              {items.length} item{items.length !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchQueue} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Batch actions bar */}
      {items.length > 0 && (
        <div className="border-border bg-muted/30 mb-4 flex items-center gap-3 rounded-xl border px-4 py-2.5">
          <Checkbox
            checked={selected.size === items.length && items.length > 0}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all"
          />
          <span className="text-muted-foreground text-sm">
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </span>

          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={processing}
                onClick={() => rejectItems(Array.from(selected))}
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Reject {selected.size}
              </Button>
              <Button
                size="sm"
                disabled={processing}
                onClick={() => approveItems(Array.from(selected))}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Approve {selected.size}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="border-border rounded-xl border border-dashed py-16 text-center">
          <ClipboardCheck className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No content waiting for review.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Generated content will appear here after automation runs.
          </p>
        </div>
      )}

      {/* Content list */}
      <div className="space-y-4">
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            selected={selected.has(item.id)}
            onToggle={() => toggleSelect(item.id)}
            onApprove={() => approveItems([item.id])}
            onReject={() => rejectItems([item.id])}
            processing={processing}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Review card
// ─────────────────────────────────────────────────────────

function ReviewCard({
  item,
  selected,
  onToggle,
  onApprove,
  onReject,
  processing,
}: {
  item: ContentItem;
  selected: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
}) {
  const isImage = item.type === 'image';
  const isVideo = item.type === 'video';
  const isBlog = item.type === 'blog_article';
  const isCopy = item.type === 'social_copy';

  return (
    <div
      className={cn(
        'border-border bg-card rounded-xl border shadow-sm transition-all',
        selected && 'ring-primary ring-2'
      )}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Checkbox */}
        <Checkbox checked={selected} onCheckedChange={onToggle} className="mt-0.5" />

        {/* Thumbnail */}
        {(isImage || isVideo) && item.thumbnailUrl && (
          <div className="bg-muted h-20 w-20 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={item.thumbnailUrl}
              alt="Content preview"
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Content preview */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {TYPE_LABELS[item.type] ?? item.type}
            </Badge>
            {item.aiToolUsed && (
              <Badge variant="secondary" className="text-xs">
                {item.aiToolUsed}
              </Badge>
            )}
            <span className="text-muted-foreground text-xs">
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>

          {(isBlog || isCopy) && item.content && (
            <p className="text-muted-foreground line-clamp-3 text-sm">{item.content}</p>
          )}

          {(isImage || isVideo) && item.storageUrl && (
            <Link
              href={item.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 text-sm hover:underline"
            >
              View full {item.type} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}

          <Link
            href={`/content/studio/${item.contentIdeaId}`}
            className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs hover:underline"
          >
            Open in Studio <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            variant="outline"
            disabled={processing}
            onClick={onReject}
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
          >
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
          <Button size="sm" disabled={processing} onClick={onApprove}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
