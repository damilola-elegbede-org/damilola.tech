# Deployment Guide

Complete guide for deploying damilola.tech to production on Vercel.

## Overview

This application is designed to run on Vercel with the following services:

- **Vercel Platform** - Hosting, serverless functions, edge network
- **Vercel Blob** - File storage for content and archives
- **Upstash Redis** - Distributed rate limiting state
- **Anthropic API** - AI model inference

## Prerequisites

- GitHub account with repository access
- Vercel account (free or paid)
- Anthropic API account
- Upstash account (optional but recommended)
- Domain name (optional)

## Environment Variables

### Required Variables

```bash
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...
# Get from: https://console.anthropic.com/settings/keys

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
# Auto-injected when you connect Vercel Blob to project

# Admin Authentication - Preview/Development
ADMIN_PASSWORD_PREVIEW=your_preview_password
# Used in preview deployments and local development

# Admin Authentication - Production
ADMIN_PASSWORD_PRODUCTION=your_production_password
# Used in production deployment only
# MUST be different from preview password

# JWT Signing Secret
JWT_SECRET=base64_encoded_secret
# Generate with: openssl rand -base64 32
```

### Optional Variables

```bash
# Upstash Redis (Recommended for Production)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
# Without these, rate limiting uses in-memory storage

# Playwright E2E Testing
PLAYWRIGHT_BASE_URL=https://your-deployment.vercel.app
VERCEL_AUTOMATION_BYPASS_SECRET=your_bypass_secret
# For automated testing of deployed preview/production

# Google Search Console verification token
GOOGLE_SITE_VERIFICATION=your_verification_token
# Enables <meta name="google-site-verification"> in page <head>
```

### Variable Security

- **Never commit** `.env.local` or `.env.production` to git
- **Store production secrets** only in Vercel dashboard
- **Use different passwords** for production vs preview
- **Rotate secrets** if exposed
- **Use environment-specific** Upstash Redis instances

## Vercel Setup

### 1. Connect GitHub Repository

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import `damilola-elegbede/damilola.tech` repository
4. Configure project settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** `npm run build` (uses prebuild hook)
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

### 2. Configure Environment Variables

In Vercel Project Settings > Environment Variables:

**Production Environment:**

```text
ANTHROPIC_API_KEY           = sk-ant-api03-...         [Production]
ADMIN_PASSWORD_PRODUCTION   = strong_password          [Production]
JWT_SECRET                  = your_jwt_secret          [Production]
```

**Preview Environment:**

```text
ANTHROPIC_API_KEY           = sk-ant-api03-...         [Preview]
ADMIN_PASSWORD_PREVIEW      = preview_password         [Preview]
JWT_SECRET                  = your_jwt_secret          [Preview]
```

**All Environments:**

```text
UPSTASH_REDIS_REST_URL      = https://...             [All]
UPSTASH_REDIS_REST_TOKEN    = your_token              [All]
```

**Note:** `BLOB_READ_WRITE_TOKEN` is automatically injected when you connect Vercel Blob storage.

### 3. Connect Vercel Blob Storage

1. Navigate to [Storage Tab](https://vercel.com/dashboard/stores) in Vercel Dashboard
2. Click "Create Database" > "Blob"
3. Name your store: `damilola-tech-blob`
4. Click "Connect to Project"
5. Select your project
6. Confirm connection

This automatically adds `BLOB_READ_WRITE_TOKEN` to your environment variables.

### 4. Set Up Custom Domain (Optional)

1. Navigate to Project Settings > Domains
2. Add `damilola.tech` and `www.damilola.tech`
3. Configure DNS records at your domain registrar:

```text
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

4. Wait for DNS propagation (can take up to 48 hours)

### 5. Configure Build Settings

In Project Settings > General:

- **Node.js Version:** 20.x
- **Framework:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

**Build & Development Settings:**

- **Ignore Build Step:** No (build every commit)
- **Automatically expose System Environment Variables:** Yes

## Upstash Redis

### Setup

1. Sign up at [Upstash Console](https://console.upstash.com/)
2. Create new Redis database:
   - **Name:** `damilola-tech-ratelimit`
   - **Type:** Regional (for lower latency) or Global (for multi-region)
   - **Region:** Choose closest to your Vercel functions (usually US East)
   - **TLS:** Enabled
3. Copy credentials:
   - **REST URL:** `https://your-redis.upstash.io`
   - **REST Token:** Your token string
4. Add to Vercel environment variables (see above)

### Create Separate Instances (Recommended)

For better isolation:

```text
damilola-tech-prod-ratelimit    # Production traffic
damilola-tech-preview-ratelimit # Preview deployments
```

Configure environment-specific variables in Vercel.

### Pricing

- **Free Tier:** 10,000 commands/day (sufficient for development)
- **Pay-as-you-go:** $0.20 per 100,000 commands
- **Fixed:** $10/month for 1 million commands

Monitor usage in Upstash dashboard.

## Anthropic API

### Setup

1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys
3. Create new API key
4. Copy key (starts with `sk-ant-api03-`)
5. Add to Vercel environment variables

### Model Configuration

Application uses:
- `claude-sonnet-4-6` for chat conversations and fit assessments
- `claude-opus-4-6` for resume generation and scoring

### Pricing

- **Sonnet 4.5:** $3 per 1M input tokens, $15 per 1M output tokens
- **Prompt Caching:** 90% discount on cached prompts
- **Monitor costs:** [Usage Dashboard](https://console.anthropic.com/settings/usage)

### Cost Optimization

- Prompt caching reduces repeated system prompt costs
- Max tokens limits prevent runaway generation
- Rate limiting reduces abuse
- Conversation compaction manages context length

## Content Initialization

### Upload Initial Content

Before first deployment, upload content to Vercel Blob:

```bash
# Set environment variables locally
export BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Upload content from career-data submodule
npm run content:push

# Upload base resume
npm run resume:push
```

This uploads:

- System prompts and instructions
- STAR stories and examples
- Resume data
- Fit assessment examples

### Verify Upload

Check Vercel Blob storage in dashboard:

```text
damilola.tech/
├── instructions/
├── templates/
├── context/
├── data/
└── resume/
```

## Deployment Process

### Automatic Deployment (Recommended)

1. Push to `main` branch:

```bash
git push origin main
```

2. Vercel automatically:
   - Detects the push
   - Runs build process
   - Generates system prompts
   - Deploys to production
   - Updates custom domain

3. Monitor deployment in Vercel dashboard

### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Preview Deployments

Every pull request automatically creates a preview deployment:

- Unique URL: `https://damilola-tech-git-[branch]-[account].vercel.app`
- Uses preview environment variables
- Full functionality including admin portal
- Isolated from production data

## Post-Deployment

### 1. Verify Deployment

**Health Checks:**

```bash
# Check homepage
curl https://damilola.tech/

# Test chat API (should return rate limit after 50 requests)
curl -X POST https://damilola.tech/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"sessionId":"test","sessionStartedAt":"2024-01-15T14:30:00Z"}'

# Check admin portal (should redirect to login)
curl -I https://damilola.tech/admin/dashboard
```

**Expected Status Codes:**

- Homepage: 200
- Chat API: 200 (streaming response)
- Admin Dashboard (unauthenticated): 307 (redirect to login)

### 2. Test Admin Portal

1. Navigate to `https://damilola.tech/admin/login`
2. Enter production password
3. Verify dashboard loads with metrics
4. Check each section:
   - Dashboard
   - Traffic (should show recent visitors)
   - Chats (may be empty initially)
   - Fit Assessments (may be empty initially)
   - Resume Generator (test generation)
   - Audit Log (should show page views)

### 3. Test Rate Limiting

**Chat API:**

```bash
# Should succeed (50 times)
for i in {1..50}; do
  curl -X POST https://damilola.tech/api/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Test"}],"sessionId":"test-'$i'","sessionStartedAt":"2024-01-15T14:30:00Z"}'
done

# Should return 429 (rate limited)
curl -X POST https://damilola.tech/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Test"}],"sessionId":"test-51","sessionStartedAt":"2024-01-15T14:30:00Z"}'
```

### 4. Monitor Logs

```bash
# View real-time logs
vercel logs --follow

# Filter by function
vercel logs --follow --limit 50
```

**Watch for:**

- Rate limit events
- Redis connection errors
- Anthropic API errors
- Authentication failures
- Blob storage errors

### 5. Set Up Monitoring

**Vercel Analytics:**

- Enable in Project Settings > Analytics
- Monitor page views, performance, and errors

**Upstash Monitoring:**

- Check Redis commands/second
- Monitor memory usage
- Set up alerts for high usage

**Anthropic Monitoring:**

- Track token usage and costs
- Set up budget alerts
- Monitor API error rates

## Updating Deployment

### Code Changes

```bash
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin main

# Vercel automatically deploys
```

### Content Changes

```bash
# Update content in career-data/ submodule
cd career-data
# ... make changes ...

# Commit submodule changes
npm run content:commit

# Commit main repo
git commit -m "docs: update career data"

# Push content to blob
npm run content:push

# Push code (triggers rebuild)
git push origin main
```

### Environment Variable Changes

1. Update in Vercel dashboard
2. Redeploy to apply changes:

```bash
vercel --prod
```

## Rollback

### Revert to Previous Deployment

In Vercel Dashboard:

1. Navigate to Deployments
2. Find previous successful deployment
3. Click "..." menu > "Promote to Production"
4. Confirm promotion

### Rollback Content

```bash
# Restore previous content version
npm run content:pull  # Downloads current blob content

# Manually restore from git history
cd career-data
git log --oneline
git checkout <previous-commit>

# Push restored content
cd ..
npm run content:push
```

## Troubleshooting

### Build Failures

**Error: "BLOB_READ_WRITE_TOKEN not found"**

1. Verify Vercel Blob is connected to project
2. Check environment variables include token
3. Redeploy to refresh environment

**Error: "Failed to generate system prompt"**

1. Check content exists in Vercel Blob
2. Run `npm run content:push` locally
3. Verify blob token has read permissions

### Runtime Errors

**Error: "Unauthorized" in admin portal**

1. Verify JWT_SECRET is set
2. Check admin password matches environment
3. Clear cookies and try again

**Error: "Redis connection failed"**

1. Verify Upstash credentials are correct
2. Check Redis instance is active
3. Application falls back to in-memory (check logs)

**Error: "Rate limit not working"**

1. Check Upstash Redis connection
2. Verify environment variables
3. Test with different IP addresses

### Performance Issues

**Slow page loads:**

1. Check Vercel Analytics for bottlenecks
2. Review Next.js build output for large bundles
3. Enable Edge caching for static assets

**High API costs:**

1. Check Anthropic usage dashboard
2. Verify rate limiting is working
3. Review conversation lengths (compaction should prevent runaway costs)

**Redis performance:**

1. Monitor commands/second in Upstash
2. Check memory usage
3. Consider upgrading Upstash tier

## Security Checklist

- [ ] Strong production admin password (20+ characters)
- [ ] Different passwords for production vs preview
- [ ] JWT_SECRET is random and secure (32+ bytes)
- [ ] Upstash Redis uses TLS
- [ ] Vercel Blob access tokens are not exposed
- [ ] Environment variables are not committed to git
- [ ] Rate limiting is enabled and working
- [ ] Admin portal login rate limit tested
- [ ] CORS settings restrict API access (if configured)
- [ ] Audit log captures all sensitive actions

## Performance Checklist

- [ ] Vercel Analytics enabled
- [ ] Prompt caching working (check Anthropic dashboard)
- [ ] Redis connection successful (no circuit breaker logs)
- [ ] Build time under 2 minutes
- [ ] First contentful paint under 1 second
- [ ] Admin portal loads under 2 seconds
- [ ] Chat responses start streaming immediately
- [ ] Blob storage latency under 100ms

## Cost Optimization

### Vercel

- **Free Tier:**
  - 100GB bandwidth/month
  - 100GB-hours serverless function execution
  - Sufficient for personal project

- **Monitor:**
  - Bandwidth usage
  - Function invocations
  - Build minutes

### Upstash Redis

- **Free Tier:** 10,000 commands/day
- **Optimization:**
  - Set appropriate TTLs
  - Clean up expired keys
  - Monitor peak usage times

### Anthropic

- **Cost Factors:**
  - Input tokens (system prompt + conversation)
  - Output tokens (AI responses)
  - Prompt caching (90% discount)

- **Optimization:**
  - Enable prompt caching (already implemented)
  - Limit max_tokens (512 for chat, 4096 for fit assessment)
  - Use conversation compaction
  - Rate limit to prevent abuse

**Expected Monthly Costs:**

- **Vercel:** $0 (free tier)
- **Upstash:** $0-10 (depending on traffic)
- **Anthropic:** $5-50 (depending on usage, caching helps significantly)

## Maintenance

### Regular Tasks

**Weekly:**

- Review Vercel analytics for traffic patterns
- Check rate limit logs for abuse attempts
- Monitor Anthropic costs and usage
- Review audit log for suspicious activity

**Monthly:**

- Update dependencies (`npm outdated`)
- Review and clean up old chat archives
- Rotate admin passwords if needed
- Check for security updates

**Quarterly:**

- Review and update rate limits based on usage
- Optimize content and prompts
- Audit access logs
- Performance tuning

## Related Documentation

- [Admin Portal Documentation](./admin-portal.md)
- [API Documentation](./api-documentation.md)
- [Rate Limiting Documentation](./rate-limiting.md)
- [Project README](../README.md)
