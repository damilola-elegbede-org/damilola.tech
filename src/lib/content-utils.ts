/**
 * Content Utilities
 *
 * Shared utilities for content management scripts.
 * These are extracted for testability.
 */

/**
 * File routing map: filename -> subdirectory in career-data/
 */
export const FILE_ROUTING: Record<string, string> = {
  // Instructions
  'chatbot-instructions.md': 'instructions',
  'fit-assessment-instructions.md': 'instructions',
  'resume-generator-instructions.md': 'instructions',

  // Templates
  'shared-context.md': 'templates',

  // Context
  'ai-context.md': 'context',
  'anecdotes.md': 'context',
  'chatbot-architecture.md': 'context',
  'leadership-philosophy.md': 'context',
  'projects-context.md': 'context',
  'technical-expertise.md': 'context',
  'verily-feedback.md': 'context',

  // Data
  'resume-full.json': 'data',
  'star-stories.json': 'data',

  // Examples
  'fit-example-strong.md': 'examples',
  'fit-example-weak.md': 'examples',
};

/**
 * Content directories to search for local fallback (in priority order)
 */
export const CONTENT_DIRS = [
  'career-data/instructions',
  'career-data/templates',
  'career-data/context',
  'career-data/data',
  'career-data/examples',
];

/**
 * All possible target directories for content files
 */
export const TARGET_DIRS = ['instructions', 'templates', 'context', 'data', 'examples'];

/**
 * Get the target directory for a content file based on filename.
 * Uses explicit routing map first, then heuristic fallbacks.
 */
export function getTargetDirectory(filename: string): string {
  const dir = FILE_ROUTING[filename];
  if (dir) {
    return dir;
  }

  // Heuristic fallback for unknown files
  if (filename.endsWith('-instructions.md')) {
    return 'instructions';
  }
  if (filename.endsWith('.json')) {
    return 'data';
  }
  if (filename.startsWith('fit-example-')) {
    return 'examples';
  }

  // Default to context for unknown markdown files
  return 'context';
}

/**
 * Check if a filename is in the known routing map.
 */
export function isKnownFile(filename: string): boolean {
  return FILE_ROUTING[filename] !== undefined;
}

/**
 * Generate a commit message based on changed files.
 */
export function generateCommitMessage(files: string[]): string {
  // Analyze changed files to generate appropriate message
  const categories = new Set<string>();

  for (const file of files) {
    if (file.includes('instructions/')) categories.add('instructions');
    else if (file.includes('templates/')) categories.add('templates');
    else if (file.includes('context/')) categories.add('context');
    else if (file.includes('data/')) categories.add('data');
    else if (file.includes('examples/')) categories.add('examples');
    else if (file.includes('resume/')) categories.add('resume');
    else categories.add('content');
  }

  const categoryList = Array.from(categories).sort().join(', ');

  if (files.length === 1) {
    const filename = files[0].split('/').pop() || files[0];
    return `chore(career-data): update ${filename}`;
  }

  return `chore(career-data): update ${categoryList}`;
}

/**
 * Validate a filename contains only safe characters.
 * Returns true if valid, false if contains unsafe characters.
 */
export function isValidFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(filename);
}

/**
 * Validate a filename for resume files (allows spaces).
 */
export function isValidResumeFilename(filename: string): boolean {
  return /^[a-zA-Z0-9._\- ]+$/.test(filename);
}

/**
 * Detect duplicate filenames across directories.
 * Returns a map of filename -> array of source directories.
 */
export function detectDuplicates(
  files: Array<{ filename: string; sourceDir: string }>
): Map<string, string[]> {
  const filenameMap = new Map<string, string[]>();

  for (const file of files) {
    const existing = filenameMap.get(file.filename);
    if (existing) {
      existing.push(file.sourceDir);
    } else {
      filenameMap.set(file.filename, [file.sourceDir]);
    }
  }

  // Filter to only duplicates
  const duplicates = new Map<string, string[]>();
  for (const [filename, dirs] of filenameMap) {
    if (dirs.length > 1) {
      duplicates.set(filename, dirs);
    }
  }

  return duplicates;
}
