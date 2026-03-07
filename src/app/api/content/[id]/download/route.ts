import { type NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { generatedContent } from '@/db/schema';
import { getSignedUrl, extractKeyFromUrl } from '@/lib/storage/r2';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/content/[id]/download' });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Authentication required');
    }
    const userId = session.user.id;
    const { id } = await params;

    const content = await db.query.generatedContent.findFirst({
      where: and(eq(generatedContent.id, id), eq(generatedContent.userId, userId)),
      columns: { id: true, storageUrl: true, type: true, status: true },
    });

    if (!content) {
      return apiError('NOT_FOUND', 'Generated content not found');
    }

    if (!content.storageUrl) {
      return apiError('NOT_FOUND', 'No asset available for this content');
    }

    // Generate a signed URL valid for 1 hour
    const key = extractKeyFromUrl(content.storageUrl);
    const signedUrl = await getSignedUrl(key, 3600);

    routeLogger.info({ userId, contentId: id }, 'Download URL generated');
    return NextResponse.json({ data: { downloadUrl: signedUrl, expiresIn: 3600 } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
