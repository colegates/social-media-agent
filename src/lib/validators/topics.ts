import { z } from 'zod';

export const SCAN_FREQUENCY_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' },
] as const;

export const CONTENT_GENERATION_FREQUENCY_OPTIONS = [
  { value: null, label: 'Disabled (manual only)' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours (once per day)' },
  { value: 2880, label: '48 hours (every 2 days)' },
  { value: 10080, label: '7 days (weekly)' },
] as const;

export const DEDUPLICATION_WINDOW_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 168, label: '7 days' },
] as const;

export const SOURCE_TYPES = [
  'website',
  'social_link',
  'subreddit',
  'hashtag',
  'search_term',
  'competitor_account',
  'platform',
] as const;

/**
 * Platforms the scanner can query using keyword-based search.
 * Use these as the `value` when adding a source with type `platform`.
 */
export const SUPPORTED_SCAN_PLATFORMS = [
  { value: 'google', label: 'Google', requiresKey: 'serpapi' },
  { value: 'youtube', label: 'YouTube', requiresKey: 'serpapi' },
  { value: 'instagram', label: 'Instagram', requiresKey: 'apify' },
  { value: 'tiktok', label: 'TikTok', requiresKey: 'apify' },
  { value: 'twitter', label: 'Twitter / X', requiresKey: 'twitter' },
  { value: 'reddit', label: 'Reddit', requiresKey: null },
] as const;

export type SupportedPlatform = (typeof SUPPORTED_SCAN_PLATFORMS)[number]['value'];

export const topicSettingsSchema = z.object({
  autoApproveThreshold: z.number().int().min(0).max(100).nullable().optional(),
  notifyOnNewIdeas: z.boolean().optional(),
  /** Maximum number of ideas to generate per curation run. null = unlimited. */
  maxIdeasPerRun: z.number().int().min(1).max(100).nullable().optional(),
});

export type TopicSettings = z.infer<typeof topicSettingsSchema>;

export const createTopicSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .or(z.literal('')),
  keywords: z.array(z.string().min(1).max(100)).min(0).max(20, 'Maximum 20 keywords allowed'),
  scanFrequencyMinutes: z
    .number()
    .int()
    .min(15, 'Minimum scan frequency is 15 minutes')
    .max(1440, 'Maximum scan frequency is 24 hours'),
  contentGenerationFrequencyMinutes: z
    .number()
    .int()
    .min(60, 'Minimum content generation frequency is 60 minutes')
    .max(10080, 'Maximum content generation frequency is 7 days')
    .nullable()
    .optional(),
  trendDeduplicationWindowHours: z
    .number()
    .int()
    .min(1, 'Minimum deduplication window is 1 hour')
    .max(168, 'Maximum deduplication window is 7 days')
    .optional(), // default (24h) applied at DB and API layer; omitting .default() avoids zodResolver input/output type mismatch
  isActive: z.boolean().optional().default(true),
  settings: topicSettingsSchema.optional(),
});

export const updateTopicSchema = createTopicSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const SUPPORTED_PLATFORM_VALUES = SUPPORTED_SCAN_PLATFORMS.map((p) => p.value);

export const createSourceSchema = z
  .object({
    type: z.enum(SOURCE_TYPES),
    value: z.string().min(1, 'Value is required').max(500, 'Value must be 500 characters or fewer'),
    label: z
      .string()
      .max(100, 'Label must be 100 characters or fewer')
      .optional()
      .or(z.literal('')),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'website' || data.type === 'social_link') {
        try {
          new URL(data.value);
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    { message: 'Must be a valid URL (e.g. https://example.com)', path: ['value'] }
  )
  .refine(
    (data) => {
      if (data.type === 'platform') {
        return SUPPORTED_PLATFORM_VALUES.includes(data.value as SupportedPlatform);
      }
      return true;
    },
    {
      message: `Platform must be one of: ${SUPPORTED_PLATFORM_VALUES.join(', ')}`,
      path: ['value'],
    }
  );

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
