'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface GenerateIdeasButtonProps {
  topics: { id: string; name: string }[];
  topicId?: string; // If provided, skips topic selection
}

export function GenerateIdeasButton({ topics, topicId: fixedTopicId }: GenerateIdeasButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    const targetTopicId = fixedTopicId ?? topics[0]?.id;
    if (!targetTopicId) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: targetTopicId }),
      });

      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to trigger generation');
      }

      toast.success(data.message ?? 'Generating ideas in the background…', {
        description: 'Refresh in a few moments to see new ideas.',
      });

      // Refresh after a delay to pick up new ideas
      setTimeout(() => router.refresh(), 5000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate ideas');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      Generate Ideas
    </Button>
  );
}
