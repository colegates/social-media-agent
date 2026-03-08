import { vi } from 'vitest';

// Mock Next.js server modules that aren't available in test environment
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      json: async () => data,
      status: init?.status ?? 200,
      headers: new Map(Object.entries((init?.headers as Record<string, string>) ?? {})),
      _body: data,
    }),
    redirect: (url: string) => ({ redirect: url }),
    next: () => ({ next: true, headers: new Map() }),
  },
  NextRequest: class MockNextRequest {
    url: string;
    method: string;
    headers: Headers;
    nextUrl: URL;

    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? 'GET';
      this.headers = new Headers((init?.headers as HeadersInit) ?? {});
      this.nextUrl = new URL(url);
    }

    async json() {
      return JSON.parse('{}');
    }
  },
}));

// Mock the logger to avoid pino issues in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Suppress console output in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};
