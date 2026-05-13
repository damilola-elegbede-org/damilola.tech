import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../../../mcp/lib/api-client';
import { registerAssessFit } from '../../../mcp/tools/assess-fit';
import { registerFitAssessments } from '../../../mcp/tools/fit-assessments';
import { registerResumeGenerations } from '../../../mcp/tools/resume-generations';
import { registerGetStats } from '../../../mcp/tools/get-stats';
import { registerScoreResume } from '../../../mcp/tools/score-resume';
import { registerGenerateResume } from '../../../mcp/tools/generate-resume';
import { registerUpdateApplicationStatus } from '../../../mcp/tools/update-application-status';
import { registerGetResumeData } from '../../../mcp/tools/get-resume-data';
import { registerModifyChange } from '../../../mcp/tools/modify-change';
import { registerUploadResumePdf } from '../../../mcp/tools/upload-resume-pdf';
import { registerLogGeneration } from '../../../mcp/tools/log-generation';
import { registerGetStatsOnly } from '../../../mcp/tools/get-stats-only';
import { registerChats } from '../../../mcp/tools/chats';
import { registerAuditLog } from '../../../mcp/tools/audit-log';
import { registerTraffic } from '../../../mcp/tools/traffic';
import { registerScoreJob } from '../../../mcp/tools/score-job';
import { registerGenerateCoverLetter } from '../../../mcp/tools/generate-cover-letter';

/**
 * Creates an MCP server instance with all supported tools registered.
 *
 * @param apiKey - API key used for downstream API calls made by tools.
 * @param apiBaseUrl - Trusted base URL for server-to-server requests.
 */
export function createMcpServer(apiKey: string, apiBaseUrl: string): McpServer {
  const server = new McpServer({
    name: 'damilola-tech',
    version: '1.0.0',
  });

  const client = new ApiClient({ apiKey, baseUrl: apiBaseUrl });

  registerAssessFit(server, client);
  registerFitAssessments(server, client);
  registerResumeGenerations(server, client);
  registerGetStats(server, client);
  registerScoreResume(server, client);
  registerGenerateResume(server, client);
  registerUpdateApplicationStatus(server, client);
  registerGetResumeData(server, client);
  registerModifyChange(server, client);
  registerUploadResumePdf(server, client);
  registerLogGeneration(server, client);
  registerGetStatsOnly(server, client);
  registerChats(server, client);
  registerAuditLog(server, client);
  registerTraffic(server, client);
  registerScoreJob(server, client);
  registerGenerateCoverLetter(server, client);

  return server;
}
