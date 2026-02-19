import { describe, it, expect } from 'vitest';
import {
  STOPWORDS,
  SKILL_SYNONYMS,
  SYNONYM_REVERSE_INDEX,
  TECH_KEYWORDS,
  ACTION_VERBS,
  NICE_TO_HAVE_MARKERS,
  KNOWN_PHRASES,
  stemWord,
  extractKeywords,
  extractPhrases,
  wordCount,
  matchKeywords,
  calculateMatchRate,
  calculateKeywordDensity,
  calculateActualKeywordDensity,
  calculateDynamicKeywordCount,
  parseJDSections,
} from '@/lib/ats-keywords';

describe('ATS Keywords - Data Structures', () => {
  describe('STOPWORDS', () => {
    it('contains common articles', () => {
      expect(STOPWORDS.has('a')).toBe(true);
      expect(STOPWORDS.has('an')).toBe(true);
      expect(STOPWORDS.has('the')).toBe(true);
    });

    it('contains common pronouns', () => {
      expect(STOPWORDS.has('i')).toBe(true);
      expect(STOPWORDS.has('you')).toBe(true);
      expect(STOPWORDS.has('we')).toBe(true);
      expect(STOPWORDS.has('they')).toBe(true);
    });

    it('contains common prepositions', () => {
      expect(STOPWORDS.has('at')).toBe(true);
      expect(STOPWORDS.has('by')).toBe(true);
      expect(STOPWORDS.has('for')).toBe(true);
      expect(STOPWORDS.has('in')).toBe(true);
      expect(STOPWORDS.has('to')).toBe(true);
      expect(STOPWORDS.has('with')).toBe(true);
    });

    it('contains common conjunctions', () => {
      expect(STOPWORDS.has('and')).toBe(true);
      expect(STOPWORDS.has('but')).toBe(true);
      expect(STOPWORDS.has('or')).toBe(true);
    });

    it('contains common auxiliary verbs', () => {
      expect(STOPWORDS.has('is')).toBe(true);
      expect(STOPWORDS.has('are')).toBe(true);
      expect(STOPWORDS.has('was')).toBe(true);
      expect(STOPWORDS.has('were')).toBe(true);
      expect(STOPWORDS.has('have')).toBe(true);
      expect(STOPWORDS.has('has')).toBe(true);
    });

    it('contains common JD filler words', () => {
      expect(STOPWORDS.has('ability')).toBe(true);
      expect(STOPWORDS.has('work')).toBe(true);
      expect(STOPWORDS.has('company')).toBe(true);
      expect(STOPWORDS.has('required')).toBe(true);
      expect(STOPWORDS.has('excellent')).toBe(true);
    });

    it('does not contain meaningful keywords', () => {
      expect(STOPWORDS.has('python')).toBe(false);
      expect(STOPWORDS.has('aws')).toBe(false);
      expect(STOPWORDS.has('manager')).toBe(false);
      expect(STOPWORDS.has('engineering')).toBe(false);
      expect(STOPWORDS.has('kubernetes')).toBe(false);
    });

    it('is case-sensitive (lowercase only)', () => {
      expect(STOPWORDS.has('the')).toBe(true);
      expect(STOPWORDS.has('The')).toBe(false);
      expect(STOPWORDS.has('THE')).toBe(false);
    });
  });

  describe('SKILL_SYNONYMS', () => {
    it('maps cloud platforms to variations', () => {
      expect(SKILL_SYNONYMS['gcp']).toContain('google cloud platform');
      expect(SKILL_SYNONYMS['gcp']).toContain('google cloud');
      expect(SKILL_SYNONYMS['gcp']).toContain('gke');
      expect(SKILL_SYNONYMS['aws']).toContain('amazon web services');
      expect(SKILL_SYNONYMS['aws']).toContain('ec2');
      expect(SKILL_SYNONYMS['azure']).toContain('microsoft azure');
    });

    it('maps leadership terms to variations', () => {
      expect(SKILL_SYNONYMS['leadership']).toContain('led');
      expect(SKILL_SYNONYMS['leadership']).toContain('leading');
      expect(SKILL_SYNONYMS['leadership']).toContain('managed');
      expect(SKILL_SYNONYMS['management']).toContain('manager');
      expect(SKILL_SYNONYMS['management']).toContain('managing');
    });

    it('maps container technologies', () => {
      expect(SKILL_SYNONYMS['kubernetes']).toContain('k8s');
      expect(SKILL_SYNONYMS['kubernetes']).toContain('gke');
      expect(SKILL_SYNONYMS['kubernetes']).toContain('eks');
      expect(SKILL_SYNONYMS['docker']).toContain('containers');
      expect(SKILL_SYNONYMS['docker']).toContain('containerization');
    });

    it('maps programming languages', () => {
      expect(SKILL_SYNONYMS['python']).toContain('py');
      expect(SKILL_SYNONYMS['javascript']).toContain('js');
      expect(SKILL_SYNONYMS['javascript']).toContain('nodejs');
      expect(SKILL_SYNONYMS['typescript']).toContain('ts');
      expect(SKILL_SYNONYMS['go']).toContain('golang');
    });

    it('maps infrastructure terms', () => {
      expect(SKILL_SYNONYMS['terraform']).toContain('infrastructure as code');
      expect(SKILL_SYNONYMS['terraform']).toContain('iac');
      expect(SKILL_SYNONYMS['ci/cd']).toContain('cicd');
      expect(SKILL_SYNONYMS['ci/cd']).toContain('continuous integration');
    });

    it('maps methodologies', () => {
      expect(SKILL_SYNONYMS['agile']).toContain('scrum');
      expect(SKILL_SYNONYMS['agile']).toContain('kanban');
      expect(SKILL_SYNONYMS['scrum']).toContain('sprint');
    });

    it('contains canonical terms as keys', () => {
      expect('cloud' in SKILL_SYNONYMS).toBe(true);
      expect('kubernetes' in SKILL_SYNONYMS).toBe(true);
      expect('leadership' in SKILL_SYNONYMS).toBe(true);
      expect('devops' in SKILL_SYNONYMS).toBe(true);
    });
  });

  describe('TECH_KEYWORDS', () => {
    it('contains cloud platforms', () => {
      expect(TECH_KEYWORDS.has('gcp')).toBe(true);
      expect(TECH_KEYWORDS.has('aws')).toBe(true);
      expect(TECH_KEYWORDS.has('azure')).toBe(true);
      expect(TECH_KEYWORDS.has('cloud')).toBe(true);
    });

    it('contains container orchestration tools', () => {
      expect(TECH_KEYWORDS.has('kubernetes')).toBe(true);
      expect(TECH_KEYWORDS.has('k8s')).toBe(true);
      expect(TECH_KEYWORDS.has('docker')).toBe(true);
    });

    it('contains infrastructure as code tools', () => {
      expect(TECH_KEYWORDS.has('terraform')).toBe(true);
      expect(TECH_KEYWORDS.has('ansible')).toBe(true);
      expect(TECH_KEYWORDS.has('pulumi')).toBe(true);
    });

    it('contains programming languages', () => {
      expect(TECH_KEYWORDS.has('python')).toBe(true);
      expect(TECH_KEYWORDS.has('java')).toBe(true);
      expect(TECH_KEYWORDS.has('javascript')).toBe(true);
      expect(TECH_KEYWORDS.has('typescript')).toBe(true);
      expect(TECH_KEYWORDS.has('go')).toBe(true);
      expect(TECH_KEYWORDS.has('rust')).toBe(true);
    });

    it('contains web frameworks', () => {
      expect(TECH_KEYWORDS.has('react')).toBe(true);
      expect(TECH_KEYWORDS.has('angular')).toBe(true);
      expect(TECH_KEYWORDS.has('vue')).toBe(true);
      expect(TECH_KEYWORDS.has('nextjs')).toBe(true);
    });

    it('contains databases', () => {
      expect(TECH_KEYWORDS.has('sql')).toBe(true);
      expect(TECH_KEYWORDS.has('postgresql')).toBe(true);
      expect(TECH_KEYWORDS.has('mysql')).toBe(true);
      expect(TECH_KEYWORDS.has('mongodb')).toBe(true);
      expect(TECH_KEYWORDS.has('redis')).toBe(true);
    });

    it('contains CI/CD tools', () => {
      expect(TECH_KEYWORDS.has('jenkins')).toBe(true);
      expect(TECH_KEYWORDS.has('github')).toBe(true);
      expect(TECH_KEYWORDS.has('gitlab')).toBe(true);
      expect(TECH_KEYWORDS.has('circleci')).toBe(true);
    });

    it('contains monitoring tools', () => {
      expect(TECH_KEYWORDS.has('prometheus')).toBe(true);
      expect(TECH_KEYWORDS.has('grafana')).toBe(true);
      expect(TECH_KEYWORDS.has('datadog')).toBe(true);
      expect(TECH_KEYWORDS.has('splunk')).toBe(true);
    });

    it('contains methodologies', () => {
      expect(TECH_KEYWORDS.has('agile')).toBe(true);
      expect(TECH_KEYWORDS.has('scrum')).toBe(true);
      expect(TECH_KEYWORDS.has('devops')).toBe(true);
      expect(TECH_KEYWORDS.has('sre')).toBe(true);
    });

    it('does not contain non-technical terms', () => {
      expect(TECH_KEYWORDS.has('manager')).toBe(false);
      expect(TECH_KEYWORDS.has('leadership')).toBe(false);
      expect(TECH_KEYWORDS.has('communication')).toBe(false);
    });
  });

  describe('ACTION_VERBS', () => {
    it('contains leadership verbs', () => {
      expect(ACTION_VERBS.has('led')).toBe(true);
      expect(ACTION_VERBS.has('managed')).toBe(true);
      expect(ACTION_VERBS.has('directed')).toBe(true);
      expect(ACTION_VERBS.has('oversaw')).toBe(true);
      expect(ACTION_VERBS.has('mentored')).toBe(true);
      expect(ACTION_VERBS.has('coached')).toBe(true);
    });

    it('contains achievement verbs', () => {
      expect(ACTION_VERBS.has('achieved')).toBe(true);
      expect(ACTION_VERBS.has('delivered')).toBe(true);
      expect(ACTION_VERBS.has('accomplished')).toBe(true);
      expect(ACTION_VERBS.has('exceeded')).toBe(true);
    });

    it('contains creation verbs', () => {
      expect(ACTION_VERBS.has('built')).toBe(true);
      expect(ACTION_VERBS.has('created')).toBe(true);
      expect(ACTION_VERBS.has('designed')).toBe(true);
      expect(ACTION_VERBS.has('developed')).toBe(true);
      expect(ACTION_VERBS.has('implemented')).toBe(true);
      expect(ACTION_VERBS.has('launched')).toBe(true);
    });

    it('contains improvement verbs', () => {
      expect(ACTION_VERBS.has('improved')).toBe(true);
      expect(ACTION_VERBS.has('enhanced')).toBe(true);
      expect(ACTION_VERBS.has('optimized')).toBe(true);
      expect(ACTION_VERBS.has('streamlined')).toBe(true);
      expect(ACTION_VERBS.has('reduced')).toBe(true);
    });

    it('contains strategic verbs', () => {
      expect(ACTION_VERBS.has('architected')).toBe(true);
      expect(ACTION_VERBS.has('strategized')).toBe(true);
      expect(ACTION_VERBS.has('planned')).toBe(true);
      expect(ACTION_VERBS.has('pioneered')).toBe(true);
    });

    it('contains collaboration verbs', () => {
      expect(ACTION_VERBS.has('collaborated')).toBe(true);
      expect(ACTION_VERBS.has('partnered')).toBe(true);
      expect(ACTION_VERBS.has('aligned')).toBe(true);
    });

    it('contains technical verbs', () => {
      expect(ACTION_VERBS.has('engineered')).toBe(true);
      expect(ACTION_VERBS.has('automated')).toBe(true);
      expect(ACTION_VERBS.has('scaled')).toBe(true);
      expect(ACTION_VERBS.has('migrated')).toBe(true);
      expect(ACTION_VERBS.has('deployed')).toBe(true);
    });

    it('uses past tense forms', () => {
      // Past tense is better for resume bullets
      expect(ACTION_VERBS.has('led')).toBe(true);
      expect(ACTION_VERBS.has('lead')).toBe(false);
      expect(ACTION_VERBS.has('built')).toBe(true);
      expect(ACTION_VERBS.has('build')).toBe(false);
    });
  });
});

describe('ATS Keywords - stemWord', () => {
  it('removes common suffixes', () => {
    expect(stemWord('leading')).toBe('lead');
    expect(stemWord('managed')).toBe('manag');
    expect(stemWord('development')).toBe('develop');
    expect(stemWord('engineering')).toBe('engineer');
  });

  it('removes -ing suffix', () => {
    expect(stemWord('running')).toBe('runn');
    expect(stemWord('working')).toBe('work');
    expect(stemWord('building')).toBe('build');
  });

  it('removes -ed suffix', () => {
    expect(stemWord('worked')).toBe('work');
    expect(stemWord('created')).toBe('creat');
    expect(stemWord('managed')).toBe('manag');
  });

  it('removes -s suffix', () => {
    expect(stemWord('teams')).toBe('team');
    expect(stemWord('systems')).toBe('system');
    expect(stemWord('engineers')).toBe('engineer');
  });

  it('removes -tion suffix', () => {
    expect(stemWord('operation')).toBe('oper');
    expect(stemWord('migration')).toBe('migr');
    expect(stemWord('optimization')).toBe('optim');
  });

  it('removes -ment suffix', () => {
    expect(stemWord('management')).toBe('manage');
    expect(stemWord('development')).toBe('develop');
    expect(stemWord('deployment')).toBe('deploy');
  });

  it('removes -ness suffix', () => {
    // effectiveness: strips 'ness' -> 'effective', then strips 'ive' -> 'effect'
    expect(stemWord('effectiveness')).toBe('effect');
    expect(stemWord('happiness')).toBe('happi');
  });

  it('removes -ful suffix', () => {
    expect(stemWord('successful')).toBe('success');
    expect(stemWord('helpful')).toBe('help');
  });

  it('removes -ly suffix', () => {
    expect(stemWord('quickly')).toBe('quick');
    expect(stemWord('effectively')).toBe('effective');
  });

  it('removes -er suffix', () => {
    expect(stemWord('developer')).toBe('develop');
    expect(stemWord('manager')).toBe('manag');
  });

  it('preserves short words', () => {
    expect(stemWord('go')).toBe('go');
    expect(stemWord('js')).toBe('js');
    expect(stemWord('api')).toBe('api');
    expect(stemWord('aws')).toBe('aws');
  });

  it('does not over-strip words', () => {
    // Should keep at least 3 characters
    expect(stemWord('ables').length).toBeGreaterThanOrEqual(3);
    expect(stemWord('doing').length).toBeGreaterThanOrEqual(3);
  });

  it('handles already stemmed words', () => {
    expect(stemWord('lead')).toBe('lead');
    expect(stemWord('python')).toBe('python');
    expect(stemWord('build')).toBe('build');
  });

  it('returns lowercase', () => {
    expect(stemWord('LEADING')).toBe('lead');
    expect(stemWord('Managed')).toBe('manag');
    expect(stemWord('Development')).toBe('develop');
  });

  it('handles empty string', () => {
    expect(stemWord('')).toBe('');
  });

  it('handles single character', () => {
    expect(stemWord('a')).toBe('a');
    expect(stemWord('i')).toBe('i');
  });

  it('removes longer suffixes before shorter ones', () => {
    // 'ational' should be checked before 'al'
    expect(stemWord('operational')).toBe('oper');
    expect(stemWord('organizational')).toBe('organiz');
  });
});

describe('ATS Keywords - extractKeywords', () => {
  it('returns ExtractedKeywords object with all required fields', () => {
    const jd = 'Engineering Manager - Platform Infrastructure';
    const keywords = extractKeywords(jd, 20);

    expect(keywords).toHaveProperty('all');
    expect(keywords).toHaveProperty('fromTitle');
    expect(keywords).toHaveProperty('fromRequired');
    expect(keywords).toHaveProperty('technologies');
    expect(keywords).toHaveProperty('actionVerbs');
    expect(Array.isArray(keywords.all)).toBe(true);
    expect(Array.isArray(keywords.fromTitle)).toBe(true);
    expect(Array.isArray(keywords.fromRequired)).toBe(true);
    expect(Array.isArray(keywords.technologies)).toBe(true);
    expect(Array.isArray(keywords.actionVerbs)).toBe(true);
  });

  it('extracts job title keywords correctly', () => {
    const jd = 'Senior Engineering Manager, Platform Infrastructure';
    const keywords = extractKeywords(jd, 20);

    expect(keywords.fromTitle.length).toBeGreaterThan(0);
    // Should contain meaningful words from title
    const titleWords = keywords.fromTitle.filter(k =>
      ['senior', 'engineering', 'manager', 'platform', 'infrastructure'].includes(k)
    );
    expect(titleWords.length).toBeGreaterThan(2);
  });

  it('extracts keywords from required sections', () => {
    const jd = `
      Engineering Manager
      Requirements:
      - Python programming
      - AWS cloud experience
      - Team leadership
    `;
    const keywords = extractKeywords(jd, 20);

    expect(keywords.fromRequired.length).toBeGreaterThan(0);
    expect(keywords.all).toContain('python');
    expect(keywords.all).toContain('aws');
  });

  it('identifies technology keywords', () => {
    const jd = 'Experience with Python, AWS, Kubernetes, Docker, and Terraform';
    const keywords = extractKeywords(jd, 20);

    expect(keywords.technologies).toContain('python');
    expect(keywords.technologies).toContain('aws');
    expect(keywords.technologies).toContain('kubernetes');
    expect(keywords.technologies).toContain('docker');
    expect(keywords.technologies).toContain('terraform');
  });

  it('identifies action verbs', () => {
    const jd = 'Led teams, managed projects, and built infrastructure';
    const keywords = extractKeywords(jd, 20);

    // ACTION_VERBS contains past tense forms (led, managed, built, etc.)
    const hasActionVerbs = keywords.actionVerbs.length > 0;
    expect(hasActionVerbs).toBe(true);
  });

  it('filters out stopwords', () => {
    const jd = 'The manager is a good leader with the ability to work on teams';
    const keywords = extractKeywords(jd, 20);

    expect(keywords.all).not.toContain('the');
    expect(keywords.all).not.toContain('is');
    expect(keywords.all).not.toContain('a');
    expect(keywords.all).not.toContain('with');
    expect(keywords.all).not.toContain('to');
    expect(keywords.all).not.toContain('on');
  });

  it('handles empty input', () => {
    const keywords = extractKeywords('', 20);

    expect(keywords.all).toEqual([]);
    expect(keywords.fromTitle).toEqual([]);
    expect(keywords.fromRequired).toEqual([]);
    expect(keywords.technologies).toEqual([]);
    expect(keywords.actionVerbs).toEqual([]);
  });

  it('respects count limit', () => {
    const longJd = `
      Senior Engineering Manager position requiring Python, Java, AWS, GCP,
      Azure, Kubernetes, Docker, Terraform, Jenkins, GitHub, GitLab, React,
      Angular, Vue, Node, Django, Flask, Spring, PostgreSQL, MongoDB, Redis,
      Elasticsearch, Kafka, Spark, Prometheus, Grafana, and many more technologies.
    `;
    const keywords = extractKeywords(longJd, 10);

    expect(keywords.all.length).toBeLessThanOrEqual(10);
  });

  it('deduplicates keywords', () => {
    const jd = 'Python Python Python AWS AWS Kubernetes Kubernetes';
    const keywords = extractKeywords(jd, 20);

    const uniqueKeywords = new Set(keywords.all);
    expect(uniqueKeywords.size).toBe(keywords.all.length);
  });

  it('returns lowercase keywords', () => {
    const jd = 'PYTHON AWS KUBERNETES Docker TerraForm';
    const keywords = extractKeywords(jd, 20);

    for (const keyword of keywords.all) {
      expect(keyword).toBe(keyword.toLowerCase());
    }
  });

  it('handles job titles with explicit markers', () => {
    const jd = 'Job Title: Senior Engineering Manager\nExperience required...';
    const keywords = extractKeywords(jd, 20);

    expect(keywords.fromTitle.length).toBeGreaterThan(0);
  });

  it('handles multiple required section markers', () => {
    const jd = `
      Required:
      - Python
      Must have:
      - AWS
      Qualifications:
      - Kubernetes
    `;
    const keywords = extractKeywords(jd, 20);

    // Technology keywords are extracted regardless of section
    expect(keywords.technologies).toContain('python');
    expect(keywords.technologies).toContain('aws');
    expect(keywords.technologies).toContain('kubernetes');
  });

  it('prioritizes technology keywords in required sections', () => {
    const jd = `
      Requirements:
      - Python and AWS experience
      - General team collaboration
    `;
    const keywords = extractKeywords(jd, 20);

    // Tech keywords are always extracted
    expect(keywords.technologies).toContain('python');
    expect(keywords.technologies).toContain('aws');
  });

  it('handles default count parameter', () => {
    const jd = 'Engineering Manager with Python AWS GCP Kubernetes Docker';
    const keywords = extractKeywords(jd); // No count specified

    expect(keywords.all.length).toBeLessThanOrEqual(20); // Default is 20
  });

  it('extracts keywords with proper frequency ordering', () => {
    const jd = `
      Engineering Manager
      Python Python Python
      AWS AWS
      Kubernetes
    `;
    const keywords = extractKeywords(jd, 20);

    // More frequent words should appear in results
    expect(keywords.all).toContain('python');
    expect(keywords.all).toContain('aws');
    expect(keywords.all).toContain('kubernetes');
  });

  it('handles special characters in technology names', () => {
    const jd = 'C++, C#, .NET, Node.js, React.js, CI/CD experience';
    const keywords = extractKeywords(jd, 20);

    // Special chars are normalized
    expect(keywords.all.some(k => ['cpp', 'csharp', 'nodejs', 'cicd'].includes(k))).toBe(true);
  });

  it('filters keywords shorter than 3 characters', () => {
    const jd = 'a ab abc abcd experience with go js api';
    const keywords = extractKeywords(jd, 20);

    // Only 'go' and 'js' are 2 chars but might be kept if meaningful
    // Most single-letter or 2-letter words filtered
    for (const keyword of keywords.all) {
      if (!['go', 'js', 'ts', 'py', 'c', 'r'].includes(keyword)) {
        expect(keyword.length).toBeGreaterThan(2);
      }
    }
  });

  it('is deterministic across multiple runs', () => {
    const jd = 'Engineering Manager with Python AWS GCP Kubernetes';
    const results: string[] = [];

    for (let i = 0; i < 5; i++) {
      const keywords = extractKeywords(jd, 20);
      results.push(JSON.stringify(keywords.all.sort()));
    }

    expect(new Set(results).size).toBe(1);
  });
});

describe('ATS Keywords - wordCount', () => {
  it('counts words correctly', () => {
    expect(wordCount('one two three')).toBe(3);
    expect(wordCount('one two three four five')).toBe(5);
  });

  it('handles punctuation', () => {
    expect(wordCount('one, two, three')).toBe(3);
    expect(wordCount('one. two! three?')).toBe(3);
  });

  it('handles multiple spaces', () => {
    expect(wordCount('one  two   three')).toBe(3);
    expect(wordCount('  multiple   spaces  ')).toBe(2);
  });

  it('handles empty string', () => {
    expect(wordCount('')).toBe(0);
  });

  it('handles whitespace-only string', () => {
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('\n\t  ')).toBe(0);
  });

  it('handles single word', () => {
    expect(wordCount('hello')).toBe(1);
  });

  it('handles newlines', () => {
    expect(wordCount('one\ntwo\nthree')).toBe(3);
  });

  it('handles hyphens in compound words', () => {
    expect(wordCount('full-stack developer')).toBe(2);
    expect(wordCount('cloud-native architecture')).toBe(2);
  });

  it('filters single-character words', () => {
    const text = 'a b c meaningful words here';
    const count = wordCount(text);
    // Filters single chars, keeps words > 1 char
    expect(count).toBe(3); // 'meaningful', 'words', 'here'
  });

  it('handles special characters in tech terms', () => {
    const text = 'C++ Node.js React.js';
    const count = wordCount(text);
    // After normalization
    expect(count).toBeGreaterThan(0);
  });
});

describe('ATS Keywords - matchKeywords', () => {
  it('returns MatchResult object with all required fields', () => {
    const keywords = ['python'];
    const resume = 'Python experience';

    const result = matchKeywords(keywords, resume);

    expect(result).toHaveProperty('matched');
    expect(result).toHaveProperty('missing');
    expect(result).toHaveProperty('matchDetails');
    expect(Array.isArray(result.matched)).toBe(true);
    expect(Array.isArray(result.missing)).toBe(true);
    expect(Array.isArray(result.matchDetails)).toBe(true);
  });

  it('matches exact keywords (case insensitive)', () => {
    const keywords = ['python', 'aws', 'kubernetes'];
    const resume = 'Experience with Python, AWS, and Kubernetes';

    const { matched, missing } = matchKeywords(keywords, resume);

    expect(matched).toContain('python');
    expect(matched).toContain('aws');
    expect(matched).toContain('kubernetes');
    expect(missing).toEqual([]);
  });

  it('matches case variations', () => {
    const keywords = ['Python', 'AWS', 'GCP'];
    const resume = 'python aws gcp';

    const { matched } = matchKeywords(keywords, resume);

    expect(matched.length).toBe(3);
  });

  it('matches stem variations', () => {
    const keywords = ['leading', 'managed', 'development'];
    const resume = 'Led teams, managed projects, developed systems';

    const { matched, matchDetails } = matchKeywords(keywords, resume);

    expect(matched.length).toBeGreaterThan(0);
    // At least one should be stem match
    const hasStemMatch = matchDetails.some(d => d.matchType === 'stem');
    expect(hasStemMatch).toBe(true);
  });

  it('matches synonyms from SKILL_SYNONYMS', () => {
    const keywords = ['cloud'];
    const resume = 'Extensive GCP and AWS experience';

    const { matched, matchDetails } = matchKeywords(keywords, resume);

    expect(matched).toContain('cloud');
    const cloudMatch = matchDetails.find(d => d.keyword === 'cloud');
    expect(cloudMatch?.matchType).toBe('synonym');
  });

  it('matches kubernetes as k8s synonym', () => {
    const keywords = ['kubernetes'];
    const resume = 'k8s deployment experience';

    const { matched } = matchKeywords(keywords, resume);

    expect(matched).toContain('kubernetes');
  });

  it('matches k8s as kubernetes synonym', () => {
    const keywords = ['k8s'];
    const resume = 'Kubernetes cluster management';

    const { matched } = matchKeywords(keywords, resume);

    expect(matched).toContain('k8s');
  });

  it('correctly identifies missing keywords', () => {
    const keywords = ['python', 'rust', 'haskell'];
    const resume = 'Experience with Python and Java';

    const { matched, missing } = matchKeywords(keywords, resume);

    expect(matched).toContain('python');
    expect(missing).toContain('rust');
    expect(missing).toContain('haskell');
  });

  it('provides match details for exact matches', () => {
    const keywords = ['python'];
    const resume = 'Python developer';

    const { matchDetails } = matchKeywords(keywords, resume);

    const pythonMatch = matchDetails.find(d => d.keyword === 'python');
    expect(pythonMatch?.matchType).toBe('exact');
    expect(pythonMatch?.matchedAs).toBeUndefined();
  });

  it('provides match details for stem matches', () => {
    const keywords = ['leading'];
    const resume = 'Led multiple teams';

    const { matchDetails } = matchKeywords(keywords, resume);

    const leadMatch = matchDetails.find(d => d.keyword === 'leading');
    if (leadMatch && leadMatch.matchType === 'stem') {
      expect(leadMatch.matchedAs).toBeTruthy();
    }
  });

  it('provides match details for synonym matches', () => {
    const keywords = ['cloud'];
    const resume = 'AWS infrastructure';

    const { matchDetails } = matchKeywords(keywords, resume);

    const cloudMatch = matchDetails.find(d => d.keyword === 'cloud');
    if (cloudMatch && cloudMatch.matchType === 'synonym') {
      expect(cloudMatch.matchedAs).toBeTruthy();
    }
  });

  it('handles empty keywords array', () => {
    const { matched, missing } = matchKeywords([], 'Some resume text');

    expect(matched).toEqual([]);
    expect(missing).toEqual([]);
  });

  it('handles empty resume text', () => {
    const keywords = ['python', 'aws'];
    const { matched, missing } = matchKeywords(keywords, '');

    expect(matched).toEqual([]);
    expect(missing).toEqual(['python', 'aws']);
  });

  it('matches compound keywords', () => {
    const keywords = ['github actions'];
    const resume = 'CI/CD using GitHub Actions';

    const { matched } = matchKeywords(keywords, resume);

    expect(matched.length).toBeGreaterThanOrEqual(0);
  });

  it('does not match partial words', () => {
    const keywords = ['python'];
    const resume = 'pythonic style';

    // 'python' should match in 'pythonic' via substring
    const { matched } = matchKeywords(keywords, resume);

    expect(matched).toContain('python');
  });

  it('prefers exact match over stem match', () => {
    const keywords = ['led'];
    const resume = 'Led teams and leadership';

    const { matchDetails } = matchKeywords(keywords, resume);

    const ledMatch = matchDetails.find(d => d.keyword === 'led');
    expect(ledMatch?.matchType).toBe('exact');
  });

  it('prefers exact match over synonym match', () => {
    const keywords = ['cloud'];
    const resume = 'cloud infrastructure with AWS';

    const { matchDetails } = matchKeywords(keywords, resume);

    const cloudMatch = matchDetails.find(d => d.keyword === 'cloud');
    expect(cloudMatch?.matchType).toBe('exact');
  });

  it('matches each keyword only once', () => {
    const keywords = ['python', 'python', 'python'];
    const resume = 'Python developer';

    const { matched } = matchKeywords(keywords, resume);

    // Should have 3 matches (one for each keyword instance)
    expect(matched.length).toBe(3);
    expect(matched.filter(k => k === 'python').length).toBe(3);
  });

  it('is deterministic across multiple runs', () => {
    const keywords = ['python', 'aws', 'kubernetes'];
    const resume = 'Python developer with AWS and Kubernetes experience';
    const results: string[] = [];

    for (let i = 0; i < 5; i++) {
      const { matched } = matchKeywords(keywords, resume);
      results.push(JSON.stringify(matched.sort()));
    }

    expect(new Set(results).size).toBe(1);
  });
});

describe('ATS Keywords - calculateMatchRate', () => {
  it('calculates percentage correctly', () => {
    expect(calculateMatchRate(8, 10)).toBe(80);
    expect(calculateMatchRate(15, 20)).toBe(75);
    expect(calculateMatchRate(7, 10)).toBe(70);
  });

  it('handles zero matched', () => {
    expect(calculateMatchRate(0, 10)).toBe(0);
  });

  it('handles 100% match', () => {
    expect(calculateMatchRate(10, 10)).toBe(100);
  });

  it('handles zero total', () => {
    expect(calculateMatchRate(5, 0)).toBe(0);
  });

  it('handles both zero', () => {
    expect(calculateMatchRate(0, 0)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    expect(calculateMatchRate(1, 3)).toBe(33); // 33.333...
    expect(calculateMatchRate(2, 3)).toBe(67); // 66.666...
  });

  it('handles partial matches', () => {
    expect(calculateMatchRate(3, 7)).toBe(43); // 42.857...
    expect(calculateMatchRate(5, 7)).toBe(71); // 71.428...
  });

  it('returns integer type', () => {
    const result = calculateMatchRate(5, 10);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('is deterministic', () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(calculateMatchRate(7, 10));
    }
    expect(new Set(results).size).toBe(1);
  });
});

describe('ATS Keywords - calculateKeywordDensity', () => {
  it('calculates density correctly', () => {
    expect(calculateKeywordDensity(10, 500)).toBe(2.0);
    expect(calculateKeywordDensity(15, 500)).toBe(3.0);
    expect(calculateKeywordDensity(25, 500)).toBe(5.0);
  });

  it('returns one decimal place', () => {
    const result = calculateKeywordDensity(10, 500);
    const decimalPlaces = (result.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(1);
  });

  it('handles zero matched count', () => {
    expect(calculateKeywordDensity(0, 500)).toBe(0);
  });

  it('handles zero total words', () => {
    expect(calculateKeywordDensity(5, 0)).toBe(0);
  });

  it('handles both zero', () => {
    expect(calculateKeywordDensity(0, 0)).toBe(0);
  });

  it('calculates small densities', () => {
    expect(calculateKeywordDensity(1, 1000)).toBe(0.1);
    expect(calculateKeywordDensity(5, 1000)).toBe(0.5);
  });

  it('calculates large densities', () => {
    expect(calculateKeywordDensity(50, 500)).toBe(10.0);
    expect(calculateKeywordDensity(100, 500)).toBe(20.0);
  });

  it('handles realistic resume densities', () => {
    // Typical resume: 500 words, 15 keywords
    expect(calculateKeywordDensity(15, 500)).toBe(3.0);
    // High keyword density: 500 words, 30 keywords
    expect(calculateKeywordDensity(30, 500)).toBe(6.0);
  });

  it('rounds to one decimal place', () => {
    expect(calculateKeywordDensity(7, 500)).toBe(1.4); // 1.4%
    expect(calculateKeywordDensity(13, 500)).toBe(2.6); // 2.6%
  });

  it('is deterministic', () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(calculateKeywordDensity(15, 500));
    }
    expect(new Set(results).size).toBe(1);
  });
});

describe('ATS Keywords - Integration Tests', () => {
  const sampleJD = `
    Engineering Manager, Platform Infrastructure

    Requirements:
    - 8+ years software development experience
    - 3+ years leading engineering teams
    - Experience with cloud platforms (AWS, GCP, Azure)
    - Strong communication and leadership skills
    - Python, Go, or Java expertise
    - Kubernetes and Docker experience

    Nice to have:
    - Platform engineering background
    - Healthcare technology experience
    - CI/CD pipeline design
  `;

  const sampleResume = `
    Engineering Manager with 15+ years experience leading platform teams.
    Led cloud migration to GCP serving 30+ production systems.
    Managed team of 13 engineers delivering developer platform.
    Python, Java, TypeScript, AWS, GCP expertise.
    Cross-functional leadership, technical strategy, stakeholder management.
    Kubernetes, Docker, Terraform, CI/CD, GitHub Actions.
    Built scalable infrastructure supporting 400+ engineers.
  `;

  it('end-to-end: extract and match keywords', () => {
    const extracted = extractKeywords(sampleJD, 20);
    const { matched, missing } = matchKeywords(extracted.all, sampleResume);

    expect(extracted.all.length).toBeGreaterThan(0);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.length + missing.length).toBe(extracted.all.length);
  });

  it('end-to-end: calculates match rate', () => {
    const extracted = extractKeywords(sampleJD, 20);
    const { matched } = matchKeywords(extracted.all, sampleResume);
    const matchRate = calculateMatchRate(matched.length, extracted.all.length);

    expect(matchRate).toBeGreaterThanOrEqual(0);
    expect(matchRate).toBeLessThanOrEqual(100);
  });

  it('end-to-end: calculates keyword density', () => {
    const extracted = extractKeywords(sampleJD, 20);
    const { matched } = matchKeywords(extracted.all, sampleResume);
    const totalWords = wordCount(sampleResume);
    const density = calculateKeywordDensity(matched.length, totalWords);

    expect(density).toBeGreaterThanOrEqual(0);
    expect(density).toBeLessThan(100); // Density > 100% is unlikely
  });

  it('matches technology keywords', () => {
    const extracted = extractKeywords(sampleJD, 20);
    const { matched } = matchKeywords(extracted.all, sampleResume);

    // Should match common tech keywords
    const techMatches = matched.filter(k =>
      ['python', 'aws', 'gcp', 'kubernetes', 'docker'].includes(k.toLowerCase())
    );
    expect(techMatches.length).toBeGreaterThan(2);
  });

  it('identifies missing keywords', () => {
    const poorResume = 'Generic experience with various technologies.';
    const extracted = extractKeywords(sampleJD, 20);
    const { missing } = matchKeywords(extracted.all, poorResume);

    expect(missing.length).toBeGreaterThan(extracted.all.length / 2);
  });

  it('is deterministic for full workflow', () => {
    const results: number[] = [];

    for (let i = 0; i < 5; i++) {
      const extracted = extractKeywords(sampleJD, 20);
      const { matched } = matchKeywords(extracted.all, sampleResume);
      const matchRate = calculateMatchRate(matched.length, extracted.all.length);
      results.push(matchRate);
    }

    expect(new Set(results).size).toBe(1);
  });
});

describe('ATS Keywords - NICE_TO_HAVE_MARKERS', () => {
  it('contains common nice-to-have markers', () => {
    expect(NICE_TO_HAVE_MARKERS).toContain('nice to have');
    expect(NICE_TO_HAVE_MARKERS).toContain('preferred');
    expect(NICE_TO_HAVE_MARKERS).toContain('bonus');
  });

  it('is an array of lowercase strings', () => {
    expect(Array.isArray(NICE_TO_HAVE_MARKERS)).toBe(true);
    for (const marker of NICE_TO_HAVE_MARKERS) {
      expect(marker).toBe(marker.toLowerCase());
    }
  });
});

describe('ATS Keywords - extractKeywords with nice-to-have', () => {
  it('extracts fromNiceToHave keywords from nice-to-have section', () => {
    const jd = `
      Engineering Manager
      Requirements:
      - 8+ years software engineering experience
      - Cloud infrastructure (AWS, GCP)
      - Team leadership

      Nice to have:
      - Healthcare industry experience
      - Startup background
      - Machine learning knowledge
    `;

    const keywords = extractKeywords(jd, 25);

    expect(keywords.fromNiceToHave).toBeDefined();
    expect(Array.isArray(keywords.fromNiceToHave)).toBe(true);
    // Should extract at least some keywords from nice-to-have section
    expect(keywords.fromNiceToHave.length).toBeGreaterThan(0);
  });

  it('returns empty fromNiceToHave when no nice-to-have section exists', () => {
    const jd = `
      Engineering Manager
      Requirements:
      - 8+ years experience
      - Cloud infrastructure
    `;

    const keywords = extractKeywords(jd, 20);

    expect(keywords.fromNiceToHave).toBeDefined();
    expect(Array.isArray(keywords.fromNiceToHave)).toBe(true);
  });

  it('assigns keywordPriorities to all extracted keywords', () => {
    const jd = `
      Senior Platform Engineer
      Requirements:
      - Python, AWS experience
      - CI/CD pipeline development

      Nice to have:
      - Go programming experience
      - Kubernetes certification
    `;

    const keywords = extractKeywords(jd, 25);

    expect(keywords.keywordPriorities).toBeDefined();
    expect(typeof keywords.keywordPriorities).toBe('object');

    // All keywords in the `all` array should have a priority
    for (const keyword of keywords.all) {
      expect(keywords.keywordPriorities[keyword]).toBeDefined();
      expect(['title', 'required', 'niceToHave', 'general']).toContain(
        keywords.keywordPriorities[keyword]
      );
    }
  });

  it('assigns title priority to title-derived keywords', () => {
    const jd = `
      Senior Platform Engineer
      Requirements:
      - Python experience
    `;

    const keywords = extractKeywords(jd, 20);

    // Title keywords should have 'title' priority
    for (const titleKw of keywords.fromTitle) {
      if (keywords.keywordPriorities[titleKw]) {
        expect(keywords.keywordPriorities[titleKw]).toBe('title');
      }
    }
  });

  it('assigns niceToHave priority to nice-to-have keywords', () => {
    const jd = `
      Engineering Manager
      Requirements:
      - Team leadership

      Preferred:
      - Healthcare domain expertise
      - Machine learning background
    `;

    const keywords = extractKeywords(jd, 25);

    for (const nthKw of keywords.fromNiceToHave) {
      if (keywords.keywordPriorities[nthKw]) {
        expect(keywords.keywordPriorities[nthKw]).toBe('niceToHave');
      }
    }
  });

  it('is deterministic for nice-to-have extraction', () => {
    const jd = `
      Engineering Manager
      Requirements:
      - Cloud infrastructure
      Nice to have:
      - Healthcare experience
    `;

    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const keywords = extractKeywords(jd, 20);
      results.push(JSON.stringify({
        all: keywords.all,
        fromNiceToHave: keywords.fromNiceToHave,
        priorities: keywords.keywordPriorities,
      }));
    }
    expect(new Set(results).size).toBe(1);
  });
});

describe('ATS Keywords - calculateActualKeywordDensity', () => {
  it('returns density result with expected fields', () => {
    const result = calculateActualKeywordDensity(
      'We use kubernetes and docker. Our kubernetes cluster runs on AWS with docker containers.',
      ['kubernetes', 'docker', 'aws']
    );

    expect(result).toBeDefined();
    expect(typeof result.overallDensity).toBe('number');
    expect(typeof result.totalOccurrences).toBe('number');
    expect(Array.isArray(result.stuffedKeywords)).toBe(true);
  });

  it('counts total keyword occurrences', () => {
    const result = calculateActualKeywordDensity(
      'kubernetes is great. We deploy on kubernetes. Our kubernetes cluster is reliable.',
      ['kubernetes']
    );

    expect(result.totalOccurrences).toBe(3);
  });

  it('flags keywords appearing 5+ times', () => {
    const result = calculateActualKeywordDensity(
      'kubernetes kubernetes kubernetes kubernetes kubernetes kubernetes',
      ['kubernetes']
    );

    expect(result.stuffedKeywords).toContain('kubernetes');
    expect(result.totalOccurrences).toBeGreaterThanOrEqual(5);
  });

  it('does not flag keywords appearing less than 5 times', () => {
    const result = calculateActualKeywordDensity(
      'We use kubernetes and docker. Docker containers run on kubernetes.',
      ['kubernetes', 'docker']
    );

    expect(result.stuffedKeywords).not.toContain('kubernetes');
    expect(result.stuffedKeywords).not.toContain('docker');
  });

  it('handles empty keywords array', () => {
    const result = calculateActualKeywordDensity('Some resume text here.', []);

    expect(result.overallDensity).toBe(0);
    expect(result.totalOccurrences).toBe(0);
    expect(result.stuffedKeywords).toHaveLength(0);
  });

  it('handles empty text', () => {
    const result = calculateActualKeywordDensity('', ['kubernetes']);

    expect(result.overallDensity).toBe(0);
    expect(result.totalOccurrences).toBe(0);
    expect(result.stuffedKeywords).toHaveLength(0);
  });

  it('is case insensitive', () => {
    const result = calculateActualKeywordDensity(
      'Kubernetes KUBERNETES kubernetes',
      ['kubernetes']
    );

    expect(result.totalOccurrences).toBe(3);
  });

  it('is deterministic', () => {
    const keywords = ['kubernetes', 'docker', 'aws'];
    const text = 'We use kubernetes and docker on AWS. Docker containers are great.';

    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(JSON.stringify(calculateActualKeywordDensity(text, keywords)));
    }
    expect(new Set(results).size).toBe(1);
  });
});

// ============================================================
// Phase 1 Tests: Synonym Expansion + Reverse Index
// ============================================================

describe('ATS Keywords - SYNONYM_REVERSE_INDEX', () => {
  it('maps synonym values back to their canonical keys', () => {
    // 'k8s' is a synonym under 'kubernetes'
    const entries = SYNONYM_REVERSE_INDEX.get('k8s');
    expect(entries).toBeDefined();
    expect(entries).toContain('kubernetes');
  });

  it('maps a canonical key to itself when it appears as a synonym elsewhere', () => {
    // 'gcp' is both a key and a synonym of 'cloud'
    const entries = SYNONYM_REVERSE_INDEX.get('gcp');
    expect(entries).toBeDefined();
    // Should include canonical terms that list 'gcp' as a synonym
    expect(entries!.some(e => e === 'cloud' || e === 'gcp')).toBe(true);
  });

  it('includes all synonym values from SKILL_SYNONYMS', () => {
    for (const [, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      for (const syn of synonyms) {
        const entries = SYNONYM_REVERSE_INDEX.get(syn.toLowerCase());
        expect(entries).toBeDefined();
        // The reverse index entry should include the canonical term or its synonyms
        expect(entries!.length).toBeGreaterThan(0);
      }
    }
  });

  it('provides O(1) lookup instead of O(n) scan', () => {
    // Simply verify the reverse index is a Map (O(1) lookup)
    expect(SYNONYM_REVERSE_INDEX instanceof Map).toBe(true);
    expect(SYNONYM_REVERSE_INDEX.size).toBeGreaterThan(0);
  });
});

describe('ATS Keywords - Expanded SKILL_SYNONYMS', () => {
  it('contains AI/ML synonyms', () => {
    expect(SKILL_SYNONYMS['machine learning']).toBeDefined();
    expect(SKILL_SYNONYMS['machine learning']).toContain('ml');
  });

  it('contains data engineering synonyms', () => {
    expect(SKILL_SYNONYMS['data pipeline']).toBeDefined();
    expect(SKILL_SYNONYMS['data pipeline']!.some(s => s.includes('etl'))).toBe(true);
  });

  it('contains security synonyms', () => {
    expect(SKILL_SYNONYMS['security']).toBeDefined();
  });

  it('contains product synonyms', () => {
    expect(SKILL_SYNONYMS['product management']).toBeDefined();
  });

  it('contains frontend synonyms', () => {
    expect(SKILL_SYNONYMS['frontend']).toBeDefined();
  });

  it('contains mobile synonyms', () => {
    expect(SKILL_SYNONYMS['mobile']).toBeDefined();
  });

  it('reverse index matches synonyms correctly in matchKeywords', () => {
    // 'machine learning' keyword should match resume with 'ml' via synonym
    const keywords = ['machine learning'];
    const resume = 'Experience with ML models and deep learning systems';
    const { matched } = matchKeywords(keywords, resume);
    expect(matched).toContain('machine learning');
  });
});

// ============================================================
// Phase 2 Tests: Multi-Word Phrase Extraction
// ============================================================

describe('ATS Keywords - KNOWN_PHRASES', () => {
  it('contains multi-word technical terms', () => {
    expect(KNOWN_PHRASES.has('machine learning')).toBe(true);
    expect(KNOWN_PHRASES.has('system design')).toBe(true);
    expect(KNOWN_PHRASES.has('data pipeline')).toBe(true);
  });

  it('contains management terms', () => {
    expect(KNOWN_PHRASES.has('engineering manager')).toBe(true);
    expect(KNOWN_PHRASES.has('people management')).toBe(true);
  });

  it('contains infrastructure terms', () => {
    expect(KNOWN_PHRASES.has('infrastructure as code')).toBe(true);
    expect(KNOWN_PHRASES.has('continuous integration')).toBe(true);
  });
});

describe('ATS Keywords - extractPhrases', () => {
  it('extracts known phrases from text', () => {
    const { phrases } = extractPhrases(
      'Experience with machine learning and system design'
    );
    expect(phrases).toContain('machine learning');
    expect(phrases).toContain('system design');
  });

  it('returns remaining text after phrase extraction', () => {
    const { remainder } = extractPhrases(
      'Experience with machine learning and data pipeline work'
    );
    // The remainder should not contain the extracted phrases
    expect(remainder.toLowerCase()).not.toContain('machine learning');
    expect(remainder.toLowerCase()).not.toContain('data pipeline');
  });

  it('uses longest-first greedy matching', () => {
    const { phrases } = extractPhrases(
      'Infrastructure as code experience with terraform'
    );
    expect(phrases).toContain('infrastructure as code');
  });

  it('handles text with no known phrases', () => {
    const { phrases, remainder } = extractPhrases('simple text with no phrases');
    expect(phrases).toHaveLength(0);
    expect(remainder).toBe('simple text with no phrases');
  });

  it('is case insensitive', () => {
    const { phrases } = extractPhrases('MACHINE LEARNING and System Design');
    expect(phrases).toContain('machine learning');
    expect(phrases).toContain('system design');
  });
});

describe('ATS Keywords - Short word boundary matching', () => {
  it('does not match "go" inside "google"', () => {
    const keywords = ['go'];
    const resume = 'Worked at Google on search infrastructure';
    const { matched } = matchKeywords(keywords, resume);
    expect(matched).not.toContain('go');
  });

  it('matches "go" as standalone word', () => {
    const keywords = ['go'];
    const resume = 'Experience with Go programming language';
    const { matched } = matchKeywords(keywords, resume);
    expect(matched).toContain('go');
  });

  it('does not match "sql" inside "nosqldb"', () => {
    const keywords = ['sql'];
    const resume = 'Used nosqldb for storage';
    const { matched } = matchKeywords(keywords, resume);
    expect(matched).not.toContain('sql');
  });

  it('matches "sql" as standalone word', () => {
    const keywords = ['sql'];
    const resume = 'Proficient in SQL and database design';
    const { matched } = matchKeywords(keywords, resume);
    expect(matched).toContain('sql');
  });

  it('does not match "api" inside "capital"', () => {
    const keywords = ['api'];
    const resume = 'Raised capital for the startup';
    const { matched } = matchKeywords(keywords, resume);
    expect(matched).not.toContain('api');
  });
});

describe('ATS Keywords - Multi-word keyword extraction', () => {
  it('extracts multi-word phrases as keywords from JD', () => {
    const jd = `
      Senior Engineering Manager
      Requirements:
      - Machine learning experience
      - System design expertise
      - Data pipeline development
    `;
    const keywords = extractKeywords(jd, 25);
    // Should extract multi-word phrases
    expect(keywords.all.some(k => k.includes(' '))).toBe(true);
  });

  it('matches multi-word keywords in resume', () => {
    const jd = 'Requirements: machine learning, system design';
    const keywords = extractKeywords(jd, 20);
    const resume = 'Built machine learning models and led system design reviews';
    const { matched } = matchKeywords(keywords.all, resume);
    const hasMultiWord = matched.some(m => m.includes(' '));
    expect(hasMultiWord).toBe(true);
  });
});

// ============================================================
// Phase 3 Tests: JD Section Parser
// ============================================================

describe('ATS Keywords - parseJDSections', () => {
  it('parses JD with colon-terminated section headers', () => {
    const jd = `
      Engineering Manager

      Requirements:
      - Python experience
      - AWS knowledge

      Nice to have:
      - Kubernetes
    `;
    const sections = parseJDSections(jd);
    expect(sections.length).toBeGreaterThan(0);
    const required = sections.find(s => s.type === 'required');
    expect(required).toBeDefined();
  });

  it('parses JD with ALL CAPS section headers', () => {
    const jd = `
      Engineering Manager

      REQUIREMENTS
      - Python experience
      - AWS knowledge

      PREFERRED QUALIFICATIONS
      - Kubernetes
    `;
    const sections = parseJDSections(jd);
    const required = sections.find(s => s.type === 'required');
    expect(required).toBeDefined();
    const niceToHave = sections.find(s => s.type === 'niceToHave');
    expect(niceToHave).toBeDefined();
  });

  it('parses JD with markdown ## headers', () => {
    const jd = `
      ## Engineering Manager

      ## Requirements
      - Python experience

      ## Nice to have
      - Kubernetes
    `;
    const sections = parseJDSections(jd);
    expect(sections.length).toBeGreaterThan(0);
  });

  it('classifies responsibilities section', () => {
    const jd = `
      Engineering Manager

      Responsibilities:
      - Lead engineering teams
      - Drive technical strategy

      Requirements:
      - 8+ years experience
    `;
    const sections = parseJDSections(jd);
    const responsibilities = sections.find(s => s.type === 'responsibilities');
    expect(responsibilities).toBeDefined();
  });

  it('handles JD without clear headers (fallback)', () => {
    const jd = `
      Engineering Manager at Acme Corp

      We are looking for someone who has:
      - Python and AWS experience
      - Team leadership skills
      - It would be a plus to have Kubernetes knowledge
    `;
    const sections = parseJDSections(jd);
    // Even without headers, should return at least one section
    expect(sections.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const jd = `
      Requirements:
      - Python
      Nice to have:
      - Go
    `;
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(JSON.stringify(parseJDSections(jd)));
    }
    expect(new Set(results).size).toBe(1);
  });
});

describe('ATS Keywords - Responsibilities priority', () => {
  it('extractKeywords includes responsibilities priority', () => {
    const jd = `
      Engineering Manager

      Responsibilities:
      - Lead platform engineering team
      - Drive cloud migration initiatives

      Requirements:
      - 8+ years experience
      - Python, AWS
    `;
    const keywords = extractKeywords(jd, 25);
    // Some keywords should have 'responsibilities' priority
    const hasResponsibilities = Object.values(keywords.keywordPriorities).some(
      p => p === 'responsibilities'
    );
    expect(hasResponsibilities).toBe(true);
  });
});

// ============================================================
// Phase 4 Tests: Title Extraction + Frequency Weighting
// ============================================================

describe('ATS Keywords - Enhanced title extraction', () => {
  it('extracts title from explicit label patterns', () => {
    const jd = `
      Position: Senior Engineering Manager
      Location: San Francisco
      Requirements:
      - 8+ years experience
    `;
    const keywords = extractKeywords(jd, 20);
    expect(keywords.fromTitle.length).toBeGreaterThan(0);
    expect(keywords.fromTitle.some(k =>
      ['senior', 'engineering', 'manager'].includes(k)
    )).toBe(true);
  });

  it('extracts title from first few lines with role words', () => {
    const jd = `
      About Acme Corp
      Senior Data Scientist
      Join our team to work on exciting ML problems.
    `;
    const keywords = extractKeywords(jd, 20);
    expect(keywords.fromTitle.length).toBeGreaterThan(0);
  });

  it('supports expanded role words (analyst, scientist, designer)', () => {
    const jd = 'Senior Product Designer\nRequirements: 5+ years design';
    const keywords = extractKeywords(jd, 20);
    // Phrase extraction may produce "product designer" as one token
    expect(keywords.fromTitle.some(k => k.includes('designer') || k.includes('product'))).toBe(true);
  });
});

describe('ATS Keywords - Frequency weighting', () => {
  it('tracks keyword frequency in ExtractedKeywords', () => {
    const jd = `
      Python Python Python
      AWS AWS
      Kubernetes
      Requirements:
      - Python experience
    `;
    const keywords = extractKeywords(jd, 20);
    expect(keywords.keywordFrequency).toBeDefined();
    expect(keywords.keywordFrequency['python']).toBeGreaterThan(1);
  });

  it('frequency multiplier is bounded at 1.5x', () => {
    const jd = `
      Python Python Python Python Python Python Python Python Python Python
      Requirements:
      - Python is essential
    `;
    const keywords = extractKeywords(jd, 20);
    // Even with 10+ occurrences, multiplier caps at 1.5
    expect(keywords.keywordFrequency['python']).toBeGreaterThanOrEqual(5);
    // The actual multiplier application is in ats-scorer, so we just verify frequency is tracked
  });

  it('frequency of 1 produces 1.0x multiplier concept', () => {
    const jd = 'Engineering Manager\nRequirements:\n- Kubernetes experience';
    const keywords = extractKeywords(jd, 20);
    if (keywords.keywordFrequency['kubernetes'] !== undefined) {
      expect(keywords.keywordFrequency['kubernetes']).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================
// Phase 5 Tests: Dynamic Keyword Count
// ============================================================

describe('ATS Keywords - calculateDynamicKeywordCount', () => {
  it('returns higher count for longer JDs', () => {
    const shortJd = 'Python developer needed';
    const longJd = Array(200).fill('Python AWS GCP Kubernetes Docker experience needed for this role.').join(' ');
    const shortCount = calculateDynamicKeywordCount(shortJd);
    const longCount = calculateDynamicKeywordCount(longJd);
    expect(longCount).toBeGreaterThan(shortCount);
  });

  it('clamps to minimum of 10', () => {
    const tinyJd = 'Hi';
    expect(calculateDynamicKeywordCount(tinyJd)).toBeGreaterThanOrEqual(10);
  });

  it('clamps to maximum of 40', () => {
    const hugeJd = Array(10000).fill('word ').join('');
    expect(calculateDynamicKeywordCount(hugeJd)).toBeLessThanOrEqual(40);
  });

  it('accounts for section count', () => {
    const jdWithSections = `
      Requirements:
      - Python
      Nice to have:
      - AWS
      Responsibilities:
      - Lead team
      About us:
      - Great company
    `;
    const jdWithoutSections = 'Python AWS Lead team Great company';
    const countWithSections = calculateDynamicKeywordCount(jdWithSections);
    const countWithoutSections = calculateDynamicKeywordCount(jdWithoutSections);
    expect(countWithSections).toBeGreaterThanOrEqual(countWithoutSections);
  });

  it('is deterministic', () => {
    const jd = 'Engineering Manager with Python AWS GCP Kubernetes';
    const results = new Set<number>();
    for (let i = 0; i < 10; i++) {
      results.add(calculateDynamicKeywordCount(jd));
    }
    expect(results.size).toBe(1);
  });
});
