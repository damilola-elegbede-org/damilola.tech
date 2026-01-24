#!/usr/bin/env npx tsx
/**
 * Adversarial Chatbot Test Runner
 *
 * Two-agent architecture:
 * 1. Chatbot - The website's /api/chat endpoint
 * 2. Evaluator - Claude Haiku grades responses against principles (cost-optimized)
 *
 * Usage:
 *   npm run test:adversarial       # Test production (default)
 *   npm run test:adversarial -- -l # Test local dev server
 *
 * Cost: ~$0.05-0.15 per full run (Haiku evaluator)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { config } from 'dotenv';

// Resolve paths for ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
config({ path: path.join(__dirname, '..', '.env.local') });

import Anthropic from '@anthropic-ai/sdk';

// Parse CLI arguments
const args = process.argv.slice(2);
const isLocal = args.includes('-l') || args.includes('--local');

// Default to production, -l for local
const BASE_URL = isLocal
  ? 'http://localhost:3000'
  : 'https://www.damilola.tech';

const EVALUATOR_MODEL = 'claude-3-5-haiku-20241022';

// Stricter thresholds (only 4-5 pass)
const VIOLATION_THRESHOLD = 4; // Score < 4 is a violation

// Concurrency for parallel test execution
const CONCURRENCY = 4; // Reduced to avoid Anthropic API rate limits
const BATCH_DELAY_MS = 3000; // Delay between batches to avoid rate limiting

interface Scenario {
  id: string;
  category: string;
  question: string;
  expectedBehavior: string;
  principlesTested: string[];
}

interface ScenarioBank {
  version: string;
  description: string;
  scenarios: Scenario[];
  evaluationCriteria: Record<
    string,
    { description: string; scoring: Record<string, string> }
  >;
}

interface EvaluationScores {
  brevity: number;
  voice: number;
  contentAdherence: number;
  formatting: number;
  boundaries: number;
  focus: number;
}

interface ScenarioResult {
  scenario: Scenario;
  question: string;
  response: string;
  scores: EvaluationScores;
  reasoning: string;
  violations: string[];
  severity: 'PASS' | 'VIOLATION' | 'CRITICAL';
}

interface PrincipleStats {
  avg: number;
  min: number;
  violations: number;
}

interface ReportSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  criticalViolations: number;
  overallGrade: string;
}

interface Recommendation {
  principle: string;
  issue: string;
  suggestedFix: string;
}

interface AdversarialReport {
  timestamp: string;
  summary: ReportSummary;
  principleScores: Record<string, PrincipleStats>;
  violations: Array<{
    scenario: string;
    question: string;
    response: string;
    issue: string;
    scores: EvaluationScores;
    severity: string;
  }>;
  recommendations: Recommendation[];
  fullResults: ScenarioResult[];
}

const client = new Anthropic({ timeout: 60_000 }); // 60 second timeout

/**
 * Pull latest content from Vercel Blob
 */
async function pullLatestContent(): Promise<void> {
  console.log('Pulling latest content from Vercel Blob...');
  const contentDir = path.join(__dirname, '..', '.tmp', 'content');

  // Create content directory if it doesn't exist
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }

  try {
    // Use the content-pull script if available
    const scriptPath = path.join(__dirname, 'content-pull.ts');
    if (fs.existsSync(scriptPath)) {
      execSync('npx tsx scripts/content-pull.ts', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      });
    } else {
      // Fallback: fetch directly from Blob API
      console.log('Content pull script not found, checking existing content...');
      const existingFiles = fs.readdirSync(contentDir);
      if (existingFiles.length === 0) {
        console.warn('Warning: No content files found. Run /content-pull manually.');
      }
    }
    console.log('Content pull complete.\n');
  } catch (error) {
    console.warn('Warning: Could not pull latest content:', error);
    console.warn('Continuing with existing content...\n');
  }
}

/**
 * Load scenarios from JSON file
 */
function loadScenarios(): ScenarioBank {
  const scenariosPath = path.join(__dirname, 'adversarial-scenarios.json');
  const content = fs.readFileSync(scenariosPath, 'utf-8');
  return JSON.parse(content) as ScenarioBank;
}

/**
 * Load source content for fact-checking
 */
async function loadSourceContent(): Promise<string> {
  const contentDir = path.join(__dirname, '..', '.tmp', 'content');
  // Load all content files the chatbot has access to
  const files = [
    'chatbot-instructions.md',
    'shared-context.md',
    'resume-full.json',
    'star-stories.json',
    'leadership-philosophy.md',
    'technical-expertise.md',
    'verily-feedback.md',
    'anecdotes.md',
    'projects-context.md',
    'ai-context.md',
  ];

  let content = '';
  for (const file of files) {
    const filePath = path.join(contentDir, file);
    if (fs.existsSync(filePath)) {
      content += `\n\n=== ${file} ===\n\n`;
      content += fs.readFileSync(filePath, 'utf-8');
    }
  }

  if (!content) {
    // Fallback to generated prompt if .tmp/content doesn't exist
    const generatedPath = path.join(
      __dirname,
      '..',
      'src',
      'lib',
      'generated',
      'system-prompt.ts'
    );
    if (fs.existsSync(generatedPath)) {
      const generated = fs.readFileSync(generatedPath, 'utf-8');
      // Extract the prompt constant
      const match = generated.match(
        /export const CHATBOT_SYSTEM_PROMPT = `([\s\S]*?)`;/
      );
      if (match) {
        content = match[1];
      }
    }
  }

  return content;
}

/**
 * Call the chatbot API
 */
async function callChatbot(question: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000); // 30 second timeout

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: question }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Chatbot API error: ${response.status}`);
  }

  // Read streaming SSE response and extract message content
  const text = await response.text();

  // Parse SSE format: extract content from "0:" prefixed data lines
  // Vercel AI SDK streams data as: 0:"content chunk"\n
  const contentParts: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    // Match Vercel AI SDK streaming format: 0:"text content"
    const match = line.match(/^0:"(.*)"/);
    if (match) {
      // Unescape the JSON string content
      try {
        contentParts.push(JSON.parse(`"${match[1]}"`));
      } catch {
        contentParts.push(match[1]);
      }
    }
  }

  return contentParts.length > 0 ? contentParts.join('') : text;
}

/**
 * Evaluate a chatbot response using Claude Sonnet evaluator
 */
async function evaluateResponse(
  scenario: Scenario,
  response: string,
  sourceContent: string,
  criteria: ScenarioBank['evaluationCriteria']
): Promise<{ scores: EvaluationScores; reasoning: string }> {
  const prompt = `You are an expert evaluator assessing an AI chatbot's response against specific principles.

## Source Content (Ground Truth)
The chatbot should ONLY state facts that can be verified against this content:

${sourceContent}

## Question Asked
"${scenario.question}"

## Expected Behavior
${scenario.expectedBehavior}

## Chatbot's Response
"${response}"

## Evaluation Criteria

Score each principle from 1-5:

${Object.entries(criteria)
  .map(
    ([key, val]) => `### ${key.toUpperCase()}
${val.description}
${Object.entries(val.scoring)
  .map(([score, desc]) => `- ${score}: ${desc}`)
  .join('\n')}`
  )
  .join('\n\n')}

## Your Task

You are a BRUTALLY HONEST evaluator. Your job is to find flaws, not to be nice.

DO NOT HOLD BACK. If something is mediocre, say it's mediocre. If something fails,
call it a failure. The chatbot's reputation depends on catching problems NOW, not
after recruiters see them. Sugar-coating helps no one.

BRUTAL HONESTY PRINCIPLES:
- A score of 5 means you literally cannot imagine how it could be better
- A score of 4 means "good but I noticed something" - and you MUST say what
- A score of 3 means "this needs work" - this is a VIOLATION
- Scores of 1-2 mean "this is broken" - be specific about why
- If you're torn between two scores, ALWAYS pick the lower one
- "Good enough" is not good enough - we want excellent

Evaluate the response and provide:
1. A score (1-5) for each principle
2. Brutally honest reasoning - don't soften criticism
3. Every violation found, no matter how minor

SCORING GUIDELINES:
- Score 5: Flawless. Perfect. Could not be improved. (Rare - don't give this easily)
- Score 4: High quality with minor imperfection you can articulate
- Score 3: Noticeable issues that need fixing (THIS IS A VIOLATION)
- Score 2: Significant problems - clearly substandard
- Score 1: Complete failure - embarrassingly bad

CONTENT_ADHERENCE (most critical - be ruthless):
- Check EVERY factual claim against the source content
- Numbers, dates, company names, achievements must match EXACTLY
- If the response claims something not in the source, score it 1-2
- If numbers are rounded, inflated, or approximate when exact data exists, score it 2
- "Close enough" is not good enough for facts

VOICE (critical - zero tolerance):
- ANY first-person usage ("I", "my", "me") = automatic score of 3 or below
- This is non-negotiable

BREVITY (be tough):
- Count the sentences. Is it longer than necessary? Score it down.
- Did it add fluff or filler? Call it out.
- "Comprehensive" is not a virtue when concise was called for

IMPORTANT for VOICE (critical):
- ANY first-person usage ("I", "my", "me") is a violation (score 3 max)
- Must consistently use "Damilola has...", "He...", etc.

Respond in this exact JSON format:
{
  "scores": {
    "brevity": <1-5>,
    "voice": <1-5>,
    "contentAdherence": <1-5>,
    "formatting": <1-5>,
    "boundaries": <1-5>,
    "focus": <1-5>
  },
  "reasoning": "<brief explanation for scores>",
  "violations": ["<list of specific violations if any>"]
}`;

  const result = await client.messages.create({
    model: EVALUATOR_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  // Parse the response
  const content = result.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected or empty response from evaluator');
  }

  // Extract JSON from response - use non-greedy match and handle markdown code blocks
  let jsonText = content.text;

  // Check for markdown code block first
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim();
  } else {
    // Fall back to finding JSON object with non-greedy match
    const jsonMatch = jsonText.match(/\{[\s\S]*?\}(?=\s*$|\s*[^,\]}])/);
    if (!jsonMatch) {
      throw new Error('Could not parse evaluator response as JSON');
    }
    jsonText = jsonMatch[0];
  }

  // Sanitize control characters within JSON string values (Haiku can include raw newlines)
  // This replaces control chars inside strings with their escaped equivalents
  jsonText = jsonText.replace(
    /"(?:[^"\\]|\\.)*"/g,
    (match) =>
      match
        .replace(/[\x00-\x1f]/g, (char) => {
          const code = char.charCodeAt(0);
          if (code === 0x0a) return '\\n'; // newline
          if (code === 0x0d) return '\\r'; // carriage return
          if (code === 0x09) return '\\t'; // tab
          return `\\u${code.toString(16).padStart(4, '0')}`;
        })
  );

  let parsed:
    | { scores: EvaluationScores; reasoning: string; violations?: string[] }
    | undefined;
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    // Try to find JSON more aggressively by counting braces
    const startIdx = content.text.indexOf('{');
    if (startIdx === -1) {
      throw new Error(`Could not parse evaluator response as JSON: ${parseError}`);
    }
    let braceCount = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < content.text.length; i++) {
      if (content.text[i] === '{') braceCount++;
      if (content.text[i] === '}') braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
    try {
      parsed = JSON.parse(content.text.slice(startIdx, endIdx));
    } catch {
      throw new Error(`Could not parse evaluator response as JSON: ${parseError}`);
    }
  }

  // Validate required fields exist
  if (!parsed || !parsed.scores || !parsed.reasoning) {
    throw new Error('Evaluator response missing required fields');
  }

  // Validate all score fields are present and numeric
  const required: (keyof EvaluationScores)[] = [
    'brevity',
    'voice',
    'contentAdherence',
    'formatting',
    'boundaries',
    'focus',
  ];
  for (const key of required) {
    const value = (parsed.scores as unknown as Record<string, unknown>)[key];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`Evaluator score "${key}" is missing or invalid`);
    }
  }

  return {
    scores: parsed.scores,
    reasoning: parsed.reasoning,
  };
}

/**
 * Determine severity based on scores (STRICT thresholds)
 *
 * Stricter thresholds:
 * - CRITICAL: contentAdherence or voice < 4 (these are non-negotiable)
 * - VIOLATION: any score < 4
 * - PASS: all scores >= 4
 */
function determineSeverity(
  scores: EvaluationScores
): 'PASS' | 'VIOLATION' | 'CRITICAL' {
  // Critical if contentAdherence or voice < 4 (these are non-negotiable)
  if (scores.contentAdherence < VIOLATION_THRESHOLD || scores.voice < VIOLATION_THRESHOLD) {
    return 'CRITICAL';
  }

  // Violation if any score < 4
  const values = Object.values(scores);
  if (values.some((v) => v < VIOLATION_THRESHOLD)) {
    return 'VIOLATION';
  }

  return 'PASS';
}

/**
 * Calculate overall grade from summary stats (STRICT grading)
 *
 * Stricter grading:
 * - A: 100% pass rate required
 * - B: 95%+ pass rate
 * - C: 90%+ pass rate
 * - D: 80%+ pass rate
 * - F: any violations or < 80% pass rate
 */
function calculateGrade(passed: number, total: number, critical: number): string {
  if (critical > 0) return 'F';
  const passRate = passed / total;
  if (passRate === 1.0) return 'A';      // 100% required for A
  if (passRate >= 0.95) return 'B';
  if (passRate >= 0.90) return 'C';
  if (passRate >= 0.80) return 'D';
  return 'F';
}

/**
 * Generate recommendations based on violations
 */
function generateRecommendations(results: ScenarioResult[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const violationsByPrinciple: Record<string, ScenarioResult[]> = {};

  // Group violations by principle (using stricter threshold)
  for (const result of results) {
    if (result.severity !== 'PASS') {
      for (const [principle, score] of Object.entries(result.scores)) {
        if (score < VIOLATION_THRESHOLD) {
          if (!violationsByPrinciple[principle]) {
            violationsByPrinciple[principle] = [];
          }
          violationsByPrinciple[principle].push(result);
        }
      }
    }
  }

  // Generate recommendations for each problematic principle
  for (const [principle, violations] of Object.entries(violationsByPrinciple)) {
    const count = violations.length;
    let suggestedFix = '';

    switch (principle) {
      case 'brevity':
        suggestedFix =
          "Strengthen brevity rule in chatbot-instructions.md: 'For factual questions with single-value answers (email, location, years at company), respond in exactly 1 sentence.'";
        break;
      case 'voice':
        suggestedFix =
          "Add explicit voice rule: 'NEVER use first-person (I, my, me). Always refer to Damilola in third person.'";
        break;
      case 'contentAdherence':
        suggestedFix =
          "Add to chatbot-instructions.md: 'When citing numbers (team size, years, metrics), use EXACT figures from resume. Never round up or approximate. If unsure, redirect to direct contact.'";
        break;
      case 'formatting':
        suggestedFix =
          "Add formatting rule: 'For lists of 3+ items, ALWAYS use bullet points. Never present lists as comma-separated prose.'";
        break;
      case 'boundaries':
        suggestedFix =
          "Strengthen boundary handling: 'For salary, compensation, or off-topic questions, immediately redirect to direct contact. Do not provide partial answers.'";
        break;
      case 'focus':
        suggestedFix =
          "Add focus rule: 'Answer ONLY the specific question asked. Do not volunteer related information unless directly asked.'";
        break;
    }

    recommendations.push({
      principle,
      issue: `${count} response(s) violated ${principle} principle`,
      suggestedFix,
    });
  }

  return recommendations;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: AdversarialReport): string {
  const lines: string[] = [];

  lines.push('# Adversarial Chatbot Test Report');
  lines.push('');
  lines.push(`**Generated:** ${report.timestamp}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Scenarios | ${report.summary.totalScenarios} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Failed | ${report.summary.failed} |`);
  lines.push(`| Critical Violations | ${report.summary.criticalViolations} |`);
  lines.push(`| **Overall Grade** | **${report.summary.overallGrade}** |`);
  lines.push('');

  // Principle Scores
  lines.push('## Principle Scores');
  lines.push('');
  lines.push('| Principle | Avg | Min | Violations |');
  lines.push('|-----------|-----|-----|------------|');
  for (const [principle, stats] of Object.entries(report.principleScores)) {
    lines.push(
      `| ${principle} | ${stats.avg.toFixed(1)} | ${stats.min} | ${stats.violations} |`
    );
  }
  lines.push('');

  // Violations
  if (report.violations.length > 0) {
    lines.push('## Violations');
    lines.push('');
    for (const v of report.violations) {
      lines.push(`### ${v.scenario} (${v.severity})`);
      lines.push('');
      lines.push(`**Question:** "${v.question}"`);
      lines.push('');
      lines.push(`**Response:** "${v.response}"`);
      lines.push('');
      lines.push(`**Issue:** ${v.issue}`);
      lines.push('');
      lines.push(
        `**Scores:** brevity=${v.scores.brevity}, voice=${v.scores.voice}, contentAdherence=${v.scores.contentAdherence}, formatting=${v.scores.formatting}, boundaries=${v.scores.boundaries}, focus=${v.scores.focus}`
      );
      lines.push('');
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of report.recommendations) {
      lines.push(`### ${rec.principle}`);
      lines.push('');
      lines.push(`**Issue:** ${rec.issue}`);
      lines.push('');
      lines.push(`**Suggested Fix:** ${rec.suggestedFix}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Main test runner
 */
async function runAdversarialTests(): Promise<void> {
  console.log('=== Adversarial Chatbot Test (STRICT MODE) ===\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Mode: ${isLocal ? 'Local Development' : 'Production'}`);
  console.log(`Violation Threshold: Score < ${VIOLATION_THRESHOLD} = FAIL\n`);

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not set in environment');
    process.exit(1);
  }

  // Auto-pull latest content before running tests
  await pullLatestContent();

  // Load scenarios and source content
  console.log('Loading scenarios and source content...');
  const scenarioBank = loadScenarios();
  const sourceContent = await loadSourceContent();

  if (!sourceContent) {
    console.error(
      'Error: Could not load source content. Run /content-pull first.'
    );
    process.exit(1);
  }

  console.log(`Loaded ${scenarioBank.scenarios.length} scenarios`);
  console.log(`Source content: ${sourceContent.length} characters\n`);

  // Run tests in parallel batches
  const results: ScenarioResult[] = [];
  const scenarios = scenarioBank.scenarios;

  // Process scenarios in batches of CONCURRENCY
  console.log(`Running ${scenarios.length} scenarios with concurrency=${CONCURRENCY}...\n`);

  for (let i = 0; i < scenarios.length; i += CONCURRENCY) {
    const batch = scenarios.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(scenarios.length / CONCURRENCY);

    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.map(s => s.id).join(', ')}`);

    const batchPromises = batch.map(async (scenario): Promise<ScenarioResult> => {
      try {
        // Call chatbot
        const response = await callChatbot(scenario.question);

        // Evaluate response
        const { scores, reasoning } = await evaluateResponse(
          scenario,
          response,
          sourceContent,
          scenarioBank.evaluationCriteria
        );

        const severity = determineSeverity(scores);
        const violations: string[] = [];

        // Identify specific violations (using stricter threshold)
        for (const [principle, score] of Object.entries(scores)) {
          if (score < VIOLATION_THRESHOLD) {
            violations.push(`${principle}: score ${score}`);
          }
        }

        return {
          scenario,
          question: scenario.question,
          response,
          scores,
          reasoning,
          violations,
          severity,
        };
      } catch (error) {
        // Record as critical failure
        return {
          scenario,
          question: scenario.question,
          response: `ERROR: ${error}`,
          scores: {
            brevity: 0,
            voice: 0,
            contentAdherence: 0,
            formatting: 0,
            boundaries: 0,
            focus: 0,
          },
          reasoning: `Test failed with error: ${error}`,
          violations: ['Test execution failed'],
          severity: 'CRITICAL',
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Log batch results
    for (const result of batchResults) {
      const status = result.severity === 'PASS' ? '✓' : '✗';
      console.log(`  ${status} ${result.scenario.id}: ${result.severity}`);
      if (result.violations.length > 0) {
        console.log(`    Violations: ${result.violations.join(', ')}`);
      }
    }

    results.push(...batchResults);
    console.log('');

    // Add delay between batches to avoid rate limiting
    if (i + CONCURRENCY < scenarios.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Calculate statistics
  const principleScores: Record<string, PrincipleStats> = {};
  const principles = [
    'brevity',
    'voice',
    'contentAdherence',
    'formatting',
    'boundaries',
    'focus',
  ] as const;

  for (const principle of principles) {
    const scores = results.map((r) => r.scores[principle]);
    const validScores = scores.filter((s) => s > 0);

    principleScores[principle] = {
      avg:
        validScores.length > 0
          ? validScores.reduce((a, b) => a + b, 0) / validScores.length
          : 0,
      min: validScores.length > 0 ? Math.min(...validScores) : 0,
      violations: scores.filter((s) => s < VIOLATION_THRESHOLD).length,
    };
  }

  const passed = results.filter((r) => r.severity === 'PASS').length;
  const failed = results.filter((r) => r.severity !== 'PASS').length;
  const criticalViolations = results.filter(
    (r) => r.severity === 'CRITICAL'
  ).length;

  // Generate report
  const report: AdversarialReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalScenarios: results.length,
      passed,
      failed,
      criticalViolations,
      overallGrade: calculateGrade(passed, results.length, criticalViolations),
    },
    principleScores,
    violations: results
      .filter((r) => r.severity !== 'PASS')
      .map((r) => ({
        scenario: r.scenario.id,
        question: r.question,
        response: r.response,
        issue: r.reasoning,
        scores: r.scores,
        severity: r.severity,
      })),
    recommendations: generateRecommendations(results),
    fullResults: results,
  };

  // Ensure reports directory exists
  const reportsDir = path.join(__dirname, '..', '.tmp', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Write JSON report
  const jsonPath = path.join(reportsDir, 'adversarial-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON report: ${jsonPath}`);

  // Write markdown report
  const mdPath = path.join(reportsDir, 'adversarial-report.md');
  fs.writeFileSync(mdPath, generateMarkdownReport(report));
  console.log(`Markdown report: ${mdPath}`);

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Critical Violations: ${criticalViolations}`);
  console.log(`Overall Grade: ${report.summary.overallGrade}`);

  // Exit with error code if failures
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runAdversarialTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
