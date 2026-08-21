import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resumeData } from '@/lib/resume-data';

/**
 * The website renders `resumeData`. The resume generator, chatbot and fit
 * assessment render a prompt built from the career-data files. Those are two
 * separate sources of truth for one profile, and nothing forced them to agree —
 * which is how the Visa role sat on the website for four months while every
 * generated resume still ended at Verily.
 *
 * These tests bind the two together on the one fact that goes stale first: who
 * D currently works for.
 */
describe('profile current-role sync', () => {
  const currentRole = resumeData.experiences[0];
  const sharedContext = readFileSync(
    join(process.cwd(), 'career-data/templates/shared-context.md'),
    'utf-8',
  );
  const resumeFull = JSON.parse(
    readFileSync(join(process.cwd(), 'career-data/data/resume-full.json'), 'utf-8'),
  ) as { summary: string; experience: Array<{ company: string; responsibilities: string[] }> };

  it('lists the current role first, as an ongoing one', () => {
    expect(currentRole.endDate).toBe('Present');
  });

  it('names the current employer in the shared-context contact block', () => {
    // Scope to the Contact Information block, not the whole header: the
    // Professional Summary sits in the same header and also names the employer,
    // so a wider slice passes even when the contact block has gone stale.
    const block = sharedContext.split('### Contact Information')[1]?.split('###')[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toContain(currentRole.company);
    expect(block).toContain(currentRole.title);
  });

  it('names the current employer in the branding statement', () => {
    expect(resumeData.brandingStatement).toContain(currentRole.company);
  });

  it('names the current employer in the resume-full summary', () => {
    // `summary` is in the preserved-as-is set of generate-resume-json.ts, so a
    // regeneration will not fix it — it has to be edited in career-data.
    expect(resumeFull.summary).toContain(currentRole.company);
  });

  it('carries every current-role highlight through to resume-full responsibilities', () => {
    const entry = resumeFull.experience.find((e) => e.company === currentRole.company);
    expect(entry).toBeDefined();
    for (const highlight of currentRole.highlights) {
      expect(entry!.responsibilities).toContain(highlight);
    }
  });
});
