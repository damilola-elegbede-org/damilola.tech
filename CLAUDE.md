# damilola.tech - Personal Career Landing Page

## Project Overview
Personal job search landing page with AI chatbot for Damilola Elegbede.
Recruiters can ask the AI about experience, skills, and role fit.

## Tech Stack
- Next.js 16 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Vitest + React Testing Library + Playwright
- Vercel AI SDK + Anthropic Claude
- Vercel Blob (private content storage)

## Development Approach
**TDD Required**: Write tests before implementation.
1. Write failing test
2. Implement to pass
3. Refactor

## Key Commands
- `npm run dev` - Start development server
- `npm run test` - Run unit tests (Vitest)
- `npm run test:e2e` - Run E2E tests (Playwright)
- `npm run test:adversarial` - Run adversarial chatbot tests against production (~$0.50-1.50)
- `npm run test:adversarial -- -l` - Run adversarial tests against local dev server
- `npm run build` - Production build
- `npm run lint` - Lint code
- `npm run typecheck` - TypeScript type checking

## Project Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components (ui/, sections/, chat/)
- `src/lib/` - Utilities (blob fetching, system prompt)
- `content/` - Local dev content (mirrored to Vercel Blob)
- `tests/` - Unit test files
- `e2e/` - Playwright E2E tests

## Environment Variables
Required in `.env.local` (never commit):
- `ANTHROPIC_API_KEY` - Claude API access
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob access

## Security
- API keys in Vercel env vars only
- STAR stories and detailed context in Vercel Blob (not in git)
- Public repo contains code only, no sensitive career data

## Design System
- Colors: Deep blue (#0A2540), accent blue (#0066FF), white/grey
- Fonts: Geist Sans (headings/body), Geist Mono (code/technical)
- Style: McKinsey-inspired, clean, high-contrast, professional

## AI Chatbot
- Full context window approach (no RAG)
- Prompt caching enabled for cost/latency optimization
- System prompt includes resume, STAR stories, leadership philosophy

## Content Management

Content files (system prompts, STAR stories, feedback) live in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob).

### Claude Commands
- `/content-pull` - Download all content from Blob to `.tmp/content/`
- `/content-push` - Upload local content changes to Blob
- `/adversarial-test` - Run adversarial chatbot testing with graded report

### Local Development
Content is cached at build time in `src/lib/generated/`. For local dev without
blob token, files are read from `.tmp/content/` fallback.

### Editing Content
1. Run `/content-pull` to get latest
2. Edit files in `.tmp/content/`
3. Run `/content-push` to upload changes
4. Rebuild to regenerate cached prompts

## Adversarial Chatbot Testing

Automated testing to validate chatbot adheres to core principles when faced with challenging questions.
Uses **strict mode** with 36 scenarios and higher pass thresholds.

### When to Run
- After modifying chatbot instructions or system prompt
- Before deploying changes to production
- Periodically to catch regression

### Core Principles Tested
- **Brevity** - 2-4 sentences default, 1-2 for simple factual
- **Voice** - Third-person ("Damilola has..."), never first-person
- **Content Adherence** - Only states facts from actual content (CRITICAL)
- **Formatting** - Clear, readable, proper markdown
- **Boundaries** - Redirects sensitive/off-topic questions
- **Focus** - Answers only what's asked, no tangents

### Running Tests
```bash
# Test production (default) - auto-pulls latest content
npm run test:adversarial

# Test local dev server
npm run test:adversarial -- -l

# Via Claude command
/adversarial-test
```

### Strict Mode Thresholds
- **PASS**: All scores >= 4
- **VIOLATION**: Any score < 4
- **CRITICAL**: contentAdherence < 4 OR voice < 4

### Grading Scale
- **A**: 100% pass rate (perfect)
- **B**: 95%+ pass rate
- **C**: 90%+ pass rate
- **D**: 80%+ pass rate
- **F**: < 80% or any critical violations

### Output
- `.tmp/reports/adversarial-report.json` - Full graded report
- `.tmp/reports/adversarial-report.md` - Human-readable summary

### Cost
~$0.50-1.50 per run (uses Claude Sonnet for evaluation)

## Section Background Pattern
Sections alternate backgrounds for visual rhythm:
- Odd sections (1, 3, 5): Default `var(--color-bg)` (#0D1117)
- Even sections (2, 4, 6): Alternate `bg-[var(--color-bg-alt)]` (#161B22)

Current order (1-indexed):
1. Hero - default
2. Experience - alternate (bg-[var(--color-bg-alt)])
3. SkillsAssessment - default
4. Education - alternate (bg-[var(--color-bg-alt)])
5. Projects - default
6. FitAssessment - alternate (bg-[var(--color-bg-alt)])

Note: The footer (Contact component) is not a section and uses default bg.

When adding new sections, maintain this alternation.

### Card Contrast Rules
Cards within sections must have **minimum 10 RGB units** difference from section background.

| Section Background | Card Background | Contrast |
|--------------------|-----------------|----------|
| `--color-bg` (#0D1117) | `--color-card` (#1C2128) | ✓ Card is lighter |
| `--color-bg-alt` (#161B22) | `--color-bg` (#0D1117) | ✓ Card is darker |

**Never use:**
- `--color-card` on `--color-bg-alt` sections (only 6 RGB units - insufficient)
- Same color for section and card

Nested panels (like AI Context) use the section's color to create alternating contrast:
Section → Card → Nested panel alternates colors.
