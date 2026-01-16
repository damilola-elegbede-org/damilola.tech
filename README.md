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

- Node.js 18+
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

```
ANTHROPIC_API_KEY=your_api_key_here
BLOB_READ_WRITE_TOKEN=your_blob_token_here
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
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:e2e:ui` | Run E2E tests with UI |

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/chat/       # AI chat API endpoint
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/
│   ├── chat/           # Chat components (FAB, panel, messages)
│   ├── sections/       # Landing page sections
│   └── ui/             # Reusable UI components
├── lib/                # Utilities and helpers
│   ├── blob.ts         # Vercel Blob fetching
│   ├── resume-data.ts  # Resume data
│   ├── system-prompt.ts # AI system prompt
│   └── utils.ts        # General utilities
└── types/              # TypeScript type definitions

content/                # Local dev content (mirrored to Vercel Blob)
__tests__/              # Unit tests
e2e/                    # Playwright E2E tests
```

## Architecture

### AI Chatbot

The chatbot uses a full context window approach (no RAG) with:
- System prompt containing resume, STAR stories, and leadership philosophy
- Prompt caching enabled for cost and latency optimization
- Streaming responses via Vercel AI SDK

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
