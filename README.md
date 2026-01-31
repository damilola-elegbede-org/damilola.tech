# damilola.tech

Personal career landing page with an AI chatbot. Recruiters and hiring managers can interact with the AI assistant to learn about my experience, skills, and role fit.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **AI**: Vercel AI SDK + Anthropic Claude
- **Storage**: Vercel Blob (private content)
- **Testing**: Vitest + React Testing Library + Playwright
- **Rate Limiting**: Upstash Redis (distributed state)

## Features

### Public Features

- **AI Chatbot** - Interactive conversation about experience and skills
- **Role Fit Assessment** - AI-powered analysis of job description fit
- **Projects Portfolio** - Showcase of key technical projects
- **Experience Timeline** - Professional history and achievements
- **Skills Assessment** - Technical and leadership capabilities

### Admin Portal

Secure administrative interface for monitoring and content generation:

- **Dashboard** - Aggregate metrics and quick links
- **Traffic Analytics** - UTM tracking and source analysis
- **Chat Archive** - Review all visitor conversations
- **Fit Assessments** - Review role fit analyses
- **Resume Generator** - ATS-optimized resume creation
- **API Keys** - Manage API keys for external integrations
- **Audit Log** - Complete event trail

See [Admin Portal Documentation](./docs/admin-portal.md) for details.

### External API Access

REST API with API key authentication for programmatic access:

- **API Key Management** - Generate and manage API keys in admin portal
- **Full Access** - All admin functionality available via `/api/v1/*` endpoints
- **Audit Tracking** - API access logged separately from browser access

See [External API Documentation](./docs/external-api.md) for details.

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
# Required
ANTHROPIC_API_KEY=your_api_key_here
BLOB_READ_WRITE_TOKEN=your_blob_token_here

# Admin Portal
ADMIN_PASSWORD_PREVIEW=your_preview_password
ADMIN_PASSWORD_PRODUCTION=your_production_password
JWT_SECRET=your_jwt_secret

# Optional (for distributed rate limiting)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

**Generate JWT secret:**

```bash
openssl rand -base64 32
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) to access admin portal.

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
| `npm run content:commit` | Commit submodule changes and stage pointer |
| `npm run resume:pull` | Download base resume PDF from Vercel Blob |
| `npm run resume:push` | Upload base resume PDF to Vercel Blob |
| `npm run cleanup:chats` | Clean up old chat sessions |

## Project Structure

```text
src/
├── app/                    # Next.js App Router
│   ├── admin/              # Admin portal pages
│   │   ├── dashboard/      # Analytics dashboard
│   │   ├── traffic/        # Traffic analytics
│   │   ├── chats/          # Chat archive
│   │   ├── fit-assessments/ # Fit assessment archive
│   │   ├── resume-generator/ # Resume generation
│   │   ├── audit/          # Audit log viewer
│   │   ├── docs/           # Admin documentation
│   │   └── login/          # Authentication
│   ├── api/
│   │   ├── admin/          # Admin API endpoints
│   │   │   ├── auth/       # Login/logout
│   │   │   ├── stats/      # Dashboard statistics
│   │   │   ├── traffic/    # Traffic analytics
│   │   │   ├── chats/      # Chat archive
│   │   │   ├── fit-assessments/ # Fit assessments
│   │   │   ├── resumes/    # Resume archive
│   │   │   └── audit/      # Audit log
│   │   ├── chat/           # AI chat API endpoint
│   │   ├── fit-assessment/ # Role fit analysis endpoint
│   │   └── fit-examples/   # Example JDs for fit assessment
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/
│   ├── admin/              # Admin portal components
│   │   ├── AdminLayout.tsx # Admin layout wrapper
│   │   ├── AdminNav.tsx    # Admin navigation
│   │   └── StatsCard.tsx   # Dashboard stat cards
│   ├── chat/               # Chat components (FAB, panel, messages)
│   ├── sections/           # Landing page sections
│   └── ui/                 # Reusable UI components
├── lib/
│   ├── generated/          # Auto-generated files (gitignored)
│   ├── admin-auth.ts       # Admin authentication
│   ├── rate-limit.ts       # Rate limiting implementation
│   ├── blob.ts             # Vercel Blob fetching
│   ├── chat-storage-server.ts # Chat persistence
│   ├── projects-data.ts    # Project portfolio data
│   ├── resume-data.ts      # Resume data
│   ├── system-prompt.ts    # AI system prompt builder
│   └── utils.ts            # General utilities
└── types/                  # TypeScript type definitions

career-data/                # Git submodule (private repo)
├── instructions/           # AI behavior rules
├── templates/              # Prompt templates
├── context/                # Career narrative
├── data/                   # Structured JSON
├── examples/               # Fit assessment samples
└── resume/                 # Base resume PDF

scripts/                    # Build and utility scripts
├── generate-prompt.ts      # System prompt generator
├── content-pull.ts         # Download content from Vercel Blob
├── content-push.ts         # Upload content to Vercel Blob
├── content-commit.ts       # Commit submodule changes
├── resume-pull.ts          # Download resume PDF
├── resume-push.ts          # Upload resume PDF
└── cleanup-chats.ts        # Clean old chats

docs/                       # Documentation
├── admin-portal.md         # Admin portal guide
├── api-documentation.md    # API reference
└── rate-limiting.md        # Rate limiting details

.tmp/content/               # Local content files (gitignored)
tests/                      # Unit tests
e2e/                        # Playwright E2E tests
```

## Architecture

### AI Chatbot

The chatbot uses a full context window approach (no RAG) with:

- System prompt containing resume, STAR stories, and leadership philosophy
- Prompt caching enabled for cost and latency optimization
- Streaming responses via Vercel AI SDK
- Automatic conversation compaction when approaching limits

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

Content files (system prompts, STAR stories, feedback) are version-controlled in the `career-data/` private git submodule and synced to Vercel Blob.

**Directory Structure:**

```text
career-data/
├── instructions/     # AI behavior rules
├── templates/        # Prompt templates
├── context/          # Career narrative
├── data/             # Structured JSON
├── examples/         # Fit assessment samples
└── resume/           # Base resume PDF
```

**Workflow:**

1. **Pull content**: `npm run content:pull` downloads all files to `career-data/` directories
2. **Edit locally**: Modify files in `career-data/` subdirectories
3. **Commit changes**: `npm run content:commit` commits submodule + stages pointer in main repo
4. **Commit main repo**: `npm run commit` commits main repo
5. **Push to blob**: `npm run content:push` syncs to Vercel Blob
6. **Rebuild**: `npm run build` regenerates cached prompts

**Initial Setup (Fresh Clone):**

```bash
git clone --recurse-submodules git@github.com:damilola-elegbede/damilola.tech.git
# Or if already cloned:
git submodule update --init --recursive
```

### Admin Authentication

- **JWT-based sessions** with HTTP-only cookies
- **Rate limiting** prevents brute force attacks (5 attempts per 15 minutes)
- **Timing-safe password comparison** prevents timing attacks
- **Environment-specific passwords** (production vs preview)
- **24-hour session duration** with automatic logout

See [Admin Portal Documentation](./docs/admin-portal.md) for details.

### Rate Limiting

Distributed rate limiting using Upstash Redis:

- **Admin login:** 5 attempts per 15 minutes per IP
- **Chat API:** 50 requests per 5 minutes per IP
- **Fit Assessment:** 10 requests per hour per IP
- **Resume Generator:** 10 requests per hour per IP
- **Circuit breaker:** Fails open to in-memory storage on Redis errors

See [Rate Limiting Documentation](./docs/rate-limiting.md) for details.

### Traffic Tracking

Comprehensive analytics with UTM parameter tracking:

- Automatic referrer detection and classification
- UTM source, medium, campaign tracking
- Landing page analysis
- Session-based tracking
- Time range filtering (7d, 30d, 90d, custom)

### Content Security

- Sensitive career data (STAR stories, detailed context) stored in Vercel Blob
- API keys managed via Vercel environment variables
- Public repository contains code only
- Admin portal protected by JWT authentication
- Rate limiting prevents API abuse

### Audit Trail

Complete audit log of all user interactions:

- Page views with traffic source metadata
- Chat messages and AI responses
- Fit assessment requests
- Resume generation events
- Admin actions
- Stored in Vercel Blob with date-based organization

## API Endpoints

### Public Endpoints

- `POST /api/chat` - AI chatbot conversation (50/5min per IP)
- `POST /api/fit-assessment` - Role fit analysis (10/hour per IP)
- `GET /api/fit-examples` - Example job descriptions

### Admin Endpoints

- `POST /api/admin/auth` - Login (5/15min per IP)
- `DELETE /api/admin/auth` - Logout
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/traffic` - Traffic analytics
- `GET /api/admin/chats` - Chat archive
- `GET /api/admin/fit-assessments` - Fit assessment archive
- `GET /api/admin/resumes` - Resume archive
- `POST /api/admin/resume/generate` - Generate resume (10/hour per IP)
- `GET /api/admin/audit` - Audit log

See [API Documentation](./docs/api-documentation.md) for complete reference.

## Design

- **Colors**: Deep blue (#0A2540), accent blue (#0066FF), white/grey
- **Fonts**: Geist Sans (headings/body), Geist Mono (code/technical)
- **Style**: Clean, professional, high-contrast, McKinsey-inspired

### Section Background Pattern

Sections alternate backgrounds for visual rhythm:

- Odd sections (1, 3, 5): Default `var(--color-bg)` (#0D1117)
- Even sections (2, 4, 6): Alternate `bg-[var(--color-bg-alt)]` (#161B22)

Cards within sections must have minimum 10 RGB units difference from section background.

## Testing

### Unit Tests (Vitest)

```bash
# Run all tests
npm run test

# Run with UI
npm run test:ui

# Generate coverage
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Run all browsers
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

**Test browsers:** Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari

## Deployment

### Vercel (Production)

1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Connect Vercel Blob storage
4. Connect Upstash Redis
5. Push to main branch to deploy

### Environment Variables (Vercel)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Admin Portal
ADMIN_PASSWORD_PRODUCTION=strong_password
JWT_SECRET=base64_secret

# Rate Limiting (optional but recommended)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Documentation

- [Admin Portal Documentation](./docs/admin-portal.md) - Complete admin portal guide
- [API Documentation](./docs/api-documentation.md) - API endpoint reference
- [Rate Limiting Documentation](./docs/rate-limiting.md) - Rate limiting implementation
- [UTM Tracking Guide](/admin/docs/utm-tracking) - Traffic source tracking

## Security

- JWT-based authentication with HTTP-only cookies
- Rate limiting on all endpoints
- SSRF protection for URL fetching
- Prompt injection prevention via XML wrapping
- Timing-safe password comparison
- Content-length validation
- Input sanitization and validation

## Performance

- Streaming responses for progressive content display
- Prompt caching reduces AI costs and latency
- Date-based blob prefixes optimize listing
- Batch fetching with timeouts
- Circuit breaker for Redis failures
- Automatic conversation compaction

## License

Private - All rights reserved
