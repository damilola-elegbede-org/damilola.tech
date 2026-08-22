/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

// score-core creates its client at import time.  This deliberately delayed fake
// makes a Promise.all regression observable as a peak of eight, not just a
// quicker test run.
let inFlight = 0;
let peakInFlight = 0;
const mockCreate = vi.fn(async () => {
  inFlight++;
  peakInFlight = Math.max(peakInFlight, inFlight);
  await new Promise((resolve) => setTimeout(resolve, 5));
  inFlight--;
  return { content: [{ type: 'text', text: JSON.stringify({
    band: 'exemplary',
    resumeQuote: 'Built a data platform with 8,400 lines across 6 services and 3 deploy workflows.',
    jdQuote: 'infrastructure requirements',
  }) }] };
});
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: () => mockCreate() }; },
}));

import { buildCorpusDocument, type CareerCorpus } from '@/lib/career-corpus';
import { scoreAts } from '@/lib/score-core';
import { scoreExperienceDimensions } from '@/lib/fit-experience';
import { evaluateFitScore } from '@/lib/fit-score';
import { PASTRY_JD } from '@/lib/__tests__/fixtures/probe-jds';

const AGENTIC_EVIDENCE = 'Built a data platform with 8,400 lines across 6 services and 3 deploy workflows.';
const CORPUS: CareerCorpus = {
  sources: [
    { file: 'resume.txt', text: 'Engineering manager.', words: 2 },
    { file: 'projects-context.md', text: AGENTIC_EVIDENCE, words: 14 },
  ],
  totalWords: 16,
  document: buildCorpusDocument([
    { file: 'resume.txt', text: 'Engineering manager.', words: 2 },
    { file: 'projects-context.md', text: AGENTIC_EVIDENCE, words: 14 },
  ]),
};

// P95 from Clara's 2026-08-21 Ascent snapshot: 44 JDs, nearest-rank P95 =
// 9,386 characters. The Google failure fixture (6,399 chars) is therefore a
// floor, not the load envelope this regression protects.
const P95_GOOGLE_JD = `Software Engineering Manager II, Infrastructure, Google Cloud. infrastructure requirements. ${'large-scale infrastructure requirements. '.repeat(400)}`.slice(0, 9386);
const NVIDIA_JD = 'Manager, CI/CD Infrastructure — Open Source Accelerated Computing. infrastructure requirements.';

describe('ENG-2010 fixture regressions', () => {
  it('keeps the P95 Google-size ATS fan-out bounded and preserves corpus attribution for NVIDIA', async () => {
    inFlight = 0;
    peakInFlight = 0;
    const google = await scoreAts(P95_GOOGLE_JD, CORPUS);
    expect(P95_GOOGLE_JD).toHaveLength(9386);
    expect(google.max.total).toBeGreaterThan(google.current.total);
    // There are five current and three corpus calls. A return to Promise.all
    // makes this 8; the production limit is intentionally 3.
    expect(peakInFlight).toBeLessThanOrEqual(3);

    const nvidia = await scoreAts(NVIDIA_JD, CORPUS);
    expect(nvidia.max.breakdown.some((d) =>
      (d as typeof d & { ceilingSourceFile?: string | null }).ceilingSourceFile === 'projects-context.md'
    )).toBe(true);
  });

  it('keeps the pastry negative control gated and does not manufacture ATS headroom', async () => {
    const fit = evaluateFitScore({ title: 'Pastry Chef', jobDescription: PASTRY_JD }, 'Artisan Bakery', []);
    expect(fit.gateFailed).toContain('G1_no_mgmt_signal');
    expect(fit.breakdown.experience).toBe(0);
  });

  it('awards all 40 experience points when every requirement has verbatim corpus evidence', async () => {
    const client = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({
      band: 'exemplary', resumeQuote: AGENTIC_EVIDENCE, jdQuote: 'agentic AI platform',
    }) }] }) } };
    const jd = 'Engineering Manager for an agentic AI platform. Remote in the US. $350,000 - $400,000.';
    const dimensions = await scoreExperienceDimensions(CORPUS, jd, { client });
    const fit = evaluateFitScore({ title: 'Engineering Manager, Infrastructure', jobDescription: jd }, 'NVIDIA', dimensions);
    expect(fit.breakdown.experience).toBe(40);
  });
});
