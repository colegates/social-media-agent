import type { TrendPlatform } from '@/db/schema';

export interface RawTrendItem {
  title: string;
  description?: string;
  sourceUrl?: string;
  platform: TrendPlatform;
  engagementData: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
    upvotes?: number;
    score?: number;
  };
  rawData: Record<string, unknown>;
  publishedAt?: Date;
}

export interface ScoredTrend extends RawTrendItem {
  viralityScore: number;
  relevanceScore: number;
  recencyScore: number;
  compositeScore: number;
  expiresAt?: Date;
}

export type ExternalApiErrorType = 'rate_limit' | 'auth_error' | 'network_error' | 'api_error';

export class ExternalApiError extends Error {
  constructor(
    public readonly type: ExternalApiErrorType,
    message: string,
    public readonly service: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}
