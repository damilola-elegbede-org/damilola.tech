# .lighthouse/

This directory holds the Lighthouse CI baseline used by `.github/workflows/lighthouse.yml`.

## baseline.json

`baseline.json` records the reference Lighthouse scores against which every Vercel preview
deployment is compared. The gate fails if **any category drops more than 10 points** from
its baseline value.

### Format

```json
{
  "performance":   <0–100>,
  "accessibility": <0–100>,
  "seo":           <0–100>
}
```

### Establishing or updating the baseline

Run Lighthouse locally against the production URL (or a representative preview), then
commit the captured scores:

```bash
npx lighthouse https://damilola.elegbede.com \
  --output json \
  --output-path /tmp/lhr.json \
  --chrome-flags="--headless=new --no-sandbox" \
  --only-categories="performance,accessibility,seo" \
  --quiet

node -e "
const lhr = require('/tmp/lhr.json');
const scores = {
  performance:   Math.round(lhr.categories.performance.score   * 100),
  accessibility: Math.round(lhr.categories.accessibility.score * 100),
  seo:           Math.round(lhr.categories.seo.score           * 100),
};
process.stdout.write(JSON.stringify(scores, null, 2) + '\n');
" > .lighthouse/baseline.json
```

Commit and push `baseline.json`. The gate activates on the next PR deployment.

### Re-triggering the check

Push a new commit to the PR branch. The `deployment_status` event fires after Vercel
deploys the preview, which re-runs the workflow automatically.

### Threshold

Any score that drops **>10 points** below the corresponding baseline value causes the
`lighthouse` commit status to turn red and blocks merge (once added as a required check
in branch protection — see ENG-331).
