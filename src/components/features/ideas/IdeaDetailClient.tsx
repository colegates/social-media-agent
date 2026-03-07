'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, Edit2, Loader2, Calendar, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformIcon, getPlatformLabel } from './PlatformIcon';
import type { ContentIdea, ContentIdeaStatus } from '@/db/schema';

type IdeaWithRelations = ContentIdea & {
  topic: { id: string; name: string } | null;
  trend: {
    id: string;
    title: string;
    sourceUrl: string | null;
    platform: string;
    viralityScore: number;
    discoveredAt: Date;
  } | null;
};

interface IdeaDetailClientProps {
  idea: IdeaWithRelations;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  carousel: 'Carousel',
  text: 'Text',
  blog_article: 'Article',
};

const STATUS_VARIANTS: Record<
  ContentIdeaStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  suggested: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  in_production: 'outline',
  completed: 'outline',
  published: 'outline',
};

export function IdeaDetailClient({ idea: initialIdea }: IdeaDetailClientProps) {
  const router = useRouter();
  const [idea, setIdea] = useState(initialIdea);
  const [isEditingCopy, setIsEditingCopy] = useState(false);
  const [editedCopy, setEditedCopy] = useState(idea.suggestedCopy);
  const [scheduledDate, setScheduledDate] = useState(
    idea.scheduledFor ? new Date(idea.scheduledFor).toISOString().split('T')[0] : ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  async function handleAction(action: 'approve' | 'reject') {
    if (isActioning) return;
    setIsActioning(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      setIdea((prev) => ({ ...prev, status: newStatus as ContentIdeaStatus }));
      toast.success(action === 'approve' ? 'Idea approved!' : 'Idea rejected');
      router.refresh();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setIsActioning(false);
    }
  }

  async function saveCopy() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestedCopy: editedCopy }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setIdea((prev) => ({ ...prev, suggestedCopy: editedCopy }));
      setIsEditingCopy(false);
      toast.success('Copy saved');
    } catch {
      toast.error('Failed to save copy');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSchedule() {
    setIsSaving(true);
    try {
      const scheduledFor = scheduledDate ? new Date(scheduledDate) : null;
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setIdea((prev) => ({ ...prev, scheduledFor }));
      toast.success(scheduledDate ? 'Scheduled!' : 'Schedule cleared');
    } catch {
      toast.error('Failed to update schedule');
    } finally {
      setIsSaving(false);
    }
  }

  const priorityColor =
    idea.priorityScore >= 75
      ? 'text-emerald-600'
      : idea.priorityScore >= 50
        ? 'text-amber-600'
        : 'text-slate-600';

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <PlatformIcon platform={idea.platform} className="h-5 w-5" />
                <span className="text-muted-foreground text-sm">
                  {getPlatformLabel(idea.platform)}
                </span>
                <Badge variant="outline" className="text-xs">
                  {CONTENT_TYPE_LABELS[idea.contentType] ?? idea.contentType}
                </Badge>
                <Badge variant={STATUS_VARIANTS[idea.status]} className="text-xs capitalize">
                  {idea.status.replace('_', ' ')}
                </Badge>
              </div>
              <CardTitle className="text-xl leading-tight">{idea.title}</CardTitle>
            </div>
            <div className={`shrink-0 text-2xl font-bold ${priorityColor}`}>
              {idea.priorityScore}
              <span className="text-muted-foreground text-sm font-normal">/100</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">{idea.description}</p>

          {/* Quick actions */}
          {idea.status === 'suggested' && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleAction('approve')}
                disabled={isActioning}
              >
                {isActioning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Approve Idea
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={() => handleAction('reject')}
                disabled={isActioning}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested copy */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Suggested Copy</CardTitle>
          {!isEditingCopy && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => setIsEditingCopy(true)}
            >
              <Edit2 className="h-3 w-3" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditingCopy ? (
            <div className="space-y-3">
              <Textarea
                value={editedCopy}
                onChange={(e) => setEditedCopy(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveCopy} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Save Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditedCopy(idea.suggestedCopy);
                    setIsEditingCopy(false);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <pre className="text-sm leading-relaxed whitespace-pre-wrap">{idea.suggestedCopy}</pre>
          )}
        </CardContent>
      </Card>

      {/* Visual direction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Visual Direction</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">{idea.visualDirection}</p>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="scheduledDate" className="text-xs">
                Scheduled date
              </Label>
              <Input
                id="scheduledDate"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={saveSchedule} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source trend */}
      {idea.trend && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Source Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p className="font-medium">{idea.trend.title}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                <span className="capitalize">{idea.trend.platform}</span>
                <span>Virality: {idea.trend.viralityScore}/100</span>
                <span>
                  Discovered:{' '}
                  {new Date(idea.trend.discoveredAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {idea.trend.sourceUrl && (
                <a
                  href={idea.trend.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary mt-2 inline-flex items-center gap-1 text-xs hover:underline"
                >
                  View source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
