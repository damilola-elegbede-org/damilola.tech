import { list } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
import { generateJobId } from '@/lib/job-id';
import type {
  ResumeGenerationSummary,
  ResumeGenerationLog,
  ResumeGenerationFilters,
  ApplicationStatus,
} from '@/lib/types/resume-generation';

export const runtime = 'nodejs';

function getEnvironment(): string {
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'preview';
}

function parseFilters(url: URL): ResumeGenerationFilters {
  const filters: ResumeGenerationFilters = {};
  const status = url.searchParams.get('status');
  if (status && ['draft', 'applied', 'interview', 'offer', 'rejected'].includes(status)) {
    filters.applicationStatus = status as ApplicationStatus;
  }
  const company = url.searchParams.get('company');
  if (company) filters.companyName = company;
  const dateFrom = url.searchParams.get('dateFrom');
  if (dateFrom) filters.dateFrom = dateFrom;
  const dateTo = url.searchParams.get('dateTo');
  if (dateTo) filters.dateTo = dateTo;
  const minScore = url.searchParams.get('minScore');
  if (minScore && !isNaN(Number(minScore))) filters.minScore = Number(minScore);
  const maxScore = url.searchParams.get('maxScore');
  if (maxScore && !isNaN(Number(maxScore))) filters.maxScore = Number(maxScore);
  return filters;
}

function matchesFilters(generation: ResumeGenerationSummary, filters: ResumeGenerationFilters): boolean {
  if (filters.applicationStatus && generation.applicationStatus !== filters.applicationStatus) return false;
  if (filters.companyName) {
    const searchTerm = filters.companyName.toLowerCase();
    if (!generation.companyName.toLowerCase().includes(searchTerm)) return false;
  }
  if (filters.dateFrom) {
    const generationDate = new Date(generation.timestamp).getTime();
    const fromDate = new Date(filters.dateFrom + 'T00:00:00.000Z').getTime();
    if (generationDate < fromDate) return false;
  }
  if (filters.dateTo) {
    const generationDate = new Date(generation.timestamp).getTime();
    const toDate = new Date(filters.dateTo + 'T23:59:59.999Z').getTime();
    if (generationDate > toDate) return false;
  }
  if (filters.minScore !== undefined && generation.scoreAfter < filters.minScore) return false;
  if (filters.maxScore !== undefined && generation.scoreAfter > filters.maxScore) return false;
  return true;
}

function computeJobIdForV1(data: ResumeGenerationLog): string {
  if (data.version === 2) return data.jobId;
  if (data.extractedUrl) return generateJobId({ url: data.extractedUrl }).jobId;
  return generateJobId({ title: data.roleTitle, company: data.companyName }).jobId;
}

export async function GET(req: Request) {
  console.log('[api/v1/resume-generations] Request received');

  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor') || undefined;
    const environment = getEnvironment();
    const filters = parseFilters(url);

    const blobPath = `damilola.tech/resume-generations/${environment}/`;

    const { blobs, cursor: nextCursor } = await list({
      prefix: blobPath,
      cursor,
      limit: 50,
    });

    const FETCH_CONCURRENCY = 10;
    const FETCH_TIMEOUT_MS = 10000;
    const MAX_BLOB_SIZE = 1024 * 1024;

    const fetchBlobWithTimeout = async (blobUrl: string): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(blobUrl, { signal: controller.signal });
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_BLOB_SIZE) {
          throw new Error('Blob too large');
        }
        return response;
      } finally {
        clearTimeout(timeout);
      }
    };

    const allGenerations: ResumeGenerationSummary[] = [];
    for (let i = 0; i < blobs.length; i += FETCH_CONCURRENCY) {
      const batch = blobs.slice(i, i + FETCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (blob) => {
          try {
            const response = await fetchBlobWithTimeout(blob.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data: ResumeGenerationLog = await response.json();

            const jobId = computeJobIdForV1(data);
            const generationCount = data.version === 2 ? data.generationHistory.length + 1 : 1;
            const updatedAt = data.version === 2 ? data.updatedAt : data.createdAt;

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
            console.error('[api/v1/resume-generations] Error parsing blob:', blob.pathname, error);
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

    const hasFilters = Object.keys(filters).length > 0;
    const generations = hasFilters
      ? allGenerations.filter((g) => matchesFilters(g, filters))
      : allGenerations;

    generations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return apiSuccess(
      { generations },
      {
        environment,
        pagination: {
          cursor: nextCursor || undefined,
          hasMore: !!nextCursor,
        },
      }
    );
  } catch (error) {
    console.error('[api/v1/resume-generations] Error:', error);
    return Errors.internalError('Failed to fetch generations');
  }
}
