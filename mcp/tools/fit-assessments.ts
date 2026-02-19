import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerFitAssessments(server: McpServer, client: ApiClient) {
  server.tool(
    'list_fit_assessments',
    'List all stored fit assessments with optional filtering.',
    {
      env: z.string().optional().describe('Filter by environment (e.g. production, development)'),
      limit: z.number().optional().describe('Maximum number of results to return'),
      cursor: z.string().optional().describe('Pagination cursor for next page'),
    },
    async ({ env, limit, cursor }) => {
      try {
        const result = await client.listFitAssessments({ env, limit, cursor });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'get_fit_assessment',
    'Retrieve a specific fit assessment by its blob pathname or URL.',
    {
      id: z.string().describe('The blob pathname or URL of the fit assessment'),
    },
    async ({ id }) => {
      try {
        const result = await client.getFitAssessment(id);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
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
