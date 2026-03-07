import { z } from 'zod';

export const styleExampleTypeValues = [
  'social_post',
  'blog_article',
  'image_description',
  'brand_guideline',
] as const;

export const platformValues = [
  'instagram',
  'tiktok',
  'x',
  'linkedin',
  'blog',
  'other',
] as const;

export const addStyleExampleSchema = z
  .object({
    type: z.enum(styleExampleTypeValues),
    content: z.string().min(10, 'Content must be at least 10 characters').max(10_000).optional(),
    sourceUrl: z.string().url('Must be a valid URL').optional(),
    platform: z.enum(platformValues).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.content || data.sourceUrl, {
    message: 'Either content or sourceUrl must be provided',
    path: ['content'],
  });

export type AddStyleExampleInput = z.infer<typeof addStyleExampleSchema>;

export const generateTestPostSchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters').max(500),
  platform: z.enum(platformValues),
});

export type GenerateTestPostInput = z.infer<typeof generateTestPostSchema>;
