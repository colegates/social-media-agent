// Re-export common types for use across the application

export type { User, NewUser, StyleExample, NewStyleExample, StyleExampleType } from '@/db/schema';

// Style Profile produced by Claude analysis
export interface StyleProfile {
  tone: string;
  voiceCharacteristics: string[];
  vocabularyLevel: 'simple' | 'moderate' | 'advanced';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'heavy';
  hashtagStyle: 'none' | 'minimal' | 'branded' | 'trending';
  contentThemes: string[];
  platformPreferences: Record<string, string>;
  doList: string[];
  dontList: string[];
  analysedAt: string; // ISO date string
}

// Auth session extension
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}
