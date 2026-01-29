import { NextResponse } from 'next/server';
import { getShortlink } from '@/lib/shortlinks';

/**
 * Dynamic route handler for vanity shortlinks.
 * Redirects to homepage with UTM parameters for tracking.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;
  const shortlink = getShortlink(slug);

  if (!shortlink) {
    return NextResponse.json({ error: 'Shortlink not found' }, { status: 404 });
  }

  // Use URLSearchParams to safely construct query parameters (prevents URL injection)
  const url = new URL('/', request.url);
  url.searchParams.set('utm_source', shortlink.utm_source);
  url.searchParams.set('utm_medium', shortlink.utm_medium);

  const response = NextResponse.redirect(url, 307);
  // Cache for 5 minutes on CDN, 5 minutes in browser
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
  return response;
}
