'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Image as ImageIcon,
  Video,
  FileText,
  Search,
  Trash2,
  Download,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GeneratedContentType, GeneratedContentStatus } from '@/db/schema';

interface LibraryItem {
  id: string;
  contentIdeaId: string;
  type: string;
  status: string;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  content: string | null;
  aiToolUsed: string | null;
  generationCost: string | null;
  createdAt: Date;
  ideaTitle: string | null;
  ideaPlatform: string | null;
}

interface ContentLibraryClientProps {
  initialContents: LibraryItem[];
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: Video,
  carousel: ImageIcon,
  social_copy: FileText,
  blog_article: FileText,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-muted-foreground',
  generating: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-destructive',
  approved: 'text-green-600',
  published: 'text-purple-500',
};

export function ContentLibraryClient({ initialContents }: ContentLibraryClientProps) {
  const [contents, setContents] = useState<LibraryItem[]>(initialContents);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<GeneratedContentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<GeneratedContentStatus | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return contents.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesTitle = item.ideaTitle?.toLowerCase().includes(q) ?? false;
        const matchesContent = item.content?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesContent) return false;
      }
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [contents, search, typeFilter, statusFilter]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setContents((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Content deleted');
    } catch {
      toast.error('Failed to delete content');
    }
  }

  async function handleBulkDelete() {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => fetch(`/api/content/${id}`, { method: 'DELETE' }))
      );
      setContents((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      toast.success('Selected content deleted');
    } catch {
      toast.error('Failed to delete selected content');
    }
  }

  async function handleDownload(id: string) {
    try {
      const res = await fetch(`/api/content/${id}/download`);
      if (!res.ok) throw new Error('Failed to get download URL');
      const data = (await res.json()) as { data: { downloadUrl: string } };
      window.open(data.data.downloadUrl, '_blank');
    } catch {
      toast.error('Failed to get download URL');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-muted-foreground h-4 w-4" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as GeneratedContentType | 'all')}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="all">All Types</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="social_copy">Social Copy</option>
            <option value="blog_article">Blog Article</option>
            <option value="carousel">Carousel</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as GeneratedContentStatus | 'all')}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/50 mb-4 flex items-center justify-between rounded-lg px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1"
            onClick={() => void handleBulkDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Stats */}
      <p className="text-muted-foreground mb-4 text-sm">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        {contents.length !== filtered.length && ` of ${contents.length}`}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {contents.length === 0
                ? 'No content generated yet. Go to a content idea to start generating.'
                : 'No content matches your filters.'}
            </p>
            {contents.length === 0 && (
              <Link href="/content/ideas">
                <Button variant="outline" size="sm" className="mt-4">
                  Browse Ideas
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const TypeIcon = TYPE_ICONS[item.type] ?? FileText;
            const statusColor = STATUS_COLORS[item.status] ?? 'text-muted-foreground';
            const isSelected = selectedIds.has(item.id);

            return (
              <Card
                key={item.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'hover:border-border/80'
                }`}
                onClick={() => toggleSelect(item.id)}
              >
                <CardContent className="p-4">
                  {/* Image/Video preview */}
                  {item.storageUrl && item.type === 'image' && (
                    <div className="mb-3 overflow-hidden rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.storageUrl}
                        alt="Generated"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  )}
                  {item.storageUrl && item.type === 'video' && (
                    <div className="mb-3">
                      <video
                        src={item.storageUrl}
                        className="h-40 w-full rounded-md object-cover"
                        muted
                      />
                    </div>
                  )}
                  {item.content && !item.storageUrl && (
                    <div className="bg-muted/50 mb-3 h-20 overflow-hidden rounded-md p-3">
                      <p className="text-muted-foreground line-clamp-3 text-xs">{item.content}</p>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${statusColor}`} />
                        <span className="text-xs font-medium capitalize">
                          {item.type.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.status}
                        </Badge>
                      </div>
                      {item.ideaTitle && (
                        <p className="text-muted-foreground truncate text-xs">{item.ideaTitle}</p>
                      )}
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {item.createdAt.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {item.generationCost && ` · $${parseFloat(item.generationCost).toFixed(4)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                      {item.storageUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => void handleDownload(item.id)}
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Link href={`/content/studio/${item.contentIdeaId}/review`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Review">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={() => void handleDelete(item.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
