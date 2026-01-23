import { list } from '@vercel/blob';

export const runtime = 'nodejs';

const ASSESSMENTS_PREFIX = 'damilola.tech/fit-assessments/';

interface AssessmentSummary {
  id: string;
  pathname: string;
  assessmentId: string;
  environment: string;
  timestamp: string;
  size: number;
  url: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const environment = searchParams.get('env') || 'production';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    const prefix = `${ASSESSMENTS_PREFIX}${environment}/`;
    const result = await list({ prefix, cursor, limit });

    const assessments: AssessmentSummary[] = result.blobs.map((blob) => {
      // Extract info from pathname: damilola.tech/fit-assessments/{env}/{timestamp}-{uuid}.json
      const filename = blob.pathname.split('/').pop() || '';
      const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9]+)/);

      return {
        id: blob.pathname,
        pathname: blob.pathname,
        assessmentId: match?.[2] || '',
        environment,
        timestamp: match?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z') || '',
        size: blob.size,
        url: blob.url,
      };
    });

    return Response.json({
      assessments,
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('[admin/fit-assessments] Error listing assessments:', error);
    return Response.json({ error: 'Failed to list assessments' }, { status: 500 });
  }
}
