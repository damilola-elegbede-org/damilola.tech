// Cache for blob content to avoid repeated fetches
const blobCache = new Map<string, string>();

/**
 * Fetch content from Vercel Blob storage
 * Note: For local development, content files should be uploaded to Vercel Blob
 * or you can use a local API route to serve the content
 */
export async function fetchBlob(filename: string): Promise<string> {
  // Check cache first
  if (blobCache.has(filename)) {
    return blobCache.get(filename)!;
  }

  // Fetch from Vercel Blob
  try {
    const blobStoreId = process.env.VERCEL_BLOB_STORE_ID;
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!blobStoreId || !token) {
      console.warn(`Blob configuration missing for ${filename}`);
      return '';
    }

    const blobUrl = `https://${blobStoreId}.blob.vercel-storage.com/${filename}`;
    const response = await fetch(blobUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn(`Blob not found or error: ${filename} (${response.status})`);
      return '';
    }

    const content = await response.text();
    blobCache.set(filename, content);
    return content;
  } catch (error) {
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
 * Fetch all reference materials for the AI chatbot
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
