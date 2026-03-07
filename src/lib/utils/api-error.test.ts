import { describe, it, expect, vi } from 'vitest';
import { apiError, handleApiError } from './api-error';
import type { Logger } from 'pino';

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
} as unknown as Logger;

// Helper to extract body from the mocked NextResponse.json
function getBody(response: { status: number }): Record<string, unknown> {
  return (response as unknown as { _body: Record<string, unknown> })._body;
}

describe('apiError', () => {
  it('returns correct HTTP status for UNAUTHORIZED', () => {
    const response = apiError('UNAUTHORIZED', 'Not logged in');
    expect(response.status).toBe(401);
    expect(getBody(response)).toEqual({ error: 'Not logged in', code: 'UNAUTHORIZED', details: undefined });
  });

  it('returns correct HTTP status for NOT_FOUND', () => {
    const response = apiError('NOT_FOUND', 'Resource not found');
    expect(response.status).toBe(404);
  });

  it('returns correct HTTP status for VALIDATION_ERROR', () => {
    const response = apiError('VALIDATION_ERROR', 'Invalid input', { field: 'name' });
    expect(response.status).toBe(400);
    expect(getBody(response)).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { field: 'name' },
    });
  });

  it('returns correct HTTP status for RATE_LIMITED', () => {
    const response = apiError('RATE_LIMITED', 'Too many requests');
    expect(response.status).toBe(429);
  });

  it('returns correct HTTP status for INTERNAL_ERROR', () => {
    const response = apiError('INTERNAL_ERROR', 'Server error');
    expect(response.status).toBe(500);
  });

  it('returns correct HTTP status for FORBIDDEN', () => {
    const response = apiError('FORBIDDEN', 'Access denied');
    expect(response.status).toBe(403);
  });
});

describe('handleApiError', () => {
  it('logs the error and returns INTERNAL_ERROR by default', () => {
    const error = new Error('Something broke');
    const response = handleApiError(error, mockLogger);
    expect(mockLogger.error).toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(getBody(response)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('returns CONFLICT for unique constraint errors', () => {
    const error = new Error('unique constraint violated');
    const response = handleApiError(error, mockLogger);
    expect(response.status).toBe(409);
    expect(getBody(response)).toMatchObject({ code: 'CONFLICT' });
  });

  it('returns SERVICE_UNAVAILABLE for missing ENCRYPTION_KEY', () => {
    const error = new Error('ENCRYPTION_KEY is missing');
    const response = handleApiError(error, mockLogger);
    expect(response.status).toBe(503);
    expect(getBody(response)).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('handles non-Error objects gracefully', () => {
    const response = handleApiError('string error', mockLogger);
    expect(response.status).toBe(500);
  });
});
