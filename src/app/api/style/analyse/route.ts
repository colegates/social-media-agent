import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { styleExamples, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { analyseStyle } from '@/lib/ai/claude';

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'POST /api/style/analyse' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }

    const examples = await db.query.styleExamples.findMany({
      where: eq(styleExamples.userId, session.user.id),
    });

    if (examples.length === 0) {
      return apiError(
        'VALIDATION_ERROR',
        'No style examples found. Please add at least one example before analysing.'
      );
    }

    routeLogger.info(
      { userId: session.user.id, exampleCount: examples.length },
      'Starting style analysis'
    );

    const styleProfile = await analyseStyle(examples);

    // Persist the profile on the user record
    await db
      .update(users)
      .set({ styleProfile, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    routeLogger.info({ userId: session.user.id }, 'Style profile updated');

    return NextResponse.json({ data: styleProfile });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
