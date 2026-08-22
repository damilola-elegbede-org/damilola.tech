## Root cause

The production probe recorded: `500 INTERNAL_ERROR: "AI service error."` for the 6,399-character Google JD, `3 of 3 attempts`, while the 3,961-character NVIDIA JD succeeded. The shipped scorer documents the causal fan-out: `Promise.all over 5 dimension calls plus 3 corpus calls put EIGHT concurrent Opus requests in flight.` The live Ascent snapshot was readable; its 44 JDs have nearest-rank P95 of 9,386 characters (and the Google fixture is exactly 6,399).

## Fix

No production logic was changed: the branch already contains the requested `ATS_CALL_CONCURRENCY = 3`, attribution, ceiling, and resume-gap fixes. Added hermetic coverage for the 9,386-character envelope, tracked in-flight client calls, NVIDIA corpus attribution (`projects-context.md`), pastry G1 negative control, and a verbatim-evidence Fit experience score of 40. Both v1 routes now exercise a P95-sized Google-shaped input and assert HTTP 200. Registered the fixture suite in `.github/workflows/score-job-regression.yml` without ripgrep.

## Tests

Baseline before edits:

```
Test Files  154 passed | 2 skipped (156)
Tests  2703 passed | 24 skipped (2727)
```

Mutation (temporarily changed `ATS_CALL_CONCURRENCY` from 3 to 8; real exit was 1):

```
FAIL ... keeps the P95 Google-size ATS fan-out bounded
AssertionError: expected 5 to be less than or equal to 3
Test Files  1 failed (1)
Tests  1 failed | 2 passed (3)
EXIT=1
```

After restore:

```
npx vitest run
Test Files  155 passed | 2 skipped (157)
Tests  2708 passed | 24 skipped (2732)

npx tsc --noEmit -p tsconfig.json
EXIT=0

npx eslint src tests scripts
0 errors, 12 pre-existing warnings
```

`npm run build` did not reach Next build: its prebuild `tsx` process failed with `Error: listen EPERM: operation not permitted ... /tsx-501/...pipe` in this headless sandbox. This is environmental, not a test/build diagnostic from the repository.

The new regression did not exist on `origin/main`, so it cannot be executed there verbatim. Its mutation proves the load-bearing assertion is red when the bounded-concurrency fix is broken; the branch diff establishes that origin/main's scorer predates the `mapWithLimit` change.

## Residual risk

The route status tests are hermetic route-contract tests and mock external model calls; they cannot prove Anthropic's production capacity at P95. The P95 fixture preserves observed input size, not the externally scraped prose. Full production build remains unverified because the sandbox prohibits tsx IPC sockets.

## Out of scope found

`npx eslint src tests scripts` reports 12 existing warnings (unused symbols) and no errors. The Ascent snapshot has no retained NVIDIA JD text (`jd: null`) for the named role, so its test uses the role’s required agentic-infrastructure wording and corpus evidence rather than inventing scraped content.
