/**
 * Build-time script to generate the system prompt from template + content.
 *
 * This script:
 * 1. Fetches the chatbot-system-prompt.md template (REQUIRED - fails if missing)
 * 2. Fetches all content files (optional - graceful degradation)
 * 3. Replaces placeholders in template with content
 * 4. Writes the final prompt to src/lib/generated/system-prompt.ts
 *
 * Run: npm run generate-prompt
 * Or automatically via: npm run build (prebuild hook)
 */

import { fetchPromptTemplate, fetchAllContent } from '../src/lib/blob';
import * as fs from 'fs/promises';
import * as path from 'path';

const GENERATED_DIR = path.join(process.cwd(), 'src/lib/generated');
const OUTPUT_FILE = path.join(GENERATED_DIR, 'system-prompt.ts');

async function generatePrompt(): Promise<void> {
  console.log('=== System Prompt Generation ===\n');

  // Step 1: Fetch the template (REQUIRED in production, optional in development)
  console.log('1. Fetching system prompt template...');
  let template: string;
  try {
    template = await fetchPromptTemplate();
    console.log('   ✓ Template fetched successfully\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if this is a missing token error (development mode)
    if (errorMessage.includes('BLOB_READ_WRITE_TOKEN not configured')) {
      console.warn('   ⚠ Blob token not configured - using development placeholder');
      console.warn('   → In production, ensure BLOB_READ_WRITE_TOKEN is set\n');

      // Ensure directory exists and placeholder file is in place
      await fs.mkdir(GENERATED_DIR, { recursive: true });

      // Check if placeholder already exists
      try {
        await fs.access(OUTPUT_FILE);
        console.log('   ✓ Development placeholder already exists\n');
      } catch {
        // Create placeholder file
        const placeholder = `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Generated at: ${new Date().toISOString()}
// Status: Development placeholder (no Blob token configured)
//
// To regenerate: npm run generate-prompt
// This file is automatically regenerated during build.

export const SYSTEM_PROMPT: string = '__DEVELOPMENT_PLACEHOLDER__';

// Prompt statistics
export const PROMPT_STATS = {
  generatedAt: '${new Date().toISOString()}',
  templateSize: 0,
  finalSize: 0,
  contentIncluded: {
    starStories: false,
    resume: false,
    leadershipPhilosophy: false,
    technicalExpertise: false,
    verilyFeedback: false,
    anecdotes: false,
    chatbotArchitecture: false,
  },
};
`;
        await fs.writeFile(OUTPUT_FILE, placeholder, 'utf-8');
        console.log(`   ✓ Development placeholder created at ${OUTPUT_FILE}\n`);
      }

      console.log('=== Development Mode ===');
      console.log('Chat will use runtime blob fetch as fallback.');
      console.log('Set BLOB_READ_WRITE_TOKEN in .env.local for full functionality.\n');
      return; // Exit successfully for development
    }

    // For other errors, re-throw
    console.error('   ✗ Failed to fetch template');
    throw error;
  }

  // Step 2: Fetch content files (optional)
  console.log('2. Fetching content files...');
  const content = await fetchAllContent();

  const contentStatus = {
    starStories: content.starStories ? '✓' : '○',
    resume: content.resume ? '✓' : '○',
    leadershipPhilosophy: content.leadershipPhilosophy ? '✓' : '○',
    technicalExpertise: content.technicalExpertise ? '✓' : '○',
    verilyFeedback: content.verilyFeedback ? '✓' : '○',
    anecdotes: content.anecdotes ? '✓' : '○',
    chatbotArchitecture: content.chatbotArchitecture ? '✓' : '○',
  };

  console.log(`   ${contentStatus.starStories} star-stories.json`);
  console.log(`   ${contentStatus.resume} resume-full.json`);
  console.log(`   ${contentStatus.leadershipPhilosophy} leadership-philosophy.md`);
  console.log(`   ${contentStatus.technicalExpertise} technical-expertise.md`);
  console.log(`   ${contentStatus.verilyFeedback} verily-feedback.md`);
  console.log(`   ${contentStatus.anecdotes} anecdotes.md`);
  console.log(`   ${contentStatus.chatbotArchitecture} chatbot-architecture.md`);
  console.log('');

  // Step 3: Replace placeholders (use global regex for all occurrences)
  console.log('3. Replacing placeholders...');
  const replacements: Record<string, string> = {
    '{{STAR_STORIES}}': content.starStories || '*STAR stories not available in current build.*',
    '{{RESUME}}': content.resume || '*Resume content not available in current build.*',
    '{{LEADERSHIP_PHILOSOPHY}}': content.leadershipPhilosophy || '*Leadership philosophy details not available in current build.*',
    '{{TECHNICAL_EXPERTISE}}': content.technicalExpertise || '*Technical expertise details not available in current build.*',
    '{{VERILY_FEEDBACK}}': content.verilyFeedback || '*Performance feedback not available in current build.*',
    '{{ANECDOTES}}': content.anecdotes || '*Additional context and anecdotes not available in current build.*',
    '{{CHATBOT_ARCHITECTURE}}': content.chatbotArchitecture || '*Chatbot architecture details not available.*',
  };

  let prompt = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Use global regex with replacer function to avoid $-pattern substitution issues
    // (e.g., "$100" in content would be corrupted if using string replacement)
    prompt = prompt.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => value
    );
  }
  console.log('   ✓ Placeholders replaced\n');

  // Step 4: Generate output file
  console.log('4. Generating output file...');
  const output = `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Generated at: ${new Date().toISOString()}
// Template source: chatbot-system-prompt.md (Vercel Blob)
//
// To regenerate: npm run generate-prompt
// This file is automatically regenerated during build.

export const SYSTEM_PROMPT: string = ${JSON.stringify(prompt)};

// Prompt statistics
export const PROMPT_STATS = {
  generatedAt: '${new Date().toISOString()}',
  templateSize: ${template.length},
  finalSize: ${prompt.length},
  contentIncluded: {
    starStories: ${!!content.starStories},
    resume: ${!!content.resume},
    leadershipPhilosophy: ${!!content.leadershipPhilosophy},
    technicalExpertise: ${!!content.technicalExpertise},
    verilyFeedback: ${!!content.verilyFeedback},
    anecdotes: ${!!content.anecdotes},
    chatbotArchitecture: ${!!content.chatbotArchitecture},
  },
};
`;

  // Create directory if it doesn't exist
  await fs.mkdir(GENERATED_DIR, { recursive: true });

  // Write the file
  await fs.writeFile(OUTPUT_FILE, output, 'utf-8');
  console.log(`   ✓ Written to ${OUTPUT_FILE}\n`);

  // Summary
  console.log('=== Generation Complete ===');
  console.log(`Template size: ${template.length.toLocaleString()} characters`);
  console.log(`Final prompt size: ${prompt.length.toLocaleString()} characters`);
  console.log('');
}

// Run the script
generatePrompt()
  .then(() => {
    console.log('System prompt generated successfully!');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n=== Build Failed ===');
    console.error(error.message);
    console.error('\nThe system prompt template is required for the build to succeed.');
    console.error('Ensure chatbot-system-prompt.md is uploaded to Vercel Blob.');
    process.exit(1);
  });
