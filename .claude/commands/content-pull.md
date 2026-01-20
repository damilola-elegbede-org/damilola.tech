---
name: content-pull
description: Pull content files from Vercel Blob to .tmp/content
---

# Content Pull

Pull all content files from Vercel Blob to local `.tmp/content/` directory.

## Steps
1. Create `.tmp/content/` directory if it doesn't exist
2. Fetch all content files from blob base URL
3. Save to local directory for editing/analysis

## Prerequisites
- BLOB_READ_WRITE_TOKEN must be set in `.env.local`

## Implementation

Run the TypeScript script which dynamically lists and downloads all files from blob storage:

```bash
npm run content:pull
```

Or directly:

```bash
npx tsx scripts/content-pull.ts
```

The script uses `@vercel/blob`'s `list()` function to discover all files in the
`damilola.tech/content/` prefix - no hardcoded file list required.
