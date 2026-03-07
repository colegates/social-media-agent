import { describe, it, expect } from 'vitest';
import { createTopicSchema, createSourceSchema } from './topics';

describe('createTopicSchema', () => {
  const valid = {
    name: 'Skincare',
    description: 'Trending skincare content',
    keywords: ['skincare', 'spf', 'retinol'],
    scanFrequencyMinutes: 60,
  };

  it('accepts valid topic data', () => {
    const result = createTopicSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createTopicSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    const result = createTopicSchema.safeParse({ ...valid, name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects too many keywords', () => {
    const result = createTopicSchema.safeParse({
      ...valid,
      keywords: Array.from({ length: 21 }, (_, i) => `keyword${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects scan frequency below 15 min', () => {
    const result = createTopicSchema.safeParse({ ...valid, scanFrequencyMinutes: 10 });
    expect(result.success).toBe(false);
  });

  it('rejects scan frequency above 24 hours', () => {
    const result = createTopicSchema.safeParse({ ...valid, scanFrequencyMinutes: 1500 });
    expect(result.success).toBe(false);
  });

  it('allows empty keywords array', () => {
    const result = createTopicSchema.safeParse({ ...valid, keywords: [] });
    expect(result.success).toBe(true);
  });

  it('allows optional description to be omitted', () => {
    const { description: _d, ...noDesc } = valid;
    const result = createTopicSchema.safeParse(noDesc);
    expect(result.success).toBe(true);
  });
});

describe('createSourceSchema', () => {
  it('accepts valid website URL', () => {
    const result = createSourceSchema.safeParse({
      type: 'website',
      value: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL for website type', () => {
    const result = createSourceSchema.safeParse({
      type: 'website',
      value: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid subreddit name', () => {
    const result = createSourceSchema.safeParse({
      type: 'subreddit',
      value: 'r/skincare',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid hashtag', () => {
    const result = createSourceSchema.safeParse({
      type: 'hashtag',
      value: '#skincare',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid platform source', () => {
    const result = createSourceSchema.safeParse({
      type: 'platform',
      value: 'reddit',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid platform value', () => {
    const result = createSourceSchema.safeParse({
      type: 'platform',
      value: 'myspace',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty value', () => {
    const result = createSourceSchema.safeParse({
      type: 'search_term',
      value: '',
    });
    expect(result.success).toBe(false);
  });
});
