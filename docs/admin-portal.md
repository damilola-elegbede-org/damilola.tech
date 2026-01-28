# Admin Portal Documentation

Secure administrative interface for monitoring visitor interactions, reviewing conversations, and generating custom resumes.

## Overview

The admin portal provides centralized access to analytics, conversation archives, and resume generation tools. Access is protected by JWT-based authentication with rate-limiting to prevent brute force attacks.

## Features

### Dashboard

Central hub displaying key metrics and quick links to all portal sections.

**Metrics Displayed:**

- Total chat sessions archived
- Fit assessments completed
- Resume generations by status
- Recent audit events
- Top traffic sources (last 30 days)

**Location:** `/admin/dashboard`

### Traffic Analytics

Comprehensive analytics for visitor traffic sources with UTM parameter tracking.

**Features:**

- Time range filtering (7d, 30d, 90d, or custom date range)
- Traffic breakdown by source (linkedin, google, email, etc.)
- Medium analysis (bio, post, signature, etc.)
- Campaign tracking for targeted outreach
- Landing page performance
- Visual pie chart and detailed tables
- WCAG-compliant accessibility features

**Location:** `/admin/traffic`

**Related Docs:** [UTM Tracking Guide](/admin/docs/utm-tracking)

### Chat Archive

Browse and review all archived chat conversations with visitors.

**Features:**

- List all chat sessions with metadata
- View full conversation history
- Session details (ID, start time, message count)
- Search and filter capabilities

**Location:** `/admin/chats`

**Storage:** Vercel Blob (`damilola.tech/chats/`)

### Fit Assessments

Review AI-generated role fit assessments created by visitors.

**Features:**

- List all fit assessment submissions
- View full assessment reports
- Job description and fit analysis
- Timestamp and session tracking

**Location:** `/admin/fit-assessments`

**Storage:** Vercel Blob (`damilola.tech/fit-assessments/`)

### Resume Generator

Generate ATS-optimized resumes tailored to specific job descriptions.

**Features:**

- Paste job description or company name
- AI-powered keyword optimization
- Custom bullet point generation
- PDF download with high-quality rendering
- Application status tracking (applied, interview, offer, rejected, withdrawn)

**Location:** `/admin/resume-generator`

**Storage:** Vercel Blob (`damilola.tech/resumes/`)

### Audit Log

Comprehensive audit trail of all user interactions and system events.

**Event Types:**

- `page_view` - Page navigation with traffic source
- `chat_message` - User messages and AI responses
- `fit_assessment` - Role fit analysis requests
- `resume_generation` - Custom resume creation

**Location:** `/admin/audit`

**Storage:** Vercel Blob (`damilola.tech/audit/{environment}/{date}/`)

## Authentication

### Login Process

1. Navigate to `/admin/login`
2. Enter admin password
3. System validates credentials and creates JWT token
4. Token stored in HTTP-only cookie
5. Redirect to dashboard

### Security Features

- **JWT-based authentication** - Secure token-based sessions
- **HTTP-only cookies** - Protection against XSS attacks
- **Rate limiting** - 5 attempts per 15 minutes per IP
- **Timing-safe comparison** - Constant-time password verification
- **Environment-specific passwords** - Different credentials for production vs preview
- **24-hour session duration** - Automatic logout after expiration

### Environment Variables

```bash
# Admin authentication
ADMIN_PASSWORD_PRODUCTION=your_production_password
ADMIN_PASSWORD_PREVIEW=your_preview_password
JWT_SECRET=your_jwt_secret
```

**Generate JWT secret:**

```bash
openssl rand -base64 32
```

## Caching (Stale-While-Revalidate)

Admin pages use SWR caching for fast initial loads. Cache is stored in Vercel Blob and pre-populated at build time.

### How It Works

1. **Initial Load (~200ms)**: Page checks Blob cache for pre-built data
2. **Cache Hit**: Returns cached data immediately, shows page
3. **Background Revalidation**: Fetches fresh data from API (~3s)
4. **UI Update**: Updates display with fresh data, shows "Refreshing..." indicator
5. **Cache Update**: Writes fresh data back to Blob for next load

### Cache Keys

| Key | Page | Preset |
|-----|------|--------|
| `dashboard` | Dashboard | N/A |
| `usage-7d` | Usage Stats | 7 days |
| `usage-30d` | Usage Stats | 30 days |
| `usage-90d` | Usage Stats | 90 days |
| `traffic-7d` | Traffic Analytics | 7 days |
| `traffic-30d` | Traffic Analytics | 30 days |
| `traffic-90d` | Traffic Analytics | 90 days |

**Custom date ranges bypass caching** - they fetch directly from the API.

### Build-Time Pre-Population

Cache is pre-populated during Vercel builds via `scripts/generate-admin-cache.ts`:

```bash
npm run generate:admin-cache
```

This runs automatically in CI/CD and populates cache for all preset date ranges.

### Refresh Indicator

When background revalidation is in progress, a floating "Refreshing..." indicator appears at the top of the page.

### Related Files

- `src/lib/admin-cache.ts` - Cache read/write utilities
- `src/hooks/use-admin-cache.ts` - SWR hook with cache-first pattern
- `src/components/admin/RefreshIndicator.tsx` - Loading indicator
- `src/app/api/admin/cache/[key]/route.ts` - Cache API endpoint

## Rate Limiting

All admin API endpoints implement distributed rate limiting using Upstash Redis.

### Configuration

- **Storage:** Upstash Redis (production) or in-memory (development)
- **Circuit breaker:** Fails open to memory after 3 Redis errors
- **Cleanup:** Automatic removal of expired entries

### Login Rate Limits

- **Max attempts:** 5 failed attempts
- **Window:** 15 minutes
- **Lockout duration:** 15 minutes
- **Bypass:** Successful login clears rate limit

### Public Endpoint Limits

- **Chat API:** 50 requests per 5 minutes per IP
- **Fit Assessment:** 10 requests per hour per IP
- **Resume Generator:** 10 requests per hour per IP

## API Routes

### Authentication

#### POST /api/admin/auth

Login endpoint.

**Request:**

```json
{
  "password": "admin_password"
}
```

**Response (Success):**

```json
{
  "success": true
}
```

**Response (Error):**

```json
{
  "error": "Invalid credentials"
}
```

**Rate Limit:** 5 attempts per 15 minutes per IP

#### DELETE /api/admin/auth

Logout endpoint. Clears authentication cookie.

**Response:**

```json
{
  "success": true
}
```

### Cache

#### GET /api/admin/cache/[key]

Retrieve cached data from Vercel Blob.

**Path Parameters:**

- `key` - Cache key (dashboard, usage-7d, usage-30d, usage-90d, traffic-7d, traffic-30d, traffic-90d)

**Response (Success):**

```json
{
  "data": { "...cached data..." },
  "cachedAt": "2024-01-15T10:00:00Z",
  "dateRange": {
    "start": "2024-01-08T00:00:00.000Z",
    "end": "2024-01-15T23:59:59.999Z"
  }
}
```

**Response (Cache Miss):**

```json
{
  "error": "Cache miss"
}
```

**Status:** 404

#### PUT /api/admin/cache/[key]

Update cache in Vercel Blob.

**Request:**

```json
{
  "data": { "...data to cache..." },
  "dateRange": {
    "start": "2024-01-08T00:00:00.000Z",
    "end": "2024-01-15T23:59:59.999Z"
  }
}
```

**Response:**

```json
{
  "success": true
}
```

**Limits:** Max 5MB data size

### Dashboard Stats

#### GET /api/admin/stats

Aggregate statistics for dashboard.

**Response:**

```json
{
  "chats": { "total": 42 },
  "fitAssessments": { "total": 15 },
  "resumeGenerations": {
    "total": 8,
    "byStatus": {
      "applied": 3,
      "interview": 2,
      "offer": 1,
      "rejected": 2
    }
  },
  "audit": {
    "total": 1247,
    "byType": {
      "page_view": 856,
      "chat_message": 324,
      "fit_assessment": 45,
      "resume_generation": 22
    }
  },
  "traffic": {
    "topSources": [
      { "source": "linkedin", "count": 245, "percentage": 28.6 },
      { "source": "google", "count": 178, "percentage": 20.8 }
    ]
  },
  "environment": "production"
}
```

### Traffic Analytics

#### GET /api/admin/traffic

Traffic source analytics with date range filtering.

**Query Parameters:**

- `startDate` - ISO 8601 date string (YYYY-MM-DD)
- `endDate` - ISO 8601 date string (YYYY-MM-DD)
- `env` - Environment filter (optional, defaults to current environment)

**Example:**

```bash
GET /api/admin/traffic?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**

```json
{
  "totalSessions": 856,
  "bySource": [
    { "source": "linkedin", "medium": "", "count": 245, "percentage": 28.6 },
    { "source": "google", "medium": "", "count": 178, "percentage": 20.8 }
  ],
  "byMedium": [
    { "source": "", "medium": "bio", "count": 312, "percentage": 36.4 },
    { "source": "", "medium": "post", "count": 187, "percentage": 21.8 }
  ],
  "byCampaign": [
    { "campaign": "google-q1", "count": 45, "percentage": 5.3 }
  ],
  "topLandingPages": [
    { "path": "/", "count": 745, "percentage": 87.0 },
    { "path": "/admin/login", "count": 111, "percentage": 13.0 }
  ],
  "environment": "production",
  "dateRange": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.999Z"
  }
}
```

### Chats

#### GET /api/admin/chats

List all archived chat sessions.

**Response:**

```json
{
  "chats": [
    {
      "sessionId": "uuid",
      "sessionStartedAt": "2024-01-15T14:30:00Z",
      "url": "https://blob.vercel-storage.com/...",
      "messageCount": 12,
      "uploadedAt": "2024-01-15T14:45:00Z"
    }
  ]
}
```

### Fit Assessments

#### GET /api/admin/fit-assessments

List all fit assessment submissions.

**Response:**

```json
{
  "assessments": [
    {
      "id": "uuid",
      "timestamp": "2024-01-15T10:00:00Z",
      "url": "https://blob.vercel-storage.com/..."
    }
  ]
}
```

### Resume Generations

#### GET /api/admin/resumes

List all generated resumes.

**Response:**

```json
{
  "resumes": [
    {
      "id": "uuid",
      "timestamp": "2024-01-15T09:00:00Z",
      "jobDescription": "Engineering Manager at...",
      "status": "applied",
      "url": "https://blob.vercel-storage.com/..."
    }
  ]
}
```

#### POST /api/admin/resume/generate

Generate ATS-optimized resume for job description.

**Request:**

```json
{
  "jobDescription": "Full job description text...",
  "companyName": "Acme Corp"
}
```

**Response:** Streaming text response with generated content

### Audit Log

#### GET /api/admin/audit

Retrieve audit events with pagination.

**Query Parameters:**

- `cursor` - Pagination cursor (optional)
- `limit` - Results per page (default: 100, max: 1000)
- `env` - Environment filter (optional)

**Response:**

```json
{
  "events": [
    {
      "type": "page_view",
      "timestamp": "2024-01-15T14:30:00Z",
      "sessionId": "uuid",
      "path": "/",
      "metadata": {
        "trafficSource": {
          "source": "linkedin",
          "medium": "bio",
          "campaign": null,
          "referrer": "https://linkedin.com",
          "landingPage": "/"
        }
      }
    }
  ],
  "cursor": "next_page_token"
}
```

## Documentation Pages

### UTM Tracking Guide

Interactive guide for creating UTM-tagged links to track traffic sources.

**Location:** `/admin/docs/utm-tracking`

**Features:**

- UTM parameter explanations
- Ready-to-use examples for common platforms
- Copy-to-clipboard functionality
- Best practices and tips

## Development

### Local Testing

```bash
# Set up environment variables
cp .env.example .env.local

# Add admin credentials
ADMIN_PASSWORD_PREVIEW=your_test_password
JWT_SECRET=your_jwt_secret

# Start development server
npm run dev

# Navigate to admin portal
open http://localhost:3000/admin/login
```

### Production Deployment

1. Set production environment variables in Vercel
2. Configure Upstash Redis for distributed rate limiting
3. Set strong admin password
4. Enable Vercel Blob storage
5. Deploy via Git push

## Security Considerations

- Admin routes are protected by authentication middleware
- All API endpoints verify JWT tokens from cookies
- Rate limiting prevents brute force attacks
- Passwords use timing-safe comparison to prevent timing attacks
- HTTP-only cookies prevent XSS token theft
- Environment-specific credentials reduce credential exposure
- Audit log tracks all admin actions

## Troubleshooting

### Cannot Login

1. Verify correct environment password (production vs preview)
2. Check rate limit status (wait 15 minutes if locked out)
3. Verify JWT_SECRET is configured
4. Check browser cookies are enabled

### Traffic Data Not Showing

1. Verify date range includes actual traffic
2. Check audit log for page_view events
3. Confirm Vercel Blob connectivity
4. Review console for API errors

### Resume Generation Fails

1. Check ANTHROPIC_API_KEY is valid
2. Verify Vercel Blob write permissions
3. Review job description length (max 50KB)
4. Check console for API rate limit errors

## Related Documentation

- [API Documentation](./api-documentation.md)
- [Rate Limiting](./rate-limiting.md)
- [Content Management](../README.md#content-management)
- [UTM Tracking Guide](/admin/docs/utm-tracking)
