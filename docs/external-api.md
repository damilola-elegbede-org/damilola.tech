# External API Documentation

REST API access for external integrations like OpenClaw.

## Overview

The External API provides programmatic access to all admin functionality via `/api/v1/*` endpoints. Authentication is handled via API keys, which can be managed in the Admin Portal.

## Authentication

All API requests require authentication using an API key. The key can be provided in one of two ways:

### Authorization Header (Recommended)

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://damilola.tech/api/v1/stats
```

### X-API-Key Header

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://damilola.tech/api/v1/stats
```

### API Key Format

Keys follow the format: `dk_{env}_{32-char-random}`

- `dk_live_*` - Production keys
- `dk_test_*` - Test/preview keys

## Response Format

All responses follow a consistent JSON structure:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "environment": "production",
    "pagination": {
      "cursor": "abc123",
      "hasMore": true
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key."
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | API key disabled or revoked |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Endpoints

### Dashboard Statistics

Get aggregate statistics for the dashboard.

```
GET /api/v1/stats
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `env` | string | production | Environment (production, preview) |

**Response:**

```json
{
  "success": true,
  "data": {
    "chats": { "total": 150 },
    "fitAssessments": { "total": 45 },
    "resumeGenerations": {
      "total": 30,
      "byStatus": { "draft": 10, "applied": 15, "interview": 5 }
    },
    "audit": {
      "total": 5000,
      "byType": { "page_view": 3000, "chat_message_sent": 500 }
    },
    "traffic": {
      "topSources": [
        { "source": "linkedin", "count": 100, "percentage": 40.0 }
      ]
    },
    "environment": "production"
  }
}
```

### Chat Sessions

#### List Chats

```
GET /api/v1/chats
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `env` | string | production | Environment |
| `limit` | number | 50 | Max results (1-100) |
| `cursor` | string | - | Pagination cursor |

**Response:**

```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "id": "damilola.tech/chats/production/...",
        "sessionId": "chat-abc123...",
        "timestamp": "2024-01-15T10:30:00Z",
        "size": 4096,
        "url": "https://..."
      }
    ]
  },
  "meta": {
    "pagination": { "cursor": "...", "hasMore": true }
  }
}
```

#### Get Chat Detail

```
GET /api/v1/chats/{id}
```

The `id` is the URL-encoded blob URL from the chat list.

### Fit Assessments

#### List Assessments

```
GET /api/v1/fit-assessments
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `env` | string | production | Environment |
| `limit` | number | 50 | Max results (1-100) |
| `cursor` | string | - | Pagination cursor |

#### Get Assessment Detail

```
GET /api/v1/fit-assessments/{id}
```

#### Run Fit Assessment

Run a new fit assessment and get JSON response (no streaming).

```
POST /api/v1/fit-assessment
```

**Request Body:**

```json
{
  "input": "https://example.com/job-posting"
}
```

Or with raw job description text:

```json
{
  "input": "Senior Software Engineer at Acme Corp..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "assessment": "## Executive Fit Report\n\n...",
    "model": "claude-sonnet-4-6",
    "usage": {
      "inputTokens": 5000,
      "outputTokens": 2000,
      "cacheReadTokens": 4500
    }
  }
}
```

### Resume Generator

Generate a tailored resume analysis and proposed changes for a job description.

```
POST /api/v1/resume-generator
```

**Request Body:**

```json
{
  "input": "https://example.com/job-posting"
}
```

Or with raw job description text:

```json
{
  "input": "Senior Engineering Manager at Acme Corp..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "generationId": "uuid",
    "companyName": "Acme Corp",
    "roleTitle": "Senior Engineering Manager",
    "currentScore": {
      "total": 64,
      "breakdown": {
        "roleRelevance": 25,
        "claritySkimmability": 18,
        "businessImpact": 14,
        "presentationQuality": 7
      },
      "matchedKeywords": ["cloud", "kubernetes"],
      "missingKeywords": ["terraform"],
      "matchRate": 45.2,
      "keywordDensity": 2.1
    },
    "optimizedScore": {
      "total": 83,
      "breakdown": {
        "roleRelevance": 33,
        "claritySkimmability": 21,
        "businessImpact": 18,
        "presentationQuality": 9
      }
    },
    "maxPossibleScore": 69,
    "proposedChanges": [
      {
        "section": "experience.verily.bullet1",
        "original": "Managed infrastructure team",
        "modified": "Led 13-engineer infrastructure team delivering Kubernetes platform",
        "reason": "Adds relevant keywords and quantifies scope",
        "relevanceSignals": ["kubernetes", "platform"],
        "impactPoints": 5,
        "impactPerSignal": 2,
        "impactBreakdown": {
          "roleRelevance": 3,
          "claritySkimmability": 1,
          "businessImpact": 1,
          "presentationQuality": 0
        }
      }
    ],
    "gapsIdentified": ["Cost optimization experience"],
    "inputType": "text",
    "extractedUrl": null
  }
}
```

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| `generationId` | string | Unique ID for this generation |
| `currentScore` | object | Deterministic baseline readiness score |
| `optimizedScore` | object | Projected score after accepting all changes |
| `maxPossibleScore` | number | `currentScore.total` + sum of normalized `impactPoints`, capped at score ceiling |
| `proposedChanges` | array | AI-proposed resume edits |
| `proposedChanges[].impactBreakdown` | object \| undefined | Per-category impact (optional — absent on logs generated before V4) |
| `proposedChanges[].impactPerSignal` | number \| undefined | `impactPoints / relevanceSignals.length` (optional) |
| `gapsIdentified` | string[] | JD requirements not met by resume |

**Notes:**
- Model: `claude-opus-4-6` with `temperature: 0`
- `maxPossibleScore` is computed server-side from normalized `impactPoints`, not from Claude's stated value
- `impactBreakdown` is optional for backward compatibility with older generation logs

### Resume Generations

#### List Generations

```
GET /api/v1/resume-generations
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | - | Pagination cursor |
| `status` | string | - | Filter by status (draft, applied, interview, offer, rejected) |
| `company` | string | - | Filter by company name (partial match) |
| `dateFrom` | string | - | Start date (YYYY-MM-DD) |
| `dateTo` | string | - | End date (YYYY-MM-DD) |
| `minScore` | number | - | Minimum compatibility score |
| `maxScore` | number | - | Maximum compatibility score |

#### Get Generation Detail

```
GET /api/v1/resume-generations/{id}
```

### Resume PDF

Download the current base resume as a PDF.

> **No authentication required.** This is the only `/api/v1/*` endpoint that is publicly accessible without an API key. All other endpoints require an `Authorization: Bearer` or `X-API-Key` header.

```
GET /api/v1/resume.pdf
```

**Response:**

Returns a PDF binary stream.

| Header | Value |
|--------|-------|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="damilola-elegbede-resume.pdf"` |
| `Cache-Control` | `no-store` |

`Cache-Control: no-store` means the response is never cached — each request renders a fresh PDF from the current resume data.

**Example:**

```bash
# Download to working directory
curl -O https://damilola.tech/api/v1/resume.pdf

# Download with a custom filename
curl -o elegbede-resume.pdf https://damilola.tech/api/v1/resume.pdf
```

**Error Response:**

| Status | Code | Condition |
|--------|------|-----------|
| 429 | `RATE_LIMITED` | IP rate limit exceeded (100 req/min); see `Retry-After` header |
| 500 | `INTERNAL_ERROR` | PDF rendering failed (server-side error) |

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "PDF generation failed"
  }
}
```

### Audit Log

List audit events with filtering.

```
GET /api/v1/audit
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `env` | string | development | Environment |
| `date` | string | - | Filter by date (YYYY-MM-DD) |
| `eventType` | string | - | Filter by event type |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page (max 100) |

### Traffic Analytics

Get traffic source analytics.

```
GET /api/v1/traffic
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `env` | string | production | Environment |
| `days` | number | 30 | Number of days (1-365) |
| `startDate` | string | - | Start date (YYYY-MM-DD) |
| `endDate` | string | - | End date (YYYY-MM-DD) |

### Usage Statistics

Get AI usage and cost statistics.

```
GET /api/v1/usage
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `startDate` | string | - | Start date (YYYY-MM-DD) |
| `endDate` | string | - | End date (YYYY-MM-DD) |

### Chat with AI

Send a chat message and get JSON response (no streaming).

```
POST /api/v1/chat
```

**Request Body:**

```json
{
  "messages": [
    { "role": "user", "content": "What is your experience with AWS?" }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": {
      "role": "assistant",
      "content": "I have extensive experience with AWS..."
    },
    "model": "claude-sonnet-4-6",
    "usage": {
      "inputTokens": 3000,
      "outputTokens": 150,
      "cacheReadTokens": 2800
    }
  }
}
```


### Job Application Tracking

Log and query job applications in the career pipeline.

#### POST /api/v1/log-application

Log a new job application.

**Authentication:** API key required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company` | string | Yes | Company name |
| `title` | string | Yes | Job title |
| `url` | string | No | URL to the job posting |
| `role_id` | string | No | Identifier for matching role data |
| `status` | string | No | Application status (default: `applied`) |
| `score` | number | No | Compatibility score, 0–100 |
| `notes` | string | No | Free-text notes |
| `cover_letter_draft` | string | No | Cover letter draft text |
| `applied_at` | string | No | ISO 8601 timestamp (default: current time) |

**Status values:** `applied`, `screen`, `interview`, `offer`, `rejected`, `withdrawn`

**Example:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Acme Corp",
    "title": "Staff Engineer",
    "url": "https://jobs.acme.com/staff-engineer",
    "status": "applied"
  }' \
  https://damilola.tech/api/v1/log-application
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "company": "Acme Corp",
    "title": "Staff Engineer",
    "applied_at": "2026-04-28T12:00:00.000Z",
    "status": "applied",
    "score": null,
    "url": "https://jobs.acme.com/staff-engineer",
    "cover_letter_draft": null
  }
}
```

**Note:** The 201 response returns a subset of the stored record — `role_id`, `notes`, `created_at`, and `updated_at` are intentionally omitted. Use `GET /api/v1/log-application` or `GET /api/v1/applications` to retrieve the full record.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing `company` or `title`, invalid `status`, `score` out of 0–100 range, invalid `applied_at` format |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 429 | `RATE_LIMITED` | IP rate limit exceeded (100 req/min); see `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Storage failure |

---

#### GET /api/v1/log-application

List job applications with optional filters. The `stage` parameter is a pipeline-friendly alias for `status`. Use this endpoint when filtering by recency (`since`) or by pipeline stage. For company name search or offset-based pagination, use `GET /api/v1/applications` instead.

**Authentication:** API key required

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `stage` | string | — | Filter by status (alias for `status`); takes precedence over `status` if both are provided |
| `status` | string | — | Filter by status |
| `since` | string | — | ISO 8601 timestamp; return only applications with `applied_at ≥ since` |
| `limit` | number | 50 | Max results, 1–100 |

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://damilola.tech/api/v1/log-application?stage=interview&limit=20"
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "company": "Acme Corp",
        "title": "Staff Engineer",
        "url": "https://jobs.acme.com/staff-engineer",
        "role_id": null,
        "applied_at": "2026-04-28T12:00:00.000Z",
        "status": "interview",
        "score": 72,
        "notes": null,
        "cover_letter_draft": null,
        "created_at": "2026-04-28T12:00:00.000Z",
        "updated_at": "2026-04-28T12:00:00.000Z"
      }
    ],
    "total": 1,
    "limit": 20
  }
}
```

`total` is the full count of records matching the filters, before the `limit` is applied. If `total` exceeds `limit`, additional records exist but this endpoint has no pagination — results are silently truncated at the `limit` ceiling (max 100). Use `GET /api/v1/applications` with `offset` if you need to page through more than 100 records.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid `status`/`stage` value, invalid `since` format |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 429 | `RATE_LIMITED` | IP rate limit exceeded (100 req/min); see `Retry-After` header |

---

#### GET /api/v1/applications

List job applications with pagination and company name filtering. Ordered by `applied_at` descending. Use this endpoint when you need company name search or need to page past 100 records. For recency filtering (`since`) or pipeline stage filtering with the `stage` alias, use `GET /api/v1/log-application` instead.

**Authentication:** API key required

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | — | Filter by application status |
| `company` | string | — | Case-insensitive substring match on company name |
| `limit` | number | 50 | Max results per page, 1–100 |
| `offset` | number | 0 | Number of records to skip |

**Example:**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://damilola.tech/api/v1/applications?status=applied&limit=10&offset=0"
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "company": "Acme Corp",
        "title": "Staff Engineer",
        "url": "https://jobs.acme.com/staff-engineer",
        "role_id": null,
        "applied_at": "2026-04-28T12:00:00.000Z",
        "status": "applied",
        "score": null,
        "notes": null,
        "cover_letter_draft": null,
        "created_at": "2026-04-28T12:00:00.000Z",
        "updated_at": "2026-04-28T12:00:00.000Z"
      }
    ],
    "total": 14,
    "limit": 10,
    "offset": 0
  }
}
```

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid `status` value |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 429 | `RATE_LIMITED` | IP rate limit exceeded (100 req/min); see `Retry-After` header |

---

### Job Scoring & Cover Letters

#### POST /api/v1/score-job

Score a job posting against the stored resume and return a gap analysis. `url` is always required and is used for logging and metadata. Supply `job_content` to bypass the server-side URL fetch (useful when the page is client-side-rendered or behind auth). Use the output as `score_job_output` in `generate-cover-letter` for best fit context.

**Authentication:** API key required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL of the job posting (http/https) |
| `title` | string | Yes | Job title |
| `company` | string | Yes | Company name |
| `job_content` | string | No | Pre-fetched job description text (bypasses URL fetch; max 200KB) |

**Example:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://jobs.acme.com/staff-engineer",
    "title": "Staff Engineer",
    "company": "Acme Corp"
  }' \
  https://damilola.tech/api/v1/score-job
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "company": "Acme Corp",
    "title": "Staff Engineer",
    "url": "https://jobs.acme.com/staff-engineer",
    "currentScore": {
      "total": 72,
      "breakdown": {
        "roleRelevance": 22,
        "claritySkimmability": 21,
        "businessImpact": 18,
        "presentationQuality": 11
      },
      "matchedKeywords": ["TypeScript", "distributed systems", "team leadership"],
      "missingKeywords": ["Kubernetes", "Go", "SRE"],
      "matchRate": 68,
      "keywordDensity": 3.2
    },
    "maxPossibleScore": 88,
    "gapAnalysis": "The resume demonstrates strong alignment on TypeScript and team leadership...",
    "recommendation": "full_generation_recommended"
  }
}
```

**`recommendation` values:**

| Value | Meaning |
|-------|---------|
| `strong_fit` | Gap < 5 points — resume is likely strong as-is |
| `marginal_improvement` | Gap 5–15 points — targeted tweaks recommended |
| `full_generation_recommended` | Gap > 15 points — full resume generation advised |

When the job posting URL returns a client-side-rendered page with no extractable content, scoring proceeds from title, company, and URL slug. The response includes `"emptyShellFallback": true` in that case.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `BAD_REQUEST` | Invalid or unreachable URL, `job_content` exceeds 200KB |
| 400 | `VALIDATION_ERROR` | Missing required fields, invalid types |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 429 | `RATE_LIMITED` | IP rate limit exceeded (100 req/min) or AI backend rate limit reached; see `Retry-After` header |
| 500 | `INTERNAL_ERROR` | AI service error |

---

#### POST /api/v1/generate-cover-letter

Generate a targeted cover letter using the stored resume, STAR stories, and leadership philosophy. Pass `score_job` output for best fit context. Generation may take up to 90 seconds.

**Authentication:** API key required

**Request Body:**

Exactly one of `job_posting_url` or `job_posting_text` is required.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_posting_url` | string | One of | URL of the job posting |
| `job_posting_text` | string | One of | Raw job posting text (use when URL fetch is blocked) |
| `score_job_output` | string | No | JSON string from `POST /api/v1/score-job` (improves fit targeting) |
| `tone` | string | No | `confident` (default), `warm`, or `technical` |
| `company` | string | No | Company name (for output metadata) |
| `role` | string | No | Role title (for output metadata) |

**Example (URL input):**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "job_posting_url": "https://jobs.acme.com/staff-engineer",
    "tone": "confident",
    "company": "Acme Corp",
    "role": "Staff Engineer"
  }' \
  https://damilola.tech/api/v1/generate-cover-letter
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "cover_letter_markdown": "---\ncompany: Acme Corp\nrole: Staff Engineer\nscore_job_fit: 72\n---\n\nDear Hiring Manager...",
    "metadata": {
      "company": "Acme Corp",
      "role": "Staff Engineer",
      "generated_at": "2026-04-28T12:00:00.000Z",
      "model": "claude-sonnet-4-6",
      "input_source": "url",
      "score_job_used": true,
      "token_usage": {
        "input": 8400,
        "output": 620,
        "cache_read": 7800
      }
    }
  }
}
```

The `cover_letter_markdown` field contains YAML frontmatter (`company`, `role`, `score_job_fit`) followed by the letter body in Markdown.

**Note on `token_usage` key style:** This endpoint uses snake_case keys (`input`, `output`, `cache_read`) under `token_usage`, which differs from other endpoints that use camelCase under `usage` (e.g., `inputTokens`, `cacheReadTokens`). This is an implementation-level divergence; the fields map directly to Anthropic's `usage.input_tokens`, `usage.output_tokens`, and `usage.cache_read_input_tokens`.

**Error Responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 400 | `BAD_REQUEST` | Both or neither of `job_posting_url`/`job_posting_text` provided, invalid URL |
| 400 | `VALIDATION_ERROR` | Invalid `tone` value |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 429 | `RATE_LIMITED` | IP rate limit exceeded (100 req/min) or AI backend rate limit reached; see `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Template unavailable, AI error, generation timeout (>90s) |

---

## MCP Tools

The `damilola.tech` MCP server exposes the following tools for use in Claude AI sessions. See `.mcp.json` in the repo root for server configuration.

### `generate_cover_letter`

Generate a targeted cover letter for a job posting. Uses `score_job` output for fit context when provided.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_posting_url` | string (URL) | One of | URL of the job posting |
| `job_posting_text` | string | One of | Raw job posting text when URL fetch is blocked |
| `score_job_output` | string | No | JSON output from the `score_job` tool (recommended) |
| `tone` | `confident` \| `warm` \| `technical` | No | Tone of the letter (default: `confident`) |
| `company` | string | No | Company name for output metadata |
| `role` | string | No | Role title for output metadata |

**Returns:** JSON object matching the `POST /api/v1/generate-cover-letter` response shape.

---

### `score_job`

Score a job posting against Damilola's resume for fit and readiness. Mirrors `POST /api/v1/score-job`. Pass the full JSON output to `generate_cover_letter` as `score_job_output` for best results.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string (URL) | Yes | Job posting URL (http/https) |
| `title` | string | Yes | Job title |
| `company` | string | Yes | Company name |

**Returns:** JSON object matching the `POST /api/v1/score-job` response shape. Pass the full stringified output as `score_job_output` to `generate_cover_letter` for fit-aware generation.

## Rate Limits

All `/api/v1/*` routes — including API-key-authenticated endpoints — are subject to global rate limiting enforced at the middleware layer before any endpoint handler runs.

| Field | Value |
|-------|-------|
| Scope | All `/api/v1/*` routes |
| Limit | 100 requests per minute |
| Per | IP address |
| Algorithm | Fixed-window via Upstash Redis (`INCR` + `EXPIRE` pipeline) |
| Fail-open | Yes — when Redis is unavailable, requests pass through |

When the limit is exceeded, the server responds with HTTP `429`. The `Retry-After` header is always present on `429` responses and contains the number of seconds remaining until the current one-minute window resets.

**Error Response (429):**

```json
{
  "error": "Too many requests. Please try again later."
}
```

**Response Headers:**

```http
Retry-After: <seconds until current window resets>
```

**Fail-Open Behavior:**

If Upstash Redis is unreachable, the middleware skips rate limiting and the request passes through. Rate limiting is never a hard dependency — Redis unavailability does not block traffic.

## Security Best Practices

1. **Never expose API keys** in client-side code or public repositories
2. **Use HTTPS only** - all API endpoints require HTTPS
3. **Rotate keys periodically** - create new keys and revoke old ones
4. **Use descriptive names** - name keys by their purpose (e.g., "OpenClaw Production")
5. **Monitor usage** - check the Admin Portal's audit log for API access patterns
6. **Revoke compromised keys** immediately if a key is exposed

## Example Usage

### Python

```python
import requests

API_KEY = "YOUR_API_KEY"
BASE_URL = "https://damilola.tech/api/v1"

headers = {"Authorization": f"Bearer {API_KEY}"}

# Get stats
response = requests.get(f"{BASE_URL}/stats", headers=headers)
stats = response.json()
print(f"Total chats: {stats['data']['chats']['total']}")

# Run fit assessment
response = requests.post(
    f"{BASE_URL}/fit-assessment",
    headers=headers,
    json={"input": "https://example.com/job-posting"}
)
assessment = response.json()
print(assessment['data']['assessment'])
```

### JavaScript/Node.js

```javascript
const API_KEY = "YOUR_API_KEY";
const BASE_URL = "https://damilola.tech/api/v1";

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

// Get stats
const statsRes = await fetch(`${BASE_URL}/stats`, { headers });
const stats = await statsRes.json();
console.log(`Total chats: ${stats.data.chats.total}`);

// Chat with AI
const chatRes = await fetch(`${BASE_URL}/chat`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    messages: [{ role: "user", content: "What is your experience with AWS?" }]
  })
});
const chat = await chatRes.json();
console.log(chat.data.message.content);
```

### cURL

```bash
# Get stats
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://damilola.tech/api/v1/stats

# List chats
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://damilola.tech/api/v1/chats?limit=10"

# Run fit assessment
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": "https://example.com/job-posting"}' \
  https://damilola.tech/api/v1/fit-assessment

# Chat with AI
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is your experience with AWS?"}]}' \
  https://damilola.tech/api/v1/chat
```

## Audit Tracking

All API access is logged in the audit trail with:

- `accessType: "api"` - distinguishes from browser access
- `apiKeyId` - the ID of the API key used
- `apiKeyName` - the name of the API key used

View API access in the Admin Portal's Audit Log by filtering for "Access Type: API".
