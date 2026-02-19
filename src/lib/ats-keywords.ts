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
  // JD filler words that waste keyword slots
  'proficiency', 'proficient', 'understanding', 'familiarity', 'familiar',
  'knowledge', 'experience', 'expertise', 'exposure', 'contributions',
  'passion', 'passionate', 'enthusiasm', 'comfortable', 'competence',
  'competent', 'skilled', 'capable', 'hands-on', 'background',
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
  'aws': ['amazon web services', 'ec2', 's3', 'lambda', 'eks', 'cloudwatch', 'sagemaker'],
  'azure': ['microsoft azure', 'azure devops', 'aks', 'azure functions'],

  // Leadership
  'leadership': ['led', 'leading', 'leader', 'managed', 'managing', 'directed', 'oversaw', 'headed', 'spearheaded'],
  'management': ['manager', 'managing', 'managed', 'supervising', 'supervisor', 'oversight'],
  'engineering manager': ['em', 'tech lead manager', 'engineering lead', 'eng manager', 'engineering mgr'],
  'director': ['director of engineering', 'engineering director', 'director, engineering'],
  'people management': ['people manager', 'team management', 'managing people', 'direct reports'],
  'mentoring': ['mentorship', 'coaching', 'career development', 'growing engineers'],

  // Platform/Infrastructure
  'platform': ['platform engineering', 'internal platform', 'developer platform', 'devex', 'infrastructure'],
  'infrastructure': ['infra', 'cloud infrastructure', 'platform infrastructure'],
  'devops': ['devex', 'developer experience', 'developer productivity', 'developer tools'],
  'sre': ['site reliability', 'reliability engineering', 'platform reliability'],
  'system design': ['systems design', 'architecture design', 'technical design'],

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
  'java': ['jvm', 'java8', 'java11', 'java17', 'spring', 'spring boot'],
  'go': ['golang', 'go lang'],
  'c++': ['cpp', 'c plus plus'],
  'rust': ['rustlang'],
  'ruby': ['rails', 'ruby on rails'],
  'scala': ['akka', 'play framework'],
  'kotlin': ['android kotlin', 'kotlin multiplatform'],
  'swift': ['swiftui', 'ios swift'],

  // Methodologies
  'agile': ['scrum', 'kanban', 'sprint', 'agile methodology', 'agile development'],
  'scrum': ['sprint', 'sprint planning', 'scrum master', 'agile scrum'],

  // Architecture
  'microservices': ['microservice', 'service-oriented', 'distributed services'],
  'distributed systems': ['distributed computing', 'distributed architecture'],
  'api': ['api design', 'rest', 'restful', 'graphql', 'grpc', 'api development'],
  'event-driven': ['event sourcing', 'cqrs', 'message-driven', 'pub/sub'],

  // Database
  'sql': ['mysql', 'postgresql', 'postgres', 'database', 'rdbms'],
  'nosql': ['mongodb', 'dynamodb', 'cassandra', 'redis'],
  'data modeling': ['schema design', 'database design', 'erd'],

  // Monitoring/Observability
  'observability': ['monitoring', 'logging', 'tracing', 'metrics', 'opentelemetry', 'prometheus', 'grafana'],
  'monitoring': ['observability', 'alerting', 'dashboards'],

  // Communication
  'stakeholder management': ['stakeholder alignment', 'cross-functional', 'executive communication'],
  'communication': ['written communication', 'verbal communication', 'presentation'],

  // Domain
  'healthcare': ['health tech', 'healthtech', 'medical', 'clinical', 'hipaa'],
  'fintech': ['financial technology', 'finance', 'banking', 'payments'],
  'telecom': ['telecommunications', '5g', '4g', '3g', 'wireless'],
  'ecommerce': ['e-commerce', 'online retail', 'marketplace', 'shopping'],

  // AI/ML
  'machine learning': ['ml', 'deep learning', 'neural networks', 'model training', 'ml engineering'],
  'artificial intelligence': ['ai', 'generative ai', 'gen ai', 'llm', 'large language models'],
  'tensorflow': ['tf', 'keras', 'tf2'],
  'pytorch': ['torch', 'torchvision'],
  'data science': ['data scientist', 'statistical modeling', 'predictive analytics'],
  'nlp': ['natural language processing', 'text mining', 'language models'],
  'computer vision': ['cv', 'image recognition', 'object detection'],

  // Data Engineering
  'data pipeline': ['etl', 'data ingestion', 'data workflow', 'data orchestration'],
  'data warehouse': ['data lake', 'data lakehouse', 'olap', 'dimensional modeling'],
  'apache spark': ['spark', 'pyspark', 'spark sql'],
  'apache kafka': ['kafka', 'kafka streams', 'event streaming'],
  'airflow': ['apache airflow', 'dag', 'workflow orchestration'],
  'dbt': ['data build tool', 'data transformation'],

  // Security
  'security': ['cybersecurity', 'infosec', 'information security', 'appsec'],
  'authentication': ['auth', 'oauth', 'saml', 'openid', 'sso'],
  'encryption': ['tls', 'ssl', 'cryptography', 'data encryption'],
  'compliance': ['soc2', 'soc 2', 'gdpr', 'hipaa', 'pci dss', 'iso 27001'],

  // Product
  'product management': ['product manager', 'pm', 'product owner', 'product strategy'],
  'roadmap': ['product roadmap', 'technology roadmap', 'strategic planning'],
  'user research': ['ux research', 'user testing', 'usability testing'],

  // Frontend
  'frontend': ['front-end', 'front end', 'client-side', 'ui development'],
  'react': ['reactjs', 'react.js', 'react hooks', 'react native'],
  'css': ['sass', 'scss', 'tailwind', 'styled-components', 'css-in-js'],
  'design system': ['component library', 'ui library', 'storybook'],

  // Mobile
  'mobile': ['mobile development', 'mobile app', 'native mobile'],
  'ios': ['iphone', 'ipad', 'apple platform', 'uikit', 'swiftui'],
  'android': ['android sdk', 'jetpack compose', 'android studio'],
  'react native': ['expo', 'cross-platform mobile'],
  'flutter': ['dart', 'cross-platform mobile'],

  // Testing
  'testing': ['test automation', 'qa', 'quality assurance', 'test engineering'],
  'unit testing': ['unit tests', 'test-driven development', 'tdd'],
  'integration testing': ['integration tests', 'e2e testing', 'end-to-end testing'],

  // Project Management
  'project management': ['program management', 'delivery management', 'project planning'],
  'jira': ['atlassian', 'confluence', 'project tracking'],
};

/**
 * Reverse index: synonym value → canonical keys that contain it.
 * Built at module load for O(1) lookup in matchKeywords.
 */
export const SYNONYM_REVERSE_INDEX: Map<string, string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    for (const syn of synonyms) {
      const synLower = syn.toLowerCase();
      const existing = index.get(synLower) || [];
      existing.push(canonical);
      index.set(synLower, existing);
    }
  }
  return index;
})();

/**
 * Curated set of multi-word phrases commonly found in JDs.
 * Used for phrase extraction before single-word tokenization.
 */
export const KNOWN_PHRASES = new Set([
  // AI/ML
  'machine learning', 'deep learning', 'neural networks', 'natural language processing',
  'computer vision', 'data science', 'artificial intelligence', 'generative ai',
  'large language models', 'model training', 'ml engineering', 'reinforcement learning',
  'feature engineering',

  // Data
  'data pipeline', 'data warehouse', 'data lake', 'data engineering', 'data modeling',
  'data governance', 'data quality', 'data analytics', 'big data', 'data processing',
  'real-time data', 'data integration', 'data migration',

  // Architecture & Systems
  'system design', 'systems design', 'distributed systems', 'microservices architecture',
  'event-driven architecture', 'service-oriented architecture', 'domain-driven design',
  'api design', 'api development', 'technical architecture', 'solution architecture',
  'high availability', 'fault tolerance', 'load balancing', 'horizontal scaling',

  // Cloud & Infrastructure
  'cloud infrastructure', 'infrastructure as code', 'cloud-native', 'cloud migration',
  'container orchestration', 'platform engineering', 'developer platform',
  'google cloud platform', 'amazon web services', 'microsoft azure',
  'site reliability', 'reliability engineering',

  // DevOps & CI/CD
  'continuous integration', 'continuous deployment', 'continuous delivery',
  'github actions', 'build automation', 'deployment automation',
  'infrastructure automation', 'configuration management',

  // Management & Leadership
  'engineering manager', 'engineering director', 'tech lead', 'technical lead',
  'people management', 'team management', 'team building', 'performance management',
  'stakeholder management', 'cross-functional', 'direct reports',
  'product management', 'product manager', 'program management', 'project management',
  'change management', 'organizational design', 'talent development',

  // Software Engineering
  'software engineering', 'software development', 'software architecture',
  'full stack', 'full-stack', 'back end', 'back-end', 'front end', 'front-end',
  'test-driven development', 'code review', 'technical debt',
  'agile development', 'agile methodology', 'design patterns',
  'object-oriented', 'functional programming', 'version control',

  // Frontend
  'user interface', 'user experience', 'design system', 'component library',
  'responsive design', 'web development', 'single page application',
  'progressive web app', 'accessibility compliance',

  // Mobile
  'mobile development', 'mobile app', 'react native', 'cross-platform mobile',
  'native mobile', 'mobile architecture',

  // Security
  'information security', 'application security', 'network security',
  'threat modeling', 'penetration testing', 'security audit',
  'access control', 'identity management',

  // Testing
  'test automation', 'quality assurance', 'integration testing',
  'end-to-end testing', 'unit testing', 'performance testing',
  'load testing', 'regression testing',

  // Database
  'database design', 'database administration', 'schema design',
  'query optimization', 'data replication',

  // Networking/Protocols
  'api gateway', 'service mesh', 'message queue', 'event streaming',

  // Business & Community
  'business intelligence', 'competitive analysis', 'market research',
  'user research', 'customer experience', 'digital transformation',
  'technical strategy', 'technology roadmap', 'strategic planning',
  'open source',

  // Compliance & Governance
  'regulatory compliance', 'risk management', 'audit compliance',

  // Observability
  'log management', 'distributed tracing', 'incident management',
  'on-call', 'runbook automation',

  // Roles (for title detection)
  'software engineer', 'senior engineer', 'staff engineer', 'principal engineer',
  'engineering lead', 'data engineer', 'data scientist', 'data analyst',
  'product designer', 'ux designer', 'solutions architect', 'cloud architect',
  'devops engineer', 'sre engineer', 'security engineer', 'qa engineer',
  'mobile engineer', 'frontend engineer', 'backend engineer',
  'machine learning engineer', 'platform engineer',
]);

/** Sorted phrases longest-first for greedy extraction. */
const SORTED_PHRASES = [...KNOWN_PHRASES].sort((a, b) => b.length - a.length);

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
  // Multi-word tech keywords
  'machine learning', 'deep learning', 'data pipeline', 'data warehouse',
  'infrastructure as code', 'system design', 'distributed systems',
  'github actions', 'site reliability',
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
  "what you'll need", 'qualifications', 'what we\'re looking for',
  'you should have', 'key skills', 'core requirements',
  'basic qualifications', 'you will need', 'key qualifications',
];

/**
 * Section headers that indicate nice-to-have skills in JDs.
 */
export const NICE_TO_HAVE_MARKERS = [
  'nice to have', 'preferred', 'bonus', 'plus', 'ideal', 'desired',
  'additionally', 'preferred qualifications', 'it would be great if',
  'extra credit', 'nice-to-have', 'additional qualifications',
  'desirable', 'a plus', 'advantageous',
];

/**
 * Section headers that indicate responsibilities.
 */
const RESPONSIBILITIES_MARKERS = [
  'responsibilities', 'what you\'ll do', 'what you will do',
  'your role', 'the role', 'job duties', 'key responsibilities',
  'day to day', 'day-to-day', 'in this role', 'you will',
  'duties', 'scope', 'about the role', 'role overview',
];

/**
 * Section headers for about/company sections.
 */
const ABOUT_SECTION_MARKERS = [
  'about us', 'about the company', 'who we are', 'our mission',
  'company overview', 'about the team', 'why join',
  'what we offer', 'benefits', 'perks', 'compensation',
];

/**
 * Priority level for a keyword based on its JD section.
 */
export type KeywordPriority = 'title' | 'required' | 'responsibilities' | 'niceToHave' | 'general';

/**
 * Parsed JD section with classified type.
 */
export interface ParsedSection {
  type: 'required' | 'niceToHave' | 'responsibilities' | 'about' | 'unknown';
  header: string;
  content: string;
}

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
  /** Keywords from nice-to-have sections */
  fromNiceToHave: string[];
  /** Technology keywords identified */
  technologies: string[];
  /** Action verbs identified */
  actionVerbs: string[];
  /** Priority mapping for each keyword (keyword → priority level) */
  keywordPriorities: Record<string, KeywordPriority>;
  /** Frequency count of each keyword in the JD */
  keywordFrequency: Record<string, number>;
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
 * Extract known multi-word phrases from text (longest-first greedy).
 * Returns found phrases and the remaining text with phrases removed.
 */
export function extractPhrases(text: string): { phrases: string[]; remainder: string } {
  let remaining = text.toLowerCase();
  const phrases: string[] = [];

  for (const phrase of SORTED_PHRASES) {
    const phraseLower = phrase;
    // Find all occurrences of this phrase
    let searchFrom = 0;
    let idx = remaining.indexOf(phraseLower, searchFrom);
    while (idx !== -1) {
      phrases.push(phraseLower);
      // Replace occurrence with spaces to preserve positions and avoid overlapping matches
      remaining = remaining.slice(0, idx) + ' '.repeat(phraseLower.length) + remaining.slice(idx + phraseLower.length);
      searchFrom = idx + phraseLower.length;
      idx = remaining.indexOf(phraseLower, searchFrom);
    }
  }

  return { phrases, remainder: remaining };
}

/**
 * Tokenize text into words, handling special cases.
 * Also extracts multi-word phrases from KNOWN_PHRASES.
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
 * Tokenize text into both phrases and single words.
 * Extracts known phrases first, then word-splits the remainder.
 */
function tokenizeWithPhrases(text: string): string[] {
  const { phrases, remainder } = extractPhrases(text);
  const words = tokenize(remainder);
  return [...phrases, ...words];
}

/**
 * Parse JD into structured sections using a two-pass parser.
 *
 * Pass 1: Identify section header lines via patterns
 * Pass 2: Extract content between consecutive headers and classify
 */
export function parseJDSections(jd: string): ParsedSection[] {
  const lines = jd.split('\n');
  const sections: ParsedSection[] = [];

  // Header detection patterns
  const isHeader = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    // Markdown ## headers
    if (/^#{1,3}\s+/.test(trimmed)) return true;
    // Bold **header**
    if (/^\*\*[^*]+\*\*\s*$/.test(trimmed)) return true;
    // ALL CAPS lines (at least 2 words, all uppercase letters)
    if (/^[A-Z][A-Z\s/&-]{3,}$/.test(trimmed) && trimmed.length < 80) return true;
    // Colon-terminated headers (word(s) followed by colon)
    if (/^[A-Za-z][A-Za-z\s'''-]{2,}:\s*$/.test(trimmed)) return true;
    // Colon at end of short line
    if (trimmed.endsWith(':') && trimmed.length < 80 && !/^\s*-/.test(trimmed)) return true;
    return false;
  };

  // Pass 1: Find header positions
  const headerPositions: Array<{ line: number; header: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (isHeader(lines[i])) {
      const header = lines[i].trim()
        .replace(/^#{1,3}\s+/, '')
        .replace(/^\*\*|\*\*$/g, '')
        .replace(/:\s*$/, '')
        .trim();
      headerPositions.push({ line: i, header });
    }
  }

  // Pass 2: Extract content between headers
  if (headerPositions.length === 0) {
    // No headers found — use fallback
    return fallbackSectionParsing(jd);
  }

  for (let i = 0; i < headerPositions.length; i++) {
    const startLine = headerPositions[i].line + 1;
    const endLine = i + 1 < headerPositions.length
      ? headerPositions[i + 1].line
      : lines.length;
    const content = lines.slice(startLine, endLine).join('\n').trim();
    const header = headerPositions[i].header;
    const type = classifySection(header);
    sections.push({ type, header, content });
  }

  return sections;
}

/**
 * Classify a section header into a section type.
 */
function classifySection(header: string): ParsedSection['type'] {
  const lower = header.toLowerCase();

  // Check nice-to-have BEFORE required — "preferred qualifications" should
  // match 'preferred' before the generic 'qualifications' in required markers
  for (const marker of NICE_TO_HAVE_MARKERS) {
    if (lower.includes(marker)) return 'niceToHave';
  }
  for (const marker of REQUIRED_SECTION_MARKERS) {
    if (lower.includes(marker)) return 'required';
  }
  for (const marker of RESPONSIBILITIES_MARKERS) {
    if (lower.includes(marker)) return 'responsibilities';
  }
  for (const marker of ABOUT_SECTION_MARKERS) {
    if (lower.includes(marker)) return 'about';
  }

  return 'unknown';
}

/**
 * Fallback parsing for JDs without clear section headers.
 * Uses heuristics: bullet position and inline signal words.
 */
function fallbackSectionParsing(jd: string): ParsedSection[] {
  const lines = jd.split('\n');
  const sections: ParsedSection[] = [];
  let currentContent: string[] = [];
  let currentType: ParsedSection['type'] = 'unknown';

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    // Check for inline signal words that suggest section type
    let detectedType: ParsedSection['type'] | null = null;
    // Check niceToHave before required (matches classifySection order)
    // to avoid "preferred qualifications" matching "qualifications" as required
    for (const marker of NICE_TO_HAVE_MARKERS) {
      if (lower.includes(marker)) { detectedType = 'niceToHave'; break; }
    }
    if (!detectedType) {
      for (const marker of REQUIRED_SECTION_MARKERS) {
        if (lower.includes(marker)) { detectedType = 'required'; break; }
      }
    }
    if (!detectedType) {
      for (const marker of RESPONSIBILITIES_MARKERS) {
        if (lower.includes(marker)) { detectedType = 'responsibilities'; break; }
      }
    }

    if (detectedType && detectedType !== currentType) {
      if (currentContent.length > 0) {
        sections.push({ type: currentType, header: '', content: currentContent.join('\n').trim() });
      }
      currentType = detectedType;
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({ type: currentType, header: '', content: currentContent.join('\n').trim() });
  }

  // If no sections were classified, treat entire JD as unknown
  if (sections.length === 0) {
    sections.push({ type: 'unknown', header: '', content: jd.trim() });
  }

  return sections;
}

/**
 * Extract job title from JD text.
 * Scans first 5 lines, scores candidates, checks for explicit labels.
 */
function extractJobTitle(jd: string): string | null {
  const lines = jd.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Expanded role words for title detection
  const rolePattern = /\b(engineer|manager|director|lead|senior|staff|principal|architect|developer|analyst|scientist|designer|head|vp|vice president|coordinator|administrator|specialist|consultant|strategist)\b/i;

  // Check for explicit label patterns first
  const titlePatterns = [
    /job title:\s*([^\n]+)/i,
    /position:\s*([^\n]+)/i,
    /role:\s*([^\n]+)/i,
    /title:\s*([^\n]+)/i,
    /hiring for:\s*([^\n]+)/i,
    /we are hiring[^:]*:\s*([^\n]+)/i,
  ];

  for (const pattern of titlePatterns) {
    const match = jd.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Score first 5 non-empty lines as title candidates
  // Must contain a role word to be considered
  const candidates: Array<{ line: string; score: number }> = [];
  const scanLimit = Math.min(lines.length, 5);

  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i];
    // Check markdown/HTML headings
    const cleaned = line.replace(/^#{1,3}\s+/, '').replace(/^\*\*|\*\*$/g, '').replace(/<[^>]+>/g, '').trim();

    // Gate: must contain a role word to be considered a title candidate
    if (!rolePattern.test(cleaned)) continue;

    let score = 0;
    // Short lines score higher (titles are usually concise)
    if (cleaned.length < 80) score += 2;
    if (cleaned.length < 50) score += 1;
    // Contains role word (guaranteed by gate above)
    score += 3;
    // Not a sentence (no period at end, limited words)
    if (!cleaned.endsWith('.') && cleaned.split(/\s+/).length <= 10) score += 1;
    // Earlier lines are more likely titles
    score += (scanLimit - i) * 0.5;
    // Markdown heading or bold gets extra credit
    if (/^#{1,3}\s+/.test(line) || /^\*\*/.test(line)) score += 1;

    if (score >= 3) {
      candidates.push({ line: cleaned, score });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].line;
  }

  return null;
}

/**
 * Calculate dynamic keyword count based on JD complexity.
 * Formula: clamp(15 + floor(words/50) + min(sections, 5), 10, 40)
 */
export function calculateDynamicKeywordCount(jd: string): number {
  const words = tokenize(jd).length;
  const sections = parseJDSections(jd).length;
  const count = 15 + Math.floor(words / 50) + Math.min(sections, 5);
  return Math.max(10, Math.min(40, count));
}

/**
 * Extract keywords from a job description.
 *
 * Algorithm (deterministic order):
 * 1. Parse JD sections
 * 2. Extract job title keywords (highest priority)
 * 3. Extract from required sections
 * 3.5 Extract from responsibilities sections
 * 4. Extract from nice-to-have sections
 * 5. Identify technology keywords
 * 6. Identify action verbs
 * 7. Fill remaining slots with frequency-ordered words
 *
 * @param jd - Job description text
 * @param count - Maximum number of keywords to return (default 20)
 * @returns Extracted keywords with metadata
 */
export function extractKeywords(jd: string, count: number = 20): ExtractedKeywords {
  const keywords: string[] = [];
  const fromTitle: string[] = [];
  const fromRequired: string[] = [];
  const fromNiceToHave: string[] = [];
  const technologies: string[] = [];
  const actionVerbs: string[] = [];
  const keywordPriorities: Record<string, KeywordPriority> = {};
  const keywordFrequency: Record<string, number> = {};
  const seen = new Set<string>();

  const addKeyword = (word: string, category: string[], priority?: KeywordPriority): boolean => {
    const lower = word.toLowerCase();
    // Allow multi-word phrases (they may be <= 2 chars per word but meaningful as phrase)
    const isPhrase = lower.includes(' ');
    if (STOPWORDS.has(lower) || (!isPhrase && lower.length <= 2)) {
      return false;
    }
    if (!seen.has(lower)) {
      seen.add(lower);
      keywords.push(lower);
      // Set priority (first assignment wins — higher priority sections are processed first)
      if (priority && !keywordPriorities[lower]) {
        keywordPriorities[lower] = priority;
      }
    }
    // Always push to category (tech keywords need to appear in both technologies AND section arrays)
    if (!category.includes(lower)) {
      category.push(lower);
    }
    return true;
  };

  // Compute word/phrase frequency across entire JD
  const allTokens = tokenizeWithPhrases(jd);
  const fullFreq = new Map<string, number>();
  for (const token of allTokens) {
    if (!STOPWORDS.has(token) && token.length > 1) {
      fullFreq.set(token, (fullFreq.get(token) || 0) + 1);
    }
  }

  // Parse JD into sections
  const sections = parseJDSections(jd);

  // 1. Extract job title keywords (highest priority)
  const title = extractJobTitle(jd);
  if (title) {
    const titleTokens = tokenizeWithPhrases(title);
    for (const word of titleTokens) {
      addKeyword(word, fromTitle, 'title');
    }
  }

  // Helper to process section content
  const processSection = (content: string, category: string[], priority: KeywordPriority) => {
    const tokens = tokenizeWithPhrases(content);
    for (const word of tokens) {
      if (TECH_KEYWORDS.has(word)) {
        addKeyword(word, technologies, priority);
        addKeyword(word, category, priority);
      } else if (!STOPWORDS.has(word)) {
        addKeyword(word, category, priority);
      }
    }
  };

  // 2. Extract from required sections
  for (const section of sections) {
    if (section.type === 'required') {
      processSection(section.content, fromRequired, 'required');
    }
  }

  // 2.5 Extract from responsibilities sections
  for (const section of sections) {
    if (section.type === 'responsibilities') {
      processSection(section.content, fromRequired, 'responsibilities');
    }
  }

  // 3. Extract from nice-to-have sections
  for (const section of sections) {
    if (section.type === 'niceToHave') {
      processSection(section.content, fromNiceToHave, 'niceToHave');
    }
  }

  // 4. Identify technology keywords from full JD
  const allWords = tokenizeWithPhrases(jd);
  for (const word of allWords) {
    if (TECH_KEYWORDS.has(word)) {
      addKeyword(word, technologies, 'general');
    }
  }

  // 5. Identify action verbs
  for (const word of allWords) {
    if (ACTION_VERBS.has(word)) {
      addKeyword(word, actionVerbs, 'general');
    }
  }

  // 6. Fill remaining slots with other meaningful words (frequency ordered)
  const wordFreq = new Map<string, number>();
  for (const word of allWords) {
    if (!STOPWORDS.has(word) && !seen.has(word) && (word.includes(' ') || word.length > 2)) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  const sortedByFreq = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  for (const word of sortedByFreq) {
    if (keywords.length >= count) break;
    addKeyword(word, [], 'general');
  }

  // Ensure all keywords have a priority (fallback to 'general')
  for (const kw of keywords) {
    if (!keywordPriorities[kw]) {
      keywordPriorities[kw] = 'general';
    }
  }

  // Build keyword frequency map from full JD tokens
  for (const kw of keywords) {
    keywordFrequency[kw] = fullFreq.get(kw) || 1;
  }

  return {
    all: keywords.slice(0, count),
    fromTitle,
    fromRequired,
    fromNiceToHave,
    technologies,
    actionVerbs,
    keywordPriorities,
    keywordFrequency,
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
 * 1. Exact match (case-insensitive): highest priority
 * 2. Stem match (e.g., "leading" matches "led"): medium
 * 3. Synonym match via reverse index: lowest
 *
 * Short keywords (<=3 chars) use word-boundary regex to avoid false positives.
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
    const isShort = keywordLower.length <= 3 && !keywordLower.includes(' ');
    const isPhrase = keywordLower.includes(' ');

    // 1. Check exact match
    let exactMatch = false;
    if (isPhrase) {
      // Multi-word: check substring in resume
      exactMatch = resumeLower.includes(keywordLower);
    } else if (isShort) {
      // Short words: use word-boundary regex to avoid false positives
      const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const boundaryPattern = new RegExp(`\\b${escaped}\\b`);
      exactMatch = boundaryPattern.test(resumeLower);
    } else {
      // Normal words: token set or substring
      exactMatch = resumeTokens.has(keywordLower) || resumeLower.includes(keywordLower);
    }

    if (exactMatch) {
      matched.push(keyword);
      matchDetails.push({ keyword, matchType: 'exact' });
      continue;
    }

    // 2. Check stem match (skip for phrases)
    if (!isPhrase) {
      const keywordStem = stemWord(keywordLower);
      if (resumeStems.has(keywordStem)) {
        matched.push(keyword);
        matchDetails.push({ keyword, matchType: 'stem', matchedAs: keywordStem });
        continue;
      }
    }

    // 3. Check synonym match using reverse index (O(1) lookup)
    let synonymFound = false;
    const directSynonyms = SKILL_SYNONYMS[keywordLower] || [];

    // Also get reverse-indexed synonyms (canonical terms that list this keyword)
    const reverseEntries = SYNONYM_REVERSE_INDEX.get(keywordLower) || [];
    const additionalSynonyms: string[] = [];
    for (const canonical of reverseEntries) {
      additionalSynonyms.push(canonical);
      const canonicalSyns = SKILL_SYNONYMS[canonical] || [];
      for (const s of canonicalSyns) {
        if (s !== keywordLower) additionalSynonyms.push(s);
      }
    }

    const allSynonyms = [...directSynonyms, ...additionalSynonyms];
    for (const syn of allSynonyms) {
      const synLower = syn.toLowerCase();
      // Use boundary matching for short synonyms too
      let synMatch = false;
      if (synLower.length <= 3 && !synLower.includes(' ')) {
        const escaped = synLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        synMatch = new RegExp(`\\b${escaped}\\b`).test(resumeLower);
      } else {
        synMatch = resumeLower.includes(synLower);
      }
      if (synMatch) {
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
 * Calculate keyword density percentage (simple unique count).
 */
export function calculateKeywordDensity(matchedCount: number, totalWords: number): number {
  if (totalWords === 0) return 0;
  return Math.round((matchedCount / totalWords) * 1000) / 10; // One decimal place
}

/**
 * Result of actual keyword density analysis.
 */
export interface ActualKeywordDensity {
  /** Overall density as percentage (total keyword occurrences / total words * 100) */
  overallDensity: number;
  /** Keywords that appear 5+ times (potential stuffing) */
  stuffedKeywords: string[];
  /** Total occurrences of all matched keywords */
  totalOccurrences: number;
}

/**
 * Calculate actual keyword density by counting occurrences (not just unique matches).
 * Detects keyword stuffing by flagging individual keywords that appear too frequently.
 *
 * @param resumeText - Full resume text
 * @param matchedKeywords - Keywords that were matched in the resume
 * @returns Density analysis with stuffing detection
 */
export function calculateActualKeywordDensity(
  resumeText: string,
  matchedKeywords: string[]
): ActualKeywordDensity {
  if (!resumeText || matchedKeywords.length === 0) {
    return { overallDensity: 0, stuffedKeywords: [], totalOccurrences: 0 };
  }

  const resumeLower = resumeText.toLowerCase();
  const totalWords = wordCount(resumeText);
  if (totalWords === 0) {
    return { overallDensity: 0, stuffedKeywords: [], totalOccurrences: 0 };
  }

  let totalOccurrences = 0;
  const stuffedKeywords: string[] = [];

  for (const keyword of matchedKeywords) {
    const keywordLower = keyword.toLowerCase();
    // Count occurrences using word-boundary-aware matching
    const escaped = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phrase = escaped.trim().split(/\s+/).join('\\s+');
    const pattern = new RegExp(`\\b${phrase}\\b`, 'g');
    const count = (resumeLower.match(pattern) || []).length;
    totalOccurrences += count;
    if (count >= 5) {
      stuffedKeywords.push(keyword);
    }
  }

  const overallDensity = Math.round((totalOccurrences / totalWords) * 1000) / 10;

  return { overallDensity, stuffedKeywords, totalOccurrences };
}
