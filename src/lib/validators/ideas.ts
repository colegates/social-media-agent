import { z } from 'zod';

export const contentIdeaPlatforms = [
  'instagram_post',
  'instagram_reel',
  'tiktok',
  'x_post',
  'x_thread',
  'linkedin',
  'blog',
  'youtube_short',
] as const;

export const contentIdeaContentTypes = [
  'image',
  'video',
  'carousel',
  'text',
  'blog_article',
] as const;

export const contentIdeaStatuses = [
  'suggested',
  'approved',
  'rejected',
  'in_production',
  'completed',
  'published',
] as const;

export const listIdeasQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  topicId: z.string().uuid().optional(),
  platform: z.enum(contentIdeaPlatforms).optional(),
  contentType: z.enum(contentIdeaContentTypes).optional(),
  status: z.enum(contentIdeaStatuses).optional(),
  sortBy: z.enum(['priorityScore', 'createdAt', 'scheduledFor']).default('priorityScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const updateIdeaSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1).max(2000).optional(),
  platform: z.enum(contentIdeaPlatforms).optional(),
  contentType: z.enum(contentIdeaContentTypes).optional(),
  suggestedCopy: z.string().min(1).max(5000).optional(),
  visualDirection: z.string().min(1).max(2000).optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  status: z
    .enum(['suggested', 'approved', 'rejected', 'in_production', 'completed', 'published'])
    .optional(),
});

export const generateIdeasSchema = z.object({
  topicId: z.string().uuid(),
  trendIds: z.array(z.string().uuid()).min(1).max(20).optional(),
});

export const calendarQuerySchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  topicId: z.string().uuid().optional(),
  platform: z.enum(contentIdeaPlatforms).optional(),
});
