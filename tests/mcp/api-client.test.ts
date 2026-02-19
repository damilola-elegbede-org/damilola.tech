import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../../mcp/lib/api-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeSuccessResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data }),
  });
}

function makeErrorResponse(message: string, code = 'ERROR') {
  return Promise.resolve({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ success: false, error: { code, message } }),
  });
}

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new ApiClient({ apiKey: 'test-key', baseUrl: 'http://localhost:3000' });
  });

  describe('auth header', () => {
    it('sets Authorization header with Bearer token', async () => {
      mockFetch.mockReturnValueOnce(makeSuccessResponse({ assessments: [] }));
      await client.listFitAssessments();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer test-key');
    });
  });

  describe('error handling', () => {
    it('throws with error message on JSON failure response', async () => {
      mockFetch.mockReturnValueOnce(makeErrorResponse('Not found', 'NOT_FOUND'));
      await expect(client.listFitAssessments()).rejects.toThrow('Not found');
    });

    it('throws with status text on non-JSON error response (e.g. proxy 502)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
        text: () => Promise.resolve('Bad Gateway'),
      });
      await expect(client.listFitAssessments()).rejects.toThrow('HTTP 502: Bad Gateway');
    });

    it('handles non-JSON error when text() also fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
        text: () => Promise.reject(new Error('stream error')),
      });
      await expect(client.listFitAssessments()).rejects.toThrow('HTTP 500: ');
    });
  });

  describe('query params', () => {
    it('appends query params to URL for list requests', async () => {
      mockFetch.mockReturnValueOnce(makeSuccessResponse({ assessments: [] }));
      await client.listFitAssessments({ env: 'production', limit: 10 });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('env=production');
      expect(url).toContain('limit=10');
    });

    it('omits undefined params', async () => {
      mockFetch.mockReturnValueOnce(makeSuccessResponse({ assessments: [] }));
      await client.listFitAssessments({ env: undefined, limit: 5 });
      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('env=');
      expect(url).toContain('limit=5');
    });
  });

  describe('POST body', () => {
    it('sends body as JSON for assessFit', async () => {
      const mockAssessment = {
        assessment: 'Great fit',
        model: 'claude-3',
        usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0 },
      };
      mockFetch.mockReturnValueOnce(makeSuccessResponse(mockAssessment));
      const result = await client.assessFit('Software Engineer at Acme');
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ input: 'Software Engineer at Acme' });
      expect(result.assessment).toBe('Great fit');
    });
  });

  describe('assessFit', () => {
    it('calls POST /api/v1/fit-assessment', async () => {
      const data = {
        assessment: 'Strong match',
        model: 'claude-3',
        usage: { inputTokens: 200, outputTokens: 100, cacheReadTokens: 50 },
      };
      mockFetch.mockReturnValueOnce(makeSuccessResponse(data));
      const result = await client.assessFit('job description');
      expect(mockFetch.mock.calls[0][0]).toContain('/api/v1/fit-assessment');
      expect(result).toEqual(data);
    });
  });

  describe('listFitAssessments', () => {
    it('calls GET /api/v1/fit-assessments and returns data', async () => {
      const data = { assessments: [{ id: '1', pathname: 'test', assessmentId: 'a1', environment: 'prod', timestamp: '2024-01-01', size: 100 }] };
      mockFetch.mockReturnValueOnce(makeSuccessResponse(data));
      const result = await client.listFitAssessments();
      expect(mockFetch.mock.calls[0][0]).toContain('/api/v1/fit-assessments');
      expect(result).toEqual(data);
    });
  });

  describe('getFitAssessment', () => {
    it('URL-encodes the id', async () => {
      mockFetch.mockReturnValueOnce(makeSuccessResponse({ id: 'test/path' }));
      await client.getFitAssessment('test/path');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('test%2Fpath');
    });
  });

  describe('listResumeGenerations', () => {
    it('calls GET /api/v1/resume-generations', async () => {
      const data = { generations: [] };
      mockFetch.mockReturnValueOnce(makeSuccessResponse(data));
      const result = await client.listResumeGenerations({ status: 'applied', minScore: 80 });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/v1/resume-generations');
      expect(url).toContain('status=applied');
      expect(url).toContain('minScore=80');
      expect(result).toEqual(data);
    });
  });

  describe('getResumeGeneration', () => {
    it('URL-encodes the id', async () => {
      mockFetch.mockReturnValueOnce(makeSuccessResponse({ id: 'gen/123' }));
      await client.getResumeGeneration('gen/123');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('gen%2F123');
    });
  });

  describe('getUsageStats', () => {
    it('calls GET /api/v1/usage with date params', async () => {
      const data = { total: 100 };
      mockFetch.mockReturnValueOnce(makeSuccessResponse(data));
      const result = await client.getUsageStats({ startDate: '2024-01-01', endDate: '2024-12-31' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/v1/usage');
      expect(url).toContain('startDate=2024-01-01');
      expect(result).toEqual(data);
    });
  });

  describe('getStats', () => {
    it('calls GET /api/v1/stats', async () => {
      const data = { count: 42 };
      mockFetch.mockReturnValueOnce(makeSuccessResponse(data));
      const result = await client.getStats({ env: 'production' });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/v1/stats');
      expect(url).toContain('env=production');
      expect(result).toEqual(data);
    });
  });
});
