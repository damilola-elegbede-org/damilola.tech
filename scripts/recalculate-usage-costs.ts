#!/usr/bin/env npx tsx
/**
 * Recalculate usage costs for all historical sessions.
 *
 * This script recalculates the cost for each request using the current pricing
 * constants and corrected net-savings formula.
 *
 * Usage:
 *   npx tsx scripts/recalculate-usage-costs.ts              # Recalculate all sessions
 *   npx tsx scripts/recalculate-usage-costs.ts --dry-run    # Preview changes
 *
 * Requires BLOB_READ_WRITE_TOKEN environment variable.
 */

import { list, put, head } from '@vercel/blob';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Current pricing (1-hour TTL)
const PRICING = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
  cacheWritePerMillion: 6.0,  // 1-hour TTL
  cacheReadPerMillion: 0.3,
};

// Historical pricing (5-min TTL) for sessions that used the old TTL
const HISTORICAL_PRICING = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
  cacheWritePerMillion: 3.75,  // 5-min TTL
  cacheReadPerMillion: 0.3,
};

interface UsageRequest {
  timestamp: string;
  endpoint: 'chat' | 'fit-assessment' | 'resume-generator';
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreation: number;
  cacheRead: number;
  durationMs: number;
  costUsd: number;
  cacheTtl?: '5m' | '1h';
}

interface UsageSession {
  sessionId: string;
  createdAt: string;
  lastUpdatedAt: string;
  requests: UsageRequest[];
  totals: {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    estimatedCostUsd: number;
  };
}

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2);
  return { dryRun: args.includes('--dry-run') };
}

/**
 * Calculate the USD cost for a single API request.
 * Uses historical pricing for sessions without cacheTtl (assumed 5-min TTL).
 */
function calculateCost(request: UsageRequest): number {
  // Use historical pricing for requests without cacheTtl marker (they used 5-min TTL)
  const pricing = request.cacheTtl === '1h' ? PRICING : HISTORICAL_PRICING;

  // Input tokens that weren't read from cache
  const uncachedInput = Math.max(0, request.inputTokens - request.cacheRead);

  const cost =
    (uncachedInput / 1_000_000) * pricing.inputPerMillion +
    (request.cacheRead / 1_000_000) * pricing.cacheReadPerMillion +
    (request.cacheCreation / 1_000_000) * pricing.cacheWritePerMillion +
    (request.outputTokens / 1_000_000) * pricing.outputPerMillion;

  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Calculate totals from a list of requests.
 */
function calculateTotals(requests: UsageRequest[]): UsageSession['totals'] {
  return requests.reduce(
    (acc, req) => ({
      requestCount: acc.requestCount + 1,
      inputTokens: acc.inputTokens + req.inputTokens,
      outputTokens: acc.outputTokens + req.outputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + req.cacheCreation,
      cacheReadTokens: acc.cacheReadTokens + req.cacheRead,
      estimatedCostUsd:
        Math.round((acc.estimatedCostUsd + req.costUsd) * 1_000_000) / 1_000_000,
    }),
    {
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      estimatedCostUsd: 0,
    }
  );
}

async function recalculate(options: { dryRun: boolean }): Promise<void> {
  const { dryRun } = options;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log(`\nUsage Cost Recalculation`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no updates)' : 'LIVE'}`);
  console.log(`${'='.repeat(50)}\n`);

  const env = process.env.VERCEL_ENV || 'development';
  const prefix = `damilola.tech/usage/${env}/sessions/`;

  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  let cursor: string | undefined;

  const allBlobs: Array<{ pathname: string; url: string }> = [];

  // Collect all session blobs
  console.log('Scanning sessions...\n');

  do {
    const result = await list({ prefix, cursor, limit: 1000 });
    allBlobs.push(...result.blobs.filter((b) => b.pathname.endsWith('.json')));
    cursor = result.cursor ?? undefined;
  } while (cursor);

  console.log(`Found ${allBlobs.length} sessions to process.\n`);

  let totalOldCost = 0;
  let totalNewCost = 0;

  for (const blob of allBlobs) {
    try {
      // Fetch current session data
      const response = await fetch(blob.url);
      if (!response.ok) {
        console.log(`  [SKIP] Could not fetch: ${blob.pathname}`);
        errors++;
        continue;
      }

      const session: UsageSession = await response.json();
      const oldTotalCost = session.totals.estimatedCostUsd;
      totalOldCost += oldTotalCost;

      // Recalculate each request's cost
      let hasChanges = false;
      for (const request of session.requests) {
        const newCost = calculateCost(request);
        if (Math.abs(newCost - request.costUsd) > 0.000001) {
          hasChanges = true;
          request.costUsd = newCost;
        }
      }

      // Recalculate totals
      const newTotals = calculateTotals(session.requests);
      totalNewCost += newTotals.estimatedCostUsd;

      if (hasChanges || Math.abs(newTotals.estimatedCostUsd - session.totals.estimatedCostUsd) > 0.000001) {
        session.totals = newTotals;

        if (!dryRun) {
          await put(blob.pathname, JSON.stringify(session, null, 2), {
            access: 'public',
            addRandomSuffix: false,
          });
        }

        const diff = newTotals.estimatedCostUsd - oldTotalCost;
        const diffStr = diff >= 0 ? `+$${diff.toFixed(6)}` : `-$${Math.abs(diff).toFixed(6)}`;
        console.log(`  [UPDATED] ${session.sessionId.slice(0, 20)}... $${oldTotalCost.toFixed(6)} → $${newTotals.estimatedCostUsd.toFixed(6)} (${diffStr})`);
        updated++;
      } else {
        unchanged++;
      }
    } catch (error) {
      console.error(`  [ERROR] Failed to process: ${blob.pathname}`, error);
      errors++;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Summary${dryRun ? ' (DRY RUN)' : ''}:`);
  console.log(`  ${dryRun ? 'Would update' : 'Updated'}: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Errors: ${errors}`);
  console.log(`\nCost Change:`);
  console.log(`  Old total: $${totalOldCost.toFixed(6)}`);
  console.log(`  New total: $${totalNewCost.toFixed(6)}`);
  const diff = totalNewCost - totalOldCost;
  console.log(`  Difference: ${diff >= 0 ? '+' : '-'}$${Math.abs(diff).toFixed(6)}`);
  console.log(`${'='.repeat(50)}\n`);

  if (dryRun && updated > 0) {
    console.log('Run without --dry-run to actually update these sessions.\n');
  }
}

recalculate(parseArgs()).catch((error) => {
  console.error('Recalculation failed:', error);
  process.exit(1);
});
