import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import {
  JobDescriptionInputError,
  resolveJobDescriptionInput,
  resolvePreFetchedJobDescription,
} from '@/lib/job-description-input';
import {
  scoreAts,
  buildResumeText,
} from '@/lib/score-core';
import {
  evaluateFitGates,
  assembleFitScore,
  gatedFitResult,
  FIT_SCORE_SURFACE,
  type FitScoreResult,
} from '@/lib/fit-score';
import { scoreExperienceDimensions } from '@/lib/fit-experience';
import { loadCareerCorpus, CareerCorpusUnavailableError } from '@/lib/career-corpus';

export const runtime = 'nodejs';

const MAX_BODY_SIZE = 256 * 1024;
const MAX_JOB_CONTENT_SIZE = 200 * 1024;

/**
 * The Fit Score as the API returns it. `threshold`/`surfaced` travel with the
 * score so a consumer cannot drift from the scorer's own bar — ENG-1994 exists
 * because the pipeline compared a field capped near 64 against a threshold of
 * 80 for months without anything noticing.
 */
function buildFitScorePayload(fit: FitScoreResult) {
  return {
    total: fit.total,
    threshold: FIT_SCORE_SURFACE,
    surfaced: fit.gateFailed.length === 0 && fit.total >= FIT_SCORE_SURFACE,
    gateFailed: fit.gateFailed,
    gateEvidence: fit.gateEvidence,
    breakdown: fit.breakdown,
    flags: fit.flags,
    titleTier: fit.titleTier,
    remotePosture: fit.remotePosture,
    experienceRaw: fit.experienceRaw,
  };
}

function buildEmptyShellFallbackText({
  title,
  company,
  url,
}: {
  title: string;
  company: string;
  url: string;
}): string {
  const slugHint = (() => {
    try {
      const { pathname } = new URL(url);
      return pathname.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  })();
  return [
    `Position: ${title}`,
    `Company: ${company}`,
    slugHint ? `Role keywords: ${slugHint}` : '',
    `Source: ${url}`,
    'Responsibilities and requirements unavailable — client-side-rendered posting; scoring from title and URL only.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    // ENG-1800: meter authenticated callers under their own tier, keyed by API
    // key id. requireApiKey has already run above, so every caller here is a
    // known first-party client — metering them in the anonymous IP-keyed
    // `resumeGenerator` bucket put a batch client inside an abuse limit.
    const rateLimit = await checkGenericRateLimit(
      RATE_LIMIT_CONFIGS.scoreJobAuthenticated,
      authResult.apiKey.id
    );
    if (rateLimit.limited) {
      return Errors.rateLimited(rateLimit.retryAfter || 60);
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Errors.validationError('Request body must be a JSON object.');
    }

    const { url, title, company, job_content: jobContent, mode, location } = body as Record<string, unknown>;

    if (mode !== undefined && mode !== null && mode !== 'interview-prep') {
      return Errors.badRequest('Invalid mode. Accepted values: "interview-prep".');
    }
    const interviewPrepMode = mode === 'interview-prep';

    const normalizedUrl = typeof url === 'string' ? url.trim() : url;
    const normalizedTitle = typeof title === 'string' ? title.trim() : title;
    const normalizedCompany = typeof company === 'string' ? company.trim() : company;
    const hasJobContent = typeof jobContent === 'string' && jobContent.trim().length > 0;
    const normalizedLocation = typeof location === 'string' ? location.trim() : location;

    if (!normalizedUrl || typeof normalizedUrl !== 'string') {
      return Errors.validationError('"url" is required and must be a string.');
    }
    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return Errors.validationError('"url" must be an http or https URL.');
      }
    } catch {
      return Errors.validationError('"url" must be a valid URL.');
    }
    if (!normalizedTitle || typeof normalizedTitle !== 'string') {
      return Errors.validationError('"title" is required and must be a string.');
    }
    if (!normalizedCompany || typeof normalizedCompany !== 'string') {
      return Errors.validationError('"company" is required and must be a string.');
    }
    if (jobContent !== undefined && typeof jobContent !== 'string') {
      return Errors.validationError('"job_content" must be a string when provided.');
    }
    if (hasJobContent && new TextEncoder().encode(jobContent as string).byteLength > MAX_JOB_CONTENT_SIZE) {
      return Errors.badRequest(`"job_content" exceeds ${MAX_JOB_CONTENT_SIZE} byte limit.`);
    }
    if (location !== undefined && typeof location !== 'string') {
      return Errors.validationError('"location" must be a string when provided.');
    }

    const resolvedInput = hasJobContent
      ? resolvePreFetchedJobDescription(jobContent as string, normalizedUrl)
      : await resolveJobDescriptionInput(
          normalizedUrl,
          'Mozilla/5.0 (compatible; ResumeScoreBot/1.0)'
        );

    const scoringText = resolvedInput.isEmptyShell
      ? buildEmptyShellFallbackText({
          title: normalizedTitle,
          company: normalizedCompany,
          url: normalizedUrl,
        })
      : resolvedInput.text;

    // ENG-1995: the Fit Score answers "should D apply". Gates are pure and run
    // first — a role D can't take skips every model call, the experience
    // component's three included, rather than paying to prove it would have
    // scored well.
    const fitInput = {
      title: normalizedTitle,
      jobDescription: scoringText,
      location: normalizedLocation as string | undefined,
    };
    const fitGates = evaluateFitGates(fitInput, normalizedCompany);

    if (fitGates.failed.length > 0) {
      const fit = gatedFitResult(fitGates);
      // A gated role costs ZERO model calls — neither Fit's three dimension
      // calls nor ATS's five. ATS answers "what does my resume say against this
      // JD", and for a role D cannot take, nobody ever reads the answer.
      // Computing it anyway would spend 5 Opus calls per gated role, on a
      // corpus of ~291 roles a day, to produce a number with no consumer.
      logApiAccess('api_score_job', authResult.apiKey, {
        company: normalizedCompany,
        title: normalizedTitle,
        url: normalizedUrl,
        inputType: resolvedInput.inputType,
        extractedUrl: resolvedInput.extractedUrl,
        emptyShell: resolvedInput.isEmptyShell === true,
        fitScore: fit.total,
        recommendation: 'knocked_out',
        knockoutReasons: fit.gateFailed,
      }, ip).catch((error) => {
        console.warn('[api/v1/score-job] Failed to log audit:', error);
      });

      return apiSuccess({
        company: normalizedCompany,
        title: normalizedTitle,
        url: normalizedUrl,
        fitScore: buildFitScorePayload(fit),
        gapAnalysis: `Knocked out before scoring: ${fit.gateFailed.join(', ')}.`,
        recommendation: 'knocked_out',
        knockout: {
          knockedOut: true,
          hardReasons: fit.gateFailed,
          gateEvidence: fit.gateEvidence,
        },
        resumeGap: { achievable: null, closeable: null, structural: null },
        ...(resolvedInput.isEmptyShell ? { emptyShellFallback: true } : {}),
      });
    }

    // ENG-1995 A1: Fit's experience component scores against the career-data
    // corpus, not the resume. A3: a corpus that will not load is a hard failure —
    // falling back to the resume would emit a plausible, lower score and nothing
    // in the response would say why.
    // D's ruling: Fit reads all career data, the résumé included.
    // The experience component's three dimension calls and the gap-analysis call
    // are independent — run them concurrently so the Fit Score costs latency, not
    // a serial round-trip per dimension on top of the existing one.
    // Fit's three dimension calls and ATS's rubric pass are independent — run
    // them concurrently rather than paying for them in series.
    // The corpus is required for both scores: Fit reads it as career evidence,
    // and ATS (Max) needs it so the ceiling can never assume fabrication.
    const corpus = await loadCareerCorpus(buildResumeText());
    const [experienceDimensions, atsScore] = await Promise.all([
      scoreExperienceDimensions(corpus, scoringText),
      scoreAts(scoringText, corpus),
    ]);
    const fit = assembleFitScore(fitInput, fitGates, experienceDimensions);


    logApiAccess('api_score_job', authResult.apiKey, {
      company: normalizedCompany,
      title: normalizedTitle,
      url: normalizedUrl,
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
      emptyShell: resolvedInput.isEmptyShell === true,
      fitScore: fit.total,
    }, ip).catch((error) => {
      console.warn('[api/v1/score-job] Failed to log audit:', error);
    });

    return apiSuccess({
      company: normalizedCompany,
      title: normalizedTitle,
      url: normalizedUrl,
      fitScore: buildFitScorePayload(fit),
      // A2: each award names the corpus file it came from and quotes it verbatim.
      experienceEvidence: experienceDimensions.map((d) => ({
        dimension: d.dimension,
        score: d.score,
        band: d.band,
        sourceFile: d.sourceFile,
        corpusQuote: d.resumeQuote,
        jdQuote: d.jdQuote,
        evidenceRejected: d.evidenceRejected,
      })),
      corpus: {
        files: corpus.sources.map((s) => s.file),
        totalWords: corpus.totalWords,
      },
      atsScore,
      ...(interviewPrepMode ? { interviewPrepUnavailable: true } : {}),
      // Not knocked out here (the gateFailed branch returns earlier).
      knockout: { knockedOut: false, hardReasons: [], gateEvidence: {} },
      resumeGap: { achievable: null, closeable: null, structural: null },
      ...(resolvedInput.isEmptyShell ? { emptyShellFallback: true } : {}),
    });
  } catch (error) {
    if (error instanceof CareerCorpusUnavailableError) {
      // Loud on purpose (A3). A Fit Score computed without the corpus is not a
      // worse score, it is a different question answered.
      console.error('[api/v1/score-job] Career corpus unavailable:', error.missing);
      return Errors.internalError(error.message);
    }
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message, { failure_mode: error.failureMode });
    }

    console.error('[api/v1/score-job] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
