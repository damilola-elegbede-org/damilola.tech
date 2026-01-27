/**
 * Content Push Script
 *
 * Uploads all content files from career-data/ subdirectories to Vercel Blob storage.
 * Files from multiple directories are flattened to damilola.tech/content/ in blob.
 * Uses checksum comparison to only upload new or changed files.
 * Requires BLOB_READ_WRITE_TOKEN environment variable.
 */

import { readdir, readFile, lstat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { put } from '@vercel/blob';
import * as dotenv from 'dotenv';
import { CONTENT_DIRS, isValidFilename, detectDuplicates } from '../src/lib/content-utils';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const BLOB_PATH_PREFIX = 'damilola.tech/content';
const BLOB_BASE_URL =
  process.env.BLOB_BASE_URL || 'https://mikya8vluytqhmff.public.blob.vercel-storage.com';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB limit

function md5(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

async function getRemoteContent(filename: string): Promise<string | null> {
  const url = `${BLOB_BASE_URL}/${BLOB_PATH_PREFIX}/${filename}`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        console.error(`  [ERROR] ${filename}: Response too large (${contentLength} bytes)`);
        return null;
      }
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

interface FileInfo {
  filename: string;
  localPath: string;
  sourceDir: string;
}

async function collectFilesFromDirectory(dir: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const dirPath = join(process.cwd(), dir);

  try {
    const entries = await readdir(dirPath);

    for (const filename of entries) {
      // Validate filename contains only safe characters (no path traversal)
      if (!isValidFilename(filename)) {
        console.error(`  [SKIP] ${dir}/${filename}: Invalid filename characters`);
        continue;
      }

      const localPath = join(dirPath, filename);

      // Verify it's a regular file (not a symlink or directory)
      const stat = await lstat(localPath);
      if (!stat.isFile()) {
        continue;
      }

      files.push({
        filename,
        localPath,
        sourceDir: dir,
      });
    }
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'ENOENT') {
      console.warn(`  [WARN] Directory not found: ${dir}`);
    } else {
      throw error;
    }
  }

  return files;
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('Error: BLOB_READ_WRITE_TOKEN not found in environment');
    console.error('Make sure it is set in .env.local');
    process.exit(1);
  }

  console.log('Content Push - Uploading to Vercel Blob\n');
  console.log('Source directories:');
  for (const dir of CONTENT_DIRS) {
    console.log(`  - ${dir}`);
  }
  console.log(`Target: ${BLOB_PATH_PREFIX}/\n`);

  // Collect all files from all directories
  const allFiles: FileInfo[] = [];
  for (const dir of CONTENT_DIRS) {
    const files = await collectFilesFromDirectory(dir);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log('No content files found in career-data directories.');
    console.log('Make sure career-data submodule is initialized:');
    console.log('  git submodule update --init --recursive');
    process.exit(1);
  }

  // Check for duplicate filenames across directories
  const duplicates = detectDuplicates(allFiles);
  if (duplicates.size > 0) {
    for (const [filename, dirs] of duplicates) {
      console.error(`\nError: Duplicate filename "${filename}" found in:`);
      for (const dir of dirs) {
        console.error(`  - ${dir}`);
      }
    }
    console.error('All content files must have unique names.');
    process.exit(1);
  }

  console.log(`Found ${allFiles.length} files to process\n`);

  let uploadedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const file of allFiles) {
    const content = await readFile(file.localPath, 'utf-8');
    const result = await uploadFile(file.filename, content);

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
