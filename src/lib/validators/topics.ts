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

export const SOURCE_TYPES = [
  'website',
  'social_link',
  'subreddit',
  'hashtag',
  'search_term',
  'competitor_account',
] as const;

export const createTopicSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or fewer')
    .optional()
    .or(z.literal('')),
  keywords: z
    .array(z.string().min(1).max(100))
    .min(0)
    .max(20, 'Maximum 20 keywords allowed'),
  scanFrequencyMinutes: z
    .number()
    .int()
    .min(15, 'Minimum scan frequency is 15 minutes')
    .max(1440, 'Maximum scan frequency is 24 hours'),
  isActive: z.boolean().optional().default(true),
});

export const updateTopicSchema = createTopicSchema.partial().extend({
  isActive: z.boolean().optional(),
});

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
  );

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
