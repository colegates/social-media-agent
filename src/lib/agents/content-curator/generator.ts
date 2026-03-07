import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import type { TrendInput, StyleProfileInput, GeneratedIdea } from './types';
import type { ContentIdeaPlatform, ContentIdeaContentType } from '@/db/schema';

const generatorLogger = logger.child({ module: 'content-curator/generator' });

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_RETRY_COUNT = 3;
const BASE_RETRY_DELAY_MS = 1000;

// Platform guidance for copy generation
const PLATFORM_COPY_GUIDANCE: Record<ContentIdeaPlatform, string> = {
  instagram_post:
    'Instagram post caption: engaging, 150-300 chars optimal, hashtags at end, strong hook first line.',
  instagram_reel:
    'Instagram Reel script/caption: hook in first 3 seconds, energetic, trend-aware, 30-60 sec video concept.',
  tiktok:
    'TikTok caption + script hook: punchy, conversational, trend-savvy. Include a hook line for the video.',
  x_post:
    'X/Twitter post: max 280 characters, punchy, opinionated or insightful, minimal hashtags (0-2).',
  x_thread:
    'X/Twitter thread opener: compelling hook tweet that sets up a multi-tweet thread. 280 chars max for first tweet.',
  linkedin:
    'LinkedIn post: professional, value-driven, 150-500 chars, no more than 3 hashtags, personal insight angle.',
  blog: 'Blog article intro paragraph (2-3 sentences): SEO-aware, clear topic statement, reader benefit.',
  youtube_short:
    'YouTube Short script outline: 15-60 sec, hook + main content + CTA. Include a compelling title.',
};

// Platform-to-content-type fit mapping (predefined scoring)
export const PLATFORM_CONTENT_TYPE_FIT: Record<
  ContentIdeaPlatform,
  Partial<Record<ContentIdeaContentType, number>>
> = {
  instagram_post: { image: 95, carousel: 90, video: 70, text: 30, blog_article: 0 },
  instagram_reel: { video: 95, image: 20, carousel: 10, text: 5, blog_article: 0 },
  tiktok: { video: 95, image: 30, carousel: 20, text: 5, blog_article: 0 },
  x_post: { text: 90, image: 85, video: 70, carousel: 40, blog_article: 0 },
  x_thread: { text: 95, image: 60, video: 50, carousel: 30, blog_article: 0 },
  linkedin: { text: 90, image: 80, carousel: 85, video: 65, blog_article: 40 },
  blog: { blog_article: 95, text: 60, image: 20, video: 10, carousel: 5 },
  youtube_short: { video: 95, image: 10, text: 5, carousel: 5, blog_article: 0 },
};

function getPlatformFitScore(
  platform: ContentIdeaPlatform,
  contentType: ContentIdeaContentType
): number {
  return PLATFORM_CONTENT_TYPE_FIT[platform]?.[contentType] ?? 50;
}

async function withRetry<T>(fn: () => Promise<T>, context: string, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const isRateLimit =
      error instanceof Anthropic.RateLimitError ||
      (error instanceof Anthropic.APIError && error.status === 429);

    if (attempt >= MAX_RETRY_COUNT) {
      generatorLogger.error({ context, attempt, error }, 'Claude API: max retries exceeded');
      throw error;
    }

    if (isRateLimit || error instanceof Anthropic.InternalServerError) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      generatorLogger.warn({ context, attempt, delay }, 'Claude API: retrying after backoff');
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, context, attempt + 1);
    }

    throw error;
  }
}

interface RawGeneratedIdea {
  title: string;
  description: string;
  platform: string;
  contentType: string;
  suggestedCopy: string;
  visualDirection: string;
}

const VALID_PLATFORMS = new Set<ContentIdeaPlatform>([
  'instagram_post',
  'instagram_reel',
  'tiktok',
  'x_post',
  'x_thread',
  'linkedin',
  'blog',
  'youtube_short',
]);

const VALID_CONTENT_TYPES = new Set<ContentIdeaContentType>([
  'image',
  'video',
  'carousel',
  'text',
  'blog_article',
]);

function isValidPlatform(v: string): v is ContentIdeaPlatform {
  return VALID_PLATFORMS.has(v as ContentIdeaPlatform);
}

function isValidContentType(v: string): v is ContentIdeaContentType {
  return VALID_CONTENT_TYPES.has(v as ContentIdeaContentType);
}

/**
 * Uses Claude to generate 2-3 specific, actionable content ideas for a trend.
 * Ideas are tailored to the user's brand voice and returned for at least 2 different platforms.
 */
export async function generateIdeasForTrend(
  trend: TrendInput,
  topicName: string,
  topicDescription: string | null,
  styleProfile: StyleProfileInput,
  anthropicApiKey: string
): Promise<GeneratedIdea[]> {
  const client = new Anthropic({ apiKey: anthropicApiKey });
  const model = process.env.CLAUDE_MODEL ?? DEFAULT_MODEL;

  const trendContext = `
Trend Title: ${trend.title}
Trend Platform: ${trend.platform}
Virality Score: ${trend.viralityScore}/100
${trend.description ? `Trend Description: ${trend.description}` : ''}
${trend.sourceUrl ? `Source: ${trend.sourceUrl}` : ''}
Discovered: ${trend.discoveredAt.toISOString()}
`.trim();

  const styleContext = `
Tone: ${styleProfile.tone}
Voice Characteristics: ${styleProfile.voiceCharacteristics.join(', ')}
Vocabulary Level: ${styleProfile.vocabularyLevel}
Emoji Usage: ${styleProfile.emojiUsage}
Hashtag Style: ${styleProfile.hashtagStyle}
Content Themes: ${styleProfile.contentThemes.join(', ')}
DO: ${styleProfile.doList.join(' | ')}
DON'T: ${styleProfile.dontList.join(' | ')}
${
  Object.entries(styleProfile.platformPreferences)
    .map(([p, note]) => `${p} style: ${note}`)
    .join('\n') || ''
}
`.trim();

  const systemPrompt = `You are a senior social media strategist and content creator. Your job is to generate highly specific, actionable content ideas that ride trending topics.

You must respond with ONLY a valid JSON array of exactly 2-3 content ideas. No markdown, no code blocks, no preamble - just raw JSON.

Each idea in the array must match this exact structure:
{
  "title": "Specific, compelling content title (not generic)",
  "description": "2-3 sentence explanation of the exact content angle, what makes it unique, and why it will resonate",
  "platform": one of ["instagram_post", "instagram_reel", "tiktok", "x_post", "x_thread", "linkedin", "blog", "youtube_short"],
  "contentType": one of ["image", "video", "carousel", "text", "blog_article"],
  "suggestedCopy": "Ready-to-use draft copy for this exact platform, matching the brand voice perfectly. This should be complete and usable, not a template.",
  "visualDirection": "Specific visual description: art direction, colour palette suggestion, composition, style, what to show, how to frame it. Be concrete and actionable."
}

Rules:
- Each idea must target a DIFFERENT platform (spread across at least 2 platforms)
- Ideas must be SPECIFIC to the trend - reference its exact angle, not just the general topic
- suggestedCopy must match the brand voice and platform format guidelines exactly
- visualDirection must describe a concrete, produceable visual - not vague terms like 'engaging visuals'
- Avoid generic ideas - each idea should feel unique and timely`;

  const userPrompt = `Generate 2-3 content ideas for this trending topic:

TOPIC BEING MONITORED: ${topicName}${topicDescription ? `\nTopic Context: ${topicDescription}` : ''}

TREND DETAILS:
${trendContext}

BRAND VOICE PROFILE:
${styleContext}

Platform copy guidance:
${Object.entries(PLATFORM_COPY_GUIDANCE)
  .map(([p, g]) => `${p}: ${g}`)
  .join('\n')}

Generate ideas that authentically connect this trend to the brand's voice. Make the suggestedCopy immediately usable.`;

  const start = Date.now();

  const response = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    'generateIdeasForTrend'
  );

  const latencyMs = Date.now() - start;
  const usage = response.usage;

  generatorLogger.info(
    {
      trendId: trend.id,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      latencyMs,
      estimatedCostUsd: ((usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000).toFixed(
        4
      ),
    },
    'Claude: content ideas generated'
  );

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  let parsed: unknown;
  try {
    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = content.text
      .trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '');
    parsed = JSON.parse(cleaned);
  } catch {
    generatorLogger.error(
      { rawText: content.text.slice(0, 500) },
      'Claude: failed to parse ideas JSON'
    );
    throw new Error('Claude returned invalid JSON for content ideas');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Claude did not return an array of ideas');
  }

  const ideas: GeneratedIdea[] = [];
  for (const raw of parsed as RawGeneratedIdea[]) {
    if (
      typeof raw.title !== 'string' ||
      typeof raw.description !== 'string' ||
      typeof raw.suggestedCopy !== 'string' ||
      typeof raw.visualDirection !== 'string' ||
      !isValidPlatform(raw.platform) ||
      !isValidContentType(raw.contentType)
    ) {
      generatorLogger.warn({ raw }, 'Skipping invalid idea from Claude');
      continue;
    }

    ideas.push({
      title: raw.title.trim().slice(0, 300),
      description: raw.description.trim().slice(0, 2000),
      platform: raw.platform,
      contentType: raw.contentType,
      suggestedCopy: raw.suggestedCopy.trim().slice(0, 5000),
      visualDirection: raw.visualDirection.trim().slice(0, 2000),
    });
  }

  return ideas;
}

export { getPlatformFitScore };
