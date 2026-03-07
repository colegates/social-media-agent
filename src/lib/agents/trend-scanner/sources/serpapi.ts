import { logger } from '@/lib/logger';
import type { RawTrendItem } from '../types';
import { ExternalApiError } from '../types';

const sourceLogger = logger.child({ module: 'trend-scanner', source: 'serpapi' });

const SERPAPI_BASE_URL = 'https://serpapi.com/search';
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

interface SerpApiResult {
  organic_results?: Array<{
    title?: string;
    snippet?: string;
    link?: string;
    displayed_link?: string;
  }>;
  news_results?: Array<{
    title?: string;
    snippet?: string;
    link?: string;
    date?: string;
    source?: string;
  }>;
  trending_searches?: Array<{
    query?: string;
    traffic?: string;
  }>;
  video_results?: Array<{
    title?: string;
    snippet?: string;
    link?: string;
    source?: string;
    views?: string;
    date?: string;
  }>;
  error?: string;
}

async function fetchWithRetry(
  url: string,
  params: Record<string, string>,
  attempt = 0
): Promise<SerpApiResult> {
  const searchParams = new URLSearchParams(params);
  const fullUrl = `${url}?${searchParams.toString()}`;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(fullUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const duration = Date.now() - start;
    sourceLogger.debug(
      { url: SERPAPI_BASE_URL, params: { q: params.q, engine: params.engine }, status: response.status, duration },
      'SerpAPI request'
    );

    if (response.status === 429) {
      throw new ExternalApiError('rate_limit', 'SerpAPI rate limit exceeded', 'serpapi', 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ExternalApiError('auth_error', 'SerpAPI authentication failed', 'serpapi', response.status);
    }
    if (!response.ok) {
      throw new ExternalApiError('api_error', `SerpAPI returned ${response.status}`, 'serpapi', response.status);
    }

    return response.json() as Promise<SerpApiResult>;
  } catch (err) {
    if (err instanceof ExternalApiError) throw err;

    if (attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000;
      sourceLogger.warn({ attempt, delay, err }, 'SerpAPI request failed, retrying');
      await new Promise((r) => setTimeout(r, delay));
      return fetchWithRetry(url, params, attempt + 1);
    }

    throw new ExternalApiError('network_error', `SerpAPI network error: ${String(err)}`, 'serpapi');
  }
}

export async function searchGoogle(
  keywords: string[],
  apiKey: string | null,
  maxResults = 10
): Promise<RawTrendItem[]> {
  if (!apiKey) {
    sourceLogger.warn('SerpAPI key not configured, skipping Google search');
    return [];
  }

  const query = keywords.slice(0, 5).join(' OR ');
  sourceLogger.info({ query, maxResults }, 'Searching Google via SerpAPI');

  try {
    const data = await fetchWithRetry(SERPAPI_BASE_URL, {
      api_key: apiKey,
      engine: 'google',
      q: query,
      num: String(maxResults),
      tbs: 'qdr:d', // last 24 hours
      gl: 'us',
      hl: 'en',
    });

    if (data.error) {
      throw new ExternalApiError('api_error', data.error, 'serpapi');
    }

    const results: RawTrendItem[] = [];
    for (const item of data.organic_results ?? []) {
      if (!item.title) continue;
      results.push({
        title: item.title,
        description: item.snippet,
        sourceUrl: item.link,
        platform: 'web',
        engagementData: {},
        rawData: item as Record<string, unknown>,
        publishedAt: new Date(),
      });
    }

    sourceLogger.info({ count: results.length }, 'Google search results fetched');
    return results;
  } catch (err) {
    sourceLogger.error({ err }, 'Google search failed');
    return [];
  }
}

export async function searchGoogleNews(
  keywords: string[],
  apiKey: string | null,
  maxResults = 10
): Promise<RawTrendItem[]> {
  if (!apiKey) {
    sourceLogger.warn('SerpAPI key not configured, skipping Google News search');
    return [];
  }

  const query = keywords.slice(0, 5).join(' OR ');
  sourceLogger.info({ query, maxResults }, 'Searching Google News via SerpAPI');

  try {
    const data = await fetchWithRetry(SERPAPI_BASE_URL, {
      api_key: apiKey,
      engine: 'google_news',
      q: query,
      gl: 'us',
      hl: 'en',
    });

    if (data.error) {
      throw new ExternalApiError('api_error', data.error, 'serpapi');
    }

    const results: RawTrendItem[] = [];
    for (const item of data.news_results ?? []) {
      if (!item.title) continue;
      results.push({
        title: item.title,
        description: item.snippet,
        sourceUrl: item.link,
        platform: 'web',
        engagementData: {},
        rawData: item as Record<string, unknown>,
        publishedAt: item.date ? new Date(item.date) : new Date(),
      });
    }

    sourceLogger.info({ count: results.length }, 'Google News results fetched');
    return results.slice(0, maxResults);
  } catch (err) {
    sourceLogger.error({ err }, 'Google News search failed');
    return [];
  }
}

export async function searchYouTube(
  keywords: string[],
  apiKey: string | null,
  maxResults = 10
): Promise<RawTrendItem[]> {
  if (!apiKey) {
    sourceLogger.warn('SerpAPI key not configured, skipping YouTube search');
    return [];
  }

  const query = keywords.slice(0, 5).join(' ');
  sourceLogger.info({ query, maxResults }, 'Searching YouTube via SerpAPI');

  try {
    const data = await fetchWithRetry(SERPAPI_BASE_URL, {
      api_key: apiKey,
      engine: 'youtube',
      search_query: query,
    });

    if (data.error) {
      throw new ExternalApiError('api_error', data.error, 'serpapi');
    }

    const results: RawTrendItem[] = [];
    for (const item of data.video_results ?? []) {
      if (!item.title) continue;
      const viewCount = item.views ? parseInt(item.views.replace(/[^0-9]/g, ''), 10) || 0 : 0;
      results.push({
        title: item.title,
        description: item.snippet,
        sourceUrl: item.link,
        platform: 'youtube',
        engagementData: { views: viewCount },
        rawData: item as Record<string, unknown>,
        publishedAt: item.date ? new Date(item.date) : undefined,
      });
    }

    sourceLogger.info({ count: results.length }, 'YouTube search results fetched');
    return results.slice(0, maxResults);
  } catch (err) {
    sourceLogger.error({ err }, 'YouTube search failed');
    return [];
  }
}
