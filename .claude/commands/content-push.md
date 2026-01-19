# Content Push

Push local `.tmp/content/` files to Vercel Blob storage.

## Steps
1. Read files from `.tmp/content/`
2. Upload to Vercel Blob using @vercel/blob SDK
3. Requires BLOB_READ_WRITE_TOKEN in .env.local

## Usage
Run `npm run content:push` after editing content files locally to sync changes to production.

## Prerequisites
- BLOB_READ_WRITE_TOKEN must be set in `.env.local`
- Content files must exist in `.tmp/content/`
