import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { generateTestPostSchema } from '@/lib/validators/style';
import { generateWithStyle } from '@/lib/ai/claude';
import type { StyleProfile } from '@/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/style/test-generate' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const body: unknown = await req.json();
    const parsed = generateTestPostSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { topic, platform } = parsed.data;

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { styleProfile: true },
    });

    if (!user?.styleProfile) {
      return apiError(
        'VALIDATION_ERROR',
        'No style profile found. Please add examples and run style analysis first.'
      );
    }

    const styleProfile = user.styleProfile as StyleProfile;

    routeLogger.info(
      { userId: session.user.id, platform, topic: topic.slice(0, 50) },
      'Generating test post'
    );

    const generatedContent = await generateWithStyle(topic, styleProfile, platform);

    routeLogger.info({ userId: session.user.id, platform }, 'Test post generated');
    return NextResponse.json({ data: { content: generatedContent, platform, topic } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
