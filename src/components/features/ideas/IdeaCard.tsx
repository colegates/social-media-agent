'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, X, Calendar, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlatformIcon, getPlatformLabel } from './PlatformIcon';
import type { ContentIdeaPlatform, ContentIdeaContentType, ContentIdeaStatus } from '@/db/schema';

export interface IdeaCardData {
  id: string;
  title: string;
  description: string;
  platform: ContentIdeaPlatform;
  contentType: ContentIdeaContentType;
  suggestedCopy: string;
  priorityScore: number;
  status: ContentIdeaStatus;
  scheduledFor: Date | null;
  createdAt: Date;
  trendId: string | null;
}

interface IdeaCardProps {
  idea: IdeaCardData;
  onStatusChange?: (id: string, status: 'approved' | 'rejected') => void;
}

const CONTENT_TYPE_LABELS: Record<ContentIdeaContentType, string> = {
  image: 'Image',
  video: 'Video',
  carousel: 'Carousel',
  text: 'Text',
  blog_article: 'Article',
};

const STATUS_CONFIG: Record<
  ContentIdeaStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  suggested: { label: 'Suggested', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  in_production: { label: 'In Production', variant: 'outline' },
  completed: { label: 'Completed', variant: 'outline' },
  published: { label: 'Published', variant: 'outline' },
};

function PriorityBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      : score >= 50
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {score}
    </span>
  );
}

export function IdeaCard({ idea, onStatusChange }: IdeaCardProps) {
  const [localStatus, setLocalStatus] = useState<ContentIdeaStatus>(idea.status);
  const [isUpdating, setIsUpdating] = useState(false);

  const statusConfig = STATUS_CONFIG[localStatus];

  async function handleAction(action: 'approve' | 'reject') {
    if (isUpdating) return;
    setIsUpdating(true);

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    try {
      const res = await fetch(`/api/ideas/${idea.id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to update');

      setLocalStatus(newStatus);
      onStatusChange?.(idea.id, newStatus);
      toast.success(action === 'approve' ? 'Idea approved!' : 'Idea rejected');
    } catch {
      toast.error('Failed to update idea');
    } finally {
      setIsUpdating(false);
    }
  }

  const copySnippet =
    idea.suggestedCopy.slice(0, 120) + (idea.suggestedCopy.length > 120 ? '…' : '');

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Platform icon */}
          <div className="mt-0.5 shrink-0">
            <PlatformIcon platform={idea.platform} className="h-5 w-5" />
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-start justify-between gap-2">
              <Link
                href={`/content/ideas/${idea.id}`}
                className="hover:text-primary line-clamp-2 text-sm font-semibold transition-colors"
              >
                {idea.title}
              </Link>
              <PriorityBadge score={idea.priorityScore} />
            </div>

            {/* Meta badges */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {getPlatformLabel(idea.platform)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {CONTENT_TYPE_LABELS[idea.contentType]}
              </Badge>
              {localStatus !== 'suggested' && (
                <Badge variant={statusConfig.variant} className="text-xs">
                  {statusConfig.label}
                </Badge>
              )}
            </div>

            {/* Copy snippet */}
            <p className="text-muted-foreground mb-3 line-clamp-2 text-xs leading-relaxed">
              {copySnippet}
            </p>

            {/* Scheduled date */}
            {idea.scheduledFor && (
              <div className="text-muted-foreground mb-2 flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                <span>
                  {new Date(idea.scheduledFor).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {localStatus === 'suggested' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-emerald-200 px-2.5 text-xs text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:hover:bg-emerald-950"
                    onClick={() => handleAction('approve')}
                    disabled={isUpdating}
                  >
                    <Check className="h-3 w-3" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-rose-200 px-2.5 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-800 dark:hover:bg-rose-950"
                    onClick={() => handleAction('reject')}
                    disabled={isUpdating}
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </Button>
                </>
              )}
              <Link
                href={`/content/ideas/${idea.id}`}
                className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-0.5 text-xs transition-colors"
              >
                View
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
