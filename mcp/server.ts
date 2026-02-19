import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config, validateConfig } from './lib/config.js';
import { ApiClient } from './lib/api-client.js';
import { registerAssessFit } from './tools/assess-fit.js';
import { registerFitAssessments } from './tools/fit-assessments.js';
import { registerResumeGenerations } from './tools/resume-generations.js';
import { registerGetStats } from './tools/get-stats.js';

validateConfig();

const server = new McpServer({
  name: 'damilola-tech',
  version: '1.0.0',
});

const client = new ApiClient({
  apiKey: config.apiKey,
  baseUrl: config.apiBaseUrl,
});

registerAssessFit(server, client);
registerFitAssessments(server, client);
registerResumeGenerations(server, client);
registerGetStats(server, client);

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('damilola-tech MCP server running on stdio');
}).catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
