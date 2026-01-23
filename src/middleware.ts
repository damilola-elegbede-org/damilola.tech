import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

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

  // Only protect /admin routes except login
  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // Verify JWT
  const isValid = await verifyToken(token);
  if (!isValid) {
    // Clear invalid cookie and redirect
    const response = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.delete(ADMIN_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
