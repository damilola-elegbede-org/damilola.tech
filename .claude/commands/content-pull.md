# Content Pull

Pull all content files from Vercel Blob to local `.tmp/content/` directory.

## Steps
1. Create `.tmp/content/` directory if it doesn't exist
2. Fetch all content files from blob base URL
3. Save to local directory for editing/analysis

## Blob Config
- Base URL: https://mikya8vluytqhmff.public.blob.vercel-storage.com
- Path prefix: damilola.tech/content/
- Files: star-stories.json, verily-feedback.md, anecdotes.md, shared-context.md,
  chatbot-instructions.md, fit-assessment-instructions.md, leadership-philosophy.md,
  technical-expertise.md, ai-context.md

## Usage
Run `npm run content:pull` to download all content files from Vercel Blob to `.tmp/content/`.
