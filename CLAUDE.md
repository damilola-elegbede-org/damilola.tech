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
- Vercel Blob (public access with unlisted URLs)

## Development Approach
**TDD Required**: Write tests before implementation.
1. Write failing test
2. Implement to pass
3. Refactor

## Key Commands
- `npm run dev` - Start development server
- `npm run test` - Run unit tests (Vitest)
- `npm run test:e2e` - Run E2E tests (Playwright)
- `npm run build` - Production build
- `npm run lint` - Lint code
- `npm run typecheck` - TypeScript type checking

## Project Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components (ui/, sections/, chat/)
- `src/lib/` - Utilities (blob fetching, system prompt)
- `career-data/` - Git submodule (private repo) with content files
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

## Vercel Blob Constraints
**IMPORTANT**: Vercel Blob only supports `access: 'public'` - there is no `'private'` option.
```typescript
// CORRECT
await put(path, data, { access: 'public' });

// WRONG - will fail TypeScript and build
await put(path, data, { access: 'private' }); // ❌ Not a valid option
```
Security model: Blob URLs are long random strings. Keep URLs private rather than
relying on access control. Admin endpoints verify authentication before returning blob URLs.

## Design System
- Colors: Deep blue (#0A2540), accent blue (#0066FF), white/grey
- Fonts: Geist Sans (headings/body), Geist Mono (code/technical)
- Style: McKinsey-inspired, clean, high-contrast, professional

## AI Chatbot
- Full context window approach (no RAG)
- Prompt caching enabled for cost/latency optimization
- System prompt includes resume, STAR stories, leadership philosophy

## Content Management

Content files (system prompts, STAR stories, feedback) are version-controlled in the
`career-data/` private git submodule and synced to [Vercel Blob](https://vercel.com/docs/storage/vercel-blob).

### Directory Structure
```
career-data/
├── instructions/     # AI behavior rules (chatbot, fit assessment, resume generator)
├── templates/        # Prompt templates with placeholders
├── context/          # Career narrative and background
├── data/             # Structured JSON (resume, STAR stories)
├── examples/         # Fit assessment samples
└── resume/           # Base resume PDF
```

### Claude Commands
- `/content-pull` - Download content from Blob to `career-data/` directories
- `/content-push` - Upload `career-data/` content to Blob
- `/content-ship` - Commit and push career-data changes, stage pointer in main repo
- `/resume-pull` - Download base resume PDF from Blob
- `/resume-push` - Upload base resume PDF to Blob

### Initial Setup (Fresh Clone)
```bash
git clone --recurse-submodules git@github.com:damilola-elegbede/damilola.tech.git
# Or if already cloned:
git submodule update --init --recursive
```

### Local Development
Content is cached at build time in `src/lib/generated/`. For local dev without
blob token, files are read from `career-data/` subdirectories.

### Editing Content
1. Edit files in `career-data/` subdirectories
2. Run `/content-ship` to commit and push both repos
3. Run `/content-push` to sync to Vercel Blob

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
