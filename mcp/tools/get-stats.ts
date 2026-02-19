import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerGetStats(server: McpServer, client: ApiClient) {
  server.tool(
    'get_usage_stats',
    'Get combined usage statistics and application stats.',
    {
      startDate: z.string().optional().describe('Start date for usage stats (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date for usage stats (YYYY-MM-DD)'),
      env: z.string().optional().describe('Environment filter for stats'),
    },
    async ({ startDate, endDate, env }) => {
      try {
        const [usage, stats] = await Promise.all([
          client.getUsageStats({ startDate, endDate }),
          client.getStats({ env }),
        ]);
        const combined = { usage, stats };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(combined, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
