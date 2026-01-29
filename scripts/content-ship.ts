/**
 * Content Ship Script
 *
 * Commits career-data submodule changes, commits the pointer update in the main repo,
 * and pushes both to remote.
 *
 * This script handles the 6-step workflow:
 * 1. Stage all changes in career-data submodule
 * 2. Commit in submodule with appropriate message
 * 3. Push to career-data remote (origin main)
 * 4. Stage pointer update in main repo (git add career-data)
 * 5. Commit main repo with submodule pointer update
 * 6. Push main repo to remote
 */

import { execSync, spawnSync } from 'child_process';
import { join } from 'path';
import { generateCommitMessage } from '../src/lib/content-utils';

const SUBMODULE_PATH = join(process.cwd(), 'career-data');

function exec(command: string, options?: { cwd?: string }): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      cwd: options?.cwd || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string; message?: string };
    throw new Error(err.stderr || err.stdout || err.message || 'Command failed');
  }
}

function hasChanges(cwd: string): boolean {
  try {
    const status = exec('git status --porcelain', { cwd });
    return status.length > 0;
  } catch {
    return false;
  }
}

function getChangedFiles(cwd: string): string[] {
  try {
    const status = exec('git status --porcelain', { cwd });
    return status
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.substring(3)); // Remove status prefix
  } catch {
    return [];
  }
}

async function main() {
  console.log('Content Ship - Submodule workflow\n');

  // Step 0: Check if submodule exists
  try {
    exec('git rev-parse --git-dir', { cwd: SUBMODULE_PATH });
  } catch {
    console.error('Error: career-data submodule not found or not initialized.');
    console.error('Initialize the submodule first:');
    console.error('  git submodule update --init --recursive');
    process.exit(1);
  }

  // Step 1: Check for changes in submodule
  console.log('Checking for changes in career-data...');
  if (!hasChanges(SUBMODULE_PATH)) {
    console.log('No changes detected in career-data submodule.');
    console.log('Nothing to commit.');
    process.exit(0);
  }

  const changedFiles = getChangedFiles(SUBMODULE_PATH);
  console.log(`Found ${changedFiles.length} changed file(s):`);
  for (const file of changedFiles) {
    console.log(`  - ${file}`);
  }
  console.log('');

  // Step 2: Stage all changes in submodule
  console.log('Staging changes in submodule...');
  exec('git add -A', { cwd: SUBMODULE_PATH });

  // Step 3: Commit in submodule
  const commitMessage = generateCommitMessage(changedFiles);
  console.log(`Committing with message: "${commitMessage}"`);

  // Use spawnSync to handle commit message safely
  const commitResult = spawnSync('git', ['commit', '-m', commitMessage], {
    cwd: SUBMODULE_PATH,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (commitResult.status !== 0) {
    console.error('Error committing in submodule:');
    console.error(commitResult.stderr || commitResult.stdout);
    process.exit(1);
  }

  console.log('Committed in submodule.\n');

  // Step 4: Push to remote
  console.log('Pushing to career-data remote...');
  try {
    exec('git push origin main', { cwd: SUBMODULE_PATH });
    console.log('Pushed to remote.\n');
  } catch (error) {
    const err = error as Error;
    console.error('Error pushing to remote:');
    console.error(err.message);
    console.error('\nThe commit was created locally but not pushed.');
    console.error('You may need to push manually: cd career-data && git push origin main');
    // Don't exit - we can still stage the pointer update
  }

  // Step 4: Stage pointer update in main repo
  console.log('Staging submodule pointer update in main repo...');
  exec('git add career-data', { cwd: process.cwd() });

  // Step 5: Commit main repo
  console.log('Committing main repo...');
  const mainCommitResult = spawnSync(
    'git',
    ['commit', '-m', 'chore: update career-data submodule pointer'],
    {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  if (mainCommitResult.status !== 0) {
    console.error('Error committing main repo:');
    console.error(mainCommitResult.stderr || mainCommitResult.stdout);
    process.exit(1);
  }
  console.log('Committed main repo.\n');

  // Step 6: Push main repo
  console.log('Pushing main repo to remote...');
  try {
    exec('git push', { cwd: process.cwd() });
    console.log('Pushed main repo.\n');
  } catch (error) {
    const err = error as Error;
    console.error('Error pushing main repo:');
    console.error(err.message);
    console.error('\nThe commit was created locally but not pushed.');
    console.error('You may need to push manually: git push');
    process.exit(1);
  }

  console.log('Done! Both repos are committed and pushed.');
  console.log('');
  console.log('Next step:');
  console.log('  Run "npm run content:push" to sync to Vercel Blob');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
