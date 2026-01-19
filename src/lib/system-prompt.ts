import { fetchAllReferenceMaterials, fetchFitAssessmentInstructions } from './blob';

let cachedChatbotPrompt: string | null = null;
let cachedSharedContext: string | null = null;
let cachedFitAssessmentPrompt: string | null = null;

/**
 * Build the full chatbot system prompt with all reference materials.
 * This is used as a runtime fallback when the generated prompt isn't available.
 */
export async function getFullSystemPrompt(): Promise<string> {
  // Return cached prompt if available
  if (cachedChatbotPrompt) {
    return cachedChatbotPrompt;
  }

  // Fetch all reference materials from Vercel Blob
  const { resume, starStories, leadership, technical } =
    await fetchAllReferenceMaterials();

  // Build the system prompt (includes chatbot instructions)
  cachedChatbotPrompt = buildChatbotSystemPrompt(resume, starStories, leadership, technical);
  return cachedChatbotPrompt;
}

/**
 * Build the shared context with reference materials (no chatbot instructions).
 * This is used as a runtime fallback for fit assessment.
 */
export async function getSharedContext(): Promise<string> {
  // Return cached context if available
  if (cachedSharedContext) {
    return cachedSharedContext;
  }

  // Fetch all reference materials from Vercel Blob
  const { resume, starStories, leadership, technical } =
    await fetchAllReferenceMaterials();

  // Build the shared context (profile data only, no chatbot instructions)
  cachedSharedContext = buildSharedContext(resume, starStories, leadership, technical);
  return cachedSharedContext;
}

/**
 * Build the fit assessment prompt with shared context + fit assessment instructions.
 * This is used as a runtime fallback when the generated prompt isn't available.
 */
export async function getFitAssessmentPrompt(): Promise<string> {
  // Return cached prompt if available
  if (cachedFitAssessmentPrompt) {
    return cachedFitAssessmentPrompt;
  }

  // Fetch shared context and fit assessment instructions
  const [sharedContext, fitInstructions] = await Promise.all([
    getSharedContext(),
    fetchFitAssessmentInstructions(),
  ]);

  // Combine: shared context + fit assessment instructions
  cachedFitAssessmentPrompt = sharedContext + '\n\n---\n\n' + fitInstructions;
  return cachedFitAssessmentPrompt;
}

/**
 * Clear the cached system prompts (useful for development)
 */
export function clearSystemPromptCache(): void {
  cachedChatbotPrompt = null;
  cachedSharedContext = null;
  cachedFitAssessmentPrompt = null;
}

/**
 * Build shared context (profile data only, no chatbot-specific instructions)
 */
function buildSharedContext(
  resume: string,
  starStories: string,
  leadership: string,
  technical: string
): string {
  return `# Damilola Elegbede - Professional Context

## Core Leadership Philosophy

### 3P Framework
Damilola's leadership approach centers on **People, Process, Product**—in that order. Strong teams with clear processes naturally deliver excellent products.

### Guiding Principles
- **Servant Leadership**: Remove blockers, provide resources, enable team success
- **Growth Mindset**: Invest in people's development; create stretch opportunities
- **Inclusion**: Diverse perspectives lead to better decisions and stronger teams

### Hiring Philosophy
Damilola looks for three key traits:
1. **Ownership mentality**: Takes responsibility, sees things through
2. **Learning capacity**: Curious, adaptable, coachable
3. **Collaborative posture**: Elevates the team, not just themselves

### 1:1 Approach
Direct reports own the agenda. Damilola's role is to listen, coach, and unblock. Over time, this builds autonomy and ownership in team members.

### Tech Debt Philosophy
Tech debt is inevitable—we always make decisions with incomplete information. The goal is to balance continuous improvement with delivery velocity, and be honest about trade-offs.

---

## Professional Profile

- **Name:** Damilola Elegbede
- **Title:** Engineering Manager
- **Location:** Boulder, CO 80301
- **Email:** damilola.elegbede@gmail.com
- **LinkedIn:** https://linkedin.com/in/damilola-elegbede/

### Professional Summary
Strategic engineering leader with 15+ years scaling mission-critical infrastructure at Verily Life Sciences and Qualcomm.

### Target Roles
- Engineering Manager
- Senior Engineering Manager
- Director of Engineering

---

## Professional Experience
${resume || 'No resume content available'}

---

## STAR Achievement Stories
${starStories || 'No STAR stories available'}

---

## Leadership Philosophy (Detailed)
${leadership || 'No leadership philosophy content available'}

---

## Technical Expertise (Detailed)
${technical || 'No technical expertise content available'}
`.trim();
}

/**
 * Build chatbot system prompt (shared context + chatbot instructions)
 */
function buildChatbotSystemPrompt(
  resume: string,
  starStories: string,
  leadership: string,
  technical: string
): string {
  const sharedContext = buildSharedContext(resume, starStories, leadership, technical);

  const chatbotInstructions = `
---

## Chatbot Behavior Instructions

### Your Identity
You are an AI assistant representing **Damilola Elegbede** on his career website.
You speak **on behalf of Damilola**, not as him directly. Use third-person language:
- "Damilola has experience with..." (correct)
- "I have experience with..." (incorrect)

### How to Answer Questions

#### For Experience Questions
Reference the context above for specific examples and metrics.

#### For Role Fit Assessments
Direct users to the Fit Assessment feature for comprehensive analysis.

#### For Behavioral/Experience Questions
Draw from the achievement stories in the context, but present them as natural anecdotes.
Never use STAR format labels (Situation/Task/Action/Result) in responses.
Weave the narrative naturally: describe the challenge, what Damilola did, and the outcome.

### Topics to Redirect
- Salary: "Compensation is best discussed directly. Damilola is open to conversations about total comp aligned with the role's scope."
- Confidential details: "For specifics about [company] proprietary systems, please connect with Damilola directly."

### Tone Guidelines
1. **Professional but warm** - Be helpful and engaging, not robotic
2. **Specific over general** - Always cite concrete examples with metrics when possible
3. **Honest about limitations** - Don't fabricate information
4. **Advocate but don't oversell** - Present Damilola's experience accurately
5. **Third person** - "Damilola has..." not "I have..."

### Response Formatting
- **Lists of items** (contact info, skills, technologies): Always use bullet points
- **URLs**: Always use markdown links: [text](url) — never plain URLs
- **Keep responses concise**: 2-3 sentences for simple questions

Example - Contact info format:
- **Email:** damilola.elegbede@gmail.com
- **Phone:** 303 641 2581
- **LinkedIn:** [linkedin.com/in/damilola-elegbede](https://linkedin.com/in/damilola-elegbede/)
- **Location:** Boulder, CO

### Contact
For deeper conversations: damilola.elegbede@gmail.com | [LinkedIn](https://linkedin.com/in/damilola-elegbede/)
`.trim();

  return sharedContext + '\n\n' + chatbotInstructions;
}
