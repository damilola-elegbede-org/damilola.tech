import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @/lib/blob before importing the route
const mockFetchBlob = vi.fn();
vi.mock('@/lib/blob', () => ({
  fetchBlob: mockFetchBlob,
}));

describe('resume-data API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const mockResumeData = {
    personalInfo: {
      name: 'Damilola Elegbede',
      title: 'Engineering Manager',
      email: 'test@example.com',
      phone: '+1-555-0100',
      location: 'San Francisco, CA',
      linkedin: 'linkedin.com/in/damilola-elegbede',
      github: 'github.com/damilola-elegbede',
    },
    summary: 'Experienced engineering manager with 10+ years of experience...',
    experience: [
      {
        company: 'Tech Company',
        position: 'Engineering Manager',
        startDate: '2020-01',
        endDate: 'present',
        achievements: ['Led team of 8 engineers', 'Improved system performance by 40%'],
      },
    ],
    education: [
      {
        institution: 'University',
        degree: 'BS Computer Science',
        graduationDate: '2010',
      },
    ],
    skills: {
      technical: ['TypeScript', 'React', 'Node.js'],
      leadership: ['Team Building', 'Strategic Planning'],
    },
  };

  describe('GET /api/resume-data', () => {
    it('returns resume JSON data successfully', async () => {
      mockFetchBlob.mockResolvedValue(JSON.stringify(mockResumeData));

      const { GET } = await import('@/app/api/resume-data/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResumeData);
      expect(mockFetchBlob).toHaveBeenCalledTimes(1);
      expect(mockFetchBlob).toHaveBeenCalledWith('resume-full.json');
    });

    it('response has correct content-type', async () => {
      mockFetchBlob.mockResolvedValue(JSON.stringify(mockResumeData));

      const { GET } = await import('@/app/api/resume-data/route');

      const response = await GET();

      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('response contains expected fields', async () => {
      mockFetchBlob.mockResolvedValue(JSON.stringify(mockResumeData));

      const { GET } = await import('@/app/api/resume-data/route');

      const response = await GET();
      const data = await response.json();

      expect(data).toHaveProperty('personalInfo');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('experience');
      expect(data).toHaveProperty('education');
      expect(data).toHaveProperty('skills');
    });

    it('parses resume JSON correctly', async () => {
      mockFetchBlob.mockResolvedValue(JSON.stringify(mockResumeData));

      const { GET } = await import('@/app/api/resume-data/route');

      const response = await GET();
      const data = await response.json();

      expect(data.personalInfo.name).toBe('Damilola Elegbede');
      expect(data.personalInfo.title).toBe('Engineering Manager');
      expect(data.experience).toHaveLength(1);
      expect(data.experience[0].company).toBe('Tech Company');
      expect(data.education).toHaveLength(1);
      expect(data.skills.technical).toContain('TypeScript');
    });
  });

  describe('error handling', () => {
    it('returns 503 when resume data is not available', async () => {
      mockFetchBlob.mockResolvedValue('');

      const { GET } = await import('@/app/api/resume-data/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Resume data not available.');
    });

    it('returns 503 when fetchBlob throws error', async () => {
      mockFetchBlob.mockRejectedValue(new Error('Blob storage error'));

      const { GET } = await import('@/app/api/resume-data/route');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Failed to load resume data.');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[resume-data] Error fetching resume data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('returns 503 when resume contains invalid JSON', async () => {
      mockFetchBlob.mockResolvedValue('invalid json {{{');

      const { GET } = await import('@/app/api/resume-data/route');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Failed to load resume data.');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[resume-data] Error fetching resume data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('logs error message with correct prefix', async () => {
      mockFetchBlob.mockRejectedValue(new Error('Network timeout'));

      const { GET } = await import('@/app/api/resume-data/route');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await GET();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[resume-data] Error fetching resume data:',
        expect.objectContaining({
          message: 'Network timeout',
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('runtime configuration', () => {
    it('uses nodejs runtime', async () => {
      const routeModule = await import('@/app/api/resume-data/route');
      expect(routeModule.runtime).toBe('nodejs');
    });

    it('exports maxDuration of 30', async () => {
      const routeModule = await import('@/app/api/resume-data/route');
      expect(routeModule.maxDuration).toBe(30);
    });
  });
});
