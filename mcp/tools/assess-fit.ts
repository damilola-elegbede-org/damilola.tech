import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerAssessFit(server: McpServer, client: ApiClient) {
  server.tool(
    'assess_fit',
    'Run an AI-powered fit assessment for a job description. Accepts a job description URL or text. Returns a detailed Executive Fit Report. NOTE: This is expensive (15-30s, calls Anthropic API).',
    { input: z.string().describe('Job description text or URL to a job posting') },
    async ({ input }) => {
      try {
        const result = await client.assessFit(input);
        return {
          content: [{ type: 'text' as const, text: result.assessment }],
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
