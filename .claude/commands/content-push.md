---
name: content-push
description: Push .tmp/content files to Vercel Blob storage
---

# Content Push

Push local `.tmp/content/` files to Vercel Blob storage.

## Steps
1. Read files from `.tmp/content/`
2. Upload to Vercel Blob using @vercel/blob SDK
3. Requires BLOB_READ_WRITE_TOKEN in .env.local

## Implementation

Run the TypeScript script which handles checksum comparison and upload:

```bash
npx tsx scripts/content-push.ts
```

Or use the npm script:

```bash
npm run content:push
```

## Prerequisites
- BLOB_READ_WRITE_TOKEN must be set in `.env.local`
- Content files must exist in `.tmp/content/`
