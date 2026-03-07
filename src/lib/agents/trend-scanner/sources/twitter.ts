import { logger } from '@/lib/logger';
import type { RawTrendItem } from '../types';
import { ExternalApiError } from '../types';

const sourceLogger = logger.child({ module: 'trend-scanner', source: 'twitter' });

const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

interface TwitterTweet {
  id?: string;
  text?: string;
  created_at?: string;
  public_metrics?: {
    retweet_count?: number;
    like_count?: number;
    reply_count?: number;
    quote_count?: number;
    impression_count?: number;
  };
  author_id?: string;
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
  meta?: {
    result_count?: number;
    next_token?: string;
  };
}

async function twitterFetch(
  endpoint: string,
  params: Record<string, string>,
  bearerToken: string,
  attempt = 0
): Promise<unknown> {
  const searchParams = new URLSearchParams(params);
  const url = `${TWITTER_API_BASE}${endpoint}?${searchParams.toString()}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timeout);

    const duration = Date.now() - start;
    sourceLogger.debug({ endpoint, status: response.status, duration }, 'Twitter API request');

    if (response.status === 429) {
      const resetTime = response.headers.get('x-rate-limit-reset');
      const waitMs = resetTime
        ? Math.max(0, parseInt(resetTime, 10) * 1000 - Date.now()) + 1000
        : 60_000;
      sourceLogger.warn({ waitMs, attempt }, 'Twitter rate limited');
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 30_000)));
        return twitterFetch(endpoint, params, bearerToken, attempt + 1);
      }
      throw new ExternalApiError('rate_limit', 'Twitter rate limit exceeded', 'twitter', 429);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ExternalApiError('auth_error', `Twitter auth failed: ${response.status}`, 'twitter', response.status);
    }

    if (!response.ok) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        return twitterFetch(endpoint, params, bearerToken, attempt + 1);
      }
      throw new ExternalApiError('api_error', `Twitter API returned ${response.status}`, 'twitter', response.status);
    }

    return response.json();
  } catch (err) {
    if (err instanceof ExternalApiError) throw err;

    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000;
      sourceLogger.warn({ attempt, delay, err }, 'Twitter request failed, retrying');
      await new Promise((r) => setTimeout(r, delay));
      return twitterFetch(endpoint, params, bearerToken, attempt + 1);
    }

    throw new ExternalApiError('network_error', `Twitter network error: ${String(err)}`, 'twitter');
  }
}

export async function searchTweets(
  keywords: string[],
  bearerToken: string | null,
  maxResults = 20
): Promise<RawTrendItem[]> {
  if (!bearerToken) {
    sourceLogger.warn('Twitter bearer token not configured, skipping Twitter search');
    return [];
  }

  const query = keywords
    .slice(0, 5)
    .map((k) => (k.includes(' ') ? `"${k}"` : k))
    .join(' OR ');

  const fullQuery = `(${query}) -is:retweet -is:reply lang:en`;

  sourceLogger.info({ query: fullQuery, maxResults }, 'Searching Twitter');

  try {
    const raw = await twitterFetch(
      '/tweets/search/recent',
      {
        query: fullQuery,
        max_results: String(Math.min(maxResults, 100)),
        'tweet.fields': 'created_at,public_metrics,author_id',
        sort_order: 'relevancy',
      },
      bearerToken
    );

    const data = raw as TwitterSearchResponse;
    const tweets = data.data ?? [];

    const results: RawTrendItem[] = tweets.map((tweet) => ({
      title: tweet.text ?? '',
      sourceUrl: tweet.id ? `https://x.com/i/web/status/${tweet.id}` : undefined,
      platform: 'x' as const,
      engagementData: {
        likes: tweet.public_metrics?.like_count ?? 0,
        shares: tweet.public_metrics?.retweet_count ?? 0,
        comments: tweet.public_metrics?.reply_count ?? 0,
        views: tweet.public_metrics?.impression_count ?? 0,
      },
      rawData: tweet as Record<string, unknown>,
      publishedAt: tweet.created_at ? new Date(tweet.created_at) : undefined,
    }));

    sourceLogger.info({ count: results.length }, 'Twitter results fetched');
    return results;
  } catch (err) {
    sourceLogger.error({ err }, 'Twitter search failed');
    return [];
  }
}
