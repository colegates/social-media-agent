import { NextResponse } from 'next/server';
import type { Logger } from 'pino';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_API_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'CONFLICT';

export interface ApiError {
  error: string;
  code: ApiErrorCode;
  details?: unknown;
}

const statusCodes: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  EXTERNAL_API_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  CONFLICT: 409,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown
): NextResponse<ApiError> {
  return NextResponse.json({ error: message, code, details }, { status: statusCodes[code] });
}

export function handleApiError(error: unknown, log: Logger): NextResponse<ApiError> {
  log.error({ error }, 'Unhandled API error');

  if (error instanceof Error) {
    if (error.message.includes('unique constraint')) {
      return apiError('CONFLICT', 'A resource with this identifier already exists');
    }
    if (error.message.includes('ENCRYPTION_KEY')) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'Server encryption key is not configured. Set the ENCRYPTION_KEY environment variable in your Render dashboard.'
      );
    }
  }

  return apiError('INTERNAL_ERROR', 'An unexpected error occurred');
}
