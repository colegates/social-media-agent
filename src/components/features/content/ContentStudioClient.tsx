'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Image as ImageIcon,
  Video,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlatformIcon, getPlatformLabel } from '@/components/features/ideas/PlatformIcon';
import { useContentGenerationEvents } from '@/hooks/useContentGenerationEvents';
import type { GenerationEvent } from '@/hooks/useContentGenerationEvents';
import type { ContentIdeaPlatform, GeneratedContent, GeneratedContentType } from '@/db/schema';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ContentIdea {
  id: string;
  title: string;
  description: string;
  platform: string;
  contentType: string;
  suggestedCopy: string;
  visualDirection: string;
  priorityScore: number;
  status: string;
  topic?: { id: string; name: string } | null;
}

interface ContentStudioClientProps {
  idea: ContentIdea;
  existingContent: GeneratedContent[];
}

type ContentTypeKey = 'image' | 'video' | 'social_copy' | 'blog_article';

const CONTENT_TYPE_CONFIG: Record<
  ContentTypeKey,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    estimatedCost: string;
    estimatedTime: string;
  }
> = {
  image: {
    label: 'Image',
    icon: ImageIcon,
    description: 'AI-generated image using Flux or DALL-E 3',
    estimatedCost: '~$0.04',
    estimatedTime: '30-60s',
  },
  video: {
    label: 'Video',
    icon: Video,
    description: 'Short video using Kling AI or Runway',
    estimatedCost: '~$0.35',
    estimatedTime: '2-5 min',
  },
  social_copy: {
    label: 'Social Copy',
    icon: FileText,
    description: 'Platform-optimised caption and hashtags',
    estimatedCost: '~$0.001',
    estimatedTime: '5-10s',
  },
  blog_article: {
    label: 'Blog Article',
    icon: FileText,
    description: 'Full SEO blog post (~800 words)',
    estimatedCost: '~$0.01',
    estimatedTime: '15-30s',
  },
};

const GENERATED_TYPE_TO_KEY: Record<GeneratedContentType, ContentTypeKey | null> = {
  image: 'image',
  video: 'video',
  carousel: 'image',
  social_copy: 'social_copy',
  blog_article: 'blog_article',
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function ContentStudioClient({ idea, existingContent }: ContentStudioClientProps) {
  const platform = idea.platform as ContentIdeaPlatform;
  const isBlog = platform === 'blog';
  const isVideo = idea.contentType === 'video';
  const isImage = ['image', 'carousel'].includes(idea.contentType);

  // Available content types for this idea
  const availableTypes: ContentTypeKey[] = [];
  if (isImage) availableTypes.push('image');
  if (isVideo) availableTypes.push('video');
  if (isBlog) availableTypes.push('blog_article');
  else availableTypes.push('social_copy');

  const [selectedTypes, setSelectedTypes] = useState<Set<ContentTypeKey>>(new Set(availableTypes));
  const [isGenerating, setIsGenerating] = useState(false);
  const [completedContent, setCompletedContent] = useState<GeneratedContent[]>(existingContent);
  const [listenForEvents, setListenForEvents] = useState(false);

  const totalCost = Array.from(selectedTypes).reduce((sum, type) => {
    const config = CONTENT_TYPE_CONFIG[type];
    const costStr = config.estimatedCost.replace('~$', '');
    return sum + parseFloat(costStr);
  }, 0);

  const handleEvent = useCallback(
    (event: GenerationEvent) => {
      if (event.type === 'generation_complete') {
        // Refresh the content list
        void fetch(`/api/ideas/${idea.id}/content`)
          .then((r) => r.json())
          .then((data: { data: GeneratedContent[] }) => {
            setCompletedContent(data.data);
          });
        toast.success(`${event.data.type ?? 'Content'} generated successfully!`);
      } else if (event.type === 'generation_failed') {
        toast.error(`${event.data.type ?? 'Content'} generation failed`);
      } else if (event.type === 'all_complete') {
        setIsGenerating(false);
        setListenForEvents(false);
        toast.success('All content generated!');
      }
    },
    [idea.id]
  );

  const handleComplete = useCallback(() => {
    setIsGenerating(false);
    setListenForEvents(false);
  }, []);

  useContentGenerationEvents(idea.id, {
    onEvent: handleEvent,
    onComplete: handleComplete,
    enabled: listenForEvents,
  });

  async function handleGenerate() {
    if (selectedTypes.size === 0) {
      toast.error('Select at least one content type to generate');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: idea.id,
          types: Array.from(selectedTypes),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to queue generation');
      }

      setListenForEvents(true);
      toast.success('Content generation started! This may take a few minutes.');
    } catch (err) {
      setIsGenerating(false);
      const message = err instanceof Error ? err.message : 'Failed to start generation';
      toast.error(message);
    }
  }

  async function handleRegenerate(contentId: string) {
    try {
      const response = await fetch(`/api/content/${contentId}/regenerate`, {
        method: 'POST',
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to queue regeneration');
      }
      setListenForEvents(true);
      toast.success('Regeneration queued!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to regenerate';
      toast.error(message);
    }
  }

  async function handleDelete(contentId: string) {
    try {
      const response = await fetch(`/api/content/${contentId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete content');
      }
      setCompletedContent((prev) => prev.filter((c) => c.id !== contentId));
      toast.success('Content deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      toast.error(message);
    }
  }

  async function handleApprove(contentId: string) {
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      const data = (await response.json()) as { data: GeneratedContent };
      setCompletedContent((prev) => prev.map((c) => (c.id === contentId ? data.data : c)));
      toast.success('Content approved!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve';
      toast.error(message);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <PlatformIcon platform={platform} className="h-5 w-5" />
          <h1 className="text-xl font-bold md:text-2xl">{idea.title}</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {getPlatformLabel(platform)} · {idea.contentType}
        </p>
        {idea.topic && (
          <p className="text-muted-foreground mt-1 text-xs">
            Topic:{' '}
            <Link href={`/topics/${idea.topic.id}`} className="hover:underline">
              {idea.topic.name}
            </Link>
          </p>
        )}
      </div>

      {/* Idea summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Idea Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Description
            </p>
            <p className="mt-1">{idea.description}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Visual Direction
            </p>
            <p className="mt-1">{idea.visualDirection}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Suggested Copy
            </p>
            <p className="mt-1">{idea.suggestedCopy}</p>
          </div>
        </CardContent>
      </Card>

      {/* Generation Options */}
      {!isGenerating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generate Content</CardTitle>
            <CardDescription>
              Select what to generate. You will be charged the estimated amount per generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {availableTypes.map((type) => {
                const config = CONTENT_TYPE_CONFIG[type];
                const Icon = config.icon;
                const selected = selectedTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() =>
                      setSelectedTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type);
                        else next.add(type);
                        return next;
                      })
                    }
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="text-primary h-4 w-4" />
                      <span className="text-sm font-medium">{config.label}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {config.estimatedCost}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">{config.description}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Est. time: {config.estimatedTime}
                    </p>
                  </button>
                );
              })}
            </div>

            {selectedTypes.size > 0 && (
              <div className="bg-muted/50 mb-4 rounded-lg p-3">
                <p className="text-sm">
                  <span className="font-medium">Estimated total cost:</span>{' '}
                  <span className="text-primary font-semibold">~${totalCost.toFixed(3)}</span>
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  This is an estimate. Actual costs may vary slightly based on generation
                  complexity.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={selectedTypes.size === 0}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate {selectedTypes.size > 1 ? 'All' : 'Content'}
              </Button>
              {completedContent.length > 0 && (
                <Link href={`/content/studio/${idea.id}/review`}>
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Review Content
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generating State */}
      {isGenerating && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
            <div>
              <p className="font-medium">Generating content…</p>
              <p className="text-muted-foreground text-sm">
                This may take a few minutes. You can leave this page and come back.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Content */}
      {completedContent.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Generated Content</h2>
            <Link href={`/content/studio/${idea.id}/review`}>
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Full Review
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {completedContent.map((item) => {
              const typeKey = GENERATED_TYPE_TO_KEY[item.type as GeneratedContentType];
              const config = typeKey ? CONTENT_TYPE_CONFIG[typeKey] : null;
              const Icon = config?.icon ?? FileText;

              return (
                <Card key={item.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium capitalize">
                          {item.type.replace(/_/g, ' ')}
                        </span>
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
                      <div className="flex shrink-0 gap-2">
                        {item.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => void handleApprove(item.id)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => void handleRegenerate(item.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Redo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-7 gap-1 text-xs"
                          onClick={() => void handleDelete(item.id)}
                        >
                          <XCircle className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {/* Preview */}
                    {item.storageUrl && item.type === 'image' && (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.storageUrl}
                          alt="Generated"
                          className="max-h-64 w-full rounded-md object-cover"
                        />
                      </div>
                    )}
                    {item.storageUrl && item.type === 'video' && (
                      <div className="mt-3">
                        <video
                          src={item.storageUrl}
                          controls
                          className="max-h-64 w-full rounded-md"
                        />
                      </div>
                    )}
                    {item.content && (
                      <div className="bg-muted/50 mt-3 rounded-md p-3">
                        <p className="text-sm whitespace-pre-wrap">{item.content.slice(0, 300)}</p>
                        {item.content.length > 300 && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            + {item.content.length - 300} more characters
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { variant: 'outline' as const, label: 'Pending', icon: null },
    generating: { variant: 'secondary' as const, label: 'Generating…', icon: Loader2 },
    completed: { variant: 'secondary' as const, label: 'Done', icon: CheckCircle2 },
    failed: { variant: 'destructive' as const, label: 'Failed', icon: XCircle },
    approved: { variant: 'secondary' as const, label: 'Approved', icon: CheckCircle2 },
    published: { variant: 'secondary' as const, label: 'Published', icon: CheckCircle2 },
  }[status] ?? { variant: 'outline' as const, label: status, icon: null };

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1 text-xs">
      {Icon && <Icon className={`h-3 w-3 ${status === 'generating' ? 'animate-spin' : ''}`} />}
      {config.label}
    </Badge>
  );
}
