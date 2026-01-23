import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Note: These are duplicated from src/lib/admin-auth.ts because that module
// imports Node.js crypto (for timingSafeEqual), which is incompatible with
// Edge Runtime middleware. Must be kept in sync with the shared module.
const ADMIN_COOKIE_NAME = 'admin_session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return new TextEncoder().encode(secret);
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
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
