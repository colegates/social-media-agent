import { logger } from '@/lib/logger';
import type { RawTrendItem } from '../types';
import { ExternalApiError } from '../types';

const sourceLogger = logger.child({ module: 'trend-scanner', source: 'reddit' });

const REDDIT_BASE_URL = 'https://www.reddit.com';
const OAUTH_BASE_URL = 'https://oauth.reddit.com';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
// Reddit allows 60 req/min for anonymous; keep well under
const REQUEST_DELAY_MS = 1200;

let lastRequestTime = 0;

export interface RedditCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Parse stored Reddit credentials JSON (from user_api_keys).
 * Returns null if the stored value is missing or invalid.
 */
export function parseRedditCredentials(
  storedKey: string | null | undefined
): RedditCredentials | null {
  if (!storedKey) return null;
  try {
    const parsed = JSON.parse(storedKey) as { clientId?: string; clientSecret?: string };
    if (!parsed.clientId || !parsed.clientSecret) return null;
    return { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
  } catch {
    return null;
  }
}

/**
 * Get a Reddit OAuth access token using client_credentials flow.
 */
async function getOAuthToken(credentials: RedditCredentials): Promise<string> {
  const encoded = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
    'base64'
  );

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'social-media-agent/0.1.0',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new ExternalApiError(
      'auth_error',
      `Reddit OAuth failed: ${res.status}`,
      'reddit',
      res.status
    );
  }

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new ExternalApiError(
      'auth_error',
      `Reddit OAuth error: ${data.error ?? 'no token'}`,
      'reddit'
    );
  }

  return data.access_token;
}

async function rateLimitedFetch(
  url: string,
  extraHeaders: Record<string, string> = {},
  attempt = 0
): Promise<unknown> {
  // Enforce rate limit
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'social-media-agent/0.1.0 (by /u/social_media_agent_bot)',
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
    clearTimeout(timeout);

    const duration = Date.now() - start;
    sourceLogger.debug({ url, status: response.status, duration }, 'Reddit request');

    if (response.status === 429) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10);
        sourceLogger.warn({ retryAfter, attempt }, 'Reddit rate limited, waiting');
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return rateLimitedFetch(url, extraHeaders, attempt + 1);
      }
      throw new ExternalApiError('rate_limit', 'Reddit rate limit exceeded', 'reddit', 429);
    }

    if (!response.ok) {
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        sourceLogger.warn(
          { attempt, delay, status: response.status },
          'Reddit request failed, retrying'
        );
        await new Promise((r) => setTimeout(r, delay));
        return rateLimitedFetch(url, extraHeaders, attempt + 1);
      }
      throw new ExternalApiError(
        'api_error',
        `Reddit API returned ${response.status}`,
        'reddit',
        response.status
      );
    }

    return response.json();
  } catch (err) {
    if (err instanceof ExternalApiError) throw err;

    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000;
      sourceLogger.warn({ attempt, delay, err }, 'Reddit fetch error, retrying');
      await new Promise((r) => setTimeout(r, delay));
      return rateLimitedFetch(url, extraHeaders, attempt + 1);
    }

    throw new ExternalApiError('network_error', `Reddit network error: ${String(err)}`, 'reddit');
  }
}

interface RedditPost {
  title?: string;
  selftext?: string;
  url?: string;
  permalink?: string;
  score?: number;
  ups?: number;
  num_comments?: number;
  upvote_ratio?: number;
  created_utc?: number;
  subreddit?: string;
  is_video?: boolean;
  preview?: unknown;
}

interface RedditResponse {
  data?: {
    children?: Array<{ data?: RedditPost }>;
  };
}

function parseRedditResponse(raw: unknown): RedditPost[] {
  const resp = raw as RedditResponse;
  return (resp?.data?.children ?? [])
    .map((child) => child.data)
    .filter((post): post is RedditPost => Boolean(post?.title));
}

export async function fetchSubredditPosts(
  subreddit: string,
  sort: 'hot' | 'rising' | 'top' = 'hot',
  limit = 10,
  credentials?: RedditCredentials | null
): Promise<RawTrendItem[]> {
  // Clean up subreddit input
  const sub = subreddit.replace(/^\/?(r\/)?/, '').split('/')[0];

  let headers: Record<string, string> = {};
  let baseUrl = REDDIT_BASE_URL;

  if (credentials) {
    try {
      const token = await getOAuthToken(credentials);
      headers = { Authorization: `Bearer ${token}` };
      baseUrl = OAUTH_BASE_URL;
    } catch (err) {
      sourceLogger.warn({ err }, 'Reddit OAuth failed, falling back to anonymous access');
    }
  }

  const url = `${baseUrl}/r/${sub}/${sort}.json?limit=${limit}&t=day`;
  sourceLogger.info(
    { subreddit: sub, sort, limit, authenticated: Boolean(credentials) },
    'Fetching Reddit posts'
  );

  try {
    const raw = await rateLimitedFetch(url, headers);
    const posts = parseRedditResponse(raw);

    const results: RawTrendItem[] = posts.map((post) => ({
      title: post.title ?? '',
      description: post.selftext ? post.selftext.slice(0, 500) : undefined,
      sourceUrl: post.permalink ? `${REDDIT_BASE_URL}${post.permalink}` : post.url,
      platform: 'reddit' as const,
      engagementData: {
        upvotes: post.score ?? post.ups ?? 0,
        comments: post.num_comments ?? 0,
        score: post.score ?? 0,
      },
      rawData: post as Record<string, unknown>,
      publishedAt: post.created_utc ? new Date(post.created_utc * 1000) : undefined,
    }));

    sourceLogger.info({ subreddit: sub, count: results.length }, 'Reddit posts fetched');
    return results;
  } catch (err) {
    sourceLogger.error({ err, subreddit: sub }, 'Reddit fetch failed');
    return [];
  }
}

export async function searchReddit(
  keywords: string[],
  subreddits: string[] = [],
  limit = 10,
  credentials?: RedditCredentials | null
): Promise<RawTrendItem[]> {
  const query = keywords.slice(0, 5).join(' ');
  const subredditFilter =
    subreddits.length > 0
      ? `subreddit:${subreddits.map((s) => s.replace(/^\/?(r\/)?/, '')).join('+')}`
      : '';
  const fullQuery = [query, subredditFilter].filter(Boolean).join(' ');

  let headers: Record<string, string> = {};
  let baseUrl = REDDIT_BASE_URL;

  if (credentials) {
    try {
      const token = await getOAuthToken(credentials);
      headers = { Authorization: `Bearer ${token}` };
      baseUrl = OAUTH_BASE_URL;
    } catch (err) {
      sourceLogger.warn({ err }, 'Reddit OAuth failed, falling back to anonymous access');
    }
  }

  const url = `${baseUrl}/search.json?q=${encodeURIComponent(fullQuery)}&sort=top&t=day&limit=${limit}`;
  sourceLogger.info(
    { query: fullQuery, limit, authenticated: Boolean(credentials) },
    'Searching Reddit'
  );

  try {
    const raw = await rateLimitedFetch(url, headers);
    const posts = parseRedditResponse(raw);

    const results: RawTrendItem[] = posts.map((post) => ({
      title: post.title ?? '',
      description: post.selftext ? post.selftext.slice(0, 500) : undefined,
      sourceUrl: post.permalink ? `${REDDIT_BASE_URL}${post.permalink}` : post.url,
      platform: 'reddit' as const,
      engagementData: {
        upvotes: post.score ?? post.ups ?? 0,
        comments: post.num_comments ?? 0,
        score: post.score ?? 0,
      },
      rawData: post as Record<string, unknown>,
      publishedAt: post.created_utc ? new Date(post.created_utc * 1000) : undefined,
    }));

    sourceLogger.info({ count: results.length }, 'Reddit search results fetched');
    return results;
  } catch (err) {
    sourceLogger.error({ err, query }, 'Reddit search failed');
    return [];
  }
}
