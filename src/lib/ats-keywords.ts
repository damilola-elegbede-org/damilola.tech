/**
 * ATS Keyword Extraction and Matching
 *
 * Deterministic keyword extraction and matching for ATS scoring.
 * Based on research from 20+ sources triangulated across industry best practices.
 *
 * Key findings used:
 * - 99.7% of recruiters use keyword filters (Jobscan)
 * - 75% match rate target (65% minimum acceptable)
 * - Exact matches beat synonyms - ATS doesn't recognize all synonyms
 * - Job title is the most important keyword (10.6x more likely to get interviews)
 */

/**
 * Common English stopwords to filter from keyword extraction.
 * These words don't carry semantic meaning for ATS matching.
 */
export const STOPWORDS = new Set([
  // Articles
  'a', 'an', 'the',
  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  // Verbs (common auxiliaries)
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'would', 'should', 'could', 'ought',
  'will', 'shall', 'can', 'may', 'might', 'must',
  // Prepositions
  'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'to', 'with', 'about',
  'above', 'across', 'after', 'against', 'along', 'among', 'around', 'before',
  'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'during', 'except',
  'inside', 'near', 'off', 'outside', 'over', 'past', 'since', 'through',
  'throughout', 'toward', 'under', 'until', 'up', 'upon', 'within', 'without',
  // Conjunctions
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'not',
  'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
  // Common words in JDs that aren't keywords
  'ability', 'able', 'work', 'working', 'company', 'team', 'role', 'position',
  'opportunity', 'looking', 'seeking', 'join', 'offer', 'including', 'etc',
  'related', 'relevant', 'strong', 'excellent', 'good', 'great', 'proven',
  'demonstrated', 'successful', 'effective', 'required', 'requirements',
  'responsibilities', 'qualifications', 'preferred', 'minimum', 'must',
  'will', 'ensure', 'provide', 'support', 'help', 'need', 'needs', 'make',
  // Numbers and time
  'years', 'year', 'months', 'month', 'days', 'day', 'time', 'times',
]);

/**
 * Skill synonyms for semantic matching.
 * Maps a canonical term to its variations that should match.
 */
export const SKILL_SYNONYMS: Record<string, string[]> = {
  // Cloud platforms
  'cloud': ['gcp', 'aws', 'azure', 'cloud-native', 'cloud infrastructure', 'google cloud', 'amazon web services'],
  'gcp': ['google cloud platform', 'google cloud', 'gke', 'cloud run', 'bigquery'],
  'aws': ['amazon web services', 'ec2', 's3', 'lambda', 'eks'],
  'azure': ['microsoft azure', 'azure devops', 'aks'],

  // Leadership
  'leadership': ['led', 'leading', 'leader', 'managed', 'managing', 'directed', 'oversaw', 'headed', 'spearheaded'],
  'management': ['manager', 'managing', 'managed', 'supervising', 'supervisor', 'oversight'],
  'engineering manager': ['em', 'tech lead manager', 'engineering lead', 'eng manager', 'engineering mgr'],
  'director': ['director of engineering', 'engineering director', 'director, engineering'],
  'people management': ['people manager', 'team management', 'managing people', 'direct reports'],

  // Platform/Infrastructure
  'platform': ['platform engineering', 'internal platform', 'developer platform', 'devex', 'infrastructure'],
  'infrastructure': ['infra', 'cloud infrastructure', 'platform infrastructure'],
  'devops': ['devex', 'developer experience', 'developer productivity', 'developer tools'],
  'sre': ['site reliability', 'reliability engineering', 'platform reliability'],

  // Container/Orchestration
  'kubernetes': ['k8s', 'gke', 'eks', 'aks', 'container orchestration'],
  'docker': ['containers', 'containerization', 'containerized'],
  'terraform': ['infrastructure as code', 'iac', 'pulumi', 'hcl'],

  // CI/CD
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment', 'continuous delivery', 'pipelines'],
  'github actions': ['gh actions', 'github workflows'],
  'jenkins': ['ci server', 'build automation'],

  // Programming languages
  'python': ['py', 'python3', 'python2'],
  'javascript': ['js', 'node', 'nodejs', 'typescript', 'ts', 'ecmascript'],
  'typescript': ['ts', 'node typescript'],
  'java': ['jvm', 'java8', 'java11', 'java17', 'spring'],
  'go': ['golang', 'go lang'],
  'c++': ['cpp', 'c plus plus'],

  // Methodologies
  'agile': ['scrum', 'kanban', 'sprint', 'agile methodology', 'agile development'],
  'scrum': ['sprint', 'sprint planning', 'scrum master', 'agile scrum'],

  // Architecture
  'microservices': ['microservice', 'service-oriented', 'distributed services'],
  'distributed systems': ['distributed computing', 'distributed architecture'],
  'api': ['api design', 'rest', 'restful', 'graphql', 'grpc', 'api development'],

  // Database
  'sql': ['mysql', 'postgresql', 'postgres', 'database', 'rdbms'],
  'nosql': ['mongodb', 'dynamodb', 'cassandra', 'redis'],

  // Monitoring/Observability
  'observability': ['monitoring', 'logging', 'tracing', 'metrics', 'opentelemetry', 'prometheus', 'grafana'],
  'monitoring': ['observability', 'alerting', 'dashboards'],

  // Communication
  'stakeholder management': ['stakeholder alignment', 'cross-functional', 'executive communication'],
  'communication': ['written communication', 'verbal communication', 'presentation'],

  // Domain
  'healthcare': ['health tech', 'healthtech', 'medical', 'clinical'],
  'fintech': ['financial technology', 'finance', 'banking'],
  'telecom': ['telecommunications', '5g', '4g', '3g', 'wireless'],
};

/**
 * Technology keywords commonly found in JDs.
 * Used to identify technical requirements.
 */
export const TECH_KEYWORDS = new Set([
  // Cloud
  'gcp', 'aws', 'azure', 'cloud', 'kubernetes', 'k8s', 'docker', 'terraform',
  'ansible', 'pulumi', 'cloudformation',
  // Languages
  'python', 'java', 'javascript', 'typescript', 'go', 'golang', 'rust', 'c++',
  'c#', 'ruby', 'scala', 'kotlin', 'swift',
  // Frameworks/Tools
  'react', 'angular', 'vue', 'node', 'django', 'flask', 'spring', 'rails',
  'express', 'fastapi', 'nextjs',
  // Data
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'kafka',
  'spark', 'hadoop', 'bigquery', 'snowflake', 'databricks',
  // DevOps/CI-CD
  'jenkins', 'github', 'gitlab', 'bitbucket', 'circleci', 'travis',
  'argocd', 'spinnaker', 'tekton',
  // Monitoring
  'prometheus', 'grafana', 'datadog', 'splunk', 'newrelic', 'pagerduty',
  'opentelemetry', 'jaeger',
  // API/Protocols
  'rest', 'graphql', 'grpc', 'websockets', 'http', 'tcp',
  // Security
  'oauth', 'jwt', 'ssl', 'tls', 'sso', 'iam',
  // Methodologies
  'agile', 'scrum', 'kanban', 'devops', 'sre', 'ci/cd', 'cicd',
]);

/**
 * Action verbs commonly valued in resumes.
 * Starting bullets with these increases ATS score.
 */
export const ACTION_VERBS = new Set([
  // Leadership
  'led', 'managed', 'directed', 'oversaw', 'headed', 'supervised', 'mentored',
  'coached', 'guided', 'coordinated', 'orchestrated', 'spearheaded',
  // Achievement
  'achieved', 'delivered', 'accomplished', 'completed', 'exceeded', 'surpassed',
  // Creation
  'built', 'created', 'designed', 'developed', 'established', 'founded',
  'implemented', 'launched', 'initiated', 'introduced',
  // Improvement
  'improved', 'enhanced', 'optimized', 'streamlined', 'accelerated', 'increased',
  'reduced', 'decreased', 'transformed', 'modernized', 'upgraded',
  // Strategy
  'architected', 'strategized', 'planned', 'pioneered', 'innovated',
  // Collaboration
  'collaborated', 'partnered', 'aligned', 'unified', 'integrated',
  // Technical
  'engineered', 'automated', 'scaled', 'migrated', 'deployed', 'configured',
]);

/**
 * Section headers that indicate required skills in JDs.
 */
const REQUIRED_SECTION_MARKERS = [
  'required', 'requirements', 'must have', 'minimum qualifications',
  'what you bring', 'what we require', 'essential', 'mandatory',
  "what you'll need", 'qualifications',
];

/**
 * Section headers that indicate nice-to-have skills in JDs.
 * Reserved for future use in nice-to-have vs required differentiation.
 */
const _NICE_TO_HAVE_MARKERS = [
  'nice to have', 'preferred', 'bonus', 'plus', 'ideal', 'desired',
  'additionally', 'preferred qualifications',
];
// Export for future use
export { _NICE_TO_HAVE_MARKERS as NICE_TO_HAVE_MARKERS };

/**
 * Result of keyword matching operation.
 */
export interface MatchResult {
  /** Keywords that were found (exact, stem, or synonym match) */
  matched: string[];
  /** Keywords that were not found */
  missing: string[];
  /** Match details for debugging/analysis */
  matchDetails: Array<{
    keyword: string;
    matchType: 'exact' | 'stem' | 'synonym';
    matchedAs?: string;
  }>;
}

/**
 * Extracted keywords with metadata.
 */
export interface ExtractedKeywords {
  /** All extracted keywords (deduplicated, lowercased) */
  all: string[];
  /** Keywords from the job title */
  fromTitle: string[];
  /** Keywords from required sections */
  fromRequired: string[];
  /** Technology keywords identified */
  technologies: string[];
  /** Action verbs identified */
  actionVerbs: string[];
}

/**
 * Simple word stemmer using suffix stripping.
 * Not as sophisticated as Porter/Snowball but deterministic and sufficient for ATS matching.
 */
export function stemWord(word: string): string {
  const stem = word.toLowerCase();

  // Common suffixes in order of length (longest first)
  const suffixes = [
    'ational', 'tional', 'ization', 'ousness', 'iveness', 'fulness',
    'ation', 'ness', 'ment', 'able', 'ible', 'ance', 'ence', 'ings',
    'ing', 'ful', 'ous', 'ive', 'ity', 'ies', 'ion', 'ed', 'er', 'ly', 's',
  ];

  for (const suffix of suffixes) {
    if (stem.length > suffix.length + 2 && stem.endsWith(suffix)) {
      const stripped = stem.slice(0, -suffix.length);
      // Ensure we don't strip too much
      if (stripped.length >= 3) {
        return stripped;
      }
    }
  }

  return stem;
}

/**
 * Tokenize text into words, handling special cases.
 */
function tokenize(text: string): string[] {
  // Normalize text
  let normalized = text.toLowerCase();

  // Preserve technology names with special characters
  normalized = normalized
    .replace(/c\+\+/g, 'cpp')
    .replace(/c#/g, 'csharp')
    .replace(/\.net/g, 'dotnet')
    .replace(/node\.js/g, 'nodejs')
    .replace(/react\.js/g, 'reactjs')
    .replace(/vue\.js/g, 'vuejs')
    .replace(/ci\/cd/g, 'cicd');

  // Split on non-alphanumeric (but keep hyphens in compound words)
  const words = normalized
    .split(/[^a-z0-9-]+/)
    .filter(w => w.length > 1)
    .map(w => w.replace(/^-+|-+$/g, '')); // trim hyphens from edges

  return words;
}

/**
 * Extract job title from JD text.
 * Looks for common title patterns at the beginning.
 */
function extractJobTitle(jd: string): string | null {
  const lines = jd.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // First non-empty line is often the title
  if (lines.length > 0) {
    const firstLine = lines[0];
    // Check if it looks like a title (short, contains relevant words)
    if (firstLine.length < 100 &&
        /\b(engineer|manager|director|lead|senior|staff|principal|architect|developer)\b/i.test(firstLine)) {
      return firstLine;
    }
  }

  // Look for explicit title patterns
  const titlePatterns = [
    /job title:\s*([^\n]+)/i,
    /position:\s*([^\n]+)/i,
    /role:\s*([^\n]+)/i,
    /title:\s*([^\n]+)/i,
  ];

  for (const pattern of titlePatterns) {
    const match = jd.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract section content from JD based on markers.
 */
function extractSection(jd: string, markers: string[]): string {
  const lowerJd = jd.toLowerCase();
  let content = '';

  for (const marker of markers) {
    const idx = lowerJd.indexOf(marker);
    if (idx !== -1) {
      // Extract content after the marker until next section or end
      const afterMarker = jd.slice(idx + marker.length);
      // Find next section header (usually a line with colon or specific patterns)
      const nextSectionMatch = afterMarker.match(/\n\s*[A-Z][a-zA-Z\s]+:\s*\n/);
      const sectionEnd = nextSectionMatch?.index ?? afterMarker.length;
      content += ' ' + afterMarker.slice(0, sectionEnd);
    }
  }

  return content;
}

/**
 * Extract keywords from a job description.
 *
 * Algorithm (deterministic order):
 * 1. Extract job title keywords (highest priority)
 * 2. Extract from required/must-have sections
 * 3. Identify technology keywords
 * 4. Identify action verbs
 * 5. Deduplicate and return top N
 *
 * @param jd - Job description text
 * @param count - Maximum number of keywords to return (default 20)
 * @returns Extracted keywords with metadata
 */
export function extractKeywords(jd: string, count: number = 20): ExtractedKeywords {
  const keywords: string[] = [];
  const fromTitle: string[] = [];
  const fromRequired: string[] = [];
  const technologies: string[] = [];
  const actionVerbs: string[] = [];
  const seen = new Set<string>();

  const addKeyword = (word: string, category: string[]): boolean => {
    const lower = word.toLowerCase();
    if (!seen.has(lower) && !STOPWORDS.has(lower) && lower.length > 2) {
      seen.add(lower);
      keywords.push(lower);
      category.push(lower);
      return true;
    }
    return false;
  };

  // 1. Extract job title keywords (highest priority)
  const title = extractJobTitle(jd);
  if (title) {
    const titleWords = tokenize(title);
    for (const word of titleWords) {
      addKeyword(word, fromTitle);
    }
  }

  // 2. Extract from required sections
  const requiredContent = extractSection(jd, REQUIRED_SECTION_MARKERS);
  const requiredWords = tokenize(requiredContent);
  for (const word of requiredWords) {
    // Prioritize technology keywords
    if (TECH_KEYWORDS.has(word)) {
      addKeyword(word, technologies);
      addKeyword(word, fromRequired);
    } else if (!STOPWORDS.has(word)) {
      addKeyword(word, fromRequired);
    }
  }

  // 3. Identify technology keywords from full JD
  const allWords = tokenize(jd);
  for (const word of allWords) {
    if (TECH_KEYWORDS.has(word)) {
      addKeyword(word, technologies);
    }
  }

  // 4. Identify action verbs
  for (const word of allWords) {
    if (ACTION_VERBS.has(word)) {
      addKeyword(word, actionVerbs);
    }
  }

  // 5. Fill remaining slots with other meaningful words
  const wordFreq = new Map<string, number>();
  for (const word of allWords) {
    if (!STOPWORDS.has(word) && !seen.has(word) && word.length > 2) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  // Sort by frequency and add top remaining words
  const sortedByFreq = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  for (const word of sortedByFreq) {
    if (keywords.length >= count) break;
    addKeyword(word, []);
  }

  return {
    all: keywords.slice(0, count),
    fromTitle,
    fromRequired,
    technologies,
    actionVerbs,
  };
}

/**
 * Count total words in text (for density calculation).
 */
export function wordCount(text: string): number {
  return tokenize(text).length;
}

/**
 * Match extracted keywords against resume text.
 *
 * Matching rules (deterministic):
 * 1. Exact match (case-insensitive): 2 points
 * 2. Stem match (e.g., "leading" matches "led"): 1.5 points
 * 3. Synonym match: 1 point
 *
 * @param keywords - Keywords extracted from JD
 * @param resumeText - Full text of the resume
 * @returns Match result with matched/missing keywords
 */
export function matchKeywords(keywords: string[], resumeText: string): MatchResult {
  const resumeLower = resumeText.toLowerCase();
  const resumeTokens = new Set(tokenize(resumeText));
  const resumeStems = new Set([...resumeTokens].map(stemWord));

  const matched: string[] = [];
  const missing: string[] = [];
  const matchDetails: MatchResult['matchDetails'] = [];

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();

    // 1. Check exact match
    if (resumeLower.includes(keywordLower) || resumeTokens.has(keywordLower)) {
      matched.push(keyword);
      matchDetails.push({ keyword, matchType: 'exact' });
      continue;
    }

    // 2. Check stem match
    const keywordStem = stemWord(keywordLower);
    if (resumeStems.has(keywordStem)) {
      matched.push(keyword);
      matchDetails.push({ keyword, matchType: 'stem', matchedAs: keywordStem });
      continue;
    }

    // 3. Check synonym match
    let synonymFound = false;
    const synonyms = SKILL_SYNONYMS[keywordLower] || [];

    // Also check if the keyword itself is a synonym of something
    const allSynonymSets = Object.entries(SKILL_SYNONYMS);
    const additionalSynonyms: string[] = [];
    for (const [canonical, syns] of allSynonymSets) {
      if (syns.includes(keywordLower)) {
        additionalSynonyms.push(canonical, ...syns.filter(s => s !== keywordLower));
      }
    }

    const allSynonyms = [...synonyms, ...additionalSynonyms];
    for (const syn of allSynonyms) {
      if (resumeLower.includes(syn.toLowerCase())) {
        matched.push(keyword);
        matchDetails.push({ keyword, matchType: 'synonym', matchedAs: syn });
        synonymFound = true;
        break;
      }
    }

    if (!synonymFound) {
      missing.push(keyword);
    }
  }

  return { matched, missing, matchDetails };
}

/**
 * Calculate match rate percentage.
 */
export function calculateMatchRate(matched: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((matched / total) * 100);
}

/**
 * Calculate keyword density percentage.
 */
export function calculateKeywordDensity(matchedCount: number, totalWords: number): number {
  if (totalWords === 0) return 0;
  return Math.round((matchedCount / totalWords) * 1000) / 10; // One decimal place
}
