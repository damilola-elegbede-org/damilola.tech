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
    "model": "claude-sonnet-4-20250514",
    "usage": {
      "inputTokens": 5000,
      "outputTokens": 2000,
      "cacheReadTokens": 4500
    }
  }
}
```

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
    "model": "claude-sonnet-4-20250514",
    "usage": {
      "inputTokens": 3000,
      "outputTokens": 150,
      "cacheReadTokens": 2800
    }
  }
}
```

## Rate Limits

API key access is not rate limited. However, the underlying AI endpoints are subject to Anthropic's rate limits. If you encounter 429 responses, check the `Retry-After` header.

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
