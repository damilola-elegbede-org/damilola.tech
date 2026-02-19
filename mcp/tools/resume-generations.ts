import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerResumeGenerations(server: McpServer, client: ApiClient) {
  server.tool(
    'list_resume_generations',
    'List all stored resume generations with optional filtering.',
    {
      status: z.string().optional().describe('Filter by application status'),
      company: z.string().optional().describe('Filter by company name'),
      dateFrom: z.string().optional().describe('Filter from date (YYYY-MM-DD)'),
      dateTo: z.string().optional().describe('Filter to date (YYYY-MM-DD)'),
      minScore: z.number().optional().describe('Minimum ATS score filter'),
      maxScore: z.number().optional().describe('Maximum ATS score filter'),
      cursor: z.string().optional().describe('Pagination cursor for next page'),
    },
    async ({ status, company, dateFrom, dateTo, minScore, maxScore, cursor }) => {
      try {
        const result = await client.listResumeGenerations({
          status,
          company,
          dateFrom,
          dateTo,
          minScore,
          maxScore,
          cursor,
        });
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
    'get_resume_generation',
    'Retrieve a specific resume generation by its ID.',
    {
      id: z.string().describe('The ID of the resume generation to retrieve'),
    },
    async ({ id }) => {
      try {
        const result = await client.getResumeGeneration(id);
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
