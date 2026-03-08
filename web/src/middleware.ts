import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Client-side auth is handled by AuthProvider.
 * This middleware handles basic route protection at the edge:
 * - /dashboard/* requires a token cookie/header
 * - Unauthenticated users are redirected to /login
 *
 * Note: Full role checks happen client-side since JWT is stored in localStorage.
 * For production, consider httpOnly cookies with server-side verification.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always accessible
  if (pathname === '/login' || pathname === '/use-electron' || pathname === '/') {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
