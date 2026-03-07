import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { styleExamples } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { addStyleExampleSchema } from '@/lib/validators/style';
import { extractContentFromUrl } from '@/lib/utils/content-extractor';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/style/examples' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const examples = await db.query.styleExamples.findMany({
      where: eq(styleExamples.userId, session.user.id),
      orderBy: [desc(styleExamples.createdAt)],
    });

    routeLogger.info({ userId: session.user.id, count: examples.length }, 'Style examples fetched');
    return NextResponse.json({ data: examples });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/style/examples' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const body: unknown = await req.json();
    const parsed = addStyleExampleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { type, content, sourceUrl, platform, metadata } = parsed.data;

    let finalContent = content ?? '';
    let finalPlatform = platform ?? null;

    // If a URL was provided, fetch and extract content
    if (sourceUrl) {
      routeLogger.info({ sourceUrl }, 'Extracting content from URL');
      const extracted = await extractContentFromUrl(sourceUrl);

      if (!extracted || !extracted.text) {
        return apiError('EXTERNAL_API_ERROR', 'Could not extract content from the provided URL');
      }

      finalContent = extracted.text;
      if (!finalPlatform && extracted.platform) {
        finalPlatform = extracted.platform as NonNullable<typeof platform>;
      }

      routeLogger.info(
        { sourceUrl, contentLength: finalContent.length },
        'Content extracted from URL'
      );
    }

    const [example] = await db
      .insert(styleExamples)
      .values({
        userId: session.user.id,
        type,
        content: finalContent,
        sourceUrl: sourceUrl ?? null,
        platform: finalPlatform ?? null,
        metadata: (metadata as Record<string, unknown>) ?? {},
      })
      .returning();

    routeLogger.info({ userId: session.user.id, exampleId: example.id }, 'Style example created');
    return NextResponse.json({ data: example }, { status: 201 });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
