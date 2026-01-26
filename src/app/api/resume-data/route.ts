import { fetchAllContent } from '@/lib/blob';

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';

/**
 * GET /api/resume-data
 *
 * Returns the parsed resume data from resume-full.json for PDF generation.
 */
export async function GET() {
  try {
    const content = await fetchAllContent();

    if (!content.resume) {
      return Response.json(
        { error: 'Resume data not available.' },
        { status: 503 }
      );
    }

    const resumeData = JSON.parse(content.resume);

    return Response.json(resumeData);
  } catch (error) {
    console.error('[resume-data] Error fetching resume data:', error);
    return Response.json(
      { error: 'Failed to load resume data.' },
      { status: 503 }
    );
  }
}
