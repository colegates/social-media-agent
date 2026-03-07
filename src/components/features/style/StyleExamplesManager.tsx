'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, Link, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import type { StyleExample, StyleExampleType } from '@/types';

const TYPE_LABELS: Record<StyleExampleType, string> = {
  social_post: 'Social Post',
  blog_article: 'Blog Article',
  image_description: 'Image Description',
  brand_guideline: 'Brand Guideline',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X / Twitter',
  linkedin: 'LinkedIn',
  blog: 'Blog',
  other: 'Other',
};

interface StyleExamplesManagerProps {
  initialExamples: StyleExample[];
}

type AddMode = 'text' | 'url';

export function StyleExamplesManager({ initialExamples }: StyleExamplesManagerProps) {
  const [examples, setExamples] = useState<StyleExample[]>(initialExamples);
  const [addMode, setAddMode] = useState<AddMode>('text');
  const [exampleType, setExampleType] = useState<StyleExampleType>('social_post');
  const [platform, setPlatform] = useState('');
  const [textContent, setTextContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (addMode === 'text' && textContent.trim().length < 10) {
      toast.error('Content must be at least 10 characters');
      return;
    }
    if (addMode === 'url' && !urlInput.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setIsAdding(true);
    try {
      const body =
        addMode === 'text'
          ? { type: exampleType, content: textContent, platform: platform || undefined }
          : { type: exampleType, sourceUrl: urlInput, platform: platform || undefined };

      const res = await fetch('/api/style/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? 'Failed to add example');
      }

      const { data } = (await res.json()) as { data: StyleExample };
      setExamples((prev) => [data, ...prev]);
      setTextContent('');
      setUrlInput('');
      toast.success('Example added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add example');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/style/examples/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? 'Failed to delete example');
      }
      setExamples((prev) => prev.filter((e) => e.id !== id));
      toast.success('Example removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete example');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Add example form */}
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-medium">Add Example</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Content Type</Label>
            <Select
              value={exampleType}
              onChange={(e) => setExampleType(e.target.value as StyleExampleType)}
            >
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Platform (optional)</Label>
            <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">Any / Unknown</option>
              {Object.entries(PLATFORM_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={addMode === 'text' ? 'default' : 'outline'}
            onClick={() => setAddMode('text')}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Paste Text
          </Button>
          <Button
            type="button"
            size="sm"
            variant={addMode === 'url' ? 'default' : 'outline'}
            onClick={() => setAddMode('url')}
          >
            <Link className="mr-1.5 h-3.5 w-3.5" />
            From URL
          </Button>
        </div>

        {addMode === 'text' ? (
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste your content example here..."
              rows={5}
              maxLength={10000}
            />
            <p className="text-muted-foreground text-xs">{textContent.length} / 10,000 characters</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/my-post"
            />
            <p className="text-muted-foreground text-xs">
              We&apos;ll fetch and extract the text content from this URL.
            </p>
          </div>
        )}

        <Button onClick={handleAdd} disabled={isAdding} size="sm">
          {isAdding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {isAdding ? (addMode === 'url' ? 'Fetching...' : 'Adding...') : 'Add Example'}
        </Button>
      </div>

      {/* Examples list */}
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {examples.length === 0
            ? 'No examples yet. Add some content to teach Claude your style.'
            : `${examples.length} example${examples.length === 1 ? '' : 's'}`}
        </p>

        {examples.map((example) => (
          <Card key={example.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{TYPE_LABELS[example.type]}</Badge>
                    {example.platform && (
                      <Badge variant="outline">
                        {PLATFORM_LABELS[example.platform] ?? example.platform}
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {new Date(example.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {example.sourceUrl && (
                    <a
                      href={example.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary flex items-center gap-1 text-xs hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {example.sourceUrl.slice(0, 60)}
                      {example.sourceUrl.length > 60 ? '…' : ''}
                    </a>
                  )}

                  <p className="text-muted-foreground line-clamp-3 text-sm">
                    {example.content.slice(0, 200)}
                    {example.content.length > 200 ? '…' : ''}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDelete(example.id)}
                  disabled={deletingId === example.id}
                  aria-label="Remove example"
                >
                  {deletingId === example.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
