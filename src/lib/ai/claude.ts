import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import type { StyleExample, StyleProfile } from '@/types';

function getClient(anthropicKey: string): Anthropic {
  return new Anthropic({ apiKey: anthropicKey });
}

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_RETRY_COUNT = 3;
const BASE_RETRY_DELAY_MS = 1000;

function getModel(): string {
  return process.env.CLAUDE_MODEL ?? DEFAULT_MODEL;
}

// ─────────────────────────────────────────────────────────
// Retry with exponential backoff
// ─────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, context: string, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const isRateLimit =
      error instanceof Anthropic.RateLimitError ||
      (error instanceof Anthropic.APIError && error.status === 429);

    if (attempt >= MAX_RETRY_COUNT) {
      logger.error({ context, attempt, error }, 'Claude API: max retries exceeded');
      throw error;
    }

    if (isRateLimit || error instanceof Anthropic.InternalServerError) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      logger.warn({ context, attempt, delay, error }, 'Claude API: retrying after backoff');
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, context, attempt + 1);
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────
// analyseStyle
// ─────────────────────────────────────────────────────────

export async function analyseStyle(
  examples: StyleExample[],
  anthropicKey: string
): Promise<StyleProfile> {
  const claudeLogger = logger.child({ fn: 'analyseStyle', model: getModel() });
  claudeLogger.info({ exampleCount: examples.length }, 'Claude: starting style analysis');

  const examplesText = examples
    .map(
      (ex, i) =>
        `--- Example ${i + 1} (${ex.type}${ex.platform ? `, platform: ${ex.platform}` : ''}) ---\n${ex.content}`
    )
    .join('\n\n');

  const systemPrompt = `You are a brand voice and style analyst. Analyse the provided content examples and produce a structured style profile.

You MUST respond with ONLY a valid JSON object matching this exact structure (no markdown, no code blocks, just raw JSON):
{
  "tone": "string describing the overall tone (e.g., professional, casual, witty, educational)",
  "voiceCharacteristics": ["array", "of", "descriptors"],
  "vocabularyLevel": "simple" | "moderate" | "advanced",
  "emojiUsage": "none" | "minimal" | "moderate" | "heavy",
  "hashtagStyle": "none" | "minimal" | "branded" | "trending",
  "contentThemes": ["recurring", "themes", "detected"],
  "platformPreferences": {
    "platform_name": "style notes for this platform"
  },
  "doList": ["things", "the", "brand", "consistently", "does"],
  "dontList": ["things", "the", "brand", "avoids"],
  "analysedAt": "ISO date string"
}`;

  const userPrompt = `Analyse these content examples and produce a structured style profile:\n\n${examplesText}`;

  const start = Date.now();

  const response = await withRetry(
    () =>
      getClient(anthropicKey).messages.create({
        model: getModel(),
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    'analyseStyle'
  );

  const latencyMs = Date.now() - start;
  const usage = response.usage;

  claudeLogger.info(
    {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      latencyMs,
      stopReason: response.stop_reason,
    },
    'Claude: style analysis complete'
  );

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.text);
  } catch {
    claudeLogger.error({ rawText: content.text }, 'Claude: failed to parse style profile JSON');
    throw new Error('Claude returned invalid JSON for style profile');
  }

  const profile = parsed as StyleProfile;
  profile.analysedAt = new Date().toISOString();

  return profile;
}

// ─────────────────────────────────────────────────────────
// generateWithStyle
// ─────────────────────────────────────────────────────────

const PLATFORM_GUIDANCE: Record<string, string> = {
  x: 'Write for X/Twitter: max 280 characters, punchy and direct. Use minimal hashtags.',
  instagram:
    'Write for Instagram: engaging caption, can be longer (up to 2200 chars), use relevant hashtags at the end.',
  linkedin:
    'Write for LinkedIn: professional tone, can be detailed (up to 3000 chars), add value with insights.',
  tiktok:
    'Write for TikTok: conversational and energetic, short punchy sentences, use trending language.',
  blog: 'Write a blog post: long-form, well-structured with headings, SEO-friendly, detailed and informative.',
};

export async function generateWithStyle(
  prompt: string,
  styleProfile: StyleProfile,
  platform: string,
  anthropicKey: string
): Promise<string> {
  const claudeLogger = logger.child({ fn: 'generateWithStyle', model: getModel(), platform });
  claudeLogger.info(
    { platform, prompt: prompt.slice(0, 100) },
    'Claude: starting styled generation'
  );

  const platformGuidance =
    PLATFORM_GUIDANCE[platform.toLowerCase()] ?? `Write content for ${platform}.`;
  const platformStyle = styleProfile.platformPreferences[platform] ?? '';

  const systemPrompt = `You are a content writer who mirrors a specific brand voice exactly.

Brand Style Profile:
- Tone: ${styleProfile.tone}
- Voice characteristics: ${styleProfile.voiceCharacteristics.join(', ')}
- Vocabulary level: ${styleProfile.vocabularyLevel}
- Emoji usage: ${styleProfile.emojiUsage}
- Hashtag style: ${styleProfile.hashtagStyle}
- Content themes: ${styleProfile.contentThemes.join(', ')}
${platformStyle ? `- Platform-specific notes: ${platformStyle}` : ''}

DO list (always follow):
${styleProfile.doList.map((d) => `- ${d}`).join('\n')}

DON'T list (never do):
${styleProfile.dontList.map((d) => `- ${d}`).join('\n')}

Platform guidance: ${platformGuidance}

Write ONLY the content itself. No preamble, no explanation, no quotation marks around the output.`;

  const start = Date.now();

  const response = await withRetry(
    () =>
      getClient(anthropicKey).messages.create({
        model: getModel(),
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Write content about: ${prompt}` }],
      }),
    'generateWithStyle'
  );

  const latencyMs = Date.now() - start;
  const usage = response.usage;

  claudeLogger.info(
    {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      latencyMs,
    },
    'Claude: styled generation complete'
  );

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  return content.text.trim();
}
