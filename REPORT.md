## What changed

1. The score-job route now returns an independent `roleFit` object and retains the readiness scorer's complete `currentScore` payload in both branches. It computes readiness synchronously before the knockout return, keeps the Opus call skipped for knockouts, uses `buildGapAnalysisPrompt(currentScore)` for scored roles, preserves the audit fields as readiness values, and adds the typed-null `resumeGap` stub everywhere.

2. `mcp/lib/api-client.ts` now models the new `roleFit` payload using the scorer's exported types, reuses the score-resume readiness-current-score type for `currentScore`, and includes the nullable `resumeGap` contract. A repository grep found no score-job consumer reading the old role-fit breakdown through `currentScore`.

3. Scope now has a 10-point baseline for stated 6+ spans and for unquantified (not explicitly small) spans, with `span_unquantified` retained as the internal base-function flag. Explicit 2–5/small-team language scores 5, manager-of-manager and multi-team/org-25 signals add 3 each, and the result caps at 16; roadmap, staffing, and performance-practice rows were removed rather than moved.

4. The `impact` breakdown row and its defective noun/verb and startup-vocabulary heuristics were removed. Strategy is now capped at 22: its original four three-point phrase families remain, while customer/business and metrics/outcome phrases contribute up to 10 additional points. Existing worked-example assertions were updated to the amended behavior with a note that calibration is deferred.

5. Both G1 body fallback and G3's program/product-manager carve-out now require one body signal. G2 still short-circuits solely on a title-level G1 match; a test confirms an IC title mentioning a single ambiguous mentoring phrase still fails G2.

6. G5 runs only for roles resolved as US and accepts Remote-US or Boulder/Denver/Colorado; unknown geography remains fail-open and non-US roles remain solely G4 failures. Remote-US matching inspects structured location, title tail, and the first 1,500 JD characters, requiring both `remote` and an explicit US token; Santa Clara was added to the existing US hub list so its non-remote hybrid case reaches and fails G5. G6 extracts salary once during gate evaluation, rejects only stated maximum base below $230,000, and passes unstated compensation.

7. Unknown compensation now scores 7, matching the lowest passing disclosed tier, and unknown location scores 4, matching the lowest disclosed location tier. No calibration thresholds or digest/high settings changed.

8. VP/vice-president engineering patterns now share the Director/Head 24-point level tier; the former 16-point VP branch was removed.

## Table sum verification

`level 24 + scope 16 + strategy 22 + comp 12 + company 10 + location 8 + domain 8 = 100`.

## Tests

Baseline recorded in the brief: `npx vitest run` — 148 passed files, 2,795 passed tests, 12 skipped, 0 failed.

After changes, verbatim completion summary from `npx vitest run`:

```text
Test Files  148 passed (148)
     Tests  2812 passed | 12 skipped (2824)
  Duration  10.65s
```

Verbatim `npx tsc --noEmit` output (exit 2):

```text
src/app/layout.tsx(5,27): error TS2307: Cannot find module '@vercel/analytics/next' or its corresponding type declarations.
src/app/layout.tsx(6,31): error TS2307: Cannot find module '@vercel/speed-insights/next' or its corresponding type declarations.
```

Verbatim `npm run lint` completion summary (exit 0):

```text
> damilola.tech@0.1.0 lint
> eslint

✖ 16 problems (0 errors, 16 warnings)
```

The 16 lint warnings are pre-existing unused-variable warnings in unrelated e2e, scripts, tests, and `readiness-scorer.ts` files; no errors were emitted.

## Residual risk

G5's deterministic text matching can still have false positives or negatives on unusual real-world location prose, and no live posting corpus was available in this headless run. The typecheck cannot complete until the existing missing Vercel package declarations/dependencies are restored. Threshold recalibration remains intentionally deferred, so changed totals should be validated through the post-merge full rescore rather than tuned against legacy anchors.

## Out of scope found

Left untouched: the `scoreDomain` out-of-vertical `let best = 2` floor; the Trident/Python rejection ledger; real `resumeGap` computation (only the required typed null stub ships); `SCORE_DIGEST`, `SCORE_HIGH`, and all calibration thresholds; VP Engineering's continued eligibility as a passing role; the existing non-remote scoring dock; `.claude/`, `CLAUDE.md`, `.env*`, identity/credential files, and `career-data/`. The pre-existing untracked `BRIEF.md` was also left untouched and will not be committed.
