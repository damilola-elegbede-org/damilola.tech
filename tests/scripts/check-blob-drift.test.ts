import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkBlobDrift } from '../../scripts/check-blob-drift';

/**
 * The drift check is only useful if it can come back clean. A checker that
 * always reports drift gets ignored within a week, which is the same outcome as
 * having no checker at all — so both directions are pinned here.
 */
describe('checkBlobDrift', () => {
  const realFetch = global.fetch;

  function serve(handler: (filename: string) => { ok: boolean; body?: string }) {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const filename = decodeURIComponent(url.split('/').pop() ?? '');
      const result = handler(filename);
      return {
        ok: result.ok,
        text: async () => result.body ?? '',
      } as Response;
    }) as typeof global.fetch;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('reports no drift when the blob serves back exactly what is on disk', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const { CONTENT_DIRS } = await import('../../src/lib/content-utils');
    serve((filename) => {
      for (const dir of CONTENT_DIRS) {
        try {
          return { ok: true, body: readFileSync(join(process.cwd(), dir, filename), 'utf-8') };
        } catch {
          continue;
        }
      }
      return { ok: false };
    });
    await expect(checkBlobDrift()).resolves.toEqual([]);
  });

  it('reports drift when a blob copy differs from disk', async () => {
    serve((filename) => ({
      ok: true,
      body: filename === 'shared-context.md' ? 'a stale profile' : readAll(filename),
    }));
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const { CONTENT_DIRS } = await import('../../src/lib/content-utils');
    function readAll(name: string): string {
      for (const dir of CONTENT_DIRS) {
        try {
          return readFileSync(join(process.cwd(), dir, name), 'utf-8');
        } catch {
          continue;
        }
      }
      return '';
    }
    const drift = await checkBlobDrift();
    expect(drift.map((d) => d.filename)).toContain('shared-context.md');
  });

  it('reports drift when a file was never published', async () => {
    serve(() => ({ ok: false }));
    const drift = await checkBlobDrift();
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.every((d) => d.reason === 'not published to blob')).toBe(true);
  });

  it('does not flag JSON that differs only in formatting', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const { CONTENT_DIRS } = await import('../../src/lib/content-utils');
    serve((filename) => {
      for (const dir of CONTENT_DIRS) {
        try {
          const body = readFileSync(join(process.cwd(), dir, filename), 'utf-8');
          // Reserialise JSON compactly — same content, different bytes.
          return { ok: true, body: filename.endsWith('.json') ? JSON.stringify(JSON.parse(body)) : body };
        } catch {
          continue;
        }
      }
      return { ok: false };
    });
    const drift = await checkBlobDrift();
    expect(drift.filter((d) => d.filename.endsWith('.json'))).toEqual([]);
  });
});
