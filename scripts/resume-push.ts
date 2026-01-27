/**
 * Resume Push Script
 *
 * Uploads base resume PDF from career-data/resume/ to Vercel Blob storage.
 * Only syncs the base resume file, not AI-generated resumes in generated/.
 * Uses checksum comparison to only upload if changed.
 * Requires BLOB_READ_WRITE_TOKEN environment variable.
 */

import { readdir, readFile, lstat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { put } from '@vercel/blob';
import * as dotenv from 'dotenv';
import { isValidResumeFilename } from '../src/lib/content-utils';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const BLOB_PATH_PREFIX = 'damilola.tech/resume';
const BLOB_BASE_URL =
  process.env.BLOB_BASE_URL || 'https://mikya8vluytqhmff.public.blob.vercel-storage.com';
const LOCAL_RESUME_DIR = join(process.cwd(), 'career-data/resume');

// Only sync PDF files (the base resume)
const ALLOWED_EXTENSIONS = ['.pdf'];

function md5(content: Buffer): string {
  return createHash('md5').update(content).digest('hex');
}

async function getRemoteContent(filename: string): Promise<Buffer | null> {
  const encodedFilename = encodeURIComponent(filename);
  const url = `${BLOB_BASE_URL}/${BLOB_PATH_PREFIX}/${encodedFilename}`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return null;
  } catch {
    return null;
  }
}

type UploadResult = 'uploaded' | 'unchanged' | 'error';

async function uploadFile(filename: string, localContent: Buffer): Promise<UploadResult> {
  const blobPath = `${BLOB_PATH_PREFIX}/${filename}`;

  try {
    // Check if remote content exists and compare checksums
    const remoteContent = await getRemoteContent(filename);

    if (remoteContent !== null) {
      const localHash = md5(localContent);
      const remoteHash = md5(remoteContent);

      if (localHash === remoteHash) {
        console.log(`  [UNCHANGED] ${filename}`);
        return 'unchanged';
      }
    }

    // Upload if new or changed
    const blob = await put(blobPath, localContent, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/pdf',
    });

    console.log(`  [UPLOADED] ${filename} -> ${blob.url}`);
    return 'uploaded';
  } catch (error) {
    const err = error as { code?: string; status?: number; message?: string };
    if (err.code === 'EACCES') {
      console.error(`  [ERROR] ${filename}: Permission denied`);
    } else if (err.status === 429) {
      console.error(`  [ERROR] ${filename}: Rate limited - try again later`);
    } else {
      console.error(`  [ERROR] ${filename}: ${err.message || 'Unknown error'}`);
    }
    return 'error';
  }
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('Error: BLOB_READ_WRITE_TOKEN not found in environment');
    console.error('Make sure it is set in .env.local');
    process.exit(1);
  }

  console.log('Resume Push - Uploading to Vercel Blob\n');
  console.log(`Source: ${LOCAL_RESUME_DIR}`);
  console.log(`Target: ${BLOB_PATH_PREFIX}/\n`);

  let files: string[];

  try {
    files = await readdir(LOCAL_RESUME_DIR);
  } catch {
    console.error(`Error: Directory not found: ${LOCAL_RESUME_DIR}`);
    console.error('Make sure career-data submodule is initialized:');
    console.error('  git submodule update --init --recursive');
    process.exit(1);
  }

  // Filter to only PDF files
  const pdfFiles = files.filter((f) =>
    ALLOWED_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext))
  );

  if (pdfFiles.length === 0) {
    console.log('No PDF files found in career-data/resume/');
    return;
  }

  console.log(`Found ${pdfFiles.length} PDF file(s) to process\n`);

  let uploadedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const filename of pdfFiles) {
    // Validate filename contains only safe characters (allow spaces for resume name)
    if (!isValidResumeFilename(filename)) {
      console.error(`  [SKIP] ${filename}: Invalid filename characters`);
      errorCount++;
      continue;
    }

    const localPath = join(LOCAL_RESUME_DIR, filename);

    // Verify it's a regular file (not a symlink)
    const stat = await lstat(localPath);
    if (!stat.isFile()) {
      console.error(`  [SKIP] ${filename}: Not a regular file`);
      errorCount++;
      continue;
    }

    const content = await readFile(localPath);
    const result = await uploadFile(filename, content);

    switch (result) {
      case 'uploaded':
        uploadedCount++;
        break;
      case 'unchanged':
        unchangedCount++;
        break;
      case 'error':
        errorCount++;
        break;
    }
  }

  console.log(`\nComplete: ${uploadedCount} uploaded, ${unchangedCount} unchanged, ${errorCount} errors`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
