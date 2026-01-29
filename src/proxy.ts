import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, verifyToken } from '@/lib/admin-auth';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip login page and auth API endpoint
  if (pathname === '/admin/login' || pathname === '/api/admin/auth') {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  // Handle API routes - return 401 JSON instead of redirect
  const isApiRoute = pathname.startsWith('/api/admin');

  if (!token) {
    if (isApiRoute) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // Verify JWT
  const isValid = await verifyToken(token);
  if (!isValid) {
    if (isApiRoute) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Clear invalid cookie and redirect
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete(ADMIN_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
