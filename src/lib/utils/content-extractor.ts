import { logger } from '@/lib/logger';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_LENGTH = 10_000;

// Tags whose inner content should be dropped entirely
const REMOVE_TAGS_RE =
  /<(script|style|noscript|nav|header|footer|aside|iframe|svg|figure|form|button)[^>]*>[\s\S]*?<\/\1>/gi;

// Strip all remaining HTML tags
const STRIP_TAGS_RE = /<[^>]+>/g;

// Collapse whitespace
const WHITESPACE_RE = /\s{2,}/g;

function stripHtml(html: string): string {
  return html
    .replace(REMOVE_TAGS_RE, ' ')
    .replace(STRIP_TAGS_RE, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(WHITESPACE_RE, ' ')
    .trim();
}

/**
 * Try to extract the main article content from the HTML.
 * Falls back to stripping all tags from the body if no <article> or <main> is found.
 */
function extractMainContent(html: string): string {
  // Try <article> tag first
  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  if (articleMatch?.[1]) {
    return stripHtml(articleMatch[1]);
  }

  // Try <main> tag
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (mainMatch?.[1]) {
    return stripHtml(mainMatch[1]);
  }

  // Try largest <div> with "content" or "post" in class/id
  const contentDivMatch =
    /<div[^>]+(id|class)="[^"]*(?:content|post|article|entry)[^"]*"[^>]*>([\s\S]{500,}?)<\/div>/i.exec(
      html
    );
  if (contentDivMatch?.[2]) {
    return stripHtml(contentDivMatch[2]);
  }

  // Fall back to body
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  if (bodyMatch?.[1]) {
    return stripHtml(bodyMatch[1]);
  }

  return stripHtml(html);
}

export interface ExtractedContent {
  text: string;
  title: string | null;
  platform: string | null;
}

function detectPlatform(url: string): string | null {
  if (/twitter\.com|x\.com/i.test(url)) return 'x';
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/linkedin\.com/i.test(url)) return 'linkedin';
  if (/reddit\.com/i.test(url)) return 'reddit';
  if (/facebook\.com/i.test(url)) return 'facebook';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  return null;
}

function extractTitle(html: string): string | null {
  const ogMatch = /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i.exec(html);
  if (ogMatch?.[1]) return ogMatch[1].trim();

  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  return null;
}

/**
 * Fetch a URL and extract the main textual content.
 * Returns null if the URL is unreachable or the content cannot be extracted.
 */
export async function extractContentFromUrl(url: string): Promise<ExtractedContent | null> {
  const extractLogger = logger.child({ fn: 'extractContentFromUrl', url });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    extractLogger.warn('Invalid URL provided');
    return null;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    extractLogger.warn('Only HTTP/HTTPS URLs are supported');
    return null;
  }

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SocialMediaAgent/1.0; +https://social-media-agent.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      extractLogger.warn(
        { status: response.status, latencyMs: Date.now() - start },
        'URL fetch returned non-OK status'
      );
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      extractLogger.warn({ contentType }, 'Unsupported content type');
      return null;
    }

    const html = await response.text();
    const platform = detectPlatform(url);
    const title = extractTitle(html);
    let text = extractMainContent(html);

    // Truncate to keep within reasonable Claude token limits
    if (text.length > MAX_CONTENT_LENGTH) {
      text = text.slice(0, MAX_CONTENT_LENGTH) + '…';
    }

    extractLogger.info(
      { latencyMs: Date.now() - start, contentLength: text.length, platform },
      'URL content extracted'
    );

    return { text, title, platform };
  } catch (error) {
    extractLogger.error({ error, latencyMs: Date.now() - start }, 'Failed to extract URL content');
    return null;
  }
}
