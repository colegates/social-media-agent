import { z } from 'zod';

export const API_KEY_SERVICES = [
  'anthropic',
  'serpapi',
  'apify',
  'twitter',
  'replicate',
  'reddit',
  'openai',
  'kling',
  'runway',
] as const;

export const upsertApiKeySchema = z.object({
  service: z.enum(API_KEY_SERVICES),
  key: z.string().min(1, 'API key is required').max(500, 'API key too long'),
});

export const deleteApiKeySchema = z.object({
  service: z.enum(API_KEY_SERVICES),
});

export type UpsertApiKeyInput = z.infer<typeof upsertApiKeySchema>;
