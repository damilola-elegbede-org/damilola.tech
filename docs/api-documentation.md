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

### Resume Download

#### GET /api/v1/resume.pdf

Download the current resume as a PDF.

**Response:**

- **Content-Type:** `application/pdf`
- **Content-Disposition:** `attachment; filename="damilola-elegbede-resume.pdf"`
- **Cache-Control:** `no-store`
- **Body:** PDF binary

**Authentication:** None required. This is the only `/api/v1/*` endpoint that does not require an API key — it is intentionally public for visitor access from the hero CTA and nav.

**Rate Limiting:** None

**Example:**

```bash
curl -O -J https://damilola.tech/api/v1/resume.pdf
```

## Admin Endpoints

All admin endpoints require authentication. Include JWT token cookie in requests.

### Authentication

#### POST /api/admin/auth

Login to admin portal.

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
  "error": "Too many attempts. Please try again later."
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

- `days` - Number of days to include (default: 30, max: 365)

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

#### GET /api/admin/resumes

List generated resumes.

**Query Parameters:**

- `cursor` - Pagination cursor (optional)
- `limit` - Results per page (default: 100, max: 1000)

**Response:**

```json
{
  "resumes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-15T09:00:00Z",
      "jobDescription": "Engineering Manager at Acme Corp...",
      "companyName": "Acme Corp",
      "status": "applied",
      "url": "https://blob.vercel-storage.com/..."
    }
  ],
  "cursor": "next_page_token"
}
```

**Authentication:** Required

#### POST /api/admin/resume/generate

Generate recruiter-ready resume for job description.

**Request Body:**

```json
{
  "jobDescription": "Full job description text...",
  "companyName": "Acme Corp"
}
```

**Response:**

- **Content-Type:** `text/plain; charset=utf-8`
- **Transfer-Encoding:** `chunked`
- **Body:** Streaming resume content in custom format

**Authentication:** Required

**Rate Limit:** 10 requests per hour per IP

**Validation:**

- Job description required
- Max 50KB request body

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
| `/api/admin/resume/generate` | 10 | 1 hour | IP |

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
ADMIN_PASSWORD_PREVIEW=dev_password

# Optional for rate limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Related Documentation

- [Admin Portal Documentation](./admin-portal.md)
- [Rate Limiting Implementation](./rate-limiting.md)
- [Security Best Practices](./security.md)
