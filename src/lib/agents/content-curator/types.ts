import type { ContentIdeaPlatform, ContentIdeaContentType } from '@/db/schema';

export interface TrendInput {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  platform: string;
  viralityScore: number;
  discoveredAt: Date;
}

export interface StyleProfileInput {
  tone: string;
  voiceCharacteristics: string[];
  vocabularyLevel: string;
  emojiUsage: string;
  hashtagStyle: string;
  contentThemes: string[];
  platformPreferences: Record<string, string>;
  doList: string[];
  dontList: string[];
}

export interface GeneratedIdea {
  title: string;
  description: string;
  platform: ContentIdeaPlatform;
  contentType: ContentIdeaContentType;
  suggestedCopy: string;
  visualDirection: string;
}

export interface ScoredIdea extends GeneratedIdea {
  trendId: string;
  viralityScore: number;
  brandRelevance: number;
  platformFit: number;
  timeliness: number;
  priorityScore: number;
}

export interface CurationResult {
  ideasGenerated: number;
  ideasSaved: number;
  ideasAutoApproved: number;
}
