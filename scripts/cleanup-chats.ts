#!/usr/bin/env npx tsx
/**
 * Manual cleanup script for archived chat sessions in Vercel Blob.
 *
 * This script deletes archived sessions older than the retention period (default 90 days).
 * Use this for preview environments where Vercel crons don't run.
 *
 * Usage:
 *   npm run cleanup:chats              # Delete sessions > 90 days old
 *   npm run cleanup:chats -- --dry-run # Preview what would be deleted
 *   npm run cleanup:chats -- --days 30 # Use custom retention period
 *
 * Requires BLOB_READ_WRITE_TOKEN environment variable.
 */

import { list, del } from '@vercel/blob';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const CHATS_PREFIX = 'damilola.tech/chats/';
const DEFAULT_RETENTION_DAYS = 90;

interface CleanupOptions {
  retentionDays: number;
  dryRun: boolean;
}

function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  const options: CleanupOptions = {
    retentionDays: DEFAULT_RETENTION_DAYS,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--days' && args[i + 1]) {
      const days = parseInt(args[i + 1], 10);
      if (!isNaN(days) && days > 0) {
        options.retentionDays = days;
      }
      i++;
    }
  }

  return options;
}

/**
 * Parse timestamp from blob pathname
 * Expected format: damilola.tech/chats/{env}/{timestamp}-{uuid}.json
 * Timestamp format: 2025-01-22T14-30-00Z
 */
function parseTimestampFromPathname(pathname: string): Date | null {
  try {
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1];

    const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)/);
    if (!match) return null;

    const isoTimestamp = match[1].replace(
      /T(\d{2})-(\d{2})-(\d{2})Z/,
      'T$1:$2:$3Z'
    );

    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) return null;

    return date;
  } catch {
    return null;
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function cleanup(options: CleanupOptions): Promise<void> {
  const { retentionDays, dryRun } = options;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log(`\nChat Session Cleanup`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Retention period: ${retentionDays} days`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'LIVE'}`);
  console.log(`${'='.repeat(50)}\n`);

  const now = Date.now();
  const cutoffDate = now - retentionDays * 24 * 60 * 60 * 1000;
  const cutoffDateObj = new Date(cutoffDate);

  console.log(`Cutoff date: ${formatDate(cutoffDateObj)}`);
  console.log(`Sessions archived before this date will be deleted.\n`);

  let deleted = 0;
  let kept = 0;
  let skipped = 0;
  let errors = 0;
  let cursor: string | undefined;

  const toDelete: Array<{ pathname: string; url: string; date: Date }> = [];
  const toKeep: Array<{ pathname: string; date: Date }> = [];

  // Collect all blobs first
  console.log('Scanning archived sessions...\n');

  do {
    const result = await list({
      prefix: CHATS_PREFIX,
      cursor,
    });

    for (const blob of result.blobs) {
      const timestamp = parseTimestampFromPathname(blob.pathname);

      if (!timestamp) {
        console.log(`  [SKIP] Could not parse: ${blob.pathname}`);
        skipped++;
        continue;
      }

      if (timestamp.getTime() < cutoffDate) {
        toDelete.push({ pathname: blob.pathname, url: blob.url, date: timestamp });
      } else {
        toKeep.push({ pathname: blob.pathname, date: timestamp });
      }
    }

    cursor = result.cursor ?? undefined;
  } while (cursor);

  // Report what will be deleted
  if (toDelete.length > 0) {
    console.log(`Sessions to delete (${toDelete.length}):`);
    for (const blob of toDelete.slice(0, 10)) {
      console.log(`  - ${formatDate(blob.date)}: ${blob.pathname.split('/').pop()}`);
    }
    if (toDelete.length > 10) {
      console.log(`  ... and ${toDelete.length - 10} more`);
    }
    console.log();
  }

  // Perform deletions (unless dry run)
  if (!dryRun && toDelete.length > 0) {
    console.log('Deleting old sessions...\n');

    for (const blob of toDelete) {
      try {
        await del(blob.url);
        deleted++;
        process.stdout.write(`\r  Deleted: ${deleted}/${toDelete.length}`);
      } catch (error) {
        console.error(`\n  [ERROR] Failed to delete: ${blob.pathname}`, error);
        errors++;
      }
    }
    console.log('\n');
  } else if (dryRun) {
    deleted = toDelete.length; // Would have deleted
  }

  kept = toKeep.length;

  // Summary
  console.log(`${'='.repeat(50)}`);
  console.log(`Summary${dryRun ? ' (DRY RUN)' : ''}:`);
  console.log(`  ${dryRun ? 'Would delete' : 'Deleted'}: ${deleted}`);
  console.log(`  Kept: ${kept}`);
  console.log(`  Skipped: ${skipped}`);
  if (errors > 0) {
    console.log(`  Errors: ${errors}`);
  }
  console.log(`${'='.repeat(50)}\n`);

  if (dryRun && toDelete.length > 0) {
    console.log('Run without --dry-run to actually delete these sessions.\n');
  }
}

cleanup(parseArgs()).catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
