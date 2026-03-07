'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Eye, EyeOff, ExternalLink, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface ApiKeyCardConfig {
  service: string;
  name: string;
  description: string;
  signUpUrl: string;
  docsUrl?: string;
  envVar: string;
  keyHint?: string | null;
  configuredAt?: Date | null;
  keyPlaceholder?: string;
  instructions: string[];
  optional?: boolean;
  pricingNote?: string;
}

interface ApiKeyCardProps {
  config: ApiKeyCardConfig;
  onSaved: (service: string, keyHint: string) => void;
  onDeleted: (service: string) => void;
}

export function ApiKeyCard({ config, onSaved, onDeleted }: ApiKeyCardProps) {
  const [isExpanded, setIsExpanded] = useState(!config.keyHint);
  const [showKey, setShowKey] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfigured = Boolean(config.keyHint);

  async function handleSave() {
    if (!keyValue.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: config.service, key: keyValue.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to save API key');
      }

      const hint = `...${keyValue.trim().slice(-4)}`;
      onSaved(config.service, hint);
      setKeyValue('');
      setIsExpanded(false);
      toast.success(`${config.name} API key saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/settings/api-keys/${config.service}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to remove API key');
      }

      onDeleted(config.service);
      setIsExpanded(true);
      toast.success(`${config.name} API key removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove API key');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className={isConfigured ? 'border-green-200 dark:border-green-900' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-semibold">{config.name}</CardTitle>
              {config.optional && (
                <Badge variant="outline" className="text-xs">Optional</Badge>
              )}
              {isConfigured ? (
                <Badge variant="secondary" className="gap-1 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Configured {config.keyHint}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs text-yellow-600 dark:text-yellow-500">
                  <AlertCircle className="h-3 w-3" />
                  Not configured
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">{config.description}</p>
            {config.pricingNote && (
              <p className="text-muted-foreground mt-0.5 text-xs italic">{config.pricingNote}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isConfigured && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Remove API key"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Setup instructions */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="mb-2 text-xs font-medium">Setup instructions:</p>
            <ol className="space-y-1">
              {config.instructions.map((step, i) => (
                <li key={i} className="text-muted-foreground flex gap-2 text-xs">
                  <span className="text-primary shrink-0 font-medium">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={config.signUpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3" />
                Get API key
              </a>
              {config.docsUrl && (
                <a
                  href={config.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <ExternalLink className="h-3 w-3" />
                  Documentation
                </a>
              )}
            </div>
          </div>

          {/* Key entry */}
          <div className="space-y-2">
            <Label htmlFor={`key-${config.service}`} className="text-xs">
              {isConfigured ? 'Replace API key' : 'Enter API key'}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id={`key-${config.service}`}
                  type={showKey ? 'text' : 'password'}
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder={config.keyPlaceholder ?? `Paste your ${config.name} API key`}
                  className="pr-10 font-mono text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave();
                  }}
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
                  onClick={() => setShowKey((v) => !v)}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !keyValue.trim()}
                className="shrink-0"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
