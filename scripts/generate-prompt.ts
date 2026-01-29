/**
 * Build-time script to generate system prompts from templates + content.
 *
 * This script:
 * 1. Fetches shared-context.md template (REQUIRED - fails if missing)
 * 2. Fetches chatbot-instructions.md template (REQUIRED - fails if missing)
 * 3. Fetches fit-assessment-instructions.md template (REQUIRED - fails if missing)
 * 4. Fetches all content files (optional - graceful degradation)
 * 5. Produces THREE outputs:
 *    - SHARED_CONTEXT: Profile data only (for custom use cases)
 *    - CHATBOT_SYSTEM_PROMPT: Shared context + chatbot instructions (for chat)
 *    - FIT_ASSESSMENT_PROMPT: Shared context + fit assessment instructions (for fit assessment)
 * 6. Writes the final prompts to src/lib/generated/system-prompt.ts
 *
 * Run: npm run generate-prompt
 * Or automatically via: npm run build (prebuild hook)
 */

import { fetchSharedContext, fetchChatbotInstructions, fetchFitAssessmentInstructionsRequired, fetchResumeGeneratorInstructionsRequired, fetchAllContent } from '../src/lib/blob';
import * as fs from 'fs/promises';
import * as path from 'path';

const GENERATED_DIR = path.join(process.cwd(), 'src/lib/generated');
const OUTPUT_FILE = path.join(GENERATED_DIR, 'system-prompt.ts');

async function generatePrompt(): Promise<void> {
  console.log('=== System Prompt Generation ===\n');

  // Step 1: Fetch all templates in parallel (REQUIRED in production)
  console.log('1. Fetching all templates in parallel...');
  let sharedContextTemplate: string;
  let chatbotInstructionsTemplate: string;
  let fitAssessmentInstructionsTemplate: string;
  let resumeGeneratorInstructionsTemplate: string;

  try {
    const results = await Promise.all([
      fetchSharedContext(),
      fetchChatbotInstructions(),
      fetchFitAssessmentInstructionsRequired(),
      fetchResumeGeneratorInstructionsRequired(),
    ]);

    sharedContextTemplate = results[0];
    chatbotInstructionsTemplate = results[1];
    fitAssessmentInstructionsTemplate = results[2];
    resumeGeneratorInstructionsTemplate = results[3];

    console.log('   ✓ shared-context.md fetched');
    console.log('   ✓ chatbot-instructions.md fetched');
    console.log('   ✓ fit-assessment-instructions.md fetched');
    console.log('   ✓ resume-generator-instructions.md fetched\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if this is a missing token error (development mode)
    if (errorMessage.includes('BLOB_READ_WRITE_TOKEN not configured')) {
      console.warn('   ⚠ Blob token not configured - using development placeholder');
      console.warn('   → In production, ensure BLOB_READ_WRITE_TOKEN is set\n');

      await createDevelopmentPlaceholder();
      return;
    }

    console.error('   ✗ Failed to fetch templates');
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
    projectsContext: content.projectsContext ? '✓' : '○',
    chatbotArchitecture: content.chatbotArchitecture ? '✓' : '○',
  };

  console.log(`   ${contentStatus.starStories} star-stories.json`);
  console.log(`   ${contentStatus.resume} resume-full.json`);
  console.log(`   ${contentStatus.leadershipPhilosophy} leadership-philosophy.md`);
  console.log(`   ${contentStatus.technicalExpertise} technical-expertise.md`);
  console.log(`   ${contentStatus.verilyFeedback} verily-feedback.md`);
  console.log(`   ${contentStatus.anecdotes} anecdotes.md`);
  console.log(`   ${contentStatus.projectsContext} projects-context.md`);
  console.log(`   ${contentStatus.chatbotArchitecture} chatbot-architecture.md`);
  console.log('');

  // Step 3: Define placeholder replacements
  // Shared replacements (used by all prompts)
  const sharedReplacements: Record<string, string> = {
    '{{STAR_STORIES}}': content.starStories || '*STAR stories not available in current build.*',
    '{{RESUME}}': content.resume || '*Resume content not available in current build.*',
    '{{LEADERSHIP_PHILOSOPHY}}': content.leadershipPhilosophy || '*Leadership philosophy details not available in current build.*',
    '{{TECHNICAL_EXPERTISE}}': content.technicalExpertise || '*Technical expertise details not available in current build.*',
    '{{VERILY_FEEDBACK}}': content.verilyFeedback || '*Performance feedback not available in current build.*',
    '{{ANECDOTES}}': content.anecdotes || '*Additional context and anecdotes not available in current build.*',
    '{{PROJECTS_CONTEXT}}': content.projectsContext || '*Projects context not available in current build.*',
  };

  // Chatbot-only replacement
  const chatbotOnlyReplacements: Record<string, string> = {
    '{{CHATBOT_ARCHITECTURE}}': content.chatbotArchitecture || '*Chatbot architecture details not available.*',
  };

  // Step 4: Generate SHARED_CONTEXT (profile data only, no chatbot instructions)
  console.log('3. Generating SHARED_CONTEXT...');
  let sharedContext = sharedContextTemplate;
  for (const [placeholder, value] of Object.entries(sharedReplacements)) {
    sharedContext = sharedContext.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => value
    );
  }
  console.log('   ✓ SHARED_CONTEXT generated\n');

  // Step 5: Generate CHATBOT_SYSTEM_PROMPT (shared context + chatbot instructions)
  console.log('4. Generating CHATBOT_SYSTEM_PROMPT...');
  const combinedTemplate = sharedContextTemplate + '\n\n---\n\n' + chatbotInstructionsTemplate;
  let chatbotPrompt = combinedTemplate;

  // Apply shared replacements
  for (const [placeholder, value] of Object.entries(sharedReplacements)) {
    chatbotPrompt = chatbotPrompt.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => value
    );
  }

  // Apply chatbot-only replacements
  for (const [placeholder, value] of Object.entries(chatbotOnlyReplacements)) {
    chatbotPrompt = chatbotPrompt.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => value
    );
  }
  console.log('   ✓ CHATBOT_SYSTEM_PROMPT generated\n');

  // Step 6: Generate FIT_ASSESSMENT_PROMPT (shared context + fit assessment instructions)
  console.log('5. Generating FIT_ASSESSMENT_PROMPT...');
  const fitAssessmentTemplate = sharedContextTemplate + '\n\n---\n\n' + fitAssessmentInstructionsTemplate;
  let fitAssessmentPrompt = fitAssessmentTemplate;

  // Apply shared replacements
  for (const [placeholder, value] of Object.entries(sharedReplacements)) {
    fitAssessmentPrompt = fitAssessmentPrompt.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => value
    );
  }
  console.log('   ✓ FIT_ASSESSMENT_PROMPT generated\n');

  // Step 7: Generate RESUME_GENERATOR_PROMPT (resume generator instructions only, no shared context prefix)
  // The resume generator uses different placeholders that map to content sources
  console.log('6. Generating RESUME_GENERATOR_PROMPT...');
  let resumeGeneratorPrompt = resumeGeneratorInstructionsTemplate;

  // Resume generator uses different placeholder names
  const resumeGeneratorReplacements: Record<string, string> = {
    '{{RESUME_FULL}}': content.resume || '*Resume content not available in current build.*',
    '{{STAR_STORIES}}': content.starStories || '*STAR stories not available in current build.*',
    '{{LEADERSHIP_PHILOSOPHY}}': content.leadershipPhilosophy || '*Leadership philosophy details not available in current build.*',
    '{{TECHNICAL_EXPERTISE}}': content.technicalExpertise || '*Technical expertise details not available in current build.*',
    '{{VERILY_FEEDBACK}}': content.verilyFeedback || '*Performance feedback not available in current build.*',
    '{{PROJECTS_CONTEXT}}': content.projectsContext || '*Projects context not available in current build.*',
    '{{ANECDOTES}}': content.anecdotes || '*Additional context and anecdotes not available in current build.*',
  };

  for (const [placeholder, value] of Object.entries(resumeGeneratorReplacements)) {
    resumeGeneratorPrompt = resumeGeneratorPrompt.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => value
    );
  }
  console.log('   ✓ RESUME_GENERATOR_PROMPT generated\n');

  // Step 8: Generate output file with all exports
  console.log('7. Generating output file...');
  const output = `// AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
// Generated at: ${new Date().toISOString()}
// Template sources: shared-context.md, chatbot-instructions.md, fit-assessment-instructions.md, resume-generator-instructions.md (Vercel Blob)
//
// To regenerate: npm run generate-prompt
// This file is automatically regenerated during build.

/**
 * Shared context containing Damilola's profile data only.
 * Use this for custom use cases that need profile data without instructions.
 */
export const SHARED_CONTEXT: string = ${JSON.stringify(sharedContext)};

/**
 * Full chatbot system prompt with shared context + chatbot instructions.
 * Use this for the chat feature.
 */
export const CHATBOT_SYSTEM_PROMPT: string = ${JSON.stringify(chatbotPrompt)};

/**
 * Fit assessment system prompt with shared context + fit assessment instructions.
 * Use this for the fit assessment feature.
 */
export const FIT_ASSESSMENT_PROMPT: string = ${JSON.stringify(fitAssessmentPrompt)};

/**
 * Resume generator system prompt with content sources for ATS optimization.
 * Use this for the resume generator feature.
 */
export const RESUME_GENERATOR_PROMPT: string = ${JSON.stringify(resumeGeneratorPrompt)};

/**
 * @deprecated Use CHATBOT_SYSTEM_PROMPT instead.
 * Kept for backwards compatibility during migration.
 */
export const SYSTEM_PROMPT: string = CHATBOT_SYSTEM_PROMPT;

// Prompt statistics
export const PROMPT_STATS = {
  generatedAt: '${new Date().toISOString()}',
  sharedContextSize: ${sharedContext.length},
  chatbotPromptSize: ${chatbotPrompt.length},
  fitAssessmentPromptSize: ${fitAssessmentPrompt.length},
  resumeGeneratorPromptSize: ${resumeGeneratorPrompt.length},
  contentIncluded: {
    starStories: ${!!content.starStories},
    resume: ${!!content.resume},
    leadershipPhilosophy: ${!!content.leadershipPhilosophy},
    technicalExpertise: ${!!content.technicalExpertise},
    verilyFeedback: ${!!content.verilyFeedback},
    anecdotes: ${!!content.anecdotes},
    projectsContext: ${!!content.projectsContext},
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
  console.log(`SHARED_CONTEXT size: ${sharedContext.length.toLocaleString()} characters`);
  console.log(`CHATBOT_SYSTEM_PROMPT size: ${chatbotPrompt.length.toLocaleString()} characters`);
  console.log(`FIT_ASSESSMENT_PROMPT size: ${fitAssessmentPrompt.length.toLocaleString()} characters`);
  console.log(`RESUME_GENERATOR_PROMPT size: ${resumeGeneratorPrompt.length.toLocaleString()} characters`);
  console.log('');
}

async function createDevelopmentPlaceholder(): Promise<void> {
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

export const SHARED_CONTEXT: string = '__DEVELOPMENT_PLACEHOLDER__';
export const CHATBOT_SYSTEM_PROMPT: string = '__DEVELOPMENT_PLACEHOLDER__';
export const FIT_ASSESSMENT_PROMPT: string = '__DEVELOPMENT_PLACEHOLDER__';
export const RESUME_GENERATOR_PROMPT: string = '__DEVELOPMENT_PLACEHOLDER__';
export const SYSTEM_PROMPT: string = '__DEVELOPMENT_PLACEHOLDER__';

// Prompt statistics
export const PROMPT_STATS = {
  generatedAt: '${new Date().toISOString()}',
  sharedContextSize: 0,
  chatbotPromptSize: 0,
  fitAssessmentPromptSize: 0,
  resumeGeneratorPromptSize: 0,
  contentIncluded: {
    starStories: false,
    resume: false,
    leadershipPhilosophy: false,
    technicalExpertise: false,
    verilyFeedback: false,
    anecdotes: false,
    projectsContext: false,
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
}

// Run the script
generatePrompt()
  .then(() => {
    console.log('System prompts generated successfully!');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n=== Build Failed ===');
    console.error(error.message);
    console.error('\nThe system prompt templates are required for the build to succeed.');
    console.error('Ensure shared-context.md, chatbot-instructions.md, and fit-assessment-instructions.md are uploaded to Vercel Blob.');
    process.exit(1);
  });
