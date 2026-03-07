'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Edit3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlatformIcon, getPlatformLabel } from '@/components/features/ideas/PlatformIcon';
import type { ContentIdeaPlatform, GeneratedContent } from '@/db/schema';

interface ContentIdea {
  id: string;
  title: string;
  platform: string;
  contentType: string;
  status: string;
}

interface ContentReviewClientProps {
  idea: ContentIdea;
  initialContent: GeneratedContent[];
}

export function ContentReviewClient({ idea, initialContent }: ContentReviewClientProps) {
  const [contents, setContents] = useState<GeneratedContent[]>(initialContent);
  const [expandedText, setExpandedText] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const platform = idea.platform as ContentIdeaPlatform;

  async function handleApprove(id: string) {
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      const data = (await res.json()) as { data: GeneratedContent };
      setContents((prev) => prev.map((c) => (c.id === id ? data.data : c)));
      toast.success('Content approved!');
    } catch {
      toast.error('Failed to approve content');
    }
  }

  async function handleApproveAll() {
    const completedIds = contents.filter((c) => c.status === 'completed').map((c) => c.id);

    try {
      await Promise.all(
        completedIds.map((id) =>
          fetch(`/api/content/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          })
        )
      );
      setContents((prev) =>
        prev.map((c) => (c.status === 'completed' ? { ...c, status: 'approved' as const } : c))
      );
      toast.success(`${completedIds.length} items approved!`);
    } catch {
      toast.error('Failed to approve all content');
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setContents((prev) => prev.filter((c) => c.id !== id));
      toast.success('Content deleted');
    } catch {
      toast.error('Failed to delete content');
    }
  }

  async function handleRegenerate(id: string) {
    try {
      const res = await fetch(`/api/content/${id}/regenerate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to queue regeneration');
      toast.success('Regeneration queued. Refresh the page to see results.');
    } catch {
      toast.error('Failed to queue regeneration');
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

  async function handleSaveEdit(id: string) {
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editText }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = (await res.json()) as { data: GeneratedContent };
      setContents((prev) => prev.map((c) => (c.id === id ? data.data : c)));
      setEditingId(null);
      toast.success('Content saved!');
    } catch {
      toast.error('Failed to save changes');
    }
  }

  const completedCount = contents.filter(
    (c) => c.status === 'completed' || c.status === 'approved'
  ).length;
  const approvedCount = contents.filter((c) => c.status === 'approved').length;

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={platform} className="h-4 w-4" />
          <span className="text-sm font-medium">{getPlatformLabel(platform)}</span>
          <Badge variant="outline" className="text-xs">
            {completedCount}/{contents.length} complete
          </Badge>
          {approvedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {approvedCount} approved
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {completedCount > approvedCount && (
            <Button size="sm" onClick={handleApproveAll} className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Approve All
            </Button>
          )}
          <Link href={`/content/studio/${idea.id}`}>
            <Button variant="outline" size="sm">
              Back to Studio
            </Button>
          </Link>
        </div>
      </div>

      {contents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">No generated content yet.</p>
            <Link href={`/content/studio/${idea.id}`}>
              <Button variant="outline" size="sm" className="mt-4">
                Go to Studio
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {contents.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm capitalize">
                      {item.type.replace(/_/g, ' ')}
                    </CardTitle>
                    <StatusBadge status={item.status} />
                    {item.aiToolUsed && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.aiToolUsed}
                      </Badge>
                    )}
                    {item.generationCost && (
                      <span className="text-muted-foreground text-xs">
                        ${parseFloat(item.generationCost).toFixed(4)}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {item.storageUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-xs"
                        onClick={() => void handleDownload(item.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    )}
                    {item.content && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditText(item.content ?? '');
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs"
                      onClick={() => void handleRegenerate(item.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Redo
                    </Button>
                    {item.status === 'completed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-xs text-green-600 hover:text-green-700"
                        onClick={() => void handleApprove(item.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-8 gap-1 text-xs"
                      onClick={() => void handleDelete(item.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Image preview */}
                {item.storageUrl && item.type === 'image' && (
                  <div className="overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.storageUrl}
                      alt="Generated image"
                      className="w-full object-cover"
                      style={{ maxHeight: '480px' }}
                    />
                  </div>
                )}

                {/* Video preview */}
                {item.storageUrl && item.type === 'video' && (
                  <video src={item.storageUrl} controls className="w-full rounded-lg" />
                )}

                {/* Text content */}
                {item.content && (
                  <div>
                    {editingId === item.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="border-input bg-background w-full rounded-md border p-3 text-sm focus:outline-none"
                          rows={10}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => void handleSaveEdit(item.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <p className="text-sm whitespace-pre-wrap">
                            {expandedText.has(item.id) ? item.content : item.content.slice(0, 500)}
                          </p>
                          {item.content.length > 500 && (
                            <button
                              onClick={() =>
                                setExpandedText((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                })
                              }
                              className="text-primary mt-2 flex items-center gap-1 text-xs font-medium"
                            >
                              {expandedText.has(item.id) ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Show more ({item.content.length - 500} chars)
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs">
                          {item.content.length} characters
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    generating: 'secondary',
    completed: 'secondary',
    failed: 'destructive',
    approved: 'secondary',
    published: 'secondary',
  };
  return (
    <Badge variant={variants[status] ?? 'outline'} className="text-xs capitalize">
      {status}
    </Badge>
  );
}
