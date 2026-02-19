import { describe, it, expect, vi } from 'vitest';
import { registerResumeGenerations } from '../../../mcp/tools/resume-generations.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function createMockServer() {
  const tools: Record<string, ToolHandler> = {};
  return {
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      tools[name] = handler;
    }),
    getHandler: (name: string) => tools[name],
  };
}

describe('resume generations tools', () => {
  describe('list_resume_generations', () => {
    it('registers list_resume_generations and get_resume_generation', () => {
      const server = createMockServer();
      const client = {
        listResumeGenerations: vi.fn(),
        getResumeGeneration: vi.fn(),
      } as never;
      registerResumeGenerations(server as never, client);
      const calls = server.tool.mock.calls.map((c) => c[0]);
      expect(calls).toContain('list_resume_generations');
      expect(calls).toContain('get_resume_generation');
    });

    it('returns JSON of generations list with filters', async () => {
      const server = createMockServer();
      const data = {
        generations: [
          {
            id: '1',
            jobId: 'job-1',
            generationId: 'gen-1',
            environment: 'production',
            timestamp: '2024-01-01',
            updatedAt: '2024-01-02',
            companyName: 'Acme Corp',
            roleTitle: 'Software Engineer',
            scoreBefore: 70,
            scoreAfter: 90,
            applicationStatus: 'applied',
            size: 1000,
            generationCount: 2,
          },
        ],
      };
      const client = { listResumeGenerations: vi.fn().mockResolvedValue(data), getResumeGeneration: vi.fn() };
      registerResumeGenerations(server as never, client as never);
      const handler = server.getHandler('list_resume_generations');
      const result = await handler({ status: 'applied', company: 'Acme Corp', minScore: 80 });
      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
      expect(client.listResumeGenerations).toHaveBeenCalledWith({
        status: 'applied',
        company: 'Acme Corp',
        dateFrom: undefined,
        dateTo: undefined,
        minScore: 80,
        maxScore: undefined,
        cursor: undefined,
      });
    });

    it('returns error on failure', async () => {
      const server = createMockServer();
      const client = {
        listResumeGenerations: vi.fn().mockRejectedValue(new Error('Server error')),
        getResumeGeneration: vi.fn(),
      };
      registerResumeGenerations(server as never, client as never);
      const handler = server.getHandler('list_resume_generations');
      const result = await handler({});
      expect(result.content[0].text).toBe('Error: Server error');
      expect(result.isError).toBe(true);
    });
  });

  describe('get_resume_generation', () => {
    it('returns JSON of single generation', async () => {
      const server = createMockServer();
      const data = { id: 'gen-123', companyName: 'TechCo', roleTitle: 'Staff Engineer' };
      const client = {
        listResumeGenerations: vi.fn(),
        getResumeGeneration: vi.fn().mockResolvedValue(data),
      };
      registerResumeGenerations(server as never, client as never);
      const handler = server.getHandler('get_resume_generation');
      const result = await handler({ id: 'gen-123' });
      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
      expect(client.getResumeGeneration).toHaveBeenCalledWith('gen-123');
    });

    it('returns error on failure', async () => {
      const server = createMockServer();
      const client = {
        listResumeGenerations: vi.fn(),
        getResumeGeneration: vi.fn().mockRejectedValue(new Error('Not found')),
      };
      registerResumeGenerations(server as never, client as never);
      const handler = server.getHandler('get_resume_generation');
      const result = await handler({ id: 'missing' });
      expect(result.content[0].text).toBe('Error: Not found');
      expect(result.isError).toBe(true);
    });
  });
});
