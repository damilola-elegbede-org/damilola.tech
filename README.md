# damilola.tech

Personal career landing page with an AI chatbot. Recruiters and hiring managers can interact with the AI assistant to learn about my experience, skills, and role fit.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **AI**: Vercel AI SDK + Anthropic Claude
- **Storage**: Vercel Blob (private content)
- **Testing**: Vitest + React Testing Library + Playwright

## Getting Started

### Prerequisites

- Node.js 20.9.0+
- npm

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with:

```env
ANTHROPIC_API_KEY=your_api_key_here
BLOB_READ_WRITE_TOKEN=your_blob_token_here
VERCEL_BLOB_STORE_ID=your_blob_store_id_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (includes prompt generation) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:e2e:ui` | Run E2E tests with UI |
| `npm run generate-prompt` | Generate system prompt from template |
| `npm run content:pull` | Download content from Vercel Blob to `.tmp/content/` |
| `npm run content:push` | Upload local content changes to Vercel Blob |

## Project Structure

```text
src/
├── app/                 # Next.js App Router
│   ├── api/
│   │   ├── chat/       # AI chat API endpoint
│   │   ├── fit-assessment/ # Role fit analysis endpoint
│   │   └── fit-examples/   # Example JDs for fit assessment
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/
│   ├── chat/           # Chat components (FAB, panel, messages)
│   ├── sections/       # Landing page sections
│   └── ui/             # Reusable UI components
├── lib/
│   ├── generated/      # Auto-generated files (gitignored)
│   ├── blob.ts         # Vercel Blob fetching
│   ├── projects-data.ts # Project portfolio data
│   ├── resume-data.ts  # Resume data
│   ├── system-prompt.ts # AI system prompt builder
│   └── utils.ts        # General utilities
└── types/              # TypeScript type definitions

scripts/                # Build scripts
├── generate-prompt.ts  # System prompt generator
├── content-pull.ts     # Download content from Vercel Blob
├── content-push.ts     # Upload content to Vercel Blob
.tmp/content/           # Local content files (gitignored)
tests/                  # Unit tests
e2e/                    # Playwright E2E tests
```

## Architecture

### AI Chatbot

The chatbot uses a full context window approach (no RAG) with:
- System prompt containing resume, STAR stories, and leadership philosophy
- Prompt caching enabled for cost and latency optimization
- Streaming responses via Vercel AI SDK

### Build-Time Prompt Generation

The system prompt is assembled at build time using a split-template architecture:

1. **Shared Context**: `shared-context.md` contains profile data (resume, STAR stories, skills)
2. **Chatbot Instructions**: `chatbot-instructions.md` contains chatbot-specific behavior (3rd person voice, how to answer)
3. **Content Files**: Separate blob files (`star-stories.json`, `resume-full.json`, etc.) fill placeholders
4. **Generation**: `npm run build` runs `scripts/generate-prompt.ts` as prebuild step
5. **Output**: Two prompts written to `src/lib/generated/system-prompt.ts`:
   - `SHARED_CONTEXT`: Profile data only (used by Fit Assessment)
   - `CHATBOT_SYSTEM_PROMPT`: Shared context + chatbot instructions (used by Chat)

This architecture ensures the Fit Assessment feature gets clean profile data without chatbot-specific instructions leaking in.

### Content Management

Content files (system prompts, STAR stories, feedback) are stored in Vercel Blob for security:

1. **Pull content**: `npm run content:pull` downloads all files to `.tmp/content/`
2. **Edit locally**: Modify files in `.tmp/content/`
3. **Push changes**: `npm run content:push` uploads changes to Vercel Blob
4. **Rebuild**: Run `npm run build` to regenerate cached prompts

### Content Security

- Sensitive career data (STAR stories, detailed context) stored in Vercel Blob
- API keys managed via Vercel environment variables
- Public repository contains code only

## Design

- **Colors**: Deep blue (#0A2540), accent blue (#0066FF), white/grey
- **Fonts**: Geist Sans (headings/body), Geist Mono (code/technical)
- **Style**: Clean, professional, high-contrast

## License

Private - All rights reserved
