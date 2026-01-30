---
name: cleanup-chats
description: Clean up old blob storage artifacts based on retention policies
---

# Cleanup Blob Storage Artifacts

Delete old chat sessions, audit logs, fit assessments, and other artifacts from Vercel Blob
storage based on environment-specific retention policies.

Use this command for preview environments where Vercel crons don't run, or to manually
trigger cleanup in any environment.

## Usage

**Preview changes first (dry-run):**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://damilola.tech/api/cron/cleanup-chats?dryRun=true"
```

**Execute cleanup:**
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://damilola.tech/api/cron/cleanup-chats
```

## Retention Policies

| Category | Environment | Retention |
| -------- | ----------- | --------- |
| Chats | Production | 180 days (6 months) |
| Chats | Preview | 14 days |
| Fit Assessments | All | 180 days (6 months) |
| Resume Generations | All | 365 days (1 year) |
| Audit Logs | Production | 365 days (1 year) |
| Audit Logs | Preview | 14 days |
| Audit Logs | Development | Deleted immediately |
| Development Artifacts | All | Deleted immediately |
| Empty Placeholders | All | Deleted immediately |
| Orphan Sessions | All | Deleted immediately |

## Protected Paths (Never Deleted)

These paths are protected regardless of age:
- `damilola.tech/content/` - System prompts, STAR stories, resume JSON
- `damilola.tech/resume/` - Base resume PDF (generated resumes under `resume-generations/` follow 365-day retention)
- `damilola.tech/admin-cache/` - Dashboard cache files

## What This Cleans Up

1. **Chats** - Old chat session files by environment
2. **Fit Assessments** - Old fit assessment results
3. **Resume Generations** - Old generated resume PDFs
4. **Audit Logs** - Event logs by environment (production, preview, development)
5. **Empty Placeholders** - 0-byte marker files
6. **Orphan Sessions** - Usage sessions without valid prefix (`chat-`, `fit-assessment-`, etc.)
7. **Development Artifacts** - All files under any `development/` folder

## Response Format

```json
{
  "success": true,
  "dryRun": false,
  "chats": {
    "production": { "deleted": 0, "kept": 10, "skipped": 0, "errors": 0 },
    "preview": { "deleted": 5, "kept": 2, "skipped": 0, "errors": 0 }
  },
  "fitAssessments": { "deleted": 0, "kept": 3, "skipped": 0, "errors": 0 },
  "resumeGenerations": { "deleted": 0, "kept": 1, "skipped": 0, "errors": 0 },
  "audit": {
    "production": { "deleted": 0, "kept": 100, "skipped": 0, "errors": 0 },
    "preview": { "deleted": 50, "kept": 10, "skipped": 0, "errors": 0 },
    "development": { "deleted": 20 }
  },
  "artifacts": {
    "emptyPlaceholders": { "deleted": 1 },
    "orphanSessions": { "deleted": 3 }
  },
  "totals": { "deleted": 79, "kept": 126, "skipped": 0, "errors": 0 }
}
```

## Prerequisites

- `CRON_SECRET` must be configured in Vercel environment variables
- For local testing, set `BLOB_READ_WRITE_TOKEN` in `.env.local`

## Notes

- In production, this runs automatically via cron at 3 AM UTC daily
- The blob store is shared across all environments, so production cron cleans preview/development artifacts
- Use `?dryRun=true` first to verify what will be deleted
- Preview has shorter retention (14 days) to manage E2E test noise
