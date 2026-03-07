import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import type { StyleProfile } from '@/types';
import type { ContentIdeaPlatform } from '@/db/schema';

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────

const GENERATION_MODEL = 'claude-sonnet-4-6';
const MAX_RETRY_COUNT = 2;
const BASE_RETRY_DELAY_MS = 1000;

// Estimated cost (USD per 1M tokens) - Claude Sonnet pricing
const INPUT_COST_PER_1M = 3.0;
const OUTPUT_COST_PER_1M = 15.0;

// Platform constraints
const PLATFORM_CONFIG: Record<
  ContentIdeaPlatform,
  { maxChars: number; hashtagStyle: string; emojiGuidance: string; name: string }
> = {
  instagram_post: {
    maxChars: 2200,
    hashtagStyle: 'Use 5-10 relevant hashtags at the end',
    emojiGuidance: 'Use emojis naturally throughout',
    name: 'Instagram Post',
  },
  instagram_reel: {
    maxChars: 2200,
    hashtagStyle: 'Use 5-10 relevant hashtags at the end',
    emojiGuidance: 'Use emojis naturally throughout',
    name: 'Instagram Reel',
  },
  tiktok: {
    maxChars: 2200,
    hashtagStyle: 'Use 3-5 trending hashtags',
    emojiGuidance: 'Use trending emojis',
    name: 'TikTok',
  },
  x_post: {
    maxChars: 280,
    hashtagStyle: 'Use 1-2 hashtags maximum',
    emojiGuidance: 'Use emojis sparingly if at all',
    name: 'X/Twitter Post',
  },
  x_thread: {
    maxChars: 280, // per tweet
    hashtagStyle: 'Add hashtags only in the last tweet',
    emojiGuidance: 'Use emojis to break up text',
    name: 'X/Twitter Thread',
  },
  linkedin: {
    maxChars: 3000,
    hashtagStyle: 'Use 3-5 professional hashtags at the end',
    emojiGuidance: 'Use emojis minimally and professionally',
    name: 'LinkedIn Post',
  },
  blog: {
    maxChars: 10000,
    hashtagStyle: 'No hashtags',
    emojiGuidance: 'No emojis',
    name: 'Blog Article',
  },
  youtube_short: {
    maxChars: 5000,
    hashtagStyle: 'Use 3-5 relevant hashtags in description',
    emojiGuidance: 'Use emojis in title/first line',
    name: 'YouTube Short',
  },
};

// ─────────────────────────────────────────────────────────
// Client & helpers
// ─────────────────────────────────────────────────────────

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_1M + (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M
  );
}

async function withRetry<T>(fn: () => Promise<T>, context: string, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= MAX_RETRY_COUNT) {
      logger.error({ context, attempt, error }, 'Text generator: max retries exceeded');
      throw error;
    }
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
    logger.warn({ context, attempt, delay }, 'Text generator: retrying after backoff');
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, context, attempt + 1);
  }
}

function buildStyleContext(styleProfile: StyleProfile | null): string {
  if (!styleProfile) return '';
  return `
Brand Voice & Style:
- Tone: ${styleProfile.tone}
- Voice characteristics: ${styleProfile.voiceCharacteristics.join(', ')}
- Vocabulary level: ${styleProfile.vocabularyLevel}
- Emoji usage preference: ${styleProfile.emojiUsage}
- Hashtag style preference: ${styleProfile.hashtagStyle}
- Content themes: ${styleProfile.contentThemes.join(', ')}
- Always do: ${styleProfile.doList.join('; ')}
- Never do: ${styleProfile.dontList.join('; ')}`;
}

// ─────────────────────────────────────────────────────────
// Social Media Copy Generator
// ─────────────────────────────────────────────────────────

export interface SocialCopyResult {
  content: string;
  estimatedCost: number;
}

export async function generateSocialCopy(
  ideaTitle: string,
  ideaDescription: string,
  suggestedCopy: string,
  styleProfile: StyleProfile | null,
  platform: ContentIdeaPlatform
): Promise<SocialCopyResult> {
  const copyLogger = logger.child({ fn: 'generateSocialCopy', platform });
  const config = PLATFORM_CONFIG[platform];

  copyLogger.info({ platform, estimatedCost: '~$0.001' }, 'Text generator: generating social copy');

  const systemPrompt = `You are a professional social media copywriter who writes in a specific brand voice.
${buildStyleContext(styleProfile)}

Platform: ${config.name}
Character limit: ${config.maxChars} characters
Hashtags: ${config.hashtagStyle}
Emojis: ${config.emojiGuidance}

Write ONLY the post content itself. No preamble, no quotation marks, no explanation.
Match the brand voice exactly. Stay within the character limit.`;

  const userPrompt = `Content idea: "${ideaTitle}"
Description: ${ideaDescription}
Suggested approach: ${suggestedCopy}

Write the ${config.name} copy:`;

  const start = Date.now();

  const response = await withRetry(
    () =>
      getClient().messages.create({
        model: GENERATION_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    'generateSocialCopy'
  );

  const latencyMs = Date.now() - start;
  const cost = estimateCost(response.usage.input_tokens, response.usage.output_tokens);

  copyLogger.info(
    {
      platform,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      estimatedCost: cost,
    },
    'Text generator: social copy complete'
  );

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  return { content: content.text.trim(), estimatedCost: cost };
}

// ─────────────────────────────────────────────────────────
// Blog Article Generator
// ─────────────────────────────────────────────────────────

export interface BlogArticleOptions {
  wordCount?: number;
  seoKeywords?: string[];
}

export interface BlogArticleResult {
  content: string;
  estimatedCost: number;
}

export async function generateBlogArticle(
  ideaTitle: string,
  ideaDescription: string,
  styleProfile: StyleProfile | null,
  options: BlogArticleOptions = {}
): Promise<BlogArticleResult> {
  const blogLogger = logger.child({ fn: 'generateBlogArticle' });
  const { wordCount = 800, seoKeywords = [] } = options;

  blogLogger.info(
    { wordCount, seoKeywords: seoKeywords.length },
    'Text generator: generating blog article'
  );

  const systemPrompt = `You are a professional blog writer who creates SEO-optimised articles in a specific brand voice.
${buildStyleContext(styleProfile)}

Article requirements:
- Target length: approximately ${wordCount} words
- Structure: catchy introduction, 3-5 body sections with H2 headings, conclusion with CTA
${seoKeywords.length > 0 ? `- SEO keywords to integrate naturally: ${seoKeywords.join(', ')}` : ''}
- Write in Markdown format
- No keyword stuffing - use keywords naturally

Write ONLY the article content in Markdown. No meta commentary.`;

  const userPrompt = `Write a blog article about:
Title: "${ideaTitle}"
Topic: ${ideaDescription}

Article:`;

  const start = Date.now();

  const response = await withRetry(
    () =>
      getClient().messages.create({
        model: GENERATION_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    'generateBlogArticle'
  );

  const latencyMs = Date.now() - start;
  const cost = estimateCost(response.usage.input_tokens, response.usage.output_tokens);

  blogLogger.info(
    {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      estimatedCost: cost,
    },
    'Text generator: blog article complete'
  );

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  return { content: content.text.trim(), estimatedCost: cost };
}

// ─────────────────────────────────────────────────────────
// X/Twitter Thread Generator
// ─────────────────────────────────────────────────────────

export interface ThreadResult {
  tweets: string[];
  estimatedCost: number;
}

export async function generateThread(
  ideaTitle: string,
  ideaDescription: string,
  styleProfile: StyleProfile | null
): Promise<ThreadResult> {
  const threadLogger = logger.child({ fn: 'generateThread' });

  threadLogger.info('Text generator: generating X/Twitter thread');

  const systemPrompt = `You are a professional X/Twitter content creator.
${buildStyleContext(styleProfile)}

Thread rules:
- Each tweet MUST be 280 characters or less
- First tweet is a strong hook that makes people want to read on
- Number tweets: 1/, 2/, 3/ etc.
- Last tweet is a CTA or summary
- 4-8 tweets total
- Hashtags only in the last tweet (2 max)

IMPORTANT: Output ONLY a JSON array of tweet strings. No other text.
Example: ["Tweet 1 text here", "Tweet 2 text here", "Tweet 3 text here"]`;

  const userPrompt = `Write a thread about:
Topic: "${ideaTitle}"
Details: ${ideaDescription}

JSON array of tweets:`;

  const start = Date.now();

  const response = await withRetry(
    () =>
      getClient().messages.create({
        model: GENERATION_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    'generateThread'
  );

  const latencyMs = Date.now() - start;
  const cost = estimateCost(response.usage.input_tokens, response.usage.output_tokens);

  threadLogger.info(
    {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
      estimatedCost: cost,
    },
    'Text generator: thread complete'
  );

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  let tweets: string[];
  try {
    const text = content.text.trim();
    // Extract JSON array if wrapped in code block
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    tweets = JSON.parse(jsonMatch[0]) as string[];
  } catch {
    threadLogger.error({ rawText: content.text }, 'Failed to parse thread JSON');
    throw new Error('Claude returned invalid JSON for thread');
  }

  return { tweets, estimatedCost: cost };
}
