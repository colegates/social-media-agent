import { ApifyClient } from 'apify-client';
import { logger } from '@/lib/logger';
import type { RawTrendItem } from '../types';
import { ExternalApiError } from '../types';

const sourceLogger = logger.child({ module: 'trend-scanner', source: 'apify' });

const ACTOR_TIMEOUT_MS = 120_000; // 2 minutes for actor runs
const MAX_RETRIES = 2;

function getClient(): ApifyClient {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new ExternalApiError('auth_error', 'APIFY_API_TOKEN not set', 'apify');
  }
  return new ApifyClient({ token });
}

async function runActorWithRetry<T>(
  actorId: string,
  input: Record<string, unknown>,
  attempt = 0
): Promise<T[]> {
  const client = getClient();
  const start = Date.now();

  try {
    const run = await client.actor(actorId).call(input, {
      timeout: ACTOR_TIMEOUT_MS / 1000,
      memory: 512,
    });

    const duration = Date.now() - start;
    sourceLogger.debug(
      { actorId, runId: run.id, status: run.status, duration },
      'Apify actor run completed'
    );

    if (run.status !== 'SUCCEEDED') {
      throw new ExternalApiError(
        'api_error',
        `Apify actor ${actorId} failed with status: ${run.status}`,
        'apify'
      );
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items as T[];
  } catch (err) {
    if (err instanceof ExternalApiError) throw err;

    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 2000;
      sourceLogger.warn({ attempt, delay, actorId, err }, 'Apify actor run failed, retrying');
      await new Promise((r) => setTimeout(r, delay));
      return runActorWithRetry<T>(actorId, input, attempt + 1);
    }

    throw new ExternalApiError(
      'network_error',
      `Apify actor ${actorId} failed: ${String(err)}`,
      'apify'
    );
  }
}

interface TikTokItem {
  text?: string;
  desc?: string;
  webVideoUrl?: string;
  diggCount?: number;
  shareCount?: number;
  commentCount?: number;
  playCount?: number;
  createTime?: number;
}

export async function scrapeTikTok(keywords: string[], maxResults = 20): Promise<RawTrendItem[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    sourceLogger.warn('APIFY_API_TOKEN not set, skipping TikTok scraping');
    return [];
  }

  sourceLogger.info({ keywords: keywords.slice(0, 3), maxResults }, 'Scraping TikTok via Apify');

  try {
    // Using Apify's TikTok scraper actor
    const items = await runActorWithRetry<TikTokItem>(
      'clockworks/free-tiktok-scraper',
      {
        searchQueries: keywords.slice(0, 3),
        resultsPerQuery: Math.ceil(maxResults / keywords.length),
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }
    );

    const results: RawTrendItem[] = items
      .filter((item): item is TikTokItem & { text: string } => Boolean(item.text || item.desc))
      .map((item) => ({
        title: item.text ?? item.desc ?? '',
        sourceUrl: item.webVideoUrl,
        platform: 'tiktok' as const,
        engagementData: {
          likes: item.diggCount ?? 0,
          shares: item.shareCount ?? 0,
          comments: item.commentCount ?? 0,
          views: item.playCount ?? 0,
        },
        rawData: item as unknown as Record<string, unknown>,
        publishedAt: item.createTime ? new Date(item.createTime * 1000) : undefined,
      }));

    sourceLogger.info({ count: results.length }, 'TikTok results fetched');
    return results.slice(0, maxResults);
  } catch (err) {
    sourceLogger.error({ err }, 'TikTok scraping failed');
    return [];
  }
}

interface InstagramItem {
  caption?: string;
  url?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  timestamp?: string;
  hashtags?: string[];
}

export async function scrapeInstagram(
  hashtags: string[],
  maxResults = 20
): Promise<RawTrendItem[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    sourceLogger.warn('APIFY_API_TOKEN not set, skipping Instagram scraping');
    return [];
  }

  sourceLogger.info({ hashtags: hashtags.slice(0, 3), maxResults }, 'Scraping Instagram via Apify');

  try {
    const items = await runActorWithRetry<InstagramItem>(
      'apify/instagram-hashtag-scraper',
      {
        hashtags: hashtags.slice(0, 5).map((h) => h.replace(/^#/, '')),
        resultsLimit: maxResults,
        proxy: { useApifyProxy: true },
      }
    );

    const results: RawTrendItem[] = items
      .filter((item): item is InstagramItem & { caption: string } => Boolean(item.caption))
      .map((item) => ({
        title: item.caption!.slice(0, 200),
        description: item.caption!.length > 200 ? item.caption!.slice(200, 500) : undefined,
        sourceUrl: item.url,
        platform: 'instagram' as const,
        engagementData: {
          likes: item.likesCount ?? 0,
          comments: item.commentsCount ?? 0,
          views: item.videoViewCount ?? 0,
        },
        rawData: item as unknown as Record<string, unknown>,
        publishedAt: item.timestamp ? new Date(item.timestamp) : undefined,
      }));

    sourceLogger.info({ count: results.length }, 'Instagram results fetched');
    return results;
  } catch (err) {
    sourceLogger.error({ err }, 'Instagram scraping failed');
    return [];
  }
}
