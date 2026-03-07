'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'blog', label: 'Blog' },
];

interface StyleTestGeneratorProps {
  hasProfile: boolean;
}

export function StyleTestGenerator({ hasProfile }: StyleTestGeneratorProps) {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }
    if (!hasProfile) {
      toast.error('Run style analysis first to generate styled content');
      return;
    }

    setIsGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/style/test-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platform }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? 'Generation failed');
      }

      const { data } = (await res.json()) as { data: { content: string } };
      setResult(data.content);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="space-y-4">
      {!hasProfile && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          Complete a style analysis first to enable test generation.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="test-topic">Topic</Label>
          <Input
            id="test-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. morning skincare routine tips"
            maxLength={500}
            disabled={!hasProfile}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="test-platform">Platform</Label>
          <Select
            id="test-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            disabled={!hasProfile}
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !hasProfile}
      >
        {isGenerating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {isGenerating ? 'Generating...' : 'Generate Sample Post'}
      </Button>

      {result && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm font-medium">Generated Content</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{result}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
