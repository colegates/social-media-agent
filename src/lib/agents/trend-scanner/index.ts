import { logger } from '@/lib/logger';
import { db } from '@/db';
import { topics, trends, scanJobs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserApiKeys } from '@/lib/services/api-keys';
import { searchGoogle, searchGoogleNews, searchYouTube } from './sources/serpapi';
import { scrapeTikTok, scrapeInstagram } from './sources/apify';
import { fetchSubredditPosts, searchReddit, parseRedditCredentials } from './sources/reddit';
import { searchTweets } from './sources/twitter';
import { scoreTrends } from './scoring';
import type { RawTrendItem } from './types';

const scanLogger = logger.child({ module: 'trend-scanner' });

const MIN_VIRALITY_SCORE = 10;
const MAX_TRENDS_PER_SCAN = 50;

export interface ScanResult {
  trendsFound: number;
  trendIds: string[];
  sourcesConfigured: string[];
  sourcesMissing: string[];
}

/**
 * Run a full trend scan for a topic.
 * Looks up the user's API keys from the DB, then queries all configured sources.
 * Sources with no key configured are skipped gracefully.
 */
export async function runTrendScan(
  topicId: string,
  userId: string,
  scanJobId: string
): Promise<ScanResult> {
  const jobLogger = scanLogger.child({ topicId, userId, scanJobId });
  const start = Date.now();

  await db.update(scanJobs).set({ status: 'running' }).where(eq(scanJobs.id, scanJobId));

  try {
    // Load topic and user API keys in parallel
    const [topic, userKeys] = await Promise.all([
      db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
        with: { sources: true },
      }),
      getUserApiKeys(userId, ['anthropic', 'serpapi', 'apify', 'twitter', 'reddit']),
    ]);

    if (!topic) {
      throw new Error(`Topic ${topicId} not found for user ${userId}`);
    }

    // Log which sources are available
    const sourcesConfigured: string[] = [];
    const sourcesMissing: string[] = [];

    if (userKeys.serpapi) sourcesConfigured.push('google', 'youtube');
    else sourcesMissing.push('google', 'youtube');

    if (userKeys.apify) sourcesConfigured.push('tiktok', 'instagram');
    else sourcesMissing.push('tiktok', 'instagram');

    if (userKeys.twitter) sourcesConfigured.push('twitter');
    else sourcesMissing.push('twitter');

    const redditCredentials = parseRedditCredentials(userKeys.reddit ?? null);
    sourcesConfigured.push('reddit'); // works anonymously, or authenticated if credentials provided

    jobLogger.info(
      { topicName: topic.name, sourcesConfigured, sourcesMissing },
      'Starting trend scan'
    );

    // Extract sources by type
    const subreddits = topic.sources.filter((s) => s.type === 'subreddit').map((s) => s.value);
    const hashtags = topic.sources.filter((s) => s.type === 'hashtag').map((s) => s.value);
    const searchTerms = topic.sources.filter((s) => s.type === 'search_term').map((s) => s.value);

    const allKeywords = [...topic.keywords, ...searchTerms].filter(Boolean);
    const allHashtags = [...hashtags, ...topic.keywords.map((k) => `#${k}`)].filter(Boolean);

    // Fetch from all sources concurrently
    const [
      googleResults,
      googleNewsResults,
      youtubeResults,
      twitterResults,
      tiktokResults,
      instagramResults,
      ...redditResults
    ] = await Promise.allSettled([
      searchGoogle(allKeywords, userKeys.serpapi ?? null, 10),
      searchGoogleNews(allKeywords, userKeys.serpapi ?? null, 10),
      searchYouTube(allKeywords, userKeys.serpapi ?? null, 10),
      searchTweets(allKeywords, userKeys.twitter ?? null, 20),
      scrapeTikTok(allKeywords, userKeys.apify ?? null, 20),
      scrapeInstagram(allHashtags, userKeys.apify ?? null, 20),
      searchReddit(allKeywords, subreddits, 10, redditCredentials),
      ...subreddits
        .slice(0, 5)
        .map((sub) => fetchSubredditPosts(sub, 'hot', 10, redditCredentials)),
    ]);

    const allItems: RawTrendItem[] = [];

    function addSettled(result: PromiseSettledResult<RawTrendItem[]>, source: string): void {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
        jobLogger.debug({ source, count: result.value.length }, 'Source results collected');
      } else {
        jobLogger.warn({ source, err: result.reason }, 'Source fetch failed, continuing');
      }
    }

    addSettled(googleResults, 'google');
    addSettled(googleNewsResults, 'google-news');
    addSettled(youtubeResults, 'youtube');
    addSettled(twitterResults, 'twitter');
    addSettled(tiktokResults, 'tiktok');
    addSettled(instagramResults, 'instagram');
    for (const redditResult of redditResults) {
      addSettled(redditResult as PromiseSettledResult<RawTrendItem[]>, 'reddit');
    }

    jobLogger.info({ totalRaw: allItems.length }, 'All sources collected');

    if (allItems.length === 0) {
      jobLogger.warn('No trend items found from any source');
      await db
        .update(scanJobs)
        .set({
          status: 'completed',
          trendsFound: 0,
          completedAt: new Date(),
          metadata: { sourcesConfigured, sourcesMissing },
        })
        .where(eq(scanJobs.id, scanJobId));
      return { trendsFound: 0, trendIds: [], sourcesConfigured, sourcesMissing };
    }

    // Deduplicate
    const seen = new Set<string>();
    const deduplicated = allItems.filter((item) => {
      const key = (item.sourceUrl ?? item.title).toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    jobLogger.info({ deduplicated: deduplicated.length }, 'Deduplicated trend items');

    // Score (uses Anthropic if key available, otherwise falls back to heuristics)
    const scored = await scoreTrends(
      deduplicated,
      topic.name,
      topic.description ?? null,
      allKeywords,
      userKeys.anthropic ?? null
    );

    const topTrends = scored
      .filter((t) => t.compositeScore >= MIN_VIRALITY_SCORE)
      .slice(0, MAX_TRENDS_PER_SCAN);

    jobLogger.info({ topTrendsCount: topTrends.length }, 'Top trends selected');

    const trendIds: string[] = [];
    if (topTrends.length > 0) {
      const inserted = await db
        .insert(trends)
        .values(
          topTrends.map((trend) => ({
            topicId,
            title: trend.title.slice(0, 500),
            description: trend.description?.slice(0, 2000),
            sourceUrl: trend.sourceUrl?.slice(0, 2000),
            platform: trend.platform,
            viralityScore: trend.compositeScore,
            engagementData: trend.engagementData,
            rawData: {
              ...trend.rawData,
              viralityScore: trend.viralityScore,
              relevanceScore: trend.relevanceScore,
              recencyScore: trend.recencyScore,
            },
            expiresAt: trend.expiresAt,
          }))
        )
        .returning({ id: trends.id });

      trendIds.push(...inserted.map((t) => t.id));
    }

    const duration = Date.now() - start;

    await db
      .update(scanJobs)
      .set({
        status: 'completed',
        trendsFound: trendIds.length,
        completedAt: new Date(),
        metadata: {
          duration,
          sources: { total: allItems.length, deduplicated: deduplicated.length },
          sourcesConfigured,
          sourcesMissing,
        },
      })
      .where(eq(scanJobs.id, scanJobId));

    jobLogger.info({ trendsFound: trendIds.length, duration }, 'Trend scan completed successfully');

    return { trendsFound: trendIds.length, trendIds, sourcesConfigured, sourcesMissing };
  } catch (err) {
    const duration = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);

    jobLogger.error({ err, duration }, 'Trend scan failed');

    await db
      .update(scanJobs)
      .set({ status: 'failed', completedAt: new Date(), errorLog: errorMessage })
      .where(eq(scanJobs.id, scanJobId));

    throw err;
  }
}
