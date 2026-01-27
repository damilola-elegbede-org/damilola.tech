/**
 * Content Pull Script
 *
 * Downloads all content files from Vercel Blob to career-data/ subdirectories.
 * Files are routed to appropriate directories based on filename.
 * Used for syncing blob content back to the git-tracked submodule.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { list } from '@vercel/blob';
import * as dotenv from 'dotenv';
import {
  getTargetDirectory,
  isKnownFile,
  isValidFilename,
  TARGET_DIRS,
} from '../src/lib/content-utils';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const BLOB_PATH_PREFIX = 'damilola.tech/content';
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB limit

type FetchResult = { status: 'ok'; content: string } | { status: 'error'; error: unknown };

async function fetchFile(url: string, filename: string): Promise<FetchResult> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`  [ERROR] ${filename}: ${errorMsg}`);
      return { status: 'error', error: new Error(errorMsg) };
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      const errorMsg = `Response too large (${contentLength} bytes, max ${MAX_RESPONSE_SIZE})`;
      console.error(`  [ERROR] ${filename}: ${errorMsg}`);
      return { status: 'error', error: new Error(errorMsg) };
    }

    return { status: 'ok', content: await response.text() };
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

  console.log('Content Pull - Downloading from Vercel Blob\n');
  console.log(`Source: ${BLOB_PATH_PREFIX}/`);
  console.log('Target directories:');
  for (const dir of TARGET_DIRS) {
    console.log(`  - career-data/${dir}/`);
  }
  console.log('');

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

  console.log(`Found ${blobs.length} files\n`);

  // Create all target directories
  for (const dir of TARGET_DIRS) {
    const dirPath = join(process.cwd(), 'career-data', dir);
    await mkdir(dirPath, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;
  let unknownCount = 0;

  for (const blob of blobs) {
    // Extract filename from pathname (remove prefix) and sanitize
    const rawFilename = blob.pathname.replace(`${BLOB_PATH_PREFIX}/`, '');
    const filename = basename(rawFilename); // Prevent path traversal

    // Validate filename contains only safe characters
    if (!isValidFilename(filename)) {
      console.error(`  [SKIP] ${rawFilename}: Invalid filename characters`);
      errorCount++;
      continue;
    }

    const result = await fetchFile(blob.url, filename);

    switch (result.status) {
      case 'ok': {
        const targetDir = getTargetDirectory(filename);
        const knownFile = isKnownFile(filename);

        if (!knownFile) {
          console.warn(`  [WARN] Unknown file "${filename}" - routing to ${targetDir}/`);
          unknownCount++;
        }

        const localPath = join(process.cwd(), 'career-data', targetDir, filename);
        await writeFile(localPath, result.content, 'utf-8');
        console.log(`  [OK] ${filename} -> career-data/${targetDir}/`);
        successCount++;
        break;
      }
      case 'error':
        errorCount++;
        break;
    }
  }

  console.log(`\nComplete: ${successCount} downloaded, ${errorCount} errors`);
  if (unknownCount > 0) {
    console.log(
      `\nNote: ${unknownCount} file(s) were not in the routing map and were placed using heuristics.`
    );
    console.log('Consider updating FILE_ROUTING in src/lib/content-utils.ts if needed.');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
