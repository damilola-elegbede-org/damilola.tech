import { list } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { generateJobId } from '@/lib/job-id';
import type {
  ResumeGenerationSummary,
  ResumeGenerationLog,
  ResumeGenerationFilters,
  ApplicationStatus,
} from '@/lib/types/resume-generation';

// Use Node.js runtime for blob operations
export const runtime = 'nodejs';

function getEnvironment(): string {
  // Check if we're on Vercel
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'preview';
}

/**
 * Parse filter query params from request URL.
 */
function parseFilters(url: URL): ResumeGenerationFilters {
  const filters: ResumeGenerationFilters = {};

  const status = url.searchParams.get('status');
  if (status && ['draft', 'applied', 'interview', 'offer', 'rejected'].includes(status)) {
    filters.applicationStatus = status as ApplicationStatus;
  }

  const company = url.searchParams.get('company');
  if (company) {
    filters.companyName = company;
  }

  const dateFrom = url.searchParams.get('dateFrom');
  if (dateFrom) {
    filters.dateFrom = dateFrom;
  }

  const dateTo = url.searchParams.get('dateTo');
  if (dateTo) {
    filters.dateTo = dateTo;
  }

  const minScore = url.searchParams.get('minScore');
  if (minScore && !isNaN(Number(minScore))) {
    filters.minScore = Number(minScore);
  }

  const maxScore = url.searchParams.get('maxScore');
  if (maxScore && !isNaN(Number(maxScore))) {
    filters.maxScore = Number(maxScore);
  }

  return filters;
}

/**
 * Check if a generation matches the given filters.
 */
function matchesFilters(generation: ResumeGenerationSummary, filters: ResumeGenerationFilters): boolean {
  // Status filter
  if (filters.applicationStatus && generation.applicationStatus !== filters.applicationStatus) {
    return false;
  }

  // Company filter (case-insensitive partial match)
  if (filters.companyName) {
    const searchTerm = filters.companyName.toLowerCase();
    if (!generation.companyName.toLowerCase().includes(searchTerm)) {
      return false;
    }
  }

  // Date range filter - use UTC boundaries to avoid timezone issues
  if (filters.dateFrom) {
    const generationDate = new Date(generation.timestamp).getTime();
    // Parse as UTC start of day: YYYY-MM-DDT00:00:00.000Z
    const fromDate = new Date(filters.dateFrom + 'T00:00:00.000Z').getTime();
    if (generationDate < fromDate) {
      return false;
    }
  }

  if (filters.dateTo) {
    const generationDate = new Date(generation.timestamp).getTime();
    // Parse as UTC end of day: YYYY-MM-DDT23:59:59.999Z
    const toDate = new Date(filters.dateTo + 'T23:59:59.999Z').getTime();
    if (generationDate > toDate) {
      return false;
    }
  }

  // Score filter (uses final/after score)
  if (filters.minScore !== undefined && generation.scoreAfter < filters.minScore) {
    return false;
  }

  if (filters.maxScore !== undefined && generation.scoreAfter > filters.maxScore) {
    return false;
  }

  return true;
}

/**
 * Compute jobId for a v1 record based on extractedUrl or title+company.
 */
function computeJobIdForV1(data: ResumeGenerationLog): string {
  if (data.version === 2) {
    return data.jobId;
  }

  // V1: compute from URL if available, otherwise from title+company
  if (data.extractedUrl) {
    return generateJobId({ url: data.extractedUrl }).jobId;
  }

  return generateJobId({
    title: data.roleTitle,
    company: data.companyName,
  }).jobId;
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
    const filters = parseFilters(url);

    // List blobs in the resume-generations folder for current environment
    const blobPath = `damilola.tech/resume-generations/${environment}/`;

    console.log('[admin/resume-generations] Listing blobs at:', blobPath);

    const { blobs, cursor: nextCursor } = await list({
      prefix: blobPath,
      cursor,
      limit: 50, // Fetch more to account for filtering
    });

    console.log('[admin/resume-generations] Found', blobs.length, 'blobs');

    // Fetch and parse each blob to get summary data
    // Limit concurrency to avoid overwhelming resources
    const FETCH_CONCURRENCY = 10;
    const FETCH_TIMEOUT_MS = 10000;
    const MAX_BLOB_SIZE = 1024 * 1024; // 1MB limit

    const fetchBlobWithTimeout = async (url: string): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller.signal });
        // Check Content-Length if available
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_BLOB_SIZE) {
          throw new Error('Blob too large');
        }
        return response;
      } finally {
        clearTimeout(timeout);
      }
    };

    // Process blobs in batches for concurrency control
    const allGenerations: ResumeGenerationSummary[] = [];
    for (let i = 0; i < blobs.length; i += FETCH_CONCURRENCY) {
      const batch = blobs.slice(i, i + FETCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (blob) => {
          try {
            const response = await fetchBlobWithTimeout(blob.url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const data: ResumeGenerationLog = await response.json();

          // Compute jobId for all versions
          const jobId = computeJobIdForV1(data);

          // Calculate generation count
          const generationCount = data.version === 2
            ? data.generationHistory.length + 1
            : 1;

          // Get updatedAt (v2 only, fallback to createdAt for v1)
          const updatedAt = data.version === 2
            ? data.updatedAt
            : data.createdAt;

          return {
            id: blob.pathname,
            jobId,
            generationId: data.generationId,
            environment: data.environment,
            timestamp: data.createdAt,
            updatedAt,
            companyName: data.companyName,
            roleTitle: data.roleTitle,
            scoreBefore: data.estimatedCompatibility.before,
            scoreAfter: data.estimatedCompatibility.after,
            applicationStatus: data.applicationStatus,
            url: blob.url,
            size: blob.size,
            generationCount,
          };
        } catch (error) {
          console.error('[admin/resume-generations] Error parsing blob:', blob.pathname, error);
          // Return a placeholder for failed parses
          return {
            id: blob.pathname,
            jobId: 'unknown',
            generationId: 'unknown',
            environment: environment,
            timestamp: blob.uploadedAt.toISOString(),
            updatedAt: blob.uploadedAt.toISOString(),
            companyName: 'Unknown',
            roleTitle: 'Unknown',
            scoreBefore: 0,
            scoreAfter: 0,
            applicationStatus: 'draft' as const,
            url: blob.url,
            size: blob.size,
            generationCount: 1,
          };
          }
        })
      );
      allGenerations.push(...batchResults);
    }

    // Apply filters
    const hasFilters = Object.keys(filters).length > 0;
    const generations = hasFilters
      ? allGenerations.filter((g) => matchesFilters(g, filters))
      : allGenerations;

    // Sort by timestamp descending (newest first)
    generations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return Response.json({
      generations,
      cursor: nextCursor,
      hasMore: !!nextCursor,
      totalFetched: allGenerations.length,
      filtered: hasFilters,
    });
  } catch (error) {
    console.error('[admin/resume-generations] Error:', error);
    return Response.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    );
  }
}
