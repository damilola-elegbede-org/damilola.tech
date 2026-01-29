---
name: content-ship
description: Commit and push career-data changes, stage pointer in main repo
---

# Content Ship

Commits career-data submodule changes, stages the pointer update in damilola.tech,
commits the main repo, and pushes both to remote.

## What it does

1. Stage all changes in career-data submodule
2. Commit with appropriate message (auto-generated based on changed files)
3. Push to career-data remote (origin main)
4. Stage pointer update in main repo (git add career-data)
5. Commit main repo with submodule pointer update
6. Push main repo to remote

## Implementation

```bash
npm run content:ship
```

Or directly:

```bash
npx tsx scripts/content-ship.ts
```

## After running
- Both repos are committed and pushed
- Run /content-push to sync content to Vercel Blob

## Prerequisites
- career-data submodule must be initialized
- Git must be configured with push access to both repos
