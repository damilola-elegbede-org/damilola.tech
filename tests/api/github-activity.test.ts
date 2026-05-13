import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/github-activity', () => {
  it('returns zeros when GITHUB_PERSONAL_TOKEN is absent', async () => {
    delete process.env.GITHUB_PERSONAL_TOKEN;
    const { GET } = await import('@/app/api/github-activity/route');
    const response = await GET();
    const json = await response.json();
    expect(json.contributionCount).toBe(0);
    expect(json.repos).toEqual([]);
    expect(json.error).toContain('token');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('aggregates contribution counts from GraphQL response', async () => {
    process.env.GITHUB_PERSONAL_TOKEN = 'test-token';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: {
              contributionsCollection: {
                contributionCalendar: {
                  weeks: [
                    { contributionDays: [{ contributionCount: 5 }, { contributionCount: 3 }] },
                    { contributionDays: [{ contributionCount: 7 }] },
                  ],
                },
              },
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { name: 'my-repo', description: 'A repo', language: 'TypeScript', html_url: 'https://github.com/u/my-repo', stargazers_count: 10, pushed_at: '2026-05-01' },
        ],
      } as Response);

    const { GET } = await import('@/app/api/github-activity/route');
    const response = await GET();
    const json = await response.json();
    expect(json.contributionCount).toBe(15);
    expect(json.repos).toHaveLength(1);
    expect(json.repos[0].name).toBe('my-repo');
    expect(json.error).toBeUndefined();
  });

  it('returns fallback when GitHub API is unavailable', async () => {
    process.env.GITHUB_PERSONAL_TOKEN = 'test-token';
    mockFetch.mockRejectedValue(new Error('network error'));

    const { GET } = await import('@/app/api/github-activity/route');
    const response = await GET();
    const json = await response.json();
    expect(json.contributionCount).toBe(0);
    expect(json.repos).toEqual([]);
    expect(json.error).toBeDefined();
  });
});
