'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KeywordInput } from './KeywordInput';
import { SourcesManager, type PendingSource } from './SourcesManager';
import type { Topic, TopicSource } from '@/db/schema';
import type { z } from 'zod';

import {
  createTopicSchema,
  SCAN_FREQUENCY_OPTIONS,
} from '@/lib/validators/topics';

// Form schema omits isActive (handled separately) to avoid resolver type mismatch
const topicFormSchema = createTopicSchema.omit({ isActive: true });
type TopicFormValues = z.infer<typeof topicFormSchema>;

interface TopicFormProps {
  topic?: Topic & { sources: TopicSource[] };
}

export function TopicForm({ topic }: TopicFormProps) {
  const router = useRouter();
  const isEditing = !!topic;

  const [keywords, setKeywords] = useState<string[]>(topic?.keywords ?? []);
  const [sources, setSources] = useState<PendingSource[]>(
    topic?.sources.map((s) => ({
      id: s.id,
      type: s.type,
      value: s.value,
      label: s.label ?? undefined,
    })) ?? []
  );
  const [persistedSourceIds] = useState<Set<string>>(
    new Set(topic?.sources.map((s) => s.id) ?? [])
  );
  const [newSourceIds, setNewSourceIds] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      name: topic?.name ?? '',
      description: topic?.description ?? '',
      keywords: topic?.keywords ?? [],
      scanFrequencyMinutes: topic?.scanFrequencyMinutes ?? 60,
    },
  });

  function handleAddSource(source: Omit<PendingSource, 'id'>) {
    const id = crypto.randomUUID();
    setSources((prev) => [...prev, { ...source, id }]);
    setNewSourceIds((prev) => new Set(prev).add(id));
  }

  function handleRemoveSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
    if (!persistedSourceIds.has(id)) {
      setNewSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleRemovePersisted(id: string): Promise<void> {
    const res = await fetch(`/api/topics/${topic!.id}/sources/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Failed to remove source');
    }
  }

  async function onSubmit(data: TopicFormValues) {
    try {
      if (isEditing) {
        // Update topic fields
        const updateRes = await fetch(`/api/topics/${topic.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, keywords }),
        });
        if (!updateRes.ok) {
          const err = await updateRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? 'Failed to update topic');
        }

        // Add new sources
        for (const id of newSourceIds) {
          const source = sources.find((s) => s.id === id);
          if (!source) continue;
          const res = await fetch(`/api/topics/${topic.id}/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: source.type, value: source.value, label: source.label }),
          });
          if (!res.ok) {
            toast.error(`Failed to add source: ${source.value}`);
          }
        }

        toast.success('Topic updated successfully');
        router.push(`/topics/${topic.id}`);
        router.refresh();
      } else {
        // Create topic
        const createRes = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, keywords }),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? 'Failed to create topic');
        }

        const { data: newTopic } = (await createRes.json()) as { data: Topic };

        // Add all sources
        for (const source of sources) {
          await fetch(`/api/topics/${newTopic.id}/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: source.type, value: source.value, label: source.label }),
          });
        }

        toast.success('Topic created successfully');
        router.push(`/topics/${newTopic.id}`);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Topic Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g. Skincare Trends, Fitness Tech"
              aria-invalid={!!errors.name}
              maxLength={100}
            />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description{' '}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Describe what trends you want to monitor..."
              rows={3}
              maxLength={2000}
            />
            {errors.description && (
              <p className="text-destructive text-xs">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Keywords{' '}
              <span className="text-muted-foreground text-xs">(up to 20, press Enter to add)</span>
            </Label>
            <KeywordInput value={keywords} onChange={setKeywords} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scanFrequencyMinutes">Scan Frequency</Label>
            <Select id="scanFrequencyMinutes" {...register('scanFrequencyMinutes', { valueAsNumber: true })}>
              {SCAN_FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            {errors.scanFrequencyMinutes && (
              <p className="text-destructive text-xs">{errors.scanFrequencyMinutes.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <p className="text-muted-foreground text-sm">
            Add websites, social accounts, subreddits, or hashtags to monitor.
          </p>
        </CardHeader>
        <CardContent>
          <SourcesManager
            sources={sources}
            onAdd={handleAddSource}
            onRemove={handleRemoveSource}
            persistedSourceIds={isEditing ? persistedSourceIds : undefined}
            onRemovePersisted={isEditing ? handleRemovePersisted : undefined}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3 pb-20 md:pb-0">
        <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Topic'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
