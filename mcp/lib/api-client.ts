import type { GateFailedReason, SignalBreakdown } from '@/lib/role-fit-scorer';

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
  scorePossibleMax?: number;
  currentScore?: number;
  possibleMaxScore?: number;
  applicationStatus: string;
  size: number;
  generationCount: number;
  parseError?: boolean;
}
interface ListResumeGenerationsResponse {
  generations: ResumeGenerationSummary[];
}

interface ScoreResumeResponse {
  currentScore: {
    total: number;
    breakdown: {
      roleRelevance: number;
      claritySkimmability: number;
      businessImpact: number;
      presentationQuality: number;
    };
    matchedKeywords: string[];
    missingKeywords: string[];
    matchRate: number;
    keywordDensity: number;
  };
  maxPossibleScore: number;
  gapAnalysis: string;
  recommendation: 'full_generation_recommended' | 'marginal_improvement' | 'strong_fit';
}

interface JobKnockoutInfo {
  knockedOut: boolean;
  hardReasons: GateFailedReason[];
  gateEvidence: Record<string, string>;
}

interface ScoreJobResponse {
  company: string;
  title: string;
  url: string;
  currentScore: { total: number; breakdown: SignalBreakdown };
  maxPossibleScore: number;
  gapAnalysis: string;
  // ENG-1564: 'knocked_out' means a hybrid knockout gate (G1-G4, see
  // role-fit-scorer.ts) rejected this role before scoring ran —
  // currentScore/maxPossibleScore are both 0 in that case, not a genuine low
  // fit score. See `knockout` for the reasons.
  recommendation: 'full_generation_recommended' | 'marginal_improvement' | 'strong_fit' | 'knocked_out';
  knockout?: JobKnockoutInfo;
}

export interface GenerateCoverLetterInput {
  job_posting_url?: string;
  job_posting_text?: string;
  score_job_output?: string;
  tone?: 'confident' | 'warm' | 'technical';
  company?: string;
  role?: string;
}

export interface CoverLetterResult {
  cover_letter_markdown: string;
  metadata: {
    company: string;
    role: string;
    generated_at: string;
    model: string;
    input_source: 'url' | 'text';
    score_job_used: boolean;
    token_usage: {
      input: number;
      output: number;
      cache_read: number;
    };
  };
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
      throw new Error(await this._readErrorMessage(response));
    }

    const json = (await response.json()) as { success: true; data: T };
    return json.data;
  }

  private async _readErrorMessage(response: Response): Promise<string> {
    // Try to parse JSON error envelope; fall back to status text for non-JSON responses (e.g. proxy 502, HTML 429)
    try {
      const json = await response.json() as { error?: { message?: string } };
      return json?.error?.message || `HTTP ${response.status}`;
    } catch {
      const text = await response.text().catch(() => '');
      return `HTTP ${response.status}: ${text.slice(0, 200)}`;
    }
  }

  private async _requestForm<T>(
    path: string,
    formData: FormData,
    options: { params?: Record<string, string | number | undefined> } = {}
  ): Promise<T> {
    const { params } = options;

    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await this._readErrorMessage(response));
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

  async scoreResume(input: string): Promise<ScoreResumeResponse> {
    return this._request<ScoreResumeResponse>('/api/v1/score-resume', {
      method: 'POST',
      body: { input },
    });
  }

  async scoreJob(url: string, title: string, company: string): Promise<ScoreJobResponse> {
    return this._request<ScoreJobResponse>('/api/v1/score-job', {
      method: 'POST',
      body: { url, title, company },
    });
  }

  async generateResume(input: string): Promise<unknown> {
    return this._request<unknown>('/api/v1/resume-generator', {
      method: 'POST',
      body: { input },
    });
  }

  async generateCoverLetter(input: GenerateCoverLetterInput): Promise<CoverLetterResult> {
    return this._request<CoverLetterResult>('/api/v1/generate-cover-letter', {
      method: 'POST',
      body: input,
    });
  }

  async updateApplicationStatus(
    id: string,
    updates: {
      applicationStatus?: string;
      appliedDate?: string;
      notes?: string;
    }
  ): Promise<unknown> {
    return this._request<unknown>(
      `/api/v1/resume-generations/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: updates,
      }
    );
  }

  async getResumeData(): Promise<unknown> {
    return this._request<unknown>('/api/v1/resume-data');
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

  async modifyChange(params: {
    originalChange: {
      section: string;
      original: string;
      modified: string;
      reason: string;
      relevanceSignals: string[];
      impactPoints: number;
    };
    modifyPrompt: string;
    jobDescription: string;
  }): Promise<unknown> {
    return this._request<unknown>('/api/v1/resume-generator/modify-change', {
      method: 'POST',
      body: params,
    });
  }

  async uploadResumePdf(params: {
    pdfBase64: string;
    companyName: string;
    roleTitle: string;
  }): Promise<unknown> {
    const pdfBuffer = Buffer.from(params.pdfBase64, 'base64');
    const formData = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('pdf', pdfBlob, 'resume.pdf');
    formData.append('companyName', params.companyName);
    formData.append('roleTitle', params.roleTitle);

    return this._requestForm<unknown>('/api/v1/resume-generator/upload-pdf', formData);
  }

  async logGeneration(params: {
    generationId: string;
    jobId: string;
    jobIdentifier: Record<string, unknown>;
    companyName: string;
    roleTitle: string;
    jobDescriptionFull: string;
    datePosted?: string;
    inputType?: string;
    extractedUrl?: string;
    estimatedCompatibility?: Record<string, unknown>;
    changesAccepted?: unknown[];
    changesRejected?: unknown[];
    gapsIdentified?: unknown[];
    pdfUrl?: string;
    optimizedResumeJson?: Record<string, unknown>;
  }): Promise<unknown> {
    return this._request<unknown>('/api/v1/resume-generator/log', {
      method: 'POST',
      body: params,
    });
  }

  async getStatsOnly(params?: { env?: string }): Promise<unknown> {
    return this._request<unknown>('/api/v1/stats', {
      params: params as Record<string, string | number | undefined>,
    });
  }

  async listChats(params?: {
    env?: string;
    limit?: number;
    cursor?: string;
  }): Promise<unknown> {
    return this._request<unknown>('/api/v1/chats', {
      params: params as Record<string, string | number | undefined>,
    });
  }

  async getChat(id: string): Promise<unknown> {
    return this._request<unknown>(`/api/v1/chats/${encodeURIComponent(id)}`);
  }

  async getAuditLog(params?: {
    env?: string;
    eventType?: string;
    limit?: number;
    cursor?: string;
  }): Promise<unknown> {
    return this._request<unknown>('/api/v1/audit', {
      params: params as Record<string, string | number | undefined>,
    });
  }

  async getTraffic(params?: {
    env?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<unknown> {
    return this._request<unknown>('/api/v1/traffic', {
      params: params as Record<string, string | number | undefined>,
    });
  }
}
