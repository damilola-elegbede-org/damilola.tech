import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import type { ResumeGenerationLog } from '@/lib/types/resume-generation';

// Use Node.js runtime for blob operations
export const runtime = 'nodejs';

function getEnvironment(): string {
  // Check if we're on Vercel
  if (process.env.VERCEL) {
    // VERCEL_ENV is 'production', 'preview', or 'development'
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  // Fallback to NODE_ENV for local development
  return process.env.NODE_ENV === 'production' ? 'production' : 'preview';
}

export async function POST(req: Request) {
  console.log('[resume-generator/log] Request received');

  // Verify admin authentication
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!adminToken || !(await verifyToken(adminToken))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      generationId,
      companyName,
      roleTitle,
      jobDescriptionFull,
      inputType,
      extractedUrl,
      estimatedCompatibility,
      changesAccepted,
      changesRejected,
      gapsIdentified,
      pdfUrl,
      optimizedResumeJson,
    } = body;

    // Validate required fields
    if (!generationId || !companyName || !roleTitle || !jobDescriptionFull) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const environment = getEnvironment();

    // Create the log entry
    const log: ResumeGenerationLog = {
      version: 1,
      generationId,
      environment,
      createdAt: new Date().toISOString(),
      inputType: inputType || 'text',
      extractedUrl,
      companyName,
      roleTitle,
      jobDescriptionFull,
      estimatedCompatibility: estimatedCompatibility || {
        before: 0,
        after: 0,
        breakdown: {
          keywordRelevance: 0,
          skillsQuality: 0,
          experienceAlignment: 0,
          formatParseability: 0,
        },
      },
      changesAccepted: changesAccepted || [],
      changesRejected: changesRejected || [],
      gapsIdentified: gapsIdentified || [],
      pdfUrl: pdfUrl || '',
      optimizedResumeJson: optimizedResumeJson || {},
      applicationStatus: 'draft',
    };

    // Save to blob
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobPath = `damilola.tech/resume-generations/${environment}/${timestamp}-${generationId}.json`;

    console.log('[resume-generator/log] Saving to blob:', blobPath);

    const blob = await put(blobPath, JSON.stringify(log, null, 2), {
      access: 'public',
      contentType: 'application/json',
    });

    console.log('[resume-generator/log] Saved successfully:', blob.url);

    return Response.json({
      success: true,
      url: blob.url,
      generationId,
    });
  } catch (error) {
    console.error('[resume-generator/log] Error:', error);
    return Response.json(
      { error: 'Failed to save generation log' },
      { status: 500 }
    );
  }
}
