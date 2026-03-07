import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { apiError, handleApiError } from '@/lib/utils/api-error';
import { getUserApiKeyStatus, setUserApiKey } from '@/lib/services/api-keys';
import { upsertApiKeySchema } from '@/lib/validators/api-keys';

const routeLogger = logger.child({ route: '/api/settings/api-keys' });

/**
 * GET /api/settings/api-keys
 * Returns configured services with masked hints. Never returns plaintext keys.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const statuses = await getUserApiKeyStatus(session.user.id);

    routeLogger.info({ userId: session.user.id, count: statuses.length }, 'API key statuses fetched');

    return NextResponse.json({ data: statuses });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}

/**
 * PUT /api/settings/api-keys
 * Save (upsert) an API key for a service.
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'You must be logged in');
    }

    const body: unknown = await req.json();
    const parsed = upsertApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', parsed.error.flatten());
    }

    const { service, key } = parsed.data;

    await setUserApiKey(session.user.id, service, key);

    routeLogger.info({ userId: session.user.id, service }, 'API key saved');

    return NextResponse.json({ data: { service, saved: true } });
  } catch (error) {
    return handleApiError(error, routeLogger);
  }
}
