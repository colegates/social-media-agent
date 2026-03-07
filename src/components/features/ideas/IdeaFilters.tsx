'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Topic {
  id: string;
  name: string;
}

interface IdeaFiltersProps {
  topics: Topic[];
  currentFilters: {
    topicId?: string;
    platform?: string;
    status?: string;
    contentType?: string;
    sortBy?: string;
  };
}

const PLATFORMS = [
  { value: '', label: 'All Platforms' },
  { value: 'instagram_post', label: 'Instagram Post' },
  { value: 'instagram_reel', label: 'Instagram Reel' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x_post', label: 'X Post' },
  { value: 'x_thread', label: 'X Thread' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'blog', label: 'Blog' },
  { value: 'youtube_short', label: 'YouTube Short' },
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'suggested', label: 'Suggested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'in_production', label: 'In Production' },
  { value: 'completed', label: 'Completed' },
  { value: 'published', label: 'Published' },
];

const CONTENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'text', label: 'Text' },
  { value: 'blog_article', label: 'Article' },
];

const SORT_OPTIONS = [
  { value: 'priorityScore', label: 'Priority Score' },
  { value: 'createdAt', label: 'Newest First' },
  { value: 'scheduledFor', label: 'Scheduled Date' },
];

export function IdeaFilters({ topics, currentFilters }: IdeaFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams();
      const merged = { ...currentFilters, [key]: value, page: '1' };
      for (const [k, v] of Object.entries(merged)) {
        if (v) params.set(k, v);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentFilters, pathname, router]
  );

  return (
    <div className="flex flex-wrap gap-3">
      {/* Topic filter */}
      {topics.length > 1 && (
        <div className="flex min-w-36 flex-col gap-1">
          <Label className="text-xs">Topic</Label>
          <Select
            value={currentFilters.topicId ?? ''}
            onChange={(e) => updateFilter('topicId', e.target.value)}
            className="h-8 text-xs"
          >
            <option value="">All Topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Platform filter */}
      <div className="flex min-w-36 flex-col gap-1">
        <Label className="text-xs">Platform</Label>
        <Select
          value={currentFilters.platform ?? ''}
          onChange={(e) => updateFilter('platform', e.target.value)}
          className="h-8 text-xs"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Status filter */}
      <div className="flex min-w-32 flex-col gap-1">
        <Label className="text-xs">Status</Label>
        <Select
          value={currentFilters.status ?? ''}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="h-8 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Content type filter */}
      <div className="flex min-w-32 flex-col gap-1">
        <Label className="text-xs">Type</Label>
        <Select
          value={currentFilters.contentType ?? ''}
          onChange={(e) => updateFilter('contentType', e.target.value)}
          className="h-8 text-xs"
        >
          {CONTENT_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Sort */}
      <div className="flex min-w-36 flex-col gap-1">
        <Label className="text-xs">Sort By</Label>
        <Select
          value={currentFilters.sortBy ?? 'priorityScore'}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="h-8 text-xs"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
