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
