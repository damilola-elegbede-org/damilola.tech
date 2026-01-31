import { requireApiKey } from '@/lib/api-key-auth';

export const runtime = 'nodejs';

/**
 * POST /api/v1/resume-generator
 * Generate a tailored resume (JSON response).
 *
 * Note: Resume generation is a complex multi-step process that requires
 * the full admin/resume-generator workflow. The API provides access to
 * viewing existing generations via /api/v1/resume-generations.
 *
 * For now, this endpoint returns a 501 Not Implemented response.
 * A future version may support programmatic resume generation.
 */
export async function POST(req: Request) {
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  // Resume generation requires the interactive admin workflow
  // This would require significant refactoring to support via API
  return Response.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Resume generation via API is not yet supported. Use /api/v1/resume-generations to view existing generations.',
      },
    },
    { status: 501 }
  );
}
