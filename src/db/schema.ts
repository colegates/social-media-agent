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
// Relations
// ─────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  topics: many(topics),
  styleExamples: many(styleExamples),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  user: one(users, { fields: [topics.userId], references: [users.id] }),
  sources: many(topicSources),
}));

export const topicSourcesRelations = relations(topicSources, ({ one }) => ({
  topic: one(topics, { fields: [topicSources.topicId], references: [topics.id] }),
}));

export const styleExamplesRelations = relations(styleExamples, ({ one }) => ({
  user: one(users, { fields: [styleExamples.userId], references: [users.id] }),
}));
