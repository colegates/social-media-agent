import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  primaryKey,
  index,
  decimal,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { AdapterAccountType } from 'next-auth/adapters';

// ─────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  styleProfile: jsonb('style_profile'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────────────────
// Accounts (NextAuth.js / OAuth)
// ─────────────────────────────────────────────────────────

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })]
);

// ─────────────────────────────────────────────────────────
// Sessions (NextAuth.js)
// ─────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

// ─────────────────────────────────────────────────────────
// Verification Tokens (NextAuth.js)
// ─────────────────────────────────────────────────────────

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─────────────────────────────────────────────────────────
// Authenticators (NextAuth.js WebAuthn)
// ─────────────────────────────────────────────────────────

export const authenticators = pgTable(
  'authenticators',
  {
    credentialID: text('credential_id').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerAccountId: text('provider_account_id').notNull(),
    credentialPublicKey: text('credential_public_key').notNull(),
    counter: integer('counter').notNull(),
    credentialDeviceType: text('credential_device_type').notNull(),
    credentialBackedUp: boolean('credential_backed_up').notNull(),
    transports: text('transports'),
  },
  (authenticator) => [primaryKey({ columns: [authenticator.userId, authenticator.credentialID] })]
);

// ─────────────────────────────────────────────────────────
// Topics
// ─────────────────────────────────────────────────────────

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    keywords: text('keywords').array().notNull().default([]),
    scanFrequencyMinutes: integer('scan_frequency_minutes').notNull().default(60),
    isActive: boolean('is_active').notNull().default(true),
    settings: jsonb('settings').notNull().default({}),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_topics_user_id').on(table.userId),
    index('idx_topics_is_active').on(table.isActive),
    index('idx_topics_user_active').on(table.userId, table.isActive),
  ]
);

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;

// ─────────────────────────────────────────────────────────
// Topic Sources
// ─────────────────────────────────────────────────────────

export const sourceTypeEnum = pgEnum('source_type', [
  'website',
  'social_link',
  'subreddit',
  'hashtag',
  'search_term',
  'competitor_account',
]);

export type SourceType = (typeof sourceTypeEnum.enumValues)[number];

export const topicSources = pgTable(
  'topic_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    type: sourceTypeEnum('type').notNull(),
    value: text('value').notNull(),
    label: text('label'),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('idx_topic_sources_topic_id').on(table.topicId)]
);

export type TopicSource = typeof topicSources.$inferSelect;
export type NewTopicSource = typeof topicSources.$inferInsert;

// ─────────────────────────────────────────────────────────
// Style Examples
// ─────────────────────────────────────────────────────────

export const styleExampleTypeEnum = pgEnum('style_example_type', [
  'social_post',
  'blog_article',
  'image_description',
  'brand_guideline',
]);

export type StyleExampleType = (typeof styleExampleTypeEnum.enumValues)[number];

export const styleExamples = pgTable(
  'style_examples',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: styleExampleTypeEnum('type').notNull(),
    content: text('content').notNull(),
    sourceUrl: text('source_url'),
    platform: text('platform'), // instagram, tiktok, x, linkedin, blog
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_style_examples_user_id').on(table.userId),
    index('idx_style_examples_type').on(table.type),
  ]
);

export type StyleExample = typeof styleExamples.$inferSelect;
export type NewStyleExample = typeof styleExamples.$inferInsert;

// ─────────────────────────────────────────────────────────
// User API Keys (encrypted per-user credentials for 3rd party services)
// ─────────────────────────────────────────────────────────

export const apiKeyServiceEnum = pgEnum('api_key_service', [
  'anthropic',
  'serpapi',
  'apify',
  'twitter',
  'replicate',
  'reddit',
  'openai',
  'kling',
  'runway',
]);

export type ApiKeyService = (typeof apiKeyServiceEnum.enumValues)[number];

export const userApiKeys = pgTable(
  'user_api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    service: apiKeyServiceEnum('service').notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    keyHint: text('key_hint'), // last 4 chars of original key, shown in UI
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_user_api_keys_user_id').on(table.userId),
    index('idx_user_api_keys_user_service').on(table.userId, table.service),
  ]
);

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;

// ─────────────────────────────────────────────────────────
// Trends
// ─────────────────────────────────────────────────────────

export const trendPlatformEnum = pgEnum('trend_platform', [
  'google',
  'tiktok',
  'instagram',
  'x',
  'reddit',
  'youtube',
  'web',
]);

export type TrendPlatform = (typeof trendPlatformEnum.enumValues)[number];

export const trends = pgTable(
  'trends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    sourceUrl: text('source_url'),
    platform: trendPlatformEnum('platform').notNull(),
    viralityScore: integer('virality_score').notNull().default(0),
    engagementData: jsonb('engagement_data').default({}).notNull(),
    rawData: jsonb('raw_data').default({}).notNull(),
    discoveredAt: timestamp('discovered_at', { mode: 'date' }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }),
  },
  (table) => [
    index('idx_trends_topic_id').on(table.topicId),
    index('idx_trends_virality_score').on(table.viralityScore),
    index('idx_trends_discovered_at').on(table.discoveredAt),
    index('idx_trends_platform').on(table.platform),
  ]
);

export type Trend = typeof trends.$inferSelect;
export type NewTrend = typeof trends.$inferInsert;

// ─────────────────────────────────────────────────────────
// Scan Jobs
// ─────────────────────────────────────────────────────────

export const scanJobStatusEnum = pgEnum('scan_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export type ScanJobStatus = (typeof scanJobStatusEnum.enumValues)[number];

export const scanJobs = pgTable(
  'scan_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    status: scanJobStatusEnum('status').notNull().default('pending'),
    trendsFound: integer('trends_found').notNull().default(0),
    startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    errorLog: text('error_log'),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [
    index('idx_scan_jobs_topic_id').on(table.topicId),
    index('idx_scan_jobs_status').on(table.status),
    index('idx_scan_jobs_started_at').on(table.startedAt),
  ]
);

export type ScanJob = typeof scanJobs.$inferSelect;
export type NewScanJob = typeof scanJobs.$inferInsert;

// ─────────────────────────────────────────────────────────
// Content Ideas
// ─────────────────────────────────────────────────────────

export const contentIdeaPlatformEnum = pgEnum('content_idea_platform', [
  'instagram_post',
  'instagram_reel',
  'tiktok',
  'x_post',
  'x_thread',
  'linkedin',
  'blog',
  'youtube_short',
]);

export type ContentIdeaPlatform = (typeof contentIdeaPlatformEnum.enumValues)[number];

export const contentIdeaContentTypeEnum = pgEnum('content_idea_content_type', [
  'image',
  'video',
  'carousel',
  'text',
  'blog_article',
]);

export type ContentIdeaContentType = (typeof contentIdeaContentTypeEnum.enumValues)[number];

export const contentIdeaStatusEnum = pgEnum('content_idea_status', [
  'suggested',
  'approved',
  'rejected',
  'in_production',
  'completed',
  'published',
]);

export type ContentIdeaStatus = (typeof contentIdeaStatusEnum.enumValues)[number];

export const contentIdeas = pgTable(
  'content_ideas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    trendId: uuid('trend_id').references(() => trends.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    platform: contentIdeaPlatformEnum('platform').notNull(),
    contentType: contentIdeaContentTypeEnum('content_type').notNull(),
    suggestedCopy: text('suggested_copy').notNull(),
    visualDirection: text('visual_direction').notNull(),
    priorityScore: integer('priority_score').notNull().default(0),
    status: contentIdeaStatusEnum('status').notNull().default('suggested'),
    scheduledFor: timestamp('scheduled_for', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_content_ideas_user_id').on(table.userId),
    index('idx_content_ideas_topic_id').on(table.topicId),
    index('idx_content_ideas_status').on(table.status),
    index('idx_content_ideas_priority_score').on(table.priorityScore),
    index('idx_content_ideas_scheduled_for').on(table.scheduledFor),
    index('idx_content_ideas_user_status').on(table.userId, table.status),
    index('idx_content_ideas_user_topic').on(table.userId, table.topicId),
  ]
);

export type ContentIdea = typeof contentIdeas.$inferSelect;
export type NewContentIdea = typeof contentIdeas.$inferInsert;

// ─────────────────────────────────────────────────────────
// Generated Content
// ─────────────────────────────────────────────────────────

export const generatedContentTypeEnum = pgEnum('generated_content_type', [
  'image',
  'video',
  'blog_article',
  'social_copy',
  'carousel',
]);

export type GeneratedContentType = (typeof generatedContentTypeEnum.enumValues)[number];

export const generatedContentStatusEnum = pgEnum('generated_content_status', [
  'pending',
  'generating',
  'completed',
  'failed',
  'approved',
  'published',
]);

export type GeneratedContentStatus = (typeof generatedContentStatusEnum.enumValues)[number];

export const generatedContent = pgTable(
  'generated_content',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contentIdeaId: uuid('content_idea_id')
      .notNull()
      .references(() => contentIdeas.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: generatedContentTypeEnum('type').notNull(),
    status: generatedContentStatusEnum('status').notNull().default('pending'),
    storageUrl: text('storage_url'),
    thumbnailUrl: text('thumbnail_url'),
    content: text('content'),
    metadata: jsonb('metadata').default({}).notNull(),
    aiToolUsed: text('ai_tool_used'),
    generationCost: decimal('generation_cost', { precision: 10, scale: 6 }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_generated_content_idea_id').on(table.contentIdeaId),
    index('idx_generated_content_user_id').on(table.userId),
    index('idx_generated_content_status').on(table.status),
    index('idx_generated_content_type').on(table.type),
    index('idx_generated_content_user_status').on(table.userId, table.status),
  ]
);

export type GeneratedContent = typeof generatedContent.$inferSelect;
export type NewGeneratedContent = typeof generatedContent.$inferInsert;

// ─────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  topics: many(topics),
  styleExamples: many(styleExamples),
  apiKeys: many(userApiKeys),
  contentIdeas: many(contentIdeas),
  generatedContent: many(generatedContent),
}));

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, { fields: [userApiKeys.userId], references: [users.id] }),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  user: one(users, { fields: [topics.userId], references: [users.id] }),
  sources: many(topicSources),
  trends: many(trends),
  scanJobs: many(scanJobs),
  contentIdeas: many(contentIdeas),
}));

export const topicSourcesRelations = relations(topicSources, ({ one }) => ({
  topic: one(topics, { fields: [topicSources.topicId], references: [topics.id] }),
}));

export const styleExamplesRelations = relations(styleExamples, ({ one }) => ({
  user: one(users, { fields: [styleExamples.userId], references: [users.id] }),
}));

export const trendsRelations = relations(trends, ({ one, many }) => ({
  topic: one(topics, { fields: [trends.topicId], references: [topics.id] }),
  contentIdeas: many(contentIdeas),
}));

export const scanJobsRelations = relations(scanJobs, ({ one }) => ({
  topic: one(topics, { fields: [scanJobs.topicId], references: [topics.id] }),
}));

export const contentIdeasRelations = relations(contentIdeas, ({ one, many }) => ({
  topic: one(topics, { fields: [contentIdeas.topicId], references: [topics.id] }),
  trend: one(trends, { fields: [contentIdeas.trendId], references: [trends.id] }),
  user: one(users, { fields: [contentIdeas.userId], references: [users.id] }),
  generatedContent: many(generatedContent),
}));

export const generatedContentRelations = relations(generatedContent, ({ one }) => ({
  contentIdea: one(contentIdeas, {
    fields: [generatedContent.contentIdeaId],
    references: [contentIdeas.id],
  }),
  user: one(users, { fields: [generatedContent.userId], references: [users.id] }),
}));
