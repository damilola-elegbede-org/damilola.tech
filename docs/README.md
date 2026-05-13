# Documentation Index

Comprehensive documentation for the damilola.tech personal career landing page and admin portal.

## Getting Started

- [Project README](../README.md) - Project overview, setup, and quick start
- [Environment Setup](./deployment.md#environment-variables) - Configure local development
- [Deployment Guide](./deployment.md) - Production deployment to Vercel

## Core Features

### Public Features

- [AI Chatbot](../README.md#ai-chatbot) - Interactive conversation system
- [Role Fit Assessment](./api-documentation.md#fit-assessment-api) - Job description analysis
- [Traffic Tracking](./admin-portal.md#traffic-analytics) - UTM parameter tracking

### Admin Portal

- [Admin Portal Overview](./admin-portal.md) - Complete admin portal guide
- [Dashboard](./admin-portal.md#dashboard) - Analytics and metrics
- [Traffic Analytics](./admin-portal.md#traffic-analytics) - Visitor source analysis
- [Chat Archive](./admin-portal.md#chat-archive) - Conversation history
- [Resume Generator](./admin-portal.md#resume-generator) - Recruiter-ready resumes
- [Audit Log](./admin-portal.md#audit-log) - Complete event trail

## Technical Documentation

### API Reference

- [API Documentation](./api-documentation.md) - Complete endpoint reference
- [Public Endpoints](./api-documentation.md#public-endpoints) - Chat and fit assessment
- [Admin Endpoints](./api-documentation.md#admin-endpoints) - Protected admin APIs
- [Rate Limiting](./api-documentation.md#rate-limiting) - Request limits and quotas
- [External API (v1)](./external-api.md) - REST API for external integrations (OpenClaw, MCP tools)
- [Resume PDF](./external-api.md#resume-pdf) - Public unauthenticated PDF download endpoint
- [Job Application Tracking](./external-api.md#job-application-tracking) - Log and query career pipeline entries
- [Job Scoring & Cover Letters](./external-api.md#job-scoring--cover-letters) - Score jobs and generate cover letters
- [MCP Tools](./external-api.md#mcp-tools) - `generate_cover_letter` and `score_job` tool reference

### Architecture

- [Content Management](../README.md#content-management) - Blob storage and submodule workflow
- [Build-Time Prompt Generation](../README.md#build-time-prompt-generation) - AI prompt assembly
- [Authentication System](./admin-portal.md#authentication) - JWT-based security
- [Rate Limiting Implementation](./rate-limiting.md) - Distributed rate limiting

### Security

- [Rate Limiting](./rate-limiting.md) - Prevent abuse and brute force attacks
- [Authentication](./admin-portal.md#security-features) - JWT and session management
- [SSRF Protection](./api-documentation.md#ssrf-protection) - URL fetching security
- [Input Validation](./api-documentation.md#input-validation) - Request sanitization

## Development

### Setup

```bash
# Clone repository
git clone --recurse-submodules git@github.com:damilola-elegbede/damilola.tech.git
cd damilola.tech

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Start development server
npm run dev
```

### Testing

```bash
# Unit tests
npm run test
npm run test:ui
npm run test:coverage

# E2E tests
npm run test:e2e
npm run test:e2e:ui

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Scripts Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build with prompt generation |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run content:pull` | Download content from Vercel Blob |
| `npm run content:push` | Upload content to Vercel Blob |
| `npm run content:commit` | Commit submodule changes |

See [README Scripts](../README.md#scripts) for complete list.

## Deployment

### Production Deployment

- [Deployment Guide](./deployment.md) - Complete deployment instructions
- [Environment Variables](./deployment.md#environment-variables) - Required configuration
- [Vercel Setup](./deployment.md#vercel-setup) - Platform configuration
- [Post-Deployment](./deployment.md#post-deployment) - Verification steps

### Services Integration

- [Vercel Blob](./deployment.md#vercel-blob-storage) - File storage setup
- [Upstash Redis](./deployment.md#upstash-redis) - Distributed rate limiting
- [Anthropic API](./deployment.md#anthropic-api) - AI model access

## Troubleshooting

### Common Issues

- [Cannot Login](./admin-portal.md#cannot-login) - Admin authentication issues
- [Traffic Data Not Showing](./admin-portal.md#traffic-data-not-showing) - Analytics problems
- [Rate Limit Not Working](./rate-limiting.md#rate-limit-not-working) - Rate limiting issues
- [Redis Performance](./rate-limiting.md#redis-performance) - Performance monitoring

### Debug Logs

```bash
# View Vercel logs
vercel logs

# Check environment
vercel env ls

# Test API endpoints locally
curl http://localhost:3000/api/chat
```

## Reference

### Project Structure

See [Project Structure](../README.md#project-structure) for complete directory layout.

### API Endpoints

See [API Documentation](./api-documentation.md) for complete endpoint reference.

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Admin Login | 5 | 15 min |
| Chat API | 50 | 5 min |
| Fit Assessment | 10 | 1 hour |
| Resume Generator | 10 | 1 hour |

See [Rate Limiting](./rate-limiting.md) for details.

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
JWT_SECRET=your_jwt_secret
ADMIN_PASSWORD_PREVIEW=preview_password
ADMIN_PASSWORD_PRODUCTION=production_password

# Optional
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

See [Deployment Guide](./deployment.md#environment-variables) for complete reference.

## Contributing

This is a personal project, but if you have suggestions or find issues:

1. Review existing documentation
2. Check troubleshooting guides
3. Search closed issues
4. Open detailed issue with reproduction steps

## Resources

### Internal Documentation

- [Project README](../README.md)
- [Admin Portal Documentation](./admin-portal.md)
- [API Documentation](./api-documentation.md)
- [Rate Limiting Documentation](./rate-limiting.md)
- [Deployment Guide](./deployment.md)
- [UTM Tracking Guide](/admin/docs/utm-tracking)

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

Private - All rights reserved
