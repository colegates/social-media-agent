'use client';

import { useState } from 'react';
import { ApiKeyCard } from './ApiKeyCard';
import type { ApiKeyCardConfig } from './ApiKeyCard';

const INTEGRATIONS: Omit<ApiKeyCardConfig, 'keyHint'>[] = [
  {
    service: 'anthropic',
    name: 'Anthropic (Claude AI)',
    description:
      'Powers AI-driven trend relevance scoring and future content generation features.',
    signUpUrl: 'https://console.anthropic.com/',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    envVar: 'ANTHROPIC_API_KEY',
    keyPlaceholder: 'sk-ant-...',
    pricingNote: 'Haiku model used for scoring — very low cost (~$0.001 per scan).',
    instructions: [
      'Go to console.anthropic.com and sign in or create an account.',
      'Navigate to "API Keys" in the left sidebar.',
      'Click "Create Key", give it a name, and copy the key.',
      'Paste the key below. It starts with "sk-ant-".',
    ],
  },
  {
    service: 'serpapi',
    name: 'SerpAPI (Google & YouTube)',
    description:
      'Fetches trending Google search results and YouTube videos for your topics.',
    signUpUrl: 'https://serpapi.com/users/sign_up',
    docsUrl: 'https://serpapi.com/search-api',
    envVar: 'SERPAPI_API_KEY',
    keyPlaceholder: 'Paste your SerpAPI key',
    pricingNote: 'Free plan includes 100 searches/month. Paid plans start at $50/month.',
    instructions: [
      'Sign up at serpapi.com.',
      'Once logged in, go to your Dashboard.',
      'Copy the API Key shown at the top of the page.',
      'Paste it below.',
    ],
  },
  {
    service: 'apify',
    name: 'Apify (TikTok & Instagram)',
    description:
      'Scrapes trending TikTok videos and Instagram posts related to your topics.',
    signUpUrl: 'https://console.apify.com/sign-up',
    docsUrl: 'https://docs.apify.com/api/v2',
    envVar: 'APIFY_API_TOKEN',
    keyPlaceholder: 'apify_api_...',
    pricingNote: 'Free plan includes $5/month of compute credits (enough for ~50 scans).',
    instructions: [
      'Create a free account at console.apify.com.',
      'Go to Settings → Integrations in the left sidebar.',
      'Click "Create new token", name it, and copy it.',
      'Paste it below. It starts with "apify_api_".',
    ],
  },
  {
    service: 'twitter',
    name: 'Twitter / X API',
    description: 'Searches real-time tweets and trending conversations on X (Twitter).',
    signUpUrl: 'https://developer.twitter.com/en/portal/dashboard',
    docsUrl: 'https://developer.twitter.com/en/docs/twitter-api',
    envVar: 'TWITTER_BEARER_TOKEN',
    keyPlaceholder: 'AAAA...',
    optional: true,
    pricingNote:
      'Free tier allows 500,000 tweet reads/month. Bearer Token is sufficient (no OAuth needed).',
    instructions: [
      'Apply for a developer account at developer.twitter.com.',
      'Create a new Project and App in the Developer Portal.',
      'In your App settings, go to "Keys and Tokens".',
      'Under "Bearer Token", click "Generate" and copy the token.',
      'Paste it below.',
    ],
  },
  {
    service: 'replicate',
    name: 'Replicate (Image Generation)',
    description: 'Generates images for your social media posts using Flux and other models.',
    signUpUrl: 'https://replicate.com/signin',
    docsUrl: 'https://replicate.com/docs/reference/http',
    envVar: 'REPLICATE_API_TOKEN',
    keyPlaceholder: 'r8_...',
    optional: true,
    pricingNote: 'Pay-per-use. Flux Schnell costs ~$0.003 per image.',
    instructions: [
      'Sign in or create an account at replicate.com.',
      'Go to Account Settings → API tokens.',
      'Click "Create token", name it, and copy the value.',
      'Paste it below. It starts with "r8_".',
    ],
  },
];

interface ApiKeysManagerProps {
  hintMap: Record<string, string | null | undefined>;
}

export function ApiKeysManager({ hintMap: initialHintMap }: ApiKeysManagerProps) {
  const [hintMap, setHintMap] = useState<Record<string, string | null | undefined>>(initialHintMap);

  function handleSaved(service: string, hint: string) {
    setHintMap((prev) => ({ ...prev, [service]: hint }));
  }

  function handleDeleted(service: string) {
    setHintMap((prev) => ({ ...prev, [service]: null }));
  }

  const configs: ApiKeyCardConfig[] = INTEGRATIONS.map((cfg) => ({
    ...cfg,
    keyHint: hintMap[cfg.service] ?? null,
  }));

  const configured = configs.filter((c) => c.keyHint);
  const unconfigured = configs.filter((c) => !c.keyHint);

  return (
    <div className="max-w-2xl space-y-6">
      {configured.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-green-700 dark:text-green-400">
            Configured ({configured.length})
          </h2>
          {configured.map((cfg) => (
            <ApiKeyCard
              key={cfg.service}
              config={cfg}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </section>
      )}

      {unconfigured.length > 0 && (
        <section className="space-y-3">
          {configured.length > 0 && (
            <h2 className="text-muted-foreground text-sm font-semibold">
              Not configured ({unconfigured.length})
            </h2>
          )}
          {unconfigured.map((cfg) => (
            <ApiKeyCard
              key={cfg.service}
              config={cfg}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </section>
      )}
    </div>
  );
}
