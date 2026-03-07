import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { deleteUserApiKey } from '@/lib/services/api-keys';
import { deleteApiKeySchema } from '@/lib/validators/api-keys';

const routeLogger = logger.child({ route: '/api/settings/api-keys/[service]' });

interface RouteParams {
  params: Promise<{ service: string }>;
}

/**
 * DELETE /api/settings/api-keys/:service
 * Remove a stored API key for a service.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { service: rawService } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const parsed = deleteApiKeySchema.safeParse({ service: rawService });
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid service name', parsed.error.flatten());
    }

    await deleteUserApiKey(session.user.id, parsed.data.service);

    routeLogger.info({ userId: session.user.id, service: parsed.data.service }, 'API key deleted');

    return NextResponse.json({ data: { service: parsed.data.service, deleted: true } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
