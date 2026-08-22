import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ATS production wiring (ENG-1996 AC10)', () => {
  it('reaches both the locked rubric and anchoring modules from production code', () => {
    const core = readFileSync(resolve(process.cwd(), 'src/lib/score-core.ts'), 'utf8');
    expect(core).toContain("from '@/lib/resume-rubric'");
    expect(core).toContain("from '@/lib/resume-anchoring'");
    expect(core).toContain('scoreAts(');
  });
});
