'use client';

import { useState } from 'react';
import { ApiKeyCard } from './ApiKeyCard';
import type { ApiKeyCardConfig } from './ApiKeyCard';

const INTEGRATIONS: Omit<ApiKeyCardConfig, 'keyHint'>[] = [
  {
    service: 'anthropic',
    name: 'Anthropic (Claude AI)',
    description: 'Powers AI-driven trend relevance scoring and future content generation features.',
    signUpUrl: 'https://console.anthropic.com/',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
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
    description: 'Fetches trending Google search results and YouTube videos for your topics.',
    signUpUrl: 'https://serpapi.com/users/sign_up',
    docsUrl: 'https://serpapi.com/search-api',
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
    description: 'Scrapes trending TikTok videos and Instagram posts related to your topics.',
    signUpUrl: 'https://console.apify.com/sign-up',
    docsUrl: 'https://docs.apify.com/api/v2',
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
    service: 'reddit',
    name: 'Reddit API',
    description:
      'Scans subreddits and Reddit search for trending discussions, viral posts, and emerging topics. Authenticated access gives higher rate limits.',
    signUpUrl: 'https://www.reddit.com/prefs/apps',
    docsUrl: 'https://www.reddit.com/dev/api/',
    optional: true,
    pricingNote: 'Free for up to 100 requests/minute with OAuth. No paid plan required.',
    fields: [
      {
        id: 'clientId',
        label: 'Client ID',
        placeholder: 'e.g. AbCdEfGhIjKlMn',
      },
      {
        id: 'clientSecret',
        label: 'Client Secret',
        placeholder: 'Paste your Reddit app secret',
      },
    ],
    instructions: [
      'Go to reddit.com/prefs/apps and log in with your Reddit account.',
      'Scroll down and click "create another app..." at the bottom.',
      'Select "script" as the app type. Set the name to anything (e.g. "Social Media Agent").',
      'Set the redirect URI to "http://localhost:8080" (required but unused for script apps).',
      'Click "create app". You will see two values: the Client ID (short code under the app name) and the Client Secret.',
      'Enter both the Client ID and Client Secret in the fields below.',
    ],
  },
  {
    service: 'replicate',
    name: 'Replicate (Image Generation)',
    description: 'Generates images for your social media posts using Flux and other models.',
    signUpUrl: 'https://replicate.com/signin',
    docsUrl: 'https://replicate.com/docs/reference/http',
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
  {
    service: 'openai',
    name: 'OpenAI (DALL-E 3)',
    description:
      'Generates high-quality images from text prompts using DALL-E 3. Used as an alternative to Replicate/Flux for image content creation.',
    signUpUrl: 'https://platform.openai.com/signup',
    docsUrl: 'https://platform.openai.com/docs/guides/images',
    keyPlaceholder: 'sk-...',
    optional: true,
    pricingNote:
      'DALL-E 3 Standard 1024x1024: $0.040/image. HD 1024x1792: $0.080/image. Requires pre-paid credits.',
    instructions: [
      'Sign up or log in at platform.openai.com.',
      'Go to Settings and add a payment method (minimum $5 top-up).',
      'Navigate to API Keys in the left sidebar (or visit platform.openai.com/api-keys).',
      'Click "Create new secret key", give it a name, and copy the key immediately (you cannot view it again).',
      'Paste the key below. It starts with "sk-".',
    ],
  },
  {
    service: 'kling',
    name: 'Kling AI (Video Generation)',
    description:
      'Creates short AI-generated videos from text or image prompts. Ideal for TikTok, Reels, and YouTube Shorts content.',
    signUpUrl: 'https://klingai.com/',
    docsUrl: 'https://docs.qingque.cn/d/home/eZQB3yXxVbeVgJEh4rvCSFt7a',
    keyPlaceholder: 'Paste your Kling AI API key',
    optional: true,
    pricingNote:
      'Free tier includes limited credits. Pro plans start from ~$8/month. Video generation costs vary by duration and quality.',
    instructions: [
      'Visit klingai.com and create an account (sign up with email or Google).',
      'After logging in, navigate to Account Settings or the API section.',
      'If API access is available, generate an API key from your account dashboard.',
      'Copy the API key and paste it below.',
      'Note: Kling API access may require applying for the developer programme or upgrading to a paid plan depending on availability in your region.',
    ],
  },
  {
    service: 'runway',
    name: 'Runway (Gen-3 Alpha Video)',
    description:
      'Generates cinematic AI videos using Gen-3 Alpha. Produces high-quality short clips for social media, ads, and creative content.',
    signUpUrl: 'https://app.runwayml.com/signup',
    docsUrl: 'https://docs.runwayml.com/',
    keyPlaceholder: 'Paste your Runway API secret',
    optional: true,
    pricingNote:
      'Free plan includes 125 credits. Standard plan is $12/month (625 credits). Gen-3 Alpha costs ~5 credits/second of video.',
    instructions: [
      'Sign up at app.runwayml.com and verify your email.',
      'Once logged in, click your profile icon and go to Settings then API Keys.',
      'Click "Create API Key", give it a descriptive name (e.g. "Social Media Agent").',
      'Copy the generated API secret immediately - it will only be shown once.',
      'Paste the key below.',
      'Note: API access requires a paid plan (Standard or higher). Free-tier users can upgrade from the Billing page.',
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
