/**
 * Content Push Script
 *
 * Uploads all content files from local .tmp/content/ to Vercel Blob storage.
 * Uses checksum comparison to only upload new or changed files.
 * Requires BLOB_READ_WRITE_TOKEN environment variable.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { put } from '@vercel/blob';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const BLOB_PATH_PREFIX = 'damilola.tech/content';
const BLOB_BASE_URL = 'https://mikya8vluytqhmff.public.blob.vercel-storage.com';
const LOCAL_CONTENT_DIR = join(process.cwd(), '.tmp/content');

function md5(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

async function getRemoteContent(filename: string): Promise<string | null> {
  const url = `${BLOB_BASE_URL}/${BLOB_PATH_PREFIX}/${filename}`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.text();
    }
    return null;
  } catch {
    return null;
  }
}

type UploadResult = 'uploaded' | 'unchanged' | 'error';

async function uploadFile(filename: string, localContent: string): Promise<UploadResult> {
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
    });

    console.log(`  [UPLOADED] ${filename} -> ${blob.url}`);
    return 'uploaded';
  } catch (error) {
    console.error(`  [ERROR] ${filename}:`, error);
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

  console.log('Content Push - Uploading to Vercel Blob\n');
  console.log(`Source: ${LOCAL_CONTENT_DIR}`);
  console.log(`Target: ${BLOB_PATH_PREFIX}/\n`);

  let files: string[];

  try {
    files = await readdir(LOCAL_CONTENT_DIR);
  } catch {
    console.error(`Error: Directory not found: ${LOCAL_CONTENT_DIR}`);
    console.error('Run "npm run content:pull" first to download content files.');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No files found in .tmp/content/');
    return;
  }

  let uploadedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const filename of files) {
    const localPath = join(LOCAL_CONTENT_DIR, filename);
    const content = await readFile(localPath, 'utf-8');
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
