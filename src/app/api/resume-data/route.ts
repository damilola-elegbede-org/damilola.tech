import { fetchBlob } from '@/lib/blob';

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';
// Resume PDF generator needs time for Blob fetch on cold start
export const maxDuration = 30;

/**
 * GET /api/resume-data
 *
 * Returns the parsed resume data from resume-full.json for PDF generation.
 */
export async function GET() {
  try {
    const resume = await fetchBlob('resume-full.json');

    if (!resume) {
      return Response.json(
        { error: 'Resume data not available.' },
        { status: 503 }
      );
    }

    const resumeData = JSON.parse(resume);

    return Response.json(resumeData);
  } catch (error) {
    console.error('[resume-data] Error fetching resume data:', error);
    return Response.json(
      { error: 'Failed to load resume data.' },
      { status: 503 }
    );
  }
}
