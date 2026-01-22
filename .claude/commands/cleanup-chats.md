---
name: cleanup-chats
description: Clean up old archived chat sessions from Vercel Blob
---

# Cleanup Archived Chat Sessions

Delete archived chat sessions older than the retention period from Vercel Blob storage.

Use this command for preview environments where Vercel crons don't run, or to manually
trigger cleanup in any environment.

## Usage

**Default (90-day retention, preview changes first):**
```bash
npm run cleanup:chats -- --dry-run
```

**Execute cleanup:**
```bash
npm run cleanup:chats
```

**Custom retention period:**
```bash
npm run cleanup:chats -- --days 30
```

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview what would be deleted without actually deleting |
| `--days N` | Use custom retention period (default: 90 days) |

## Prerequisites

- `BLOB_READ_WRITE_TOKEN` must be set in `.env.local`

## What This Does

1. Lists all blobs under `damilola.tech/chats/` prefix
2. Parses the timestamp from each blob's pathname
3. Deletes blobs older than the retention period
4. Reports summary of deleted/kept sessions

## Notes

- In production, this runs automatically via cron at 3 AM UTC daily
- For preview deployments, run this manually as needed
- Use `--dry-run` first to verify what will be deleted
