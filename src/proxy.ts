import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const AUTH_PATHS = ['/login', '/register'];
const PROTECTED_PATHS = ['/dashboard', '/topics', '/content', '/settings'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();

  // Apply security headers to all responses
  const response = NextResponse.next();
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
      'Content-Type, Authorization, X-Requested-With'
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
    const session = await auth();

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
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
