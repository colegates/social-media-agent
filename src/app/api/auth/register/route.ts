export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(): Promise<NextResponse> {
  logger.info({ route: 'POST /api/auth/register' }, 'Registration attempt blocked - registrations disabled');
  return NextResponse.json(
    { error: 'REGISTRATION_DISABLED', message: 'New account registration is not available.' },
    { status: 403 }
  );
}
