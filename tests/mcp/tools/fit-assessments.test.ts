import { describe, it, expect, vi } from 'vitest';
import { registerFitAssessments } from '../../../mcp/tools/fit-assessments.js';

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

describe('fit assessments tools', () => {
  describe('list_fit_assessments', () => {
    it('registers list_fit_assessments and get_fit_assessment', () => {
      const server = createMockServer();
      const client = {
        listFitAssessments: vi.fn(),
        getFitAssessment: vi.fn(),
      } as never;
      registerFitAssessments(server as never, client);
      const calls = server.tool.mock.calls.map((c) => c[0]);
      expect(calls).toContain('list_fit_assessments');
      expect(calls).toContain('get_fit_assessment');
    });

    it('returns JSON of assessments list', async () => {
      const server = createMockServer();
      const data = {
        assessments: [
          { id: '1', pathname: 'fit/2024-01.json', assessmentId: 'a1', environment: 'production', timestamp: '2024-01-01', size: 500 },
        ],
      };
      const client = { listFitAssessments: vi.fn().mockResolvedValue(data), getFitAssessment: vi.fn() };
      registerFitAssessments(server as never, client as never);
      const handler = server.getHandler('list_fit_assessments');
      const result = await handler({ env: 'production', limit: 10 });
      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
      expect(client.listFitAssessments).toHaveBeenCalledWith({ env: 'production', limit: 10, cursor: undefined });
    });

    it('returns error on failure', async () => {
      const server = createMockServer();
      const client = {
        listFitAssessments: vi.fn().mockRejectedValue(new Error('Unauthorized')),
        getFitAssessment: vi.fn(),
      };
      registerFitAssessments(server as never, client as never);
      const handler = server.getHandler('list_fit_assessments');
      const result = await handler({});
      expect(result.content[0].text).toBe('Error: Unauthorized');
      expect(result.isError).toBe(true);
    });
  });

  describe('get_fit_assessment', () => {
    it('returns JSON of single assessment', async () => {
      const server = createMockServer();
      const data = { id: 'fit/2024-01.json', assessment: 'Strong fit', timestamp: '2024-01-01' };
      const client = {
        listFitAssessments: vi.fn(),
        getFitAssessment: vi.fn().mockResolvedValue(data),
      };
      registerFitAssessments(server as never, client as never);
      const handler = server.getHandler('get_fit_assessment');
      const result = await handler({ id: 'fit/2024-01.json' });
      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
      expect(client.getFitAssessment).toHaveBeenCalledWith('fit/2024-01.json');
    });

    it('returns error on failure', async () => {
      const server = createMockServer();
      const client = {
        listFitAssessments: vi.fn(),
        getFitAssessment: vi.fn().mockRejectedValue(new Error('Not found')),
      };
      registerFitAssessments(server as never, client as never);
      const handler = server.getHandler('get_fit_assessment');
      const result = await handler({ id: 'missing' });
      expect(result.content[0].text).toBe('Error: Not found');
      expect(result.isError).toBe(true);
    });
  });
});
