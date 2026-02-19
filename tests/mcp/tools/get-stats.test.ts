import { describe, it, expect, vi } from 'vitest';
import { registerGetStats } from '../../../mcp/tools/get-stats.js';

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

describe('get_usage_stats tool', () => {
  it('registers get_usage_stats tool', () => {
    const server = createMockServer();
    const client = { getUsageStats: vi.fn(), getStats: vi.fn() } as never;
    registerGetStats(server as never, client);
    expect(server.tool).toHaveBeenCalledWith('get_usage_stats', expect.any(String), expect.any(Object), expect.any(Function));
  });

  it('combines usage and stats results', async () => {
    const server = createMockServer();
    const usageData = { totalRequests: 500, totalCost: 12.50 };
    const statsData = { fitAssessments: 42, resumeGenerations: 18 };
    const client = {
      getUsageStats: vi.fn().mockResolvedValue(usageData),
      getStats: vi.fn().mockResolvedValue(statsData),
    };
    registerGetStats(server as never, client as never);
    const handler = server.getHandler('get_usage_stats');
    const result = await handler({ startDate: '2024-01-01', endDate: '2024-12-31', env: 'production' });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.usage).toEqual(usageData);
    expect(parsed.stats).toEqual(statsData);
    expect(client.getUsageStats).toHaveBeenCalledWith({ startDate: '2024-01-01', endDate: '2024-12-31' });
    expect(client.getStats).toHaveBeenCalledWith({ env: 'production' });
  });

  it('calls both APIs in parallel', async () => {
    const server = createMockServer();
    const callOrder: string[] = [];
    const client = {
      getUsageStats: vi.fn().mockImplementation(async () => {
        callOrder.push('usage');
        return { total: 1 };
      }),
      getStats: vi.fn().mockImplementation(async () => {
        callOrder.push('stats');
        return { count: 2 };
      }),
    };
    registerGetStats(server as never, client as never);
    const handler = server.getHandler('get_usage_stats');
    await handler({});
    // Both should have been called
    expect(callOrder).toContain('usage');
    expect(callOrder).toContain('stats');
  });

  it('returns error if usage call fails', async () => {
    const server = createMockServer();
    const client = {
      getUsageStats: vi.fn().mockRejectedValue(new Error('Usage API error')),
      getStats: vi.fn().mockResolvedValue({ count: 1 }),
    };
    registerGetStats(server as never, client as never);
    const handler = server.getHandler('get_usage_stats');
    const result = await handler({});
    expect(result.content[0].text).toBe('Error: Usage API error');
    expect(result.isError).toBe(true);
  });

  it('returns error if stats call fails', async () => {
    const server = createMockServer();
    const client = {
      getUsageStats: vi.fn().mockResolvedValue({ total: 1 }),
      getStats: vi.fn().mockRejectedValue(new Error('Stats API error')),
    };
    registerGetStats(server as never, client as never);
    const handler = server.getHandler('get_usage_stats');
    const result = await handler({});
    expect(result.content[0].text).toBe('Error: Stats API error');
    expect(result.isError).toBe(true);
  });
});
