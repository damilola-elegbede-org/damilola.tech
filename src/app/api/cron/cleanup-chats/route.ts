import { list, del } from '@vercel/blob';
import { timingSafeEqual } from 'crypto';
import { extractTimestampFromFilename } from '@/lib/chat-filename';

export const runtime = 'nodejs';

// Time constants
const DAY_MS = 24 * 60 * 60 * 1000;

// Retention periods in days
const RETENTION = {
  chatsProduction: 180, // 6 months
  chatsPreview: 14, // 2 weeks (E2E test noise)
  fitAssessments: 180, // 6 months
  resumeGenerations: 365, // 1 year
  auditProduction: 365, // 1 year
  auditPreview: 14, // 2 weeks (E2E test noise)
  // Development: Delete all immediately (handled specially)
};

// Prefixes
const BASE_PREFIX = 'damilola.tech/';
const CHATS_PREFIX = 'damilola.tech/chats/';
const FIT_ASSESSMENTS_PREFIX = 'damilola.tech/fit-assessments/';
const AUDIT_PREFIX = 'damilola.tech/audit/';
const USAGE_PREFIX = 'damilola.tech/usage/';
const RESUME_GENERATIONS_PREFIX = 'damilola.tech/resume-generations/';

// Protected paths - NEVER delete regardless of age or size
const PROTECTED_PREFIXES = [
  'damilola.tech/content/', // System prompts, STAR stories, resume JSON
  'damilola.tech/resume/', // Base resume PDF and generated PDFs
  'damilola.tech/admin-cache/', // Dashboard cache files
];

// Valid usage session prefixes (anything else is orphaned)
const VALID_SESSION_PREFIXES = [
  'chat-',
  'fit-assessment-',
  'resume-generator-',
  'anonymous.json',
];

/**
 * Timing-safe token comparison to prevent timing attacks
 */
function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

interface CleanupResult {
  deleted: number;
  kept: number;
  skipped: number;
  errors: number;
}

interface SimpleCleanupResult {
  deleted: number;
  errors: number;
}

/**
 * Check if a path is protected and should never be deleted
 */
function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Clean up blobs with a given prefix older than the cutoff date
 */
async function cleanupPrefix(
  prefix: string,
  cutoffDate: number,
  dryRun = false
): Promise<CleanupResult> {
  let deleted = 0;
  let kept = 0;
  let skipped = 0;
  let errors = 0;
  let cursor: string | undefined;
  const toDelete: string[] = [];

  do {
    const result = await list({ prefix, cursor });

    for (const blob of result.blobs) {
      // Skip protected paths
      if (isProtected(blob.pathname)) {
        skipped++;
        continue;
      }

      // Try to get timestamp from filename, fall back to blob's uploadedAt
      const filename = blob.pathname.split('/').pop() || '';
      const timestamp =
        extractTimestampFromFilename(filename) || blob.uploadedAt;

      if (!timestamp) {
        console.warn(`Could not determine timestamp for: ${blob.pathname}`);
        skipped++;
        continue;
      }

      if (timestamp.getTime() < cutoffDate) {
        toDelete.push(blob.url);
      } else {
        kept++;
      }
    }

    cursor = result.cursor ?? undefined;
  } while (cursor);

  if (dryRun) {
    return { deleted: toDelete.length, kept, skipped, errors: 0 };
  }

  // Batch delete
  const BATCH_SIZE = 10;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((url) => del(url)));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        deleted++;
      } else {
        console.error('Failed to delete blob:', result.reason);
        errors++;
      }
    }
  }

  return { deleted, kept, skipped, errors };
}

/**
 * Delete all blobs under a prefix (for development cleanup)
 */
async function deleteAllUnderPrefix(
  prefix: string,
  dryRun = false
): Promise<SimpleCleanupResult> {
  let deleted = 0;
  let errors = 0;
  let cursor: string | undefined;
  const toDelete: string[] = [];

  do {
    const result = await list({ prefix, cursor });
    for (const blob of result.blobs) {
      // Extra safety: never delete protected paths even if called incorrectly
      if (!isProtected(blob.pathname)) {
        toDelete.push(blob.url);
      }
    }
    cursor = result.cursor ?? undefined;
  } while (cursor);

  if (dryRun) {
    return { deleted: toDelete.length, errors: 0 };
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((url) => del(url)));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        deleted++;
      } else {
        console.error('Failed to delete blob:', result.reason);
        errors++;
      }
    }
  }

  return { deleted, errors };
}

/**
 * Clean up empty placeholder files (0-byte marker files)
 */
async function cleanupEmptyPlaceholders(
  dryRun = false
): Promise<SimpleCleanupResult> {
  let deleted = 0;
  let errors = 0;
  let cursor: string | undefined;
  const toDelete: string[] = [];

  do {
    const result = await list({ prefix: BASE_PREFIX, cursor });
    for (const blob of result.blobs) {
      // Only delete if size is 0 AND not protected
      if (blob.size === 0 && !isProtected(blob.pathname)) {
        toDelete.push(blob.url);
      }
    }
    cursor = result.cursor ?? undefined;
  } while (cursor);

  if (dryRun) {
    return { deleted: toDelete.length, errors: 0 };
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((url) => del(url)));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        deleted++;
      } else {
        console.error('Failed to delete empty placeholder:', result.reason);
        errors++;
      }
    }
  }

  return { deleted, errors };
}

/**
 * Clean up orphan sessions (usage sessions without valid prefix)
 */
async function cleanupOrphanSessions(
  dryRun = false
): Promise<SimpleCleanupResult> {
  let deleted = 0;
  let errors = 0;
  const toDelete: string[] = [];

  // Check all environment session folders
  const environments = ['production', 'preview', 'development'];

  for (const env of environments) {
    let cursor: string | undefined;
    const prefix = `${USAGE_PREFIX}${env}/sessions/`;

    do {
      const result = await list({ prefix, cursor });
      for (const blob of result.blobs) {
        const filename = blob.pathname.split('/').pop() || '';
        // Check if filename starts with any valid prefix
        const isValid = VALID_SESSION_PREFIXES.some((validPrefix) =>
          filename.startsWith(validPrefix)
        );
        if (!isValid) {
          toDelete.push(blob.url);
        }
      }
      cursor = result.cursor ?? undefined;
    } while (cursor);
  }

  if (dryRun) {
    return { deleted: toDelete.length, errors: 0 };
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((url) => del(url)));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        deleted++;
      } else {
        console.error('Failed to delete orphan session:', result.reason);
        errors++;
      }
    }
  }

  return { deleted, errors };
}

/**
 * Clean up all development artifacts across all folders
 */
async function cleanupDevelopmentArtifacts(
  dryRun = false
): Promise<SimpleCleanupResult> {
  const devPrefixes = [
    `${AUDIT_PREFIX}development/`,
    `${USAGE_PREFIX}development/`,
    `${CHATS_PREFIX}development/`,
    `${FIT_ASSESSMENTS_PREFIX}development/`,
  ];

  let totalDeleted = 0;
  let totalErrors = 0;

  for (const prefix of devPrefixes) {
    const result = await deleteAllUnderPrefix(prefix, dryRun);
    totalDeleted += result.deleted;
    totalErrors += result.errors;
  }

  return { deleted: totalDeleted, errors: totalErrors };
}

export async function GET(req: Request) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  const expectedToken = process.env.CRON_SECRET;

  // Fail fast if CRON_SECRET not configured
  if (!expectedToken) {
    console.error('[cron/cleanup-chats] CRON_SECRET not configured');
    return Response.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (!verifyToken(token, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for dry-run mode
  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  try {
    const now = Date.now();

    // Calculate cutoff dates for each category
    const cutoffs = {
      chatsProduction: now - RETENTION.chatsProduction * DAY_MS,
      chatsPreview: now - RETENTION.chatsPreview * DAY_MS,
      fitAssessments: now - RETENTION.fitAssessments * DAY_MS,
      resumeGenerations: now - RETENTION.resumeGenerations * DAY_MS,
      auditProduction: now - RETENTION.auditProduction * DAY_MS,
      auditPreview: now - RETENTION.auditPreview * DAY_MS,
    };

    if (dryRun) {
      console.log('[cleanup] DRY RUN mode - no files will be deleted');
    }

    // Run all cleanup operations in parallel
    const [
      chatsProduction,
      chatsPreview,
      fitAssessments,
      resumeGenerations,
      auditProduction,
      auditPreview,
      developmentArtifacts,
      emptyPlaceholders,
      orphanSessions,
    ] = await Promise.all([
      // Chats by environment
      cleanupPrefix(
        `${CHATS_PREFIX}production/`,
        cutoffs.chatsProduction,
        dryRun
      ),
      cleanupPrefix(`${CHATS_PREFIX}preview/`, cutoffs.chatsPreview, dryRun),
      // Fit assessments (all environments use same retention)
      cleanupPrefix(FIT_ASSESSMENTS_PREFIX, cutoffs.fitAssessments, dryRun),
      // Resume generations (1 year retention)
      cleanupPrefix(
        RESUME_GENERATIONS_PREFIX,
        cutoffs.resumeGenerations,
        dryRun
      ),
      // Audit by environment
      cleanupPrefix(
        `${AUDIT_PREFIX}production/`,
        cutoffs.auditProduction,
        dryRun
      ),
      cleanupPrefix(`${AUDIT_PREFIX}preview/`, cutoffs.auditPreview, dryRun),
      // Development artifacts (delete all)
      cleanupDevelopmentArtifacts(dryRun),
      // Artifact cleanup
      cleanupEmptyPlaceholders(dryRun),
      cleanupOrphanSessions(dryRun),
    ]);

    // Calculate totals
    const allResults = [
      chatsProduction,
      chatsPreview,
      fitAssessments,
      resumeGenerations,
      auditProduction,
      auditPreview,
    ];

    const totals = {
      deleted:
        allResults.reduce((sum, r) => sum + r.deleted, 0) +
        developmentArtifacts.deleted +
        emptyPlaceholders.deleted +
        orphanSessions.deleted,
      kept: allResults.reduce((sum, r) => sum + r.kept, 0),
      skipped: allResults.reduce((sum, r) => sum + r.skipped, 0),
      errors:
        allResults.reduce((sum, r) => sum + r.errors, 0) +
        developmentArtifacts.errors +
        emptyPlaceholders.errors +
        orphanSessions.errors,
    };

    return Response.json({
      success: true,
      dryRun,
      chats: {
        production: chatsProduction,
        preview: chatsPreview,
      },
      fitAssessments,
      resumeGenerations,
      audit: {
        production: auditProduction,
        preview: auditPreview,
        development: { deleted: developmentArtifacts.deleted },
      },
      artifacts: {
        emptyPlaceholders: { deleted: emptyPlaceholders.deleted },
        orphanSessions: { deleted: orphanSessions.deleted },
      },
      totals,
    });
  } catch (error) {
    console.error('[cron/cleanup] Error during cleanup:', error);
    return Response.json({ error: 'Failed to run cleanup' }, { status: 500 });
  }
}
