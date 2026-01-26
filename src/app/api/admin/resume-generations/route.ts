import { list } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import type { ResumeGenerationSummary, ResumeGenerationLog } from '@/lib/types/resume-generation';

// Use Node.js runtime for blob operations
export const runtime = 'nodejs';

function getEnvironment(): string {
  // Check if we're on Vercel
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'preview';
}

export async function GET(req: Request) {
  console.log('[admin/resume-generations] Request received');

  // Verify admin authentication
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!adminToken || !(await verifyToken(adminToken))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor') || undefined;
    const environment = getEnvironment();

    // List blobs in the resume-generations folder for current environment
    const blobPath = `damilola.tech/resume-generations/${environment}/`;

    console.log('[admin/resume-generations] Listing blobs at:', blobPath);

    const { blobs, cursor: nextCursor } = await list({
      prefix: blobPath,
      cursor,
      limit: 20,
    });

    console.log('[admin/resume-generations] Found', blobs.length, 'blobs');

    // Fetch and parse each blob to get summary data
    const generations: ResumeGenerationSummary[] = await Promise.all(
      blobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data: ResumeGenerationLog = await response.json();

          return {
            id: blob.pathname,
            generationId: data.generationId,
            environment: data.environment,
            timestamp: data.createdAt,
            companyName: data.companyName,
            roleTitle: data.roleTitle,
            scoreBefore: data.estimatedCompatibility.before,
            scoreAfter: data.estimatedCompatibility.after,
            applicationStatus: data.applicationStatus,
            url: blob.url,
            size: blob.size,
          };
        } catch (error) {
          console.error('[admin/resume-generations] Error parsing blob:', blob.pathname, error);
          // Return a placeholder for failed parses
          return {
            id: blob.pathname,
            generationId: 'unknown',
            environment: environment,
            timestamp: blob.uploadedAt.toISOString(),
            companyName: 'Unknown',
            roleTitle: 'Unknown',
            scoreBefore: 0,
            scoreAfter: 0,
            applicationStatus: 'draft' as const,
            url: blob.url,
            size: blob.size,
          };
        }
      })
    );

    // Sort by timestamp descending (newest first)
    generations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return Response.json({
      generations,
      cursor: nextCursor,
      hasMore: !!nextCursor,
    });
  } catch (error) {
    console.error('[admin/resume-generations] Error:', error);
    return Response.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    );
  }
}
