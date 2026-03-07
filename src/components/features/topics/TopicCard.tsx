'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreVertical, Edit2, Trash2, Clock, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Topic, TopicSource } from '@/db/schema';
import { SCAN_FREQUENCY_OPTIONS } from '@/lib/validators/topics';

interface TopicCardProps {
  topic: Topic & { sources: TopicSource[] };
}

function getFrequencyLabel(minutes: number): string {
  return (
    SCAN_FREQUENCY_OPTIONS.find((o) => o.value === minutes)?.label ??
    `${minutes} min`
  );
}

export function TopicCard({ topic }: TopicCardProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(topic.isActive);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleToggleActive(checked: boolean) {
    setIsToggling(true);
    setIsActive(checked);
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      if (!res.ok) {
        // Revert on failure
        setIsActive(!checked);
      } else {
        router.refresh();
      }
    } catch {
      setIsActive(!checked);
    } finally {
      setIsToggling(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className={`transition-opacity ${isDeleting ? 'opacity-50' : ''}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <Link href={`/topics/${topic.id}`} className="min-w-0 flex-1">
          <h3 className="hover:text-primary truncate font-semibold transition-colors">
            {topic.name}
          </h3>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={isActive}
            onCheckedChange={handleToggleActive}
            disabled={isToggling}
            aria-label={isActive ? 'Deactivate topic' : 'Activate topic'}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hover:bg-muted focus-visible:ring-ring/50 flex h-7 w-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
              aria-label="Topic actions"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/topics/${topic.id}/edit`)}>
                <Edit2 className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {topic.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{topic.description}</p>
        )}

        {topic.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topic.keywords.slice(0, 5).map((kw) => (
              <Badge key={kw} variant="secondary" className="text-xs">
                {kw}
              </Badge>
            ))}
            {topic.keywords.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{topic.keywords.length - 5}
              </Badge>
            )}
          </div>
        )}

        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {topic.sources.length} {topic.sources.length === 1 ? 'source' : 'sources'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Every {getFrequencyLabel(topic.scanFrequencyMinutes)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
