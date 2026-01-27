/**
 * Resume Pull Script
 *
 * Downloads base resume PDF from Vercel Blob to career-data/resume/ directory.
 * Only syncs the base resume file (Damilola Elegbede Resume.pdf), not generated/.
 * Used for syncing blob content back to the git-tracked submodule.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { list } from '@vercel/blob';
import * as dotenv from 'dotenv';
import { isValidResumeFilename } from '../src/lib/content-utils';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const BLOB_PATH_PREFIX = 'damilola.tech/resume';
const LOCAL_RESUME_DIR = join(process.cwd(), 'career-data/resume');

// Skip AI-generated resumes (they're in generated/ subfolder in blob)
const SKIP_PATTERNS = ['/generated/'];

type FetchResult = { status: 'ok'; content: Buffer } | { status: 'error'; error: unknown };

async function fetchFile(url: string, filename: string): Promise<FetchResult> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`  [ERROR] ${filename}: ${errorMsg}`);
      return { status: 'error', error: new Error(errorMsg) };
    }

    const arrayBuffer = await response.arrayBuffer();
    return { status: 'ok', content: Buffer.from(arrayBuffer) };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  [ERROR] ${filename}: ${errorMsg}`);
    return { status: 'error', error };
  }
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('Error: BLOB_READ_WRITE_TOKEN not found in environment');
    console.error('Make sure it is set in .env.local');
    process.exit(1);
  }

  console.log('Resume Pull - Downloading from Vercel Blob\n');
  console.log(`Source: ${BLOB_PATH_PREFIX}/`);
  console.log(`Target: ${LOCAL_RESUME_DIR}\n`);

  // List all files in the blob storage prefix
  console.log('Listing files in blob storage...');
  const { blobs } = await list({
    prefix: `${BLOB_PATH_PREFIX}/`,
    token,
  });

  if (blobs.length === 0) {
    console.log('No files found in blob storage.');
    return;
  }

  // Filter out generated resumes and keep only base resume PDFs
  const baseResumes = blobs.filter((blob) => {
    const pathname = blob.pathname;

    // Skip generated folder
    if (SKIP_PATTERNS.some((pattern) => pathname.includes(pattern))) {
      return false;
    }

    // Only include PDF files directly under damilola.tech/resume/
    return pathname.toLowerCase().endsWith('.pdf');
  });

  if (baseResumes.length === 0) {
    console.log('No base resume PDFs found (generated resumes are skipped).');
    return;
  }

  console.log(`Found ${baseResumes.length} base resume file(s)\n`);

  // Create local resume directory
  await mkdir(LOCAL_RESUME_DIR, { recursive: true });

  let successCount = 0;
  let errorCount = 0;

  for (const blob of baseResumes) {
    // Extract filename from pathname (remove prefix)
    const rawFilename = blob.pathname.replace(`${BLOB_PATH_PREFIX}/`, '');
    const filename = basename(rawFilename); // Prevent path traversal

    // Validate filename (allow spaces for resume name)
    if (!isValidResumeFilename(filename)) {
      console.error(`  [SKIP] ${rawFilename}: Invalid filename characters`);
      errorCount++;
      continue;
    }

    const result = await fetchFile(blob.url, filename);

    switch (result.status) {
      case 'ok': {
        const localPath = join(LOCAL_RESUME_DIR, filename);
        await writeFile(localPath, result.content);
        console.log(`  [OK] ${filename}`);
        successCount++;
        break;
      }
      case 'error':
        errorCount++;
        break;
    }
  }

  console.log(`\nComplete: ${successCount} downloaded, ${errorCount} errors`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
