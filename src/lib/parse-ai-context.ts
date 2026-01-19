import type { AiContext } from '@/types';

/**
 * Parse AI context markdown into a map of experience IDs to their context.
 *
 * Expected markdown format:
 * ```
 * # AI Context
 *
 * ## experience-id
 *
 * ### Strategic Context
 * Content here...
 *
 * ### Leadership Challenge
 * Content here...
 *
 * ### Key Insight
 * Content here...
 *
 * ## another-experience-id
 * ...
 * ```
 */
export function parseAiContext(markdown: string): Map<string, AiContext> {
  const result = new Map<string, AiContext>();

  if (!markdown) {
    return result;
  }

  // Split by h2 headers (## experience-id)
  const sections = markdown.split(/^## /m).slice(1); // Skip content before first h2

  for (const section of sections) {
    const lines = section.split('\n');
    const idLine = lines[0]?.trim();

    if (!idLine) continue;

    // The ID is the first line after splitting
    const id = idLine.toLowerCase().replace(/\s+/g, '-');

    // Extract content between h3 headers
    const strategicContext = extractSection(section, 'Strategic Context');
    const leadershipChallenge = extractSection(section, 'Leadership Challenge');
    const keyInsight = extractSection(section, 'Key Insight');

    if (strategicContext || leadershipChallenge || keyInsight) {
      result.set(id, {
        strategicContext: strategicContext || '',
        leadershipChallenge: leadershipChallenge || '',
        keyInsight: keyInsight || '',
      });
    }
  }

  return result;
}

/**
 * Extract content between a specific h3 header and the next h3/h2 header.
 */
function extractSection(sectionContent: string, headerName: string): string {
  // Match ### Header Name followed by content until next ### or ## or end
  const regex = new RegExp(
    `### ${headerName}\\s*\\n([\\s\\S]*?)(?=###|##|$)`,
    'i'
  );
  const match = sectionContent.match(regex);

  if (!match || !match[1]) {
    return '';
  }

  // Clean up the content: trim, remove leading/trailing newlines
  return match[1].trim();
}

/**
 * Merge AI context into experiences array.
 * Returns a new array with aiContext populated from the parsed markdown.
 */
export function mergeAiContextWithExperiences<T extends { id: string; aiContext?: AiContext }>(
  experiences: T[],
  aiContextMap: Map<string, AiContext>
): T[] {
  return experiences.map((exp) => {
    const context = aiContextMap.get(exp.id);
    if (context) {
      return { ...exp, aiContext: context };
    }
    return exp;
  });
}
