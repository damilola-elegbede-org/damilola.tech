import { describe, it, expect, vi } from 'vitest';
import { registerAssessFit } from '../../../mcp/tools/assess-fit.js';

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

describe('assess_fit tool', () => {
  it('registers assess_fit tool', () => {
    const server = createMockServer();
    const client = { assessFit: vi.fn() } as never;
    registerAssessFit(server as never, client);
    expect(server.tool).toHaveBeenCalledWith('assess_fit', expect.any(String), expect.any(Object), expect.any(Function));
  });

  it('returns assessment text on success', async () => {
    const server = createMockServer();
    const client = {
      assessFit: vi.fn().mockResolvedValue({
        assessment: 'Executive Fit Report: Strong match.',
        model: 'claude-3',
        usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0 },
      }),
    };
    registerAssessFit(server as never, client as never);
    const handler = server.getHandler('assess_fit');
    const result = await handler({ input: 'Software Engineer role' });
    expect(result.content[0].text).toBe('Executive Fit Report: Strong match.');
    expect(result.isError).toBeUndefined();
  });

  it('returns error content on failure', async () => {
    const server = createMockServer();
    const client = {
      assessFit: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
    };
    registerAssessFit(server as never, client as never);
    const handler = server.getHandler('assess_fit');
    const result = await handler({ input: 'some job' });
    expect(result.content[0].text).toBe('Error: API rate limit exceeded');
    expect(result.isError).toBe(true);
  });

  it('calls client.assessFit with the input', async () => {
    const server = createMockServer();
    const client = {
      assessFit: vi.fn().mockResolvedValue({
        assessment: 'Good fit',
        model: 'claude-3',
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0 },
      }),
    };
    registerAssessFit(server as never, client as never);
    const handler = server.getHandler('assess_fit');
    await handler({ input: 'Senior Engineer at Google' });
    expect(client.assessFit).toHaveBeenCalledWith('Senior Engineer at Google');
  });
});
