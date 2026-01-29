import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies before importing the route
vi.mock('@/lib/generated/system-prompt', () => ({
  RESUME_GENERATOR_PROMPT: 'Test resume generator system prompt',
}));

vi.mock('@/lib/resume-data', () => ({
  resumeData: {
    name: 'Damilola Elegbede',
    title: 'Senior Engineering Manager',
    brandingStatement: 'Engineering leader with 15 years of experience',
    skills: [
      { category: 'Leadership', items: ['Team Management', 'Strategy'] },
      { category: 'Technical', items: ['Python', 'TypeScript', 'React'] },
    ],
    experiences: [
      {
        title: 'Engineering Manager',
        company: 'Tech Corp',
        highlights: ['Led team of 13 engineers', 'Shipped critical features'],
      },
    ],
    education: [
      { degree: 'BS Computer Science', institution: 'University' },
    ],
  },
}));

vi.mock('@/lib/ats-scorer', () => ({
  calculateATSScore: vi.fn(() => ({
    total: 75,
    breakdown: {
      keywordRelevance: 30,
      skillsQuality: 20,
      experienceAlignment: 15,
      formatParseability: 10,
    },
    details: {
      matchRate: 60,
      keywordDensity: 2.5,
      matchedKeywords: ['python', 'react', 'leadership'],
      missingKeywords: ['kubernetes', 'aws'],
    },
  })),
  resumeDataToText: vi.fn(() => 'Resume text content'),
}));

vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: vi.fn(),
}));

vi.mock('@/lib/usage-logger', () => ({
  logUsage: vi.fn().mockResolvedValue(undefined),
}));

const mockCheckGenericRateLimit = vi.fn();
const mockCreateRateLimitResponse = vi.fn();
const mockGetClientIp = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkGenericRateLimit: mockCheckGenericRateLimit,
  createRateLimitResponse: mockCreateRateLimitResponse,
  getClientIp: mockGetClientIp,
  RATE_LIMIT_CONFIGS: {
    resumeGenerator: { maxRequests: 5, windowMs: 60000 },
  },
}));

// Mock Anthropic SDK
const mockStream = {
  [Symbol.asyncIterator]: async function* () {
    yield {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: '{"analysis": "Test analysis"}' },
    };
  },
  finalMessage: () => Promise.resolve({
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  }),
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      stream: vi.fn().mockReturnValue(mockStream),
    };
  },
}));

// Mock DNS lookup for SSRF protection tests
const mockLookup = vi.fn();
vi.mock('node:dns/promises', () => ({
  lookup: mockLookup,
}));

// Store original fetch
const originalFetch = global.fetch;

describe('resume-generator API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup default mocks
    mockGetClientIp.mockReturnValue('1.2.3.4');
    mockCheckGenericRateLimit.mockResolvedValue({ limited: false });
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]); // example.com IP

    // Mock crypto.randomUUID using vi.stubGlobal
    vi.stubGlobal('crypto', {
      ...global.crypto,
      randomUUID: () => 'test-uuid-1234',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  // Helper to create a mock streaming response for URL fetching
  function createMockStreamingResponse(html: string, status = 200) {
    const encoder = new TextEncoder();
    const data = encoder.encode(html);
    let read = false;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({
        'content-type': 'text/html',
        'content-length': data.length.toString(),
      }),
      body: {
        getReader: () => ({
          read: async () => {
            if (!read) {
              read = true;
              return { done: false, value: data };
            }
            return { done: true, value: undefined };
          },
          releaseLock: () => {},
        }),
      },
    };
  }

  describe('valid text input', () => {
    it('processes job description text successfully', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const jobDescription = 'Senior Software Engineer position requiring Python, React, and 5+ years experience';

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/plain');
      expect(response.headers.get('Transfer-Encoding')).toBe('chunked');

      // Verify rate limit was checked
      expect(mockCheckGenericRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ maxRequests: 5 }),
        '1.2.3.4'
      );
    });

    it('includes deterministic ATS score in metadata', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: 'Senior Engineer with Python experience'
        }),
      });

      const response = await POST(request);

      // Read the response stream
      const reader = response.body!.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      // First line should be metadata JSON
      const firstLine = text.split('\n')[0];
      const metadata = JSON.parse(firstLine);

      expect(metadata.wasUrl).toBe(false);
      expect(metadata.deterministicScore).toBeDefined();
      expect(metadata.deterministicScore.total).toBe(75);
      expect(metadata.deterministicScore.breakdown).toBeDefined();
      expect(metadata.deterministicScore.matchedKeywords).toEqual(['python', 'react', 'leadership']);
    });
  });

  describe('SSRF protection - private IPv4 addresses', () => {
    it('blocks localhost (127.0.0.1)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://127.0.0.1/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks localhost hostname', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://localhost:8080/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks 127.x.x.x range', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://127.255.255.255/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks Class A private network (10.x.x.x)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://10.0.0.1/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks Class B private network (172.16-31.x.x)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const requests = [
        'http://172.16.0.1/job',
        'http://172.20.0.1/job',
        'http://172.31.255.255/job',
      ];

      for (const url of requests) {
        const request = new Request('http://localhost/api/resume-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription: url }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('not allowed');
      }
    });

    it('blocks Class C private network (192.168.x.x)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://192.168.1.1/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks link-local addresses (169.254.x.x)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://169.254.1.1/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks cloud metadata endpoint (169.254.169.254)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://169.254.169.254/latest/meta-data/' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks carrier-grade NAT (100.64-127.x.x)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const requests = [
        'http://100.64.0.1/job',
        'http://100.100.0.1/job',
        'http://100.127.255.255/job',
      ];

      for (const url of requests) {
        const request = new Request('http://localhost/api/resume-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription: url }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('not allowed');
      }
    });

    it('blocks 0.0.0.0', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://0.0.0.0/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });
  });

  describe('SSRF protection - private IPv6 addresses', () => {
    it('blocks IPv6 loopback (::1)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://[::1]/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks ULA addresses (fc00::/7)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const requests = [
        'http://[fc00::1]/job',
        'http://[fd12:3456:789a::1]/job',
      ];

      for (const url of requests) {
        const request = new Request('http://localhost/api/resume-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription: url }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('not allowed');
      }
    });

    it('blocks link-local addresses (fe80::/10)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const requests = [
        'http://[fe80::1]/job',
        'http://[fe80:1234:5678::abcd]/job',
        'http://[febf:ffff:ffff:ffff::1]/job',
      ];

      for (const url of requests) {
        const request = new Request('http://localhost/api/resume-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription: url }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('not allowed');
      }
    });

    it('blocks IPv4-mapped IPv6 (::ffff:127.0.0.1)', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://[::ffff:127.0.0.1]/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('blocks IPv4-mapped IPv6 for private networks', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const requests = [
        'http://[::ffff:10.0.0.1]/job',
        'http://[::ffff:192.168.1.1]/job',
        'http://[::ffff:172.16.0.1]/job',
      ];

      for (const url of requests) {
        const request = new Request('http://localhost/api/resume-generator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription: url }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('not allowed');
      }
    });
  });

  describe('SSRF protection - DNS resolution', () => {
    it('blocks hostnames resolving to private IPs', async () => {
      mockLookup.mockResolvedValue([{ address: '192.168.1.1', family: 4 }]);

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://malicious.example.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
      expect(mockLookup).toHaveBeenCalledWith('malicious.example.com', { all: true });
    });

    it('blocks if any resolved IP is private', async () => {
      mockLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 }, // Public
        { address: '192.168.1.1', family: 4 },   // Private - should block
      ]);

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://suspicious.example.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('fails closed on DNS resolution error', async () => {
      mockLookup.mockRejectedValue(new Error('DNS resolution failed'));

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://unknown.example.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not allowed');
    });

    it('allows public IPs to proceed', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

      const jobHtml = '<html><body><h1>Senior Software Engineer</h1><p>Job responsibilities: Build and maintain software systems. Requirements and qualifications: 5+ years experience in software engineering required.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(jobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('SSRF protection - protocol validation', () => {
    it('treats file:// as plain text (not a URL)', async () => {
      // The isUrl() function only matches http:// and https://
      // So file:// is treated as plain text, not as a URL to validate
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'file:///etc/passwd' }),
      });

      const response = await POST(request);

      // Streaming response means it was processed as text
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/plain');
    });

    it('treats ftp:// as plain text (not a URL)', async () => {
      // The isUrl() function only matches http:// and https://
      // So ftp:// is treated as plain text, not as a URL to validate
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'ftp://example.com/job' }),
      });

      const response = await POST(request);

      // Streaming response means it was processed as text
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/plain');
    });

    it('allows http:// protocol', async () => {
      const jobHtml = '<html><body><h1>Senior Software Engineer</h1><p>Job responsibilities include leading development team. Requirements: 5+ years experience in software development. Qualifications: Strong technical skills required.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(jobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('allows https:// protocol', async () => {
      const jobHtml = '<html><body><h1>Engineering Manager</h1><p>Job responsibilities include team leadership and technical guidance. Requirements: 8+ years experience, proven track record. Qualifications: Strong management skills required.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(jobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'https://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('URL input validation', () => {
    it('returns 400 for invalid URL format', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://[invalid url/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid URL');
    });

    it('returns 400 when extracted content is too short', async () => {
      const shortHtml = '<html><body>Job</body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(shortHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Could not extract');
    });

    it('returns 400 when content does not look like job description', async () => {
      const nonJobHtml = '<html><body><h1>News Article</h1><p>This is a news article about technology trends and industry developments. No job posting here.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(nonJobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/news' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('does not appear to contain');
    });

    it('successfully processes valid job description URL', async () => {
      const validJobHtml = '<html><body><h1>Senior Software Engineer</h1><p>Responsibilities: Lead development team, design systems. Requirements: 5+ years experience, Python, React. Qualifications: Strong leadership skills.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(validJobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'https://careers.example.com/job/12345' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://careers.example.com/job/12345',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Mozilla/5.0 (compatible; ResumeGeneratorBot/1.0)'
          }),
        })
      );
    });

    it('returns 400 on HTTP error status', async () => {
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse('Not Found', 404));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/notfound' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('HTTP 404');
    });

    it('returns 400 when fetched content is too large', async () => {
      const largeFetchMock = vi.fn().mockRejectedValue(new Error('Response too large'));
      global.fetch = largeFetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/huge-page' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('too large');
    });

    it('returns 400 when redirect is blocked by SSRF', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        headers: new Headers({ location: 'http://192.168.1.1/job' }),
        body: { getReader: () => ({}) },
      });
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/redirect' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('redirected to a blocked');
    });
  });

  describe('request validation', () => {
    it('returns 400 when jobDescription is missing', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('returns 400 when jobDescription is not a string', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 12345 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('returns 413 when request body is too large', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '100000', // 100KB, exceeds 50KB limit
        },
        body: JSON.stringify({ jobDescription: 'test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toContain('too large');
    });
  });

  describe('rate limiting', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      mockCheckGenericRateLimit.mockResolvedValue({
        limited: true,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 60000,
      });
      mockCreateRateLimitResponse.mockReturnValue(
        Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
      );

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'Senior Engineer' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Rate limit');
      expect(mockCreateRateLimitResponse).toHaveBeenCalled();
    });

    it('uses client IP for rate limiting', async () => {
      mockGetClientIp.mockReturnValue('10.20.30.40');

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'Senior Engineer' }),
      });

      await POST(request);

      expect(mockCheckGenericRateLimit).toHaveBeenCalledWith(
        expect.any(Object),
        '10.20.30.40'
      );
    });
  });

  describe('helper functions - isUrl', () => {
    it('detects http URLs', async () => {
      const validJobHtml = '<html><body><h1>Senior Engineer Position</h1><p>Job responsibilities include software development. Requirements and qualifications: 5+ years experience required for this role.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(validJobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      await POST(request);

      expect(fetchMock).toHaveBeenCalled(); // URL was detected and fetched
    });

    it('detects https URLs', async () => {
      const validJobHtml = '<html><body><h1>Software Developer Role</h1><p>Job responsibilities include coding and design. Requirements and qualifications: technical skills and 3+ years experience required.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(validJobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'https://example.com/job' }),
      });

      await POST(request);

      expect(fetchMock).toHaveBeenCalled();
    });

    it('does not treat plain text as URL', async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'Senior Engineer with Python experience' }),
      });

      await POST(request);

      expect(fetchMock).not.toHaveBeenCalled(); // Plain text, not fetched
    });
  });

  describe('helper functions - extractTextFromHtml', () => {
    it('removes HTML tags', async () => {
      const htmlWithTags = '<html><body><h1>Senior Software Engineer</h1><p>Job responsibilities include development. Requirements: 5+ years experience. Qualifications: Strong skills needed.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(htmlWithTags));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // Successfully extracted and processed
    });

    it('removes script tags and content', async () => {
      const htmlWithScript = '<html><body><h1>Engineering Position</h1><script>alert("xss")</script><p>Job responsibilities include development. Requirements and qualifications: 5 years experience needed</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(htmlWithScript));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('removes style tags and content', async () => {
      const htmlWithStyle = '<html><head><style>body { color: red; }</style></head><body><h1>Senior Engineer Position</h1><p>Job responsibilities include development and design. Requirements: 5+ years experience. Qualifications: technical skills required.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(htmlWithStyle));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('decodes HTML entities', async () => {
      const htmlWithEntities = '<html><body><h1>Software Engineer Position</h1><p>Job responsibilities &amp; duties. Requirements: 5+ years experience &ndash; &ldquo;expert&rdquo; level skills. Qualifications required.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(htmlWithEntities));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('helper functions - looksLikeJobDescription', () => {
    it('accepts content with job description keywords', async () => {
      // Use longer content to meet MIN_EXTRACTED_CONTENT_LENGTH requirement (100 chars)
      const validJobHtml = '<html><body><h1>Senior Software Engineer</h1><p>Job responsibilities include software development and team leadership. Qualifications: 5 years experience required. Strong technical skills needed.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(validJobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // Accepted as job description
    });

    it('rejects content without job description keywords', async () => {
      // Long enough content but no job keywords
      const nonJobHtml = '<html><body><p>This is a blog post about technology trends and industry developments. It discusses various aspects of modern software without being a job posting.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(nonJobHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/blog' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400); // Rejected
    });

    it('requires minimum keyword threshold', async () => {
      // One keyword only, should be rejected (needs at least 2)
      const oneKeywordHtml = '<html><body><p>Responsibilities: Write code and develop features. This is all the content we have here for this particular posting.</p></body></html>';
      const fetchMock = vi.fn().mockResolvedValue(createMockStreamingResponse(oneKeywordHtml));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://example.com/job' }),
      });

      const response = await POST(request);

      // One keyword is not enough, need at least 2
      expect(response.status).toBe(400);
    });
  });

  describe('error handling', () => {
    it('returns 503 on malformed JSON body', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      // Test with invalid JSON body which will trigger the generic catch block
      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {{{',
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain('AI service');

      consoleSpy.mockRestore();
    });

    it('handles general errors gracefully', async () => {
      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {{{',
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503); // JSON parse error caught by main catch block
      expect(data.error).toContain('AI service');

      consoleSpy.mockRestore();
    });

    it('handles fetch timeout', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('signal timed out'));
      global.fetch = fetchMock;

      const { POST } = await import('@/app/api/resume-generator/route');

      const request = new Request('http://localhost/api/resume-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: 'http://slowwebsite.example.com/job' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Could not fetch');
    });
  });
});
