import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import type { RawTrendItem, ScoredTrend } from './types';

const scoringLogger = logger.child({ module: 'trend-scanner', fn: 'scoring' });

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'; // Use fast/cheap model for scoring
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= MAX_RETRIES) throw error;
    const isRetryable =
      error instanceof Anthropic.RateLimitError ||
      error instanceof Anthropic.InternalServerError;
    if (!isRetryable) throw error;
    const delay = 1000 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, delay));
    return withRetry(fn, attempt + 1);
  }
}

/**
 * Use Claude to score relevance of a batch of trend items to the topic.
 * Returns relevance scores 0-100 for each item.
 */
async function scoreRelevanceBatch(
  items: RawTrendItem[],
  topicName: string,
  topicDescription: string | null,
  topicKeywords: string[]
): Promise<number[]> {
  if (items.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    scoringLogger.warn('ANTHROPIC_API_KEY not set, using default relevance scores');
    return items.map(() => 50);
  }

  const itemSummaries = items
    .map((item, i) => `Item ${i + 1}: "${item.title}"${item.description ? ` - ${item.description.slice(0, 100)}` : ''}`)
    .join('\n');

  const prompt = `You are analysing social media trends for relevance to a topic.

Topic: "${topicName}"
Description: ${topicDescription ?? 'Not provided'}
Keywords: ${topicKeywords.join(', ')}

Rate each item's relevance to this topic on a scale of 0-100, where:
- 0-20: Not relevant at all
- 21-40: Loosely related
- 41-60: Moderately relevant
- 61-80: Highly relevant
- 81-100: Directly on-topic and very relevant

Items to score:
${itemSummaries}

Respond with ONLY a JSON array of numbers, one per item. Example: [75, 30, 90, 45]`;

  const start = Date.now();
  try {
    const response = await withRetry(() =>
      getClient().messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      })
    );

    const duration = Date.now() - start;
    scoringLogger.debug(
      {
        itemCount: items.length,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        duration,
      },
      'Claude relevance scoring complete'
    );

    const content = response.content[0];
    if (content.type !== 'text') return items.map(() => 50);

    // Extract JSON array from response
    const match = content.text.match(/\[[\d,\s]+\]/);
    if (!match) return items.map(() => 50);

    const scores = JSON.parse(match[0]) as number[];
    if (!Array.isArray(scores) || scores.length !== items.length) {
      return items.map(() => 50);
    }

    return scores.map((s) => Math.max(0, Math.min(100, Math.round(s))));
  } catch (err) {
    scoringLogger.error({ err }, 'Claude relevance scoring failed, using defaults');
    return items.map(() => 50);
  }
}

/**
 * Calculate virality score based on engagement metrics (0-100).
 */
function calculateViralityScore(item: RawTrendItem): number {
  const { engagementData } = item;
  const { likes = 0, shares = 0, comments = 0, views = 0, upvotes = 0, score = 0 } = engagementData;

  // Weighted engagement total
  const totalEngagement =
    (likes + upvotes + score) * 1 +
    shares * 3 + // shares are high value
    comments * 2 +
    views * 0.001; // views are less weighted

  if (totalEngagement === 0) return 10; // Minimal baseline

  // Logarithmic scale: 10k engagement ≈ 50, 100k ≈ 75, 1M ≈ 100
  const logScore = Math.log10(Math.max(1, totalEngagement)) * 20;
  return Math.max(0, Math.min(100, Math.round(logScore)));
}

/**
 * Calculate recency score based on how recent the content is (0-100).
 * Within last hour = 100, within last day = 70, within last week = 30.
 */
function calculateRecencyScore(publishedAt: Date | undefined): number {
  if (!publishedAt) return 40; // Unknown age, moderate score

  const ageMs = Date.now() - publishedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 1) return 100;
  if (ageHours < 6) return 90;
  if (ageHours < 24) return 70;
  if (ageHours < 48) return 50;
  if (ageHours < 72) return 35;
  if (ageHours < 168) return 20; // within a week
  return 5;
}

/**
 * Calculate cross-platform bonus (not used in single-item scoring but
 * applied later if same trend appears on multiple platforms).
 */

/**
 * Score all trend items and return sorted, scored trends.
 * Composite score = (virality * 0.4) + (relevance * 0.4) + (recency * 0.2)
 */
export async function scoreTrends(
  items: RawTrendItem[],
  topicName: string,
  topicDescription: string | null,
  topicKeywords: string[]
): Promise<ScoredTrend[]> {
  if (items.length === 0) return [];

  scoringLogger.info({ itemCount: items.length }, 'Scoring trends');

  // Score relevance in batches of 20 to stay within token limits
  const BATCH_SIZE = 20;
  const relevanceScores: number[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const scores = await scoreRelevanceBatch(batch, topicName, topicDescription, topicKeywords);
    relevanceScores.push(...scores);
  }

  const scored: ScoredTrend[] = items.map((item, i) => {
    const viralityScore = calculateViralityScore(item);
    const relevanceScore = relevanceScores[i] ?? 50;
    const recencyScore = calculateRecencyScore(item.publishedAt);

    const compositeScore =
      viralityScore * 0.4 + relevanceScore * 0.4 + recencyScore * 0.2;

    // Expire trend after a week by default
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return {
      ...item,
      viralityScore: Math.round(viralityScore),
      relevanceScore: Math.round(relevanceScore),
      recencyScore: Math.round(recencyScore),
      compositeScore: Math.round(compositeScore),
      expiresAt,
    };
  });

  // Sort by composite score descending
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  scoringLogger.info(
    {
      itemCount: scored.length,
      topScore: scored[0]?.compositeScore ?? 0,
      avgScore: Math.round(scored.reduce((s, t) => s + t.compositeScore, 0) / scored.length),
    },
    'Trend scoring complete'
  );

  return scored;
}
