'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface ApiKeyField {
  id: string;
  label: string;
  placeholder: string;
}

export interface ApiKeyCardConfig {
  service: string;
  name: string;
  description: string;
  signUpUrl: string;
  docsUrl?: string;
  keyHint?: string | null;
  configuredAt?: Date | null;
  keyPlaceholder?: string;
  instructions: string[];
  optional?: boolean;
  pricingNote?: string;
  /** When set, renders multiple labeled inputs stored as a JSON object */
  fields?: ApiKeyField[];
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
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isMultiField = Boolean(config.fields?.length);
  const isConfigured = Boolean(config.keyHint);

  function setFieldValue(id: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  }

  function hasAllFields(): boolean {
    if (!config.fields) return keyValue.trim().length > 0;
    return config.fields.every((f) => fieldValues[f.id]?.trim());
  }

  async function handleSave() {
    let keyToSave: string;
    let hint: string;

    if (isMultiField && config.fields) {
      const emptyField = config.fields.find((f) => !fieldValues[f.id]?.trim());
      if (emptyField) {
        toast.error(`Please enter your ${emptyField.label}`);
        return;
      }
      const combined = Object.fromEntries(
        config.fields.map((f) => [f.id, fieldValues[f.id].trim()])
      );
      keyToSave = JSON.stringify(combined);
      // Show hint based on first field value
      const firstVal = fieldValues[config.fields[0].id].trim();
      hint = firstVal.length > 8 ? `${firstVal.slice(0, 6)}…` : '***';
    } else {
      if (!keyValue.trim()) {
        toast.error('Please enter an API key');
        return;
      }
      keyToSave = keyValue.trim();
      hint = `...${keyToSave.slice(-4)}`;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: config.service, key: keyToSave }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to save API key');
      }

      onSaved(config.service, hint);
      setKeyValue('');
      setFieldValues({});
      setIsExpanded(false);
      toast.success(`${config.name} credentials saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credentials');
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
        throw new Error(data.error ?? 'Failed to remove credentials');
      }

      onDeleted(config.service);
      setIsExpanded(true);
      toast.success(`${config.name} credentials removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove credentials');
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
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              )}
              {isConfigured ? (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs text-green-700 dark:text-green-400"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Configured {config.keyHint}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs text-yellow-600 dark:text-yellow-500"
                >
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
                className="text-destructive hover:text-destructive h-7 w-7 p-0"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Remove credentials"
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
                Get API access
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

          {/* Key entry — multi-field or single */}
          {isMultiField && config.fields ? (
            <div className="space-y-3">
              {config.fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={`field-${config.service}-${field.id}`} className="text-xs">
                    {isConfigured ? `Replace ${field.label}` : field.label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`field-${config.service}-${field.id}`}
                      type={showKey ? 'text' : 'password'}
                      value={fieldValues[field.id] ?? ''}
                      onChange={(e) => setFieldValue(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      className="pr-10 font-mono text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSave();
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setShowKey((v) => !v)}
                  tabIndex={-1}
                  type="button"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showKey ? 'Hide' : 'Show'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !hasAllFields()}
                  className="shrink-0"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
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
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
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
          )}
        </CardContent>
      )}
    </Card>
  );
}
