import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // Content Security Policy — tightened for production
  'Content-Security-Policy': [
    "default-src 'self'",
    // Scripts: allow self and Next.js inline scripts (nonce would be better but requires config)
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // Styles: Tailwind uses inline styles
    "style-src 'self' 'unsafe-inline'",
    // Images: self + data URIs (for avatars) + R2 bucket
    `img-src 'self' data: blob: ${process.env.R2_PUBLIC_URL ?? ''}`,
    // Fonts
    "font-src 'self' data:",
    // API/WS connections: self only (all external calls go through our backend)
    "connect-src 'self'",
    // Media: self + R2 bucket
    `media-src 'self' blob: ${process.env.R2_PUBLIC_URL ?? ''}`,
    // Frames: deny
    "frame-src 'none'",
    // Workers: self (service worker)
    "worker-src 'self' blob:",
  ].join('; '),
};

const AUTH_PATHS = ['/login', '/register'];
const PROTECTED_PATHS = [
  '/dashboard',
  '/topics',
  '/content',
  '/settings',
  '/notifications',
  '/onboarding',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = globalThis.crypto.randomUUID();
  const startTime = Date.now();

  // Apply security headers to all responses
  const response = NextResponse.next();

  // Attach request ID so API route loggers can read it
  response.headers.set('X-Request-Id', requestId);
  // Propagate request ID to the request so server components can read it
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-Request-Id'
    );
    response.headers.set('Access-Control-Max-Age', '86400');

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }
  }

  // Auth guard for protected routes
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPath = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(path));

  if (isProtectedPath || isAuthPath) {
    let session = null;
    try {
      session = await auth();
    } catch {
      if (isProtectedPath) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    if (isProtectedPath && !session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from auth pages
    if (isAuthPath && session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Track API request duration
  if (pathname.startsWith('/api/')) {
    const duration = Date.now() - startTime;
    response.headers.set('X-Response-Time', `${duration}ms`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
