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

  const redirectUrl = `/?utm_source=${shortlink.utm_source}&utm_medium=${shortlink.utm_medium}`;

  return NextResponse.redirect(new URL(redirectUrl, request.url), 307);
}
