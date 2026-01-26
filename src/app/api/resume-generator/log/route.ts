import { put, list } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import type {
  ResumeGenerationLogV2,
  GenerationHistoryEntry,
  ResumeGenerationLog,
} from '@/lib/types/resume-generation';
import type { JobIdentifier } from '@/lib/job-id';

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

/**
 * Try to fetch an existing record for this jobId.
 * Returns null if not found.
 */
async function fetchExistingRecord(
  environment: string,
  jobId: string
): Promise<{ log: ResumeGenerationLog; url: string } | null> {
  const blobPath = `damilola.tech/resume-generations/${environment}/${jobId}.json`;

  try {
    // List blobs with exact prefix to find the file
    const { blobs } = await list({ prefix: blobPath, limit: 1 });

    if (blobs.length === 0) {
      return null;
    }

    const blob = blobs[0];
    const response = await fetch(blob.url);
    if (!response.ok) {
      console.warn(`[resume-generator/log] Failed to fetch existing record: ${response.status}`);
      return null;
    }

    const log = await response.json();
    return { log, url: blob.url };
  } catch (error) {
    console.warn('[resume-generator/log] Error fetching existing record:', error);
    return null;
  }
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
      jobId,
      jobIdentifier,
      companyName,
      roleTitle,
      jobDescriptionFull,
      datePosted,
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

    // Validate v2 required fields
    if (!jobId || !jobIdentifier) {
      return Response.json({ error: 'Missing jobId or jobIdentifier for v2 format' }, { status: 400 });
    }

    const environment = getEnvironment();
    const now = new Date().toISOString();

    // Check for existing record
    const existing = await fetchExistingRecord(environment, jobId);

    let log: ResumeGenerationLogV2;

    if (existing) {
      // Merge with existing record
      console.log('[resume-generator/log] Found existing record, merging...');

      const existingLog = existing.log;

      // Create history entry from the CURRENT data in the existing record (before updating)
      // This preserves the previous generation's data
      let generationHistory: GenerationHistoryEntry[] = [];

      if (existingLog.version === 2) {
        // V2: Use existing history and add current data as a new entry
        const currentEntry: GenerationHistoryEntry = {
          generationId: existingLog.generationId,
          generatedAt: existingLog.updatedAt || existingLog.createdAt,
          pdfUrl: existingLog.pdfUrl,
          scoreBefore: existingLog.estimatedCompatibility.before,
          scoreAfter: existingLog.estimatedCompatibility.after,
          changesAccepted: existingLog.changesAccepted.length,
          changesRejected: existingLog.changesRejected.length,
        };
        generationHistory = [currentEntry, ...existingLog.generationHistory];
      } else {
        // V1: Convert to history entry
        const v1Entry: GenerationHistoryEntry = {
          generationId: existingLog.generationId,
          generatedAt: existingLog.createdAt,
          pdfUrl: existingLog.pdfUrl,
          scoreBefore: existingLog.estimatedCompatibility.before,
          scoreAfter: existingLog.estimatedCompatibility.after,
          changesAccepted: existingLog.changesAccepted.length,
          changesRejected: existingLog.changesRejected.length,
        };
        generationHistory = [v1Entry];
      }

      // Create updated V2 record
      log = {
        version: 2,
        jobId,
        jobIdentifier: jobIdentifier as JobIdentifier,
        environment,
        createdAt: existingLog.createdAt, // Keep original creation time
        updatedAt: now,
        inputType: inputType || 'text',
        extractedUrl,
        companyName,
        roleTitle,
        jobDescriptionFull,
        datePosted,
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
        generationId,
        pdfUrl: pdfUrl || '',
        optimizedResumeJson: optimizedResumeJson || {},
        generationHistory,
        applicationStatus: existingLog.applicationStatus, // Keep existing status
        appliedDate: existingLog.appliedDate,
        notes: existingLog.notes,
      };
    } else {
      // Create new V2 record
      console.log('[resume-generator/log] Creating new v2 record');

      log = {
        version: 2,
        jobId,
        jobIdentifier: jobIdentifier as JobIdentifier,
        environment,
        createdAt: now,
        updatedAt: now,
        inputType: inputType || 'text',
        extractedUrl,
        companyName,
        roleTitle,
        jobDescriptionFull,
        datePosted,
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
        generationId,
        pdfUrl: pdfUrl || '',
        optimizedResumeJson: optimizedResumeJson || {},
        generationHistory: [], // No history for new records
        applicationStatus: 'draft',
      };
    }

    // Save to blob using jobId-based path (enables deduplication via overwrite)
    const blobPath = `damilola.tech/resume-generations/${environment}/${jobId}.json`;

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
      jobId,
      isUpdate: !!existing,
      generationCount: log.generationHistory.length + 1,
    });
  } catch (error) {
    console.error('[resume-generator/log] Error:', error);
    return Response.json(
      { error: 'Failed to save generation log' },
      { status: 500 }
    );
  }
}
