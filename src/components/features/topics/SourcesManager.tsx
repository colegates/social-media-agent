'use client';

import { useState } from 'react';
import {
  Globe,
  Link2,
  Hash,
  Search,
  Users,
  MessageSquare,
  Layers,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SourceType } from '@/db/schema';
import { SOURCE_TYPES, SUPPORTED_SCAN_PLATFORMS } from '@/lib/validators/topics';

export interface PendingSource {
  id: string;
  type: SourceType;
  value: string;
  label?: string;
}

const SOURCE_CONFIG: Record<
  SourceType,
  { label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string }
> = {
  website: { label: 'Website', icon: Globe, placeholder: 'https://example.com' },
  social_link: { label: 'Social Media', icon: Link2, placeholder: 'https://instagram.com/account' },
  subreddit: { label: 'Subreddit', icon: MessageSquare, placeholder: 'r/technology or technology' },
  hashtag: { label: 'Hashtag', icon: Hash, placeholder: '#trending or trending' },
  search_term: { label: 'Search Term', icon: Search, placeholder: 'viral skincare routine' },
  competitor_account: { label: 'Competitor', icon: Users, placeholder: '@competitor or handle' },
  platform: { label: 'Platform', icon: Layers, placeholder: 'instagram, tiktok, youtube, reddit…' },
};

interface SourcesManagerProps {
  sources: PendingSource[];
  onAdd: (source: Omit<PendingSource, 'id'>) => void;
  onRemove: (id: string) => void;
  persistedSourceIds?: Set<string>;
  onRemovePersisted?: (id: string) => Promise<void>;
}

export function SourcesManager({
  sources,
  onAdd,
  onRemove,
  persistedSourceIds,
  onRemovePersisted,
}: SourcesManagerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [type, setType] = useState<SourceType>('website');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleAdd() {
    const trimmedValue = value.trim();

    if (type === 'platform') {
      const validPlatform = SUPPORTED_SCAN_PLATFORMS.find((p) => p.value === trimmedValue);
      if (!validPlatform) {
        setError('Please select a valid platform');
        return;
      }
      onAdd({ type, value: trimmedValue, label: label.trim() || validPlatform.label });
      setValue(SUPPORTED_SCAN_PLATFORMS[0].value);
      setLabel('');
      setError('');
      setSheetOpen(false);
      return;
    }

    if (!trimmedValue) {
      setError('Please enter a value');
      return;
    }

    if (type === 'website' || type === 'social_link') {
      try {
        new URL(trimmedValue);
      } catch {
        setError('Please enter a valid URL (e.g. https://example.com)');
        return;
      }
    }

    onAdd({ type, value: trimmedValue, label: label.trim() || undefined });
    setValue('');
    setLabel('');
    setError('');
    setSheetOpen(false);
  }

  async function handleRemove(id: string) {
    if (persistedSourceIds?.has(id) && onRemovePersisted) {
      setRemovingId(id);
      try {
        await onRemovePersisted(id);
        onRemove(id);
      } finally {
        setRemovingId(null);
      }
    } else {
      onRemove(id);
    }
  }

  return (
    <div className="space-y-3">
      {sources.length > 0 ? (
        <ul className="divide-border divide-y rounded-lg border">
          {sources.map((source) => {
            const config = SOURCE_CONFIG[source.type];
            const Icon = config.icon;
            const isPersisted = persistedSourceIds?.has(source.id);
            return (
              <li key={source.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{source.value}</p>
                  <p className="text-muted-foreground text-xs">
                    {source.label ?? config.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(source.id)}
                  disabled={removingId === source.id}
                  className="text-muted-foreground hover:text-destructive shrink-0 rounded-sm p-1 transition-colors disabled:opacity-50"
                  aria-label={`Remove ${source.type} source`}
                >
                  {isPersisted ? (
                    <Trash2 className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          No sources added yet. Sources help the AI find relevant trending content.
        </p>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Source
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle>Add Source</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-type">Source Type</Label>
              <Select
                id="source-type"
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as SourceType;
                  setType(newType);
                  setError('');
                  setValue(newType === 'platform' ? SUPPORTED_SCAN_PLATFORMS[0].value : '');
                }}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SOURCE_CONFIG[t].label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-value">
                {SOURCE_CONFIG[type].label} URL / Handle
              </Label>
              {type === 'platform' ? (
                <Select
                  id="source-value"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError('');
                  }}
                >
                  {SUPPORTED_SCAN_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="source-value"
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError('');
                  }}
                  placeholder={SOURCE_CONFIG[type].placeholder}
                  aria-invalid={!!error}
                />
              )}
              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-label">
                Label <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="source-label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main competitor, Industry blog"
                maxLength={100}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" className="flex-1" onClick={handleAdd}>
                Add Source
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSheetOpen(false);
                  setValue(type === 'platform' ? SUPPORTED_SCAN_PLATFORMS[0].value : '');
                  setLabel('');
                  setError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
