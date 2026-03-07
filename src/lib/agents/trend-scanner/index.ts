import { logger } from '@/lib/logger';
import { db } from '@/db';
import { topics, topicSources, trends, scanJobs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { searchGoogle, searchGoogleNews, searchYouTube } from './sources/serpapi';
import { scrapeTikTok, scrapeInstagram } from './sources/apify';
import { fetchSubredditPosts, searchReddit } from './sources/reddit';
import { searchTweets } from './sources/twitter';
import { scoreTrends } from './scoring';
import type { RawTrendItem } from './types';

const scanLogger = logger.child({ module: 'trend-scanner' });

const MIN_VIRALITY_SCORE = 10; // Filter out very low-quality results
const MAX_TRENDS_PER_SCAN = 50;

interface ScanResult {
  trendsFound: number;
  trendIds: string[];
}

/**
 * Run a full trend scan for a topic.
 * Fetches from all configured sources, scores results, and stores in DB.
 */
export async function runTrendScan(
  topicId: string,
  userId: string,
  scanJobId: string
): Promise<ScanResult> {
  const jobLogger = scanLogger.child({ topicId, userId, scanJobId });
  const start = Date.now();

  // Mark scan job as running
  await db
    .update(scanJobs)
    .set({ status: 'running' })
    .where(eq(scanJobs.id, scanJobId));

  try {
    // Fetch topic with sources
    const topic = await db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
      with: { sources: true },
    });

    if (!topic) {
      throw new Error(`Topic ${topicId} not found for user ${userId}`);
    }

    jobLogger.info({ topicName: topic.name, keywords: topic.keywords }, 'Starting trend scan');

    // Extract sources by type
    const subreddits = topic.sources
      .filter((s) => s.type === 'subreddit')
      .map((s) => s.value);
    const hashtags = topic.sources
      .filter((s) => s.type === 'hashtag')
      .map((s) => s.value);
    const searchTerms = topic.sources
      .filter((s) => s.type === 'search_term')
      .map((s) => s.value);

    const allKeywords = [
      ...topic.keywords,
      ...searchTerms,
    ].filter(Boolean);

    const allHashtags = [
      ...hashtags,
      ...topic.keywords.map((k) => `#${k}`),
    ].filter(Boolean);

    // Fetch from all sources concurrently, with graceful degradation
    jobLogger.info('Fetching from all sources concurrently');

    const [
      googleResults,
      googleNewsResults,
      youtubeResults,
      twitterResults,
      tiktokResults,
      instagramResults,
      ...redditResults
    ] = await Promise.allSettled([
      // Web/Google sources
      searchGoogle(allKeywords, 10),
      searchGoogleNews(allKeywords, 10),
      searchYouTube(allKeywords, 10),
      // Social sources
      searchTweets(allKeywords, 20),
      scrapeTikTok(allKeywords, 20),
      scrapeInstagram(allHashtags, 20),
      // Reddit: search + individual subreddits
      searchReddit(allKeywords, subreddits, 10),
      ...subreddits.slice(0, 5).map((sub) => fetchSubredditPosts(sub, 'hot', 10)),
    ]);

    // Aggregate all results, ignoring failures
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
        .set({ status: 'completed', trendsFound: 0, completedAt: new Date() })
        .where(eq(scanJobs.id, scanJobId));
      return { trendsFound: 0, trendIds: [] };
    }

    // Deduplicate by title similarity (simple URL/title dedup)
    const seen = new Set<string>();
    const deduplicated = allItems.filter((item) => {
      const key = (item.sourceUrl ?? item.title).toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    jobLogger.info({ deduplicated: deduplicated.length }, 'Deduplicated trend items');

    // Score all items
    const scored = await scoreTrends(
      deduplicated,
      topic.name,
      topic.description ?? null,
      allKeywords
    );

    // Filter and limit
    const topTrends = scored
      .filter((t) => t.compositeScore >= MIN_VIRALITY_SCORE)
      .slice(0, MAX_TRENDS_PER_SCAN);

    jobLogger.info({ topTrendsCount: topTrends.length }, 'Top trends selected');

    // Store in database
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

    // Mark scan job as completed
    await db
      .update(scanJobs)
      .set({
        status: 'completed',
        trendsFound: trendIds.length,
        completedAt: new Date(),
        metadata: { duration, sources: { total: allItems.length, deduplicated: deduplicated.length } },
      })
      .where(eq(scanJobs.id, scanJobId));

    jobLogger.info(
      { trendsFound: trendIds.length, duration },
      'Trend scan completed successfully'
    );

    return { trendsFound: trendIds.length, trendIds };
  } catch (err) {
    const duration = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);

    jobLogger.error({ err, duration }, 'Trend scan failed');

    await db
      .update(scanJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        errorLog: errorMessage,
      })
      .where(eq(scanJobs.id, scanJobId));

    throw err;
  }
}
