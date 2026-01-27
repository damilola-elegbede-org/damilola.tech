import { list } from '@vercel/blob';
import { CONTENT_DIRS } from './content-utils';

// Cache for blob content to avoid repeated fetches
const blobCache = new Map<string, string>();

// Content files are stored under damilola.tech/content/ in Vercel Blob
const BLOB_PATH_PREFIX = 'damilola.tech/content/';

export interface FetchBlobOptions {
  /** If true, throws an error when the blob is not found. Build will fail. */
  required?: boolean;
}

/**
 * Fetch content from Vercel Blob storage using the @vercel/blob SDK.
 * Files are stored under the content/ prefix (e.g., content/chatbot-system-prompt.md)
 */
export async function fetchBlob(
  filename: string,
  options?: FetchBlobOptions
): Promise<string> {
  // Check cache first
  if (blobCache.has(filename)) {
    return blobCache.get(filename)!;
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    const message = `BLOB_READ_WRITE_TOKEN not configured for ${filename}`;
    if (options?.required) {
      throw new Error(`${message}. Build cannot proceed.`);
    }
    console.warn(message);
    return '';
  }

  try {
    // List blobs with the specific prefix to find our file
    const blobPath = `${BLOB_PATH_PREFIX}${filename}`;
    const { blobs } = await list({
      prefix: blobPath,
      token,
    });

    // Find exact match (list returns all files with prefix)
    const blob = blobs.find((b) => b.pathname === blobPath);

    if (!blob) {
      const message = `Blob not found: ${blobPath}`;
      if (options?.required) {
        throw new Error(`Required blob file not found: ${filename}. Build cannot proceed.`);
      }
      console.warn(message);
      return '';
    }

    // Fetch the content from the blob's public URL
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(blob.url, { signal: controller.signal });

      if (!response.ok) {
        const message = `Failed to fetch blob content: ${filename} (${response.status})`;
        if (options?.required) {
          throw new Error(message);
        }
        console.warn(message);
        return '';
      }

      const content = await response.text();
      blobCache.set(filename, content);
      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (options?.required) {
      throw error;
    }
    console.error(`Error fetching blob ${filename}:`, error);
    return '';
  }
}

/**
 * Clear the blob cache (useful for development)
 */
export function clearBlobCache(): void {
  blobCache.clear();
}

/**
 * Fetch all reference materials for the AI chatbot (legacy)
 * @deprecated Use fetchPromptTemplate() and fetchAllContent() instead
 */
export async function fetchAllReferenceMaterials(): Promise<{
  resume: string;
  starStories: string;
  leadership: string;
  technical: string;
}> {
  const [resume, starStories, leadership, technical] = await Promise.all([
    fetchBlob('resume-full.json'),
    fetchBlob('star-stories.json'),
    fetchBlob('leadership-philosophy.md'),
    fetchBlob('technical-expertise.md'),
  ]);

  return { resume, starStories, leadership, technical };
}

/**
 * Fetch the system prompt template from Vercel Blob.
 * @deprecated Use fetchSharedContext() and fetchChatbotInstructions() instead.
 * This is a REQUIRED file - build will fail if it's missing.
 */
export async function fetchPromptTemplate(): Promise<string> {
  return fetchBlob('chatbot-system-prompt.md', { required: true });
}

/**
 * Fetch the shared context template from Vercel Blob.
 * Contains profile data only (no chatbot-specific instructions).
 * This is a REQUIRED file - build will fail if it's missing.
 */
export async function fetchSharedContext(): Promise<string> {
  return fetchWithLocalFallbackRequired('shared-context.md');
}

/**
 * Fetch the chatbot instructions template from Vercel Blob.
 * Contains chatbot-specific behavior (3rd person, how to answer, etc.).
 * This is a REQUIRED file - build will fail if it's missing.
 */
export async function fetchChatbotInstructions(): Promise<string> {
  return fetchWithLocalFallbackRequired('chatbot-instructions.md');
}

export interface ContentFiles {
  starStories: string;
  resume: string;
  leadershipPhilosophy: string;
  technicalExpertise: string;
  verilyFeedback: string;
  anecdotes: string;
  projectsContext: string;
  chatbotArchitecture: string;
}

/**
 * Fetch all content files for placeholder replacement.
 * All content files are REQUIRED - build fails if any are missing.
 * Falls back to local files in development when blob token is not configured.
 */
export async function fetchAllContent(): Promise<ContentFiles> {
  const [
    starStories,
    resume,
    leadershipPhilosophy,
    technicalExpertise,
    verilyFeedback,
    anecdotes,
    projectsContext,
    chatbotArchitecture,
  ] = await Promise.all([
    fetchWithLocalFallbackRequired('star-stories.json'),
    fetchWithLocalFallbackRequired('resume-full.json'),
    fetchWithLocalFallbackRequired('leadership-philosophy.md'),
    fetchWithLocalFallbackRequired('technical-expertise.md'),
    fetchWithLocalFallbackRequired('verily-feedback.md'),
    fetchWithLocalFallbackRequired('anecdotes.md'),
    fetchWithLocalFallbackRequired('projects-context.md'),
    fetchWithLocalFallbackRequired('chatbot-architecture.md'),
  ]);

  return {
    starStories,
    resume,
    leadershipPhilosophy,
    technicalExpertise,
    verilyFeedback,
    anecdotes,
    projectsContext,
    chatbotArchitecture,
  };
}

/**
 * Try to find a file in one of the content directories.
 * Returns the content if found, null otherwise.
 */
async function tryLocalContentDirs(filename: string): Promise<string | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    for (const dir of CONTENT_DIRS) {
      const localPath = path.join(process.cwd(), dir, filename);
      try {
        const content = await fs.readFile(localPath, 'utf-8');
        console.log(`Using local ${filename} from ${dir}`);
        return content;
      } catch {
        // File not found in this directory, try next
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Helper to fetch from blob with local file fallback for development.
 * Use this for content files that need to work without blob token configured.
 * NOTE: This requires Node.js runtime - won't work on Edge.
 * Uses dynamic imports to avoid breaking edge runtime.
 */
async function fetchWithLocalFallback(filename: string): Promise<string> {
  // Try blob first
  const blobContent = await fetchBlob(filename);
  if (blobContent) return blobContent;

  // Fallback to local files in career-data/ directories
  const localContent = await tryLocalContentDirs(filename);
  if (localContent) return localContent;

  console.warn(`${filename} not found in blob or locally`);
  return '';
}

/**
 * Helper to fetch from blob with local file fallback for development.
 * REQUIRED version - throws error if file not found anywhere.
 * NOTE: This requires Node.js runtime - won't work on Edge.
 * Uses dynamic imports to avoid breaking edge runtime.
 */
async function fetchWithLocalFallbackRequired(filename: string): Promise<string> {
  // Check if blob token is configured
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token) {
    // Try blob first when token is available
    try {
      return await fetchBlob(filename, { required: true });
    } catch {
      // If blob fails, try local fallback
      console.warn(`Blob fetch failed for ${filename}, trying local fallback...`);
    }
  }

  // Fallback to local files in career-data/ directories
  const localContent = await tryLocalContentDirs(filename);
  if (localContent) return localContent;

  // If no blob token and no local file, throw the appropriate error
  if (!token) {
    throw new Error(`BLOB_READ_WRITE_TOKEN not configured for ${filename}. Build cannot proceed.`);
  }
  throw new Error(`Required file ${filename} not found in blob or locally. Build cannot proceed.`);
}

/**
 * Fetch fit assessment instructions.
 * Falls back to local file in development when blob token is not configured.
 */
export async function fetchFitAssessmentInstructions(): Promise<string> {
  return fetchWithLocalFallback('fit-assessment-instructions.md');
}

/**
 * Fetch fit assessment instructions (REQUIRED version for build-time).
 * Throws error if file not found - build will fail.
 */
export async function fetchFitAssessmentInstructionsRequired(): Promise<string> {
  return fetchWithLocalFallbackRequired('fit-assessment-instructions.md');
}

/**
 * Fetch example JDs for the fit assessment feature.
 * Falls back to local files in development when blob token is not configured.
 */
export async function fetchFitExamples(): Promise<{ strong: string; weak: string }> {
  const [strong, weak] = await Promise.all([
    fetchWithLocalFallback('fit-example-strong.md'),
    fetchWithLocalFallback('fit-example-weak.md'),
  ]);
  return { strong, weak };
}

/**
 * Fetch AI context for experience cards.
 * Contains strategic context, leadership challenges, and key insights.
 * Falls back to local file in development when blob token is not configured.
 */
export async function fetchAiContext(): Promise<string> {
  return fetchWithLocalFallback('ai-context.md');
}

/**
 * Fetch resume generator instructions (REQUIRED version for build-time).
 * Throws error if file not found - build will fail.
 */
export async function fetchResumeGeneratorInstructionsRequired(): Promise<string> {
  return fetchWithLocalFallbackRequired('resume-generator-instructions.md');
}
