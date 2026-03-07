import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from './connection';

// ─────────────────────────────────────────────────────────
// Job Data Types
// ─────────────────────────────────────────────────────────

export interface TrendScanJobData {
  topicId: string;
  userId: string;
  scanJobId: string;
  isManual?: boolean;
}

export interface ContentIdeasJobData {
  topicId: string;
  userId: string;
  trendIds: string[];
}

/**
 * Job data for a scheduled (recurring) content generation run.
 * Fetches recent high-virality trends from the DB rather than relying on fresh scan results.
 */
export interface ScheduledContentJobData {
  topicId: string;
  userId: string;
  isScheduled: true;
}

export type ContentGenerationJobType =
  | 'generate_image'
  | 'generate_video'
  | 'generate_text'
  | 'generate_all';

export interface ContentGenerationJobData {
  topicId: string;
  userId: string;
  contentIdeaId: string;
  platform: string;
  contentType: string;
  jobType: ContentGenerationJobType;
  imageOptions?: {
    aspectRatio?: '1:1' | '9:16' | '16:9' | '4:5';
    style?: string;
    preferDalle?: boolean;
  };
  videoOptions?: {
    duration?: 5 | 10;
    aspectRatio?: '16:9' | '9:16' | '1:1';
  };
  textOptions?: {
    seoKeywords?: string[];
    wordCount?: number;
  };
  generatedContentId?: string;
}

// ─────────────────────────────────────────────────────────
// Queue Names
// ─────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  TREND_SCAN: 'trend-scan',
  CONTENT_IDEAS: 'content-ideas',
  CONTENT_GENERATION: 'content-generation',
} as const;

// ─────────────────────────────────────────────────────────
// Queue Instances (lazily initialised to avoid import-time Redis connection)
// ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQueue = Queue<any, any, string>;

let trendScanQueue: AnyQueue | null = null;
let contentIdeasQueue: AnyQueue | null = null;
let contentGenerationQueue: AnyQueue | null = null;

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

export function getTrendScanQueue(): AnyQueue {
  if (!trendScanQueue) {
    trendScanQueue = new Queue(QUEUE_NAMES.TREND_SCAN, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return trendScanQueue;
}

export function getContentIdeasQueue(): AnyQueue {
  if (!contentIdeasQueue) {
    contentIdeasQueue = new Queue(QUEUE_NAMES.CONTENT_IDEAS, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return contentIdeasQueue;
}

export function getContentGenerationQueue(): AnyQueue {
  if (!contentGenerationQueue) {
    contentGenerationQueue = new Queue(QUEUE_NAMES.CONTENT_GENERATION, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        backoff: { type: 'exponential' as const, delay: 2000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      },
    });
  }
  return contentGenerationQueue;
}
