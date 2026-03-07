'use client';

import { ExternalLink, TrendingUp, Calendar, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PlatformIcon } from './PlatformIcon';
import type { TrendCardData } from './TrendCard';

interface TrendDetailModalProps {
  trend: TrendCardData | null;
  onClose: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Viral';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Minimal';
}

function getScoreColour(score: number): string {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-muted-foreground';
}

export function TrendDetailModal({ trend, onClose }: TrendDetailModalProps) {
  if (!trend) return null;

  const eng = trend.engagementData as {
    likes?: number;
    views?: number;
    upvotes?: number;
    shares?: number;
    comments?: number;
    score?: number;
  };

  const discoveredDate =
    typeof trend.discoveredAt === 'string' ? new Date(trend.discoveredAt) : trend.discoveredAt;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border-border w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border p-6 shadow-xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <PlatformIcon platform={trend.platform} className="text-muted-foreground h-5 w-5 shrink-0" />
            <Badge variant="outline" className="capitalize">
              {trend.platform}
            </Badge>
            {trend.topicName && (
              <Badge variant="secondary">{trend.topicName}</Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-base font-semibold leading-snug">{trend.title}</h2>

        {/* Description */}
        {trend.description && (
          <p className="text-muted-foreground mb-4 text-sm">{trend.description}</p>
        )}

        <Separator className="my-4" />

        {/* Virality score */}
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex items-center gap-1.5 ${getScoreColour(trend.viralityScore)}`}>
            <TrendingUp className="h-5 w-5" />
            <span className="text-2xl font-bold tabular-nums">{trend.viralityScore}</span>
            <span className="text-sm font-medium">/100</span>
          </div>
          <div>
            <p className="text-sm font-medium">{getScoreLabel(trend.viralityScore)} trend</p>
            <p className="text-muted-foreground text-xs">Virality score</p>
          </div>
        </div>

        {/* Engagement data */}
        {Object.keys(eng).length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {eng.views !== undefined && eng.views > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold">{formatNumber(eng.views)}</p>
                <p className="text-muted-foreground text-xs">Views</p>
              </div>
            )}
            {(eng.likes !== undefined || eng.upvotes !== undefined) &&
              (eng.likes ?? 0) + (eng.upvotes ?? 0) > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-sm font-semibold">
                    {formatNumber((eng.likes ?? 0) + (eng.upvotes ?? 0))}
                  </p>
                  <p className="text-muted-foreground text-xs">Likes</p>
                </div>
              )}
            {eng.shares !== undefined && eng.shares > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold">{formatNumber(eng.shares)}</p>
                <p className="text-muted-foreground text-xs">Shares</p>
              </div>
            )}
            {eng.comments !== undefined && eng.comments > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold">{formatNumber(eng.comments)}</p>
                <p className="text-muted-foreground text-xs">Comments</p>
              </div>
            )}
          </div>
        )}

        {/* Meta info */}
        <div className="text-muted-foreground mb-4 flex items-center gap-1.5 text-xs">
          <Calendar className="h-3.5 w-3.5" />
          <span>Discovered {discoveredDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <Separator className="my-4" />

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {trend.sourceUrl && (
            <a
              href={trend.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                View Source
              </Button>
            </a>
          )}
          <Button className="flex-1 gap-2" disabled title="Coming in Stage 6">
            <Zap className="h-4 w-4" />
            Generate Content
          </Button>
        </div>
      </div>
    </div>
  );
}
