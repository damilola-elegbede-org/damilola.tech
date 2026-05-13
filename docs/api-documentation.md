# API Documentation

Comprehensive reference for all public and admin API endpoints.

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://damilola.tech`

## Authentication

### Admin Endpoints

All `/api/admin/*` routes require authentication via JWT token stored in HTTP-only cookie.

**Authentication Header:** Cookie-based (automatic)

**Token Expiration:** 24 hours

**Obtain Token:** POST `/api/admin/auth` with valid password

## Rate Limiting

All endpoints implement rate limiting. Rate limit headers are included in responses:

```http
Retry-After: 300
```

**Error Response (429):**

```json
{
  "error": "Too many requests. Please try again later."
}
```

## Public Endpoints

### Chat API

#### POST /api/chat

Stream AI chatbot responses.

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is your experience with team leadership?"
    },
    {
      "role": "assistant",
      "content": "I have extensive leadership experience..."
    },
    {
      "role": "user",
      "content": "Can you share a specific example?"
    }
  ],
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionStartedAt": "2024-01-15T14:30:00Z"
}
```

**Request Headers:**

```http
Content-Type: application/json
```

**Response:**

- **Content-Type:** `text/plain; charset=utf-8`
- **Transfer-Encoding:** `chunked`
- **Body:** Streaming text response

**Rate Limit:** 50 requests per 5 minutes per IP

**Validation:**

- Max 200 messages in conversation
- Max 2000 characters per message
- Max 500KB total request body
- Session ID must be valid UUID v4
- Session started timestamp must be valid ISO 8601 date

**Auto-Compaction:**

When conversation exceeds 180 messages (90% of limit), older messages are automatically summarized to prevent hitting the limit.

**Security Features:**

- User messages wrapped in XML tags to prevent prompt injection
- Rate limiting per IP address
- Content-length validation
- XSS protection via escaping

**Example:**

```bash
curl -X POST https://damilola.tech/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Tell me about your experience"}
    ],
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionStartedAt": "2024-01-15T14:30:00Z"
  }'
```

### Fit Assessment API

#### POST /api/fit-assessment

Generate AI-powered role fit analysis for a job description.

**Request Body:**

```json
{
  "prompt": "Job description text or URL..."
}
```

**Accepts:**

- Plain text job description
- URL to job posting (automatically fetched and extracted)

**Response:**

- **Content-Type:** `text/plain; charset=utf-8`
- **Transfer-Encoding:** `chunked`
- **Body:** Streaming markdown-formatted fit assessment report

**Rate Limit:** 10 requests per hour per IP

**Validation:**

- Max 50KB request body
- URL must use HTTP or HTTPS protocol
- Fetched content max 1MB
- Min 100 characters extracted from URL
- Must contain job description keywords

**SSRF Protection:**

- Blocks private IP addresses (10.x.x.x, 192.168.x.x, 127.0.0.1)
- Blocks localhost and loopback addresses
- Blocks cloud metadata endpoints (169.254.169.254)
- DNS resolution to verify final IP
- Max 5 redirect hops with validation at each step
- 10-second fetch timeout

**URL Extraction:**

- Removes HTML tags and scripts
- Decodes HTML entities
- Validates content looks like job description
- Requires minimum 2 job-related keywords

**Example (Text):**

```bash
curl -X POST https://damilola.tech/api/fit-assessment \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Engineering Manager\n\nWe are seeking an experienced..."
  }'
```

**Example (URL):**

```bash
curl -X POST https://damilola.tech/api/fit-assessment \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "https://jobs.example.com/engineering-manager"
  }'
```

### Fit Assessment Examples

#### GET /api/fit-examples

Get example job descriptions for testing fit assessment.

**Response:**

```json
{
  "examples": [
    {
      "id": "eng-manager",
      "title": "Engineering Manager",
      "company": "Tech Corp",
      "description": "Full job description text..."
    }
  ]
}
```

**No Authentication Required**

**No Rate Limiting**

## Admin Endpoints

All admin endpoints require authentication. Include JWT token cookie in requests.

### Authentication

#### POST /api/admin/auth

Login to admin portal.

**Request Headers:**

```http
X-CSRF-Token: <csrf_token>
Content-Type: application/json
```

A valid CSRF token must be obtained first via `GET /api/admin/auth` (or the admin UI's session setup). Requests missing or carrying an invalid CSRF token receive `403 Forbidden`. This endpoint is intended to be called from the admin UI, not directly via `curl`.

**Request Body:**

```json
{
  "password": "admin_password"
}
```

**Response (Success - 200):**

```json
{
  "success": true
}
```

**Response (Error - 401):**

```json
{
  "error": "Invalid credentials"
}
```

**Response (Rate Limited - 429):**

```json
{
  "error": "Too many login attempts. Please try again later.",
  "retryAfter": 900
}
```

**Side Effect:** Sets HTTP-only cookie `admin_session` with JWT token

**Rate Limit:** 5 attempts per 15 minutes per IP

#### DELETE /api/admin/auth

Logout from admin portal.

**Response:**

```json
{
  "success": true
}
```

**Side Effect:** Clears `admin_session` cookie

### Dashboard

#### GET /api/admin/stats

Aggregate statistics for admin dashboard.

**Query Parameters:**

- `env` - Environment filter: `production` or `preview` (default: current Vercel environment)

**Response:**

```json
{
  "chats": {
    "total": 42
  },
  "fitAssessments": {
    "total": 15
  },
  "resumeGenerations": {
    "total": 8,
    "byStatus": {
      "applied": 3,
      "interview": 2,
      "offer": 1,
      "rejected": 1,
      "withdrawn": 1
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
      {
        "source": "linkedin",
        "count": 245,
        "percentage": 28.6
      }
    ]
  },
  "environment": "production"
}
```

**Authentication:** Required

### Traffic Analytics

#### GET /api/admin/traffic

Traffic source analytics with UTM tracking.

**Query Parameters:**

- `startDate` - ISO 8601 date (YYYY-MM-DD)
- `endDate` - ISO 8601 date (YYYY-MM-DD)
- `env` - Environment filter (optional)

**Response:**

```json
{
  "totalSessions": 856,
  "bySource": [
    {
      "source": "linkedin",
      "medium": "",
      "count": 245,
      "percentage": 28.6
    }
  ],
  "byMedium": [
    {
      "source": "",
      "medium": "bio",
      "count": 312,
      "percentage": 36.4
    }
  ],
  "byCampaign": [
    {
      "campaign": "google-q1",
      "count": 45,
      "percentage": 5.3
    }
  ],
  "topLandingPages": [
    {
      "path": "/",
      "count": 745,
      "percentage": 87.0
    }
  ],
  "environment": "production",
  "dateRange": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.999Z"
  }
}
```

**Authentication:** Required

**Performance:**

- Uses date-based prefixes to optimize blob listing
- Batched fetching (50 blobs per batch)
- 10-second timeout per blob fetch
- Max 5000 blobs processed per request

### Chats

#### GET /api/admin/chats

List archived chat sessions.

**Query Parameters:**

- `cursor` - Pagination cursor (optional)
- `limit` - Results per page (default: 100, max: 1000)

**Response:**

```json
{
  "chats": [
    {
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "sessionStartedAt": "2024-01-15T14:30:00Z",
      "url": "https://blob.vercel-storage.com/...",
      "messageCount": 12,
      "uploadedAt": "2024-01-15T14:45:00Z"
    }
  ],
  "cursor": "next_page_token"
}
```

**Authentication:** Required

### Fit Assessments

#### GET /api/admin/fit-assessments

List fit assessment submissions.

**Query Parameters:**

- `cursor` - Pagination cursor (optional)
- `limit` - Results per page (default: 100, max: 1000)

**Response:**

```json
{
  "assessments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-15T10:00:00Z",
      "url": "https://blob.vercel-storage.com/..."
    }
  ],
  "cursor": "next_page_token"
}
```

**Authentication:** Required

### Resume Generation

#### GET /api/admin/resume-generations

List resume generation records.

**Query Parameters:**

- `cursor` - Pagination cursor (optional)
- `status` - Filter by application status: `draft`, `applied`, `interview`, `offer`, `rejected` (optional)
- `company` - Case-insensitive partial match on company name (optional)
- `dateFrom` - ISO 8601 date (`YYYY-MM-DD`) — inclusive lower bound (optional)
- `dateTo` - ISO 8601 date (`YYYY-MM-DD`) — inclusive upper bound (optional)
- `minScore` - Minimum fit score after generation (optional)
- `maxScore` - Maximum fit score after generation (optional)

**Response:**

```json
{
  "generations": [
    {
      "id": "damilola.tech/resume-generations/production/...",
      "jobId": "abc123",
      "generationId": "550e8400-e29b-41d4-a716-446655440000",
      "environment": "production",
      "timestamp": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T09:05:00Z",
      "companyName": "Acme Corp",
      "roleTitle": "Engineering Manager",
      "scoreBefore": 65,
      "scoreAfter": 82,
      "scorePossibleMax": 91,
      "applicationStatus": "applied",
      "url": "https://blob.vercel-storage.com/...",
      "size": 4096,
      "generationCount": 1
    }
  ],
  "cursor": "next_page_token",
  "hasMore": true,
  "totalFetched": 50,
  "filtered": false
}
```

**Authentication:** Required

### Audit Log

#### GET /api/admin/audit

Retrieve audit events.

**Query Parameters:**

- `cursor` - Pagination cursor (optional)
- `limit` - Results per page (default: 100, max: 1000)
- `type` - Filter by event type (optional)
- `env` - Environment filter (optional)

**Response:**

```json
{
  "events": [
    {
      "type": "page_view",
      "timestamp": "2024-01-15T14:30:00Z",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
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

**Event Types:**

- `page_view` - Page navigation
- `chat_message` - Chat interaction
- `fit_assessment` - Fit assessment request
- `resume_generation` - Resume generation

**Authentication:** Required

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `413` - Payload Too Large
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable (AI service error)

### Common Errors

#### 400 Bad Request

```json
{
  "error": "Invalid JSON in request body."
}
```

```json
{
  "error": "Invalid messages format or content too long."
}
```

```json
{
  "error": "Job description is required."
}
```

#### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

#### 413 Payload Too Large

```json
{
  "error": "Request body too large."
}
```

#### 429 Too Many Requests

```json
{
  "error": "Too many requests. Please try again later."
}
```

**Headers:**

```http
Retry-After: 300
```

#### 503 Service Unavailable

```json
{
  "error": "AI service error."
}
```

```json
{
  "error": "Chat service error."
}
```

## Rate Limit Details

### Public Endpoints

| Endpoint | Limit | Window | Per |
|----------|-------|--------|-----|
| `/api/chat` | 50 | 5 min | IP |
| `/api/fit-assessment` | 10 | 1 hour | IP |

### Admin Endpoints

| Endpoint | Limit | Window | Per |
|----------|-------|--------|-----|
| `/api/admin/auth` | 5 | 15 min | IP |

### Implementation

- **Storage:** Upstash Redis (production), in-memory (development)
- **Pattern:** Sliding window counter
- **Cleanup:** Automatic expiration via Redis TTL or in-memory cleanup
- **Circuit Breaker:** Fails open to memory after 3 consecutive Redis errors

## Security

### Authentication

- JWT tokens with HS256 signing
- HTTP-only cookies prevent XSS
- 24-hour expiration
- Timing-safe password comparison

### Rate Limiting

- IP-based identification
- Distributed state via Redis
- Circuit breaker for Redis failures
- Admin login lockout (15 minutes)

### Input Validation

- Content-length checks
- JSON schema validation
- Message count limits
- Character length limits
- UUID format validation
- Date format validation

### SSRF Protection

- URL protocol whitelist (HTTP/HTTPS only)
- Private IP range blocking
- DNS resolution validation
- Redirect validation
- Timeout enforcement
- Size limits on fetched content

### Prompt Injection Prevention

- XML tag wrapping for user inputs
- HTML entity escaping
- Separate system and user content
- Temperature 0 for deterministic fit assessments

## Data Storage

### Vercel Blob Structure

```text
damilola.tech/
├── chats/
│   └── {sessionId}-{timestamp}.json
├── fit-assessments/
│   └── {id}-{timestamp}.json
├── resumes/
│   └── {id}-{timestamp}.json
└── audit/
    └── {environment}/
        └── {date}/
            └── {timestamp}-{type}-{sessionId}.json
```

### Blob URL Format

```text
https://blob.vercel-storage.com/damilola.tech/chats/550e8400-e29b-41d4-a716-446655440000-2024-01-15T14-30-00Z.json
```

**Access:** Public with unlisted URLs (security through obscurity)

**Retention:** Indefinite (manual cleanup required)

## Performance Considerations

### Streaming Responses

Chat and fit assessment endpoints use streaming for:

- Progressive content display
- Lower perceived latency
- Better user experience
- Memory efficiency

### Prompt Caching

- System prompts cached by Anthropic
- Reduces API costs
- Improves response latency
- Cache invalidation on content changes

### Blob Optimization

- Date-based prefixes for efficient listing
- Batch fetching (50 items per batch)
- Parallel requests with timeout
- Max blob limits (5000 per request)

## Development

### Local Testing

```bash
# Start dev server
npm run dev

# Test public endpoint
curl http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"sessionId":"test","sessionStartedAt":"2024-01-15T14:30:00Z"}'

# Test admin endpoint (requires login first)
curl http://localhost:3000/api/admin/stats \
  -H "Cookie: admin_session=your_jwt_token"
```

### Environment Variables

```bash
# Required for API functionality
ANTHROPIC_API_KEY=sk-ant-...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
JWT_SECRET=your_jwt_secret
ADMIN_PASSWORD_PREVIEW=dev_password      # Used in preview/development environments
ADMIN_PASSWORD_PRODUCTION=prod_password  # Required in production environments

# Optional for rate limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## V1 API Endpoints

The `/api/v1/` surface is an authenticated REST API for programmatic access to job application tracking and AI-powered job search tooling. All routes in this section require an API key (see [V1 Authentication](#v1-authentication) below).

### V1 Authentication

V1 endpoints use API key authentication. Include the key in one of these headers:

```http
Authorization: Bearer dk_live_your_api_key
```

or

```http
X-API-Key: dk_live_your_api_key
```

Keys have the prefix `dk_`. An invalid or missing key returns `401 Unauthorized`.

### Application Tracking

#### POST /api/v1/log-application

Log a new job application.

**Request Body:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `company` | string | Yes | Trimmed; must be non-empty |
| `title` | string | Yes | Trimmed; must be non-empty |
| `url` | string | No | Job posting URL |
| `role_id` | string | No | Internal role identifier |
| `notes` | string | No | Free-text notes |
| `cover_letter_draft` | string | No | Draft cover letter text |
| `status` | string | No | One of `applied`, `screen`, `interview`, `offer`, `rejected`, `withdrawn`. Default: `applied` |
| `score` | number | No | Fit score 0–100 (inclusive, finite) |
| `applied_at` | string | No | ISO 8601 timestamp. Default: current UTC time |

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "company": "Acme Corp",
    "title": "Engineering Manager",
    "applied_at": "2026-04-26T15:00:00.000Z",
    "status": "applied",
    "score": 82,
    "url": "https://jobs.acme.com/em-123",
    "cover_letter_draft": null
  }
}
```

**Error codes:**

| Code | Cause |
|---|---|
| `400` | Invalid JSON body |
| `401` | Missing or invalid API key |
| `422` | Validation error — missing required field, invalid `status`, `score` out of range, or invalid `applied_at` |
| `500` | Failed to save application |

**Example:**

```bash
curl -X POST https://damilola.tech/api/v1/log-application \
  -H "Authorization: Bearer dk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Acme Corp",
    "title": "Engineering Manager",
    "url": "https://jobs.acme.com/em-123",
    "score": 82
  }'
```

---

#### GET /api/v1/log-application

List logged applications with optional filtering.

**Query Parameters:**

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `stage` | string | No | Alias for `status`. One of `applied`, `screen`, `interview`, `offer`, `rejected`, `withdrawn` |
| `status` | string | No | Filter by application status. Same valid values as `stage`. If both are provided, `stage` takes precedence |
| `since` | string | No | ISO 8601 timestamp. Returns only applications with `applied_at >= since` |
| `limit` | integer | No | Max results to return. Default: `50`, max: `100` |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "uuid",
        "company": "Acme Corp",
        "title": "Engineering Manager",
        "url": "https://jobs.acme.com/em-123",
        "role_id": null,
        "applied_at": "2026-04-26T15:00:00.000Z",
        "status": "applied",
        "score": 82,
        "notes": null,
        "cover_letter_draft": null,
        "created_at": "2026-04-26T15:00:00.000Z",
        "updated_at": "2026-04-26T15:00:00.000Z"
      }
    ],
    "total": 1,
    "limit": 50
  }
}
```

**Error codes:**

| Code | Cause |
|---|---|
| `400` | Invalid `status`/`stage` value or non-ISO `since` |
| `401` | Missing or invalid API key |
| `500` | Database failure |

**Example:**

```bash
curl "https://damilola.tech/api/v1/log-application?stage=interview&since=2026-04-01T00:00:00Z&limit=20" \
  -H "Authorization: Bearer dk_live_..."
```

---

#### GET /api/v1/applications

List applications with pagination and optional filtering. Unlike `GET /api/v1/log-application`, this endpoint supports `offset`-based pagination and `company` substring search.

**Query Parameters:**

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `status` | string | No | Filter by status. One of `applied`, `screen`, `interview`, `offer`, `rejected`, `withdrawn` |
| `company` | string | No | Case-insensitive substring match on company name |
| `limit` | integer | No | Max results per page. Default: `50`, max: `100` |
| `offset` | integer | No | Pagination offset. Default: `0` |

Results are ordered by `applied_at` descending.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "uuid",
        "company": "Acme Corp",
        "title": "Engineering Manager",
        "url": "https://jobs.acme.com/em-123",
        "role_id": null,
        "applied_at": "2026-04-26T15:00:00.000Z",
        "status": "applied",
        "score": 82,
        "notes": null,
        "cover_letter_draft": null,
        "created_at": "2026-04-26T15:00:00.000Z",
        "updated_at": "2026-04-26T15:00:00.000Z"
      }
    ],
    "total": 14,
    "limit": 50,
    "offset": 0
  }
}
```

**Error codes:**

| Code | Cause |
|---|---|
| `400` | Invalid `status` value |
| `401` | Missing or invalid API key |
| `500` | Database failure |

**Example:**

```bash
curl "https://damilola.tech/api/v1/applications?status=interview&company=acme&limit=10&offset=0" \
  -H "Authorization: Bearer dk_live_..."
```

---

### Job Scoring

#### POST /api/v1/score-job

Score a job posting against Damilola's resume. Returns a readiness score, keyword analysis, gap analysis, and a cover letter recommendation.

**Request Body:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string | Yes | HTTP/HTTPS URL of the job posting |
| `title` | string | Yes | Job title |
| `company` | string | Yes | Company name |
| `job_content` | string | No | Pre-fetched job posting text. When provided the URL is not fetched. Max 200 KB |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "company": "Acme Corp",
    "title": "Engineering Manager",
    "url": "https://jobs.acme.com/em-123",
    "currentScore": {
      "total": 72,
      "breakdown": {
        "skills": 80,
        "experience": 70,
        "education": 75,
        "keywords": 65
      },
      "matchedKeywords": ["distributed systems", "go", "kubernetes"],
      "missingKeywords": ["rust", "embedded"],
      "matchRate": 68.5,
      "keywordDensity": 4.2
    },
    "maxPossibleScore": 91,
    "gapAnalysis": "The resume covers most core competencies...",
    "recommendation": "full_generation_recommended"
  }
}
```

`recommendation` values:

| Value | Meaning |
|---|---|
| `full_generation_recommended` | Gap > 15 points — cover letter generation likely to add significant value |
| `marginal_improvement` | Gap 5–15 points |
| `strong_fit` | Gap < 5 points |

When the job posting is client-side-rendered and text cannot be extracted, the response includes `"emptyShellFallback": true` and scoring is based on title, company, and URL slug keywords only.

**Rate limit:** Shares the resume generator ceiling (see [Rate Limit Details](#rate-limit-details)).

**Error codes:**

| Code | Cause |
|---|---|
| `400` | Invalid JSON, invalid/non-HTTP URL, body > 256 KB, or `job_content` > 200 KB |
| `401` | Missing or invalid API key |
| `429` | Rate limited |
| `500` | AI service error |

**Example:**

```bash
curl -X POST https://damilola.tech/api/v1/score-job \
  -H "Authorization: Bearer dk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://jobs.acme.com/em-123",
    "title": "Engineering Manager",
    "company": "Acme Corp"
  }'
```

---

### Cover Letter Generation

#### POST /api/v1/generate-cover-letter

Generate a targeted cover letter for a job posting. Accepts a URL or raw text; output is a Markdown document with YAML frontmatter.

**Request Body:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `job_posting_url` | string | Conditional | URL of the job posting. Required if `job_posting_text` is omitted. Cannot supply both |
| `job_posting_text` | string | Conditional | Raw job posting text. Required if `job_posting_url` is omitted. Cannot supply both |
| `tone` | string | No | `confident` (default), `warm`, or `technical` |
| `company` | string | No | Company name; used in frontmatter and output filename |
| `role` | string | No | Role title; used in frontmatter and output filename |
| `score_job_output` | string | No | JSON string from `POST /api/v1/score-job`. Provides fit context to the generator; recommended but not required |

Body size limit: 50 KB. Timeout: 120 s.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "cover_letter_markdown": "---\ncompany: Acme Corp\nrole: Engineering Manager\n...\n---\n\nDear Hiring Team,\n...",
    "metadata": {
      "company": "Acme Corp",
      "role": "Engineering Manager",
      "generated_at": "2026-04-26T15:00:00.000Z",
      "model": "claude-sonnet-4-6",
      "input_source": "url",
      "score_job_used": true,
      "token_usage": {
        "input": 4120,
        "output": 612,
        "cache_read": 3800
      }
    }
  }
}
```

**Error codes:**

| Code | Cause |
|---|---|
| `400` | Missing or conflicting job posting input, invalid `tone`, body > 50 KB, or invalid JSON |
| `401` | Missing or invalid API key; Anthropic API key invalid |
| `429` | Rate limited |
| `500` | Template unavailable, generation timed out, or AI service error |

**Example (URL input):**

```bash
curl -X POST https://damilola.tech/api/v1/generate-cover-letter \
  -H "Authorization: Bearer dk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "job_posting_url": "https://jobs.acme.com/em-123",
    "tone": "confident",
    "company": "Acme Corp",
    "role": "Engineering Manager"
  }'
```

**Example (text input with score context):**

```bash
curl -X POST https://damilola.tech/api/v1/generate-cover-letter \
  -H "Authorization: Bearer dk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "job_posting_text": "We are looking for an Engineering Manager...",
    "tone": "technical",
    "score_job_output": "{\"currentScore\":{\"total\":72},...}"
  }'
```

---

### MCP Tools

The damilola.tech MCP server exposes the following tools wrapping the V1 API.

#### `generate_cover_letter`

Generate a targeted cover letter for a job posting. Mirrors `POST /api/v1/generate-cover-letter`.

**Arguments:**

| Argument | Type | Required | Notes |
|---|---|---|---|
| `job_posting_url` | string (URL) | Conditional | URL of the job posting |
| `job_posting_text` | string | Conditional | Raw job posting text; use when URL fetch is blocked |
| `score_job_output` | string | No | JSON output from `score_job` tool; recommended for best results |
| `tone` | `confident` \| `warm` \| `technical` | No | Default: `confident` |
| `company` | string | No | Company name for output filename |
| `role` | string | No | Role title for output filename |

**Return value:**

Returns a text content block containing the JSON response from the API:

```json
{
  "cover_letter_markdown": "...",
  "metadata": {
    "company": "...",
    "role": "...",
    "generated_at": "ISO-8601",
    "model": "claude-sonnet-4-6",
    "input_source": "url | text",
    "score_job_used": true,
    "token_usage": { "input": 0, "output": 0, "cache_read": 0 }
  }
}
```

On error, returns a text content block with the error message and `isError: true`.

#### `score_job`

Score a job posting against Damilola's resume. Mirrors `POST /api/v1/score-job`.

**Arguments:**

| Argument | Type | Required | Notes |
|---|---|---|---|
| `url` | string (URL) | Yes | Job posting URL |
| `title` | string | Yes | Job title |
| `company` | string | Yes | Company name |

**Return value:**

Returns a text content block containing the JSON response from the API. Pass the full output as `score_job_output` to `generate_cover_letter` for best results.

---

### V1 Rate Limits

V1 endpoints share the `resume-generator` rate limit bucket (key: `resume-generator`, sliding window):

| Endpoint | Limit | Window | Per |
|---|---|---|---|
| `POST /api/v1/score-job` | 100 | 1 hour | IP |
| `POST /api/v1/generate-cover-letter` | 100 | 1 hour | IP |
| `POST /api/v1/log-application` | No limit | — | — |
| `GET /api/v1/log-application` | No limit | — | — |
| `GET /api/v1/applications` | No limit | — | — |

---

## Related Documentation

- [Admin Portal Documentation](./admin-portal.md)
- [Rate Limiting Implementation](./rate-limiting.md)
- [Security Best Practices](./security.md)
