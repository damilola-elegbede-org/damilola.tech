interface AssessFitResponse {
  assessment: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

interface AssessmentSummary {
  id: string;
  pathname: string;
  assessmentId: string;
  environment: string;
  timestamp: string;
  size: number;
}
interface ListFitAssessmentsResponse {
  assessments: AssessmentSummary[];
}

interface ResumeGenerationSummary {
  id: string;
  jobId: string;
  generationId: string;
  environment: string;
  timestamp: string;
  updatedAt: string;
  companyName: string;
  roleTitle: string;
  scoreBefore: number;
  scoreAfter: number;
  applicationStatus: string;
  size: number;
  generationCount: number;
  parseError?: boolean;
}
interface ListResumeGenerationsResponse {
  generations: ResumeGenerationSummary[];
}

interface ApiClientConfig {
  apiKey: string;
  baseUrl: string;
}

export class ApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor({ apiKey, baseUrl }: ApiClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async _request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options;

    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      // Try to parse JSON error envelope; fall back to status text for non-JSON responses (e.g. proxy 502, HTML 429)
      let message: string;
      try {
        const json = await response.json();
        message = json?.error?.message || `HTTP ${response.status}`;
      } catch {
        const text = await response.text().catch(() => '');
        message = `HTTP ${response.status}: ${text.slice(0, 200)}`;
      }
      throw new Error(message);
    }

    const json = (await response.json()) as { success: true; data: T };
    return json.data;
  }

  async assessFit(input: string): Promise<AssessFitResponse> {
    return this._request<AssessFitResponse>('/api/v1/fit-assessment', {
      method: 'POST',
      body: { input },
    });
  }

  async listFitAssessments(params?: {
    env?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListFitAssessmentsResponse> {
    return this._request<ListFitAssessmentsResponse>('/api/v1/fit-assessments', {
      params: params as Record<string, string | number | undefined>,
    });
  }

  async getFitAssessment(id: string): Promise<unknown> {
    return this._request<unknown>(
      `/api/v1/fit-assessments/${encodeURIComponent(id)}`
    );
  }

  async listResumeGenerations(params?: {
    status?: string;
    company?: string;
    dateFrom?: string;
    dateTo?: string;
    minScore?: number;
    maxScore?: number;
    cursor?: string;
  }): Promise<ListResumeGenerationsResponse> {
    return this._request<ListResumeGenerationsResponse>('/api/v1/resume-generations', {
      params: params as Record<string, string | number | undefined>,
    });
  }

  async getResumeGeneration(id: string): Promise<unknown> {
    return this._request<unknown>(
      `/api/v1/resume-generations/${encodeURIComponent(id)}`
    );
  }

  async getUsageStats(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<unknown> {
    return this._request<unknown>('/api/v1/usage', {
      params: params as Record<string, string | number | undefined>,
    });
  }

  async getStats(params?: { env?: string }): Promise<unknown> {
    return this._request<unknown>('/api/v1/stats', {
      params: params as Record<string, string | number | undefined>,
    });
  }
}
