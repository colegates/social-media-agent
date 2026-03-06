import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {
  const routeLogger = logger.child({ route: 'GET /api/health' });

  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
  };

  routeLogger.debug(response, 'Health check requested');

  return NextResponse.json(response);
}
