export const runtime = 'nodejs';

/**
 * Archive endpoint - now a no-op.
 *
 * With the unified chat format (chat-{timestamp}-{shortId}.json), live saves
 * from /api/chat already use the final filename format. The archive endpoint
 * is kept for backward compatibility (frontend may still call it on page close),
 * but it simply returns success without doing anything.
 */
export async function POST() {
  // Archive is now a no-op - live saves already use the final format
  // Keep endpoint for backward compatibility (frontend may still call it)
  console.log('[chat/archive] No-op - unified format handles persistence');
  return Response.json({ success: true });
}
