# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Contact form on `/consulting` replacing the mailto CTA — validates name, email, optional company, and message fields with rate limiting (5 req / 5 min per IP) and honeypot spam protection
- `POST /api/v1/contact` endpoint — accepts JSON contact submissions and returns a confirmation message
- `/projects/rate-limiting` case study page documenting the middleware-level rate limiting architecture

### API Reference

#### `POST /api/v1/contact`

Accepts a contact inquiry from the consulting page.

**Request body** (JSON):

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 1–100 characters |
| `email` | string | yes | valid email, ≤200 characters |
| `company` | string | no | ≤100 characters |
| `message` | string | yes | 1–2000 characters |
| `website` | string | no | honeypot — must be empty or absent |

**Rate limit:** 5 requests per 5 minutes per IP (stricter than the middleware-level 100 req/min limit).

**Responses:**

| Status | Body |
|--------|------|
| `201` | `{ success: true, data: { confirmation: string } }` |
| `400` | `{ success: false, error: { code: "VALIDATION_ERROR", message: string } }` |
| `429` | `{ success: false, error: { code: "RATE_LIMITED" } }` + `Retry-After` header |
| `500` | `{ success: false, error: { code: "INTERNAL_ERROR" } }` |
