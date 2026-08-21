/**
 * Blob Drift Check
 *
 * Compares the career-data files on disk against the copies served from Vercel
 * Blob — the copies `generate-prompt.ts` actually builds SHARED_CONTEXT,
 * CHATBOT_SYSTEM_PROMPT, FIT_ASSESSMENT_PROMPT and RESUME_GENERATOR_PROMPT from.
 *
 * Why this exists: career-data is a git submodule, but nothing in the build
 * reads it. A career-data commit changes nothing in production until
 * `content-push.ts` uploads it. Between Apr 2026 and Aug 2026 that gap left the
 * live resume generator, chatbot and fit assessment running on a profile that
 * ended at Verily, four months after the Visa role was committed to git.
 *
 * Reads the public blob URL — no BLOB_READ_WRITE_TOKEN required.
 *
 * Exit 0 = blob matches disk. Exit 1 = drift (run `npm run content:push`).
 * Exit 2 = the check could not run (network, missing files).
 *
 * Run: npm run content:check-drift
 */

import { readdir, open } from 'fs/promises';
import { join } from 'path';
import { CONTENT_DIRS, isValidFilename } from '../src/lib/content-utils';

const BLOB_PATH_PREFIX = 'damilola.tech/content';
const BLOB_BASE_URL =
  process.env.BLOB_BASE_URL || 'https://mikya8vluytqhmff.public.blob.vercel-storage.com';
const FETCH_TIMEOUT_MS = 15000;

type Drift = { filename: string; reason: string };

async function fetchRemote(filename: string): Promise<string | null> {
  const url = `${BLOB_BASE_URL}/${BLOB_PATH_PREFIX}/${encodeURIComponent(filename)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Compare on content, not on bytes. A JSON file that differs only in key order
 * or indentation is the same prompt input, and failing on that would train
 * everyone to ignore this check.
 */
function sameContent(filename: string, local: string, remote: string): boolean {
  if (local === remote) return true;
  if (filename.endsWith('.json')) {
    try {
      return JSON.stringify(JSON.parse(local)) === JSON.stringify(JSON.parse(remote));
    } catch {
      return false;
    }
  }
  return local.trim() === remote.trim();
}

async function collectLocalFiles(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const dir of CONTENT_DIRS) {
    const dirPath = join(process.cwd(), dir);
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!isValidFilename(entry)) continue;
      const full = join(dirPath, entry);
      const handle = await open(full, 'r');
      try {
        const stat = await handle.stat();
        if (!stat.isFile()) continue;
        files.set(entry, await handle.readFile('utf-8'));
      } finally {
        await handle.close();
      }
    }
  }
  return files;
}

export async function checkBlobDrift(): Promise<Drift[]> {
  const localFiles = await collectLocalFiles();
  if (localFiles.size === 0) {
    throw new Error(
      'No local content files found. Is the career-data submodule initialised? ' +
        'Run: git submodule update --init career-data',
    );
  }

  const drift: Drift[] = [];
  for (const [filename, local] of localFiles) {
    const remote = await fetchRemote(filename);
    if (remote === null) {
      drift.push({ filename, reason: 'not published to blob' });
      continue;
    }
    if (!sameContent(filename, local, remote)) {
      drift.push({ filename, reason: 'blob copy differs from career-data on disk' });
    }
  }
  return drift;
}

async function main(): Promise<void> {
  console.log('=== Blob Drift Check ===\n');
  let drift: Drift[];
  try {
    drift = await checkBlobDrift();
  } catch (error) {
    console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  if (drift.length === 0) {
    console.log('✓ Blob matches career-data. The deployed prompts are current.');
    return;
  }

  console.error(`✗ ${drift.length} file(s) drifted — production prompts are stale:\n`);
  for (const d of drift) {
    console.error(`  ${d.filename}: ${d.reason}`);
  }
  console.error('\nFix: npm run content:push, then redeploy so the prebuild hook rebakes the prompts.');
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith('check-blob-drift.ts');
if (invokedDirectly) {
  void main();
}
