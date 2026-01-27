import { describe, it, expect } from 'vitest';
import {
  calculateATSScore,
  resumeDataToText,
  formatScoreAssessment,
  type ResumeData,
} from '@/lib/ats-scorer';
import {
  extractKeywords,
  matchKeywords,
  stemWord,
  wordCount,
  calculateMatchRate,
  calculateKeywordDensity,
  STOPWORDS,
  SKILL_SYNONYMS,
  TECH_KEYWORDS,
  ACTION_VERBS,
} from '@/lib/ats-keywords';

// Mock resume data for testing
const mockResumeData: ResumeData = {
  title: 'Engineering Manager',
  yearsExperience: 15,
  teamSize: '13 engineers',
  skills: ['Python', 'AWS', 'GCP', 'Leadership', 'Platform Engineering'],
  skillsByCategory: [
    { category: 'Leadership', items: ['Cross-Functional Leadership', 'Technical Strategy', 'Team Management'] },
    { category: 'Cloud', items: ['GCP', 'AWS', 'Kubernetes', 'Docker', 'Terraform'] },
    { category: 'DevOps', items: ['CI/CD', 'GitHub Actions', 'Jenkins'] },
  ],
  experiences: [
    {
      title: 'Engineering Manager - Cloud Infrastructure',
      company: 'Verily Life Sciences',
      highlights: [
        'Led cloud migration to GCP serving 30+ production systems',
        'Built and scaled team of 13 engineers across 4 hiring cycles',
        'Drove platform efficiency reducing GitHub Actions usage by 30%',
      ],
    },
    {
      title: 'Senior Staff Engineer/Manager',
      company: 'Qualcomm Technologies',
      highlights: [
        'Managed 35-engineer organization across 3 global sites',
        'Implemented CI/CD transformation reducing build times by 87%',
      ],
    },
  ],
};

const sampleResume = `
  Engineering Manager with 15+ years experience leading platform teams.
  Led cloud migration to GCP serving 30+ production systems.
  Managed team of 13 engineers delivering developer platform.
  Python, Java, TypeScript, AWS, GCP expertise.
  Cross-functional leadership, technical strategy, stakeholder management.
  Kubernetes, Docker, Terraform, CI/CD, GitHub Actions.
  Built scalable infrastructure supporting 400+ engineers.
`;

const sampleJD = `
  Engineering Manager, Platform

  Requirements:
  - 8+ years software development experience
  - 3+ years leading engineering teams
  - Experience with cloud platforms (AWS, GCP, Azure)
  - Strong communication skills
  - Python, Go, or Java expertise

  Nice to have:
  - Kubernetes experience
  - Platform engineering background
  - Healthcare technology experience
`;

describe('ATS Scorer - Determinism', () => {
  it('produces identical scores across 10 runs', () => {
    const scores: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = calculateATSScore({
        jobDescription: sampleJD,
        resumeText: sampleResume,
        resumeData: mockResumeData,
      });
      scores.push(result.total);
    }

    // All scores must be exactly equal
    expect(new Set(scores).size).toBe(1);
  });

  it('produces identical breakdown across runs', () => {
    const breakdowns: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = calculateATSScore({
        jobDescription: sampleJD,
        resumeText: sampleResume,
        resumeData: mockResumeData,
      });
      breakdowns.push(JSON.stringify(result.breakdown));
    }

    expect(new Set(breakdowns).size).toBe(1);
  });

  it('produces identical keyword lists across runs', () => {
    const keywordLists: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = calculateATSScore({
        jobDescription: sampleJD,
        resumeText: sampleResume,
        resumeData: mockResumeData,
      });
      keywordLists.push(JSON.stringify(result.details.matchedKeywords.sort()));
    }

    expect(new Set(keywordLists).size).toBe(1);
  });

  it('produces identical extracted keywords across runs', () => {
    const extractedLists: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = calculateATSScore({
        jobDescription: sampleJD,
        resumeText: sampleResume,
        resumeData: mockResumeData,
      });
      extractedLists.push(JSON.stringify(result.details.extractedKeywords.all.sort()));
    }

    expect(new Set(extractedLists).size).toBe(1);
  });
});

describe('ATS Scorer - Keyword Extraction', () => {
  it('extracts job title as highest priority', () => {
    const jd = 'Senior Engineering Manager, Platform Infrastructure';
    const keywords = extractKeywords(jd, 20);

    // Should contain title-related keywords
    expect(keywords.fromTitle.some(k =>
      ['engineering', 'manager', 'platform', 'infrastructure', 'senior'].includes(k)
    )).toBe(true);
  });

  it('extracts required skills correctly', () => {
    const jd = `
      Requirements:
      - Python programming
      - AWS experience
      - Team leadership
    `;
    const keywords = extractKeywords(jd, 20);

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
    const jd = 'You led teams, managed projects, and built infrastructure';
    const keywords = extractKeywords(jd, 20);

    // Action verbs are extracted if they match the ACTION_VERBS set exactly
    expect(keywords.actionVerbs.some(v => ['led', 'managed', 'built'].includes(v))).toBe(true);
  });

  it('handles different JD formats consistently', () => {
    const jd1 = 'Requirements: Python, AWS, Leadership';
    const jd2 = 'Must have:\n- Python\n- AWS\n- Leadership skills';

    const kw1 = extractKeywords(jd1, 20);
    const kw2 = extractKeywords(jd2, 20);

    // Both should extract python and aws
    expect(kw1.all.filter(k => ['python', 'aws'].includes(k)).length).toBeGreaterThanOrEqual(2);
    expect(kw2.all.filter(k => ['python', 'aws'].includes(k)).length).toBeGreaterThanOrEqual(2);
  });

  it('respects count limit', () => {
    const longJd = Array(50).fill('unique_keyword_' + Math.random()).join(' ');
    const keywords = extractKeywords(longJd, 20);

    expect(keywords.all.length).toBeLessThanOrEqual(20);
  });

  it('filters stopwords', () => {
    const jd = 'The manager is a good leader with the ability to work';
    const keywords = extractKeywords(jd, 20);

    // Stopwords should not be in keywords
    expect(keywords.all).not.toContain('the');
    expect(keywords.all).not.toContain('is');
    expect(keywords.all).not.toContain('with');
    expect(keywords.all).not.toContain('to');
  });
});

describe('ATS Scorer - Keyword Matching', () => {
  it('matches exact keywords', () => {
    const keywords = ['python', 'aws', 'leadership'];
    const resume = 'Experienced in Python and AWS with strong leadership skills.';

    const { matched, missing } = matchKeywords(keywords, resume);

    expect(matched).toContain('python');
    expect(matched).toContain('aws');
    expect(matched).toContain('leadership');
    expect(missing).toEqual([]);
  });

  it('matches stem variations', () => {
    const keywords = ['leading', 'managed', 'development'];
    const resume = 'Led teams, managed projects, developed systems.';

    const { matched, matchDetails } = matchKeywords(keywords, resume);

    // Should match via stemming
    expect(matched.length).toBeGreaterThanOrEqual(2);
    expect(matchDetails.some(d => d.matchType === 'stem' || d.matchType === 'exact')).toBe(true);
  });

  it('matches synonyms from mapping', () => {
    const keywords = ['cloud'];
    const resume = 'Extensive GCP and AWS experience.';

    const { matched, matchDetails } = matchKeywords(keywords, resume);

    expect(matched).toContain('cloud');
    expect(matchDetails.find(d => d.keyword === 'cloud')?.matchType).toBe('synonym');
  });

  it('is case-insensitive', () => {
    const keywords = ['Python', 'AWS', 'GCP'];
    const resume = 'python, aws, gcp';

    const { matched } = matchKeywords(keywords, resume);

    expect(matched.length).toBe(3);
  });

  it('handles compound keywords', () => {
    const keywords = ['ci/cd', 'github actions'];
    const resume = 'CI/CD pipelines using GitHub Actions';

    const { matched } = matchKeywords(keywords, resume);

    // Should match at least one
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  it('correctly identifies missing keywords', () => {
    const keywords = ['python', 'rust', 'haskell'];
    const resume = 'Experience with Python and Java.';

    const { matched, missing } = matchKeywords(keywords, resume);

    expect(matched).toContain('python');
    expect(missing).toContain('rust');
    expect(missing).toContain('haskell');
  });
});

describe('ATS Scorer - Score Calculation', () => {
  it('scores within valid range (0-100)', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('breakdown categories sum to approximately total', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    const sum =
      result.breakdown.keywordRelevance +
      result.breakdown.skillsQuality +
      result.breakdown.experienceAlignment +
      result.breakdown.formatParseability;

    // Allow for rounding differences
    expect(Math.abs(sum - result.total)).toBeLessThan(1);
  });

  it('caps keyword score at 40 points', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.keywordRelevance).toBeLessThanOrEqual(40);
  });

  it('caps skills score at 25 points', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.skillsQuality).toBeLessThanOrEqual(25);
  });

  it('caps experience score at 20 points', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.experienceAlignment).toBeLessThanOrEqual(20);
  });

  it('format parseability is always 15 for valid resumes', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Our PDF is always ATS-optimized
    expect(result.breakdown.formatParseability).toBe(15);
  });

  it('scores higher with more keyword matches', () => {
    const lowMatchResume = 'Some general text without relevant keywords.';
    const highMatchResume = sampleResume; // Has many relevant keywords

    const lowResult = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: lowMatchResume,
      resumeData: mockResumeData,
    });

    const highResult = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: highMatchResume,
      resumeData: mockResumeData,
    });

    expect(highResult.total).toBeGreaterThan(lowResult.total);
  });

  it('scores higher with matching years of experience', () => {
    const matchingYearsData: ResumeData = { ...mockResumeData, yearsExperience: 10 };
    const missingYearsData: ResumeData = { ...mockResumeData, yearsExperience: 2 };

    const matchResult = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: matchingYearsData,
    });

    const missResult = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: missingYearsData,
    });

    expect(matchResult.breakdown.experienceAlignment).toBeGreaterThan(
      missResult.breakdown.experienceAlignment
    );
  });
});

describe('ATS Scorer - Generated JD Tests', () => {
  const JD_TEMPLATES = [
    // Tech Startup
    `Senior Engineering Manager - Fintech Startup
     We're looking for a technical leader to build our platform team.
     Requirements:
     - 8+ years software engineering
     - 5+ years people management
     - Experience with Python, Go, or Rust
     - Cloud-native architecture (Kubernetes, AWS/GCP)
     - Strong product sense`,

    // Enterprise
    `Director of Engineering - Enterprise Software
     Lead multiple teams delivering mission-critical systems.
     Must have:
     - 10+ years progressive engineering experience
     - 5+ years managing managers
     - Enterprise architecture experience
     - Java, .NET, or Python background
     - Stakeholder management skills`,

    // Platform
    `Platform Engineering Manager
     Build and scale our developer platform.
     Required:
     - Platform engineering experience
     - Infrastructure as code (Terraform, Pulumi)
     - CI/CD pipeline design
     - Team leadership (6+ engineers)
     - GCP or AWS expertise`,
  ];

  JD_TEMPLATES.forEach((jd, index) => {
    it(`produces deterministic score for JD template ${index + 1}`, () => {
      const scores: number[] = [];
      for (let i = 0; i < 5; i++) {
        const result = calculateATSScore({
          jobDescription: jd,
          resumeText: sampleResume,
          resumeData: mockResumeData,
        });
        scores.push(result.total);
      }

      expect(new Set(scores).size).toBe(1);
    });

    it(`extracts reasonable keyword count for JD template ${index + 1}`, () => {
      const keywords = extractKeywords(jd, 20);

      expect(keywords.all.length).toBeGreaterThanOrEqual(5);
      expect(keywords.all.length).toBeLessThanOrEqual(20);
    });

    it(`produces non-zero score for JD template ${index + 1}`, () => {
      const result = calculateATSScore({
        jobDescription: jd,
        resumeText: sampleResume,
        resumeData: mockResumeData,
      });

      expect(result.total).toBeGreaterThan(0);
    });
  });
});

describe('ATS Scorer - Edge Cases', () => {
  it('handles empty JD gracefully', () => {
    const result = calculateATSScore({
      jobDescription: '',
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.keywordRelevance).toBe(0);
    expect(result.breakdown.formatParseability).toBe(15);
  });

  it('handles empty resume gracefully', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: '',
      resumeData: mockResumeData,
    });

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.details.matchedKeywords).toEqual([]);
  });

  it('handles special characters in JD', () => {
    const result = calculateATSScore({
      jobDescription: 'C++, C#, .NET, Node.js, React.js experience required',
      resumeText: 'Experience with C++, C#, .NET, Node.js, React.js',
      resumeData: mockResumeData,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.details.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('handles unicode characters', () => {
    const result = calculateATSScore({
      jobDescription: 'Müller Engineering – Senior Manager Position',
      resumeText: 'Worked at Müller Engineering as manager',
      resumeData: mockResumeData,
    });

    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('handles very long JD without issues', () => {
    const longJd = Array(100)
      .fill('This is a job description with Python AWS GCP requirements.')
      .join('\n');

    const result = calculateATSScore({
      jobDescription: longJd,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.details.extractedKeywords.all.length).toBeLessThanOrEqual(20);
  });

  it('handles minimal JD', () => {
    const result = calculateATSScore({
      jobDescription: 'Python developer',
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.total).toBeGreaterThan(0);
  });

  it('handles resume data with missing fields', () => {
    const minimalData: ResumeData = {
      title: 'Engineer',
    };

    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: minimalData,
    });

    expect(result.total).toBeGreaterThan(0);
  });

  it('handles whitespace-only inputs', () => {
    const result = calculateATSScore({
      jobDescription: '   \n\t  ',
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.keywordRelevance).toBe(0);
  });
});

describe('ATS Keywords - Utility Functions', () => {
  describe('stemWord', () => {
    it('stems common suffixes', () => {
      expect(stemWord('leading')).toBe('lead');
      expect(stemWord('managed')).toBe('manag');
      expect(stemWord('development')).toBe('develop');
      expect(stemWord('engineering')).toBe('engineer');
    });

    it('preserves short words', () => {
      expect(stemWord('go')).toBe('go');
      expect(stemWord('js')).toBe('js');
    });

    it('handles already stemmed words', () => {
      expect(stemWord('lead')).toBe('lead');
      expect(stemWord('python')).toBe('python');
    });
  });

  describe('wordCount', () => {
    it('counts words correctly', () => {
      expect(wordCount('one two three')).toBe(3);
      expect(wordCount('one, two, three')).toBe(3);
      expect(wordCount('  multiple   spaces  ')).toBe(2);
    });

    it('handles empty string', () => {
      expect(wordCount('')).toBe(0);
    });
  });

  describe('calculateMatchRate', () => {
    it('calculates percentage correctly', () => {
      expect(calculateMatchRate(8, 10)).toBe(80);
      expect(calculateMatchRate(15, 20)).toBe(75);
      expect(calculateMatchRate(0, 10)).toBe(0);
    });

    it('handles zero total', () => {
      expect(calculateMatchRate(5, 0)).toBe(0);
    });
  });

  describe('calculateKeywordDensity', () => {
    it('calculates density correctly', () => {
      expect(calculateKeywordDensity(10, 500)).toBe(2);
      expect(calculateKeywordDensity(15, 500)).toBe(3);
    });

    it('handles zero total words', () => {
      expect(calculateKeywordDensity(5, 0)).toBe(0);
    });
  });
});

describe('ATS Keywords - Data Structures', () => {
  it('STOPWORDS contains common words', () => {
    expect(STOPWORDS.has('the')).toBe(true);
    expect(STOPWORDS.has('and')).toBe(true);
    expect(STOPWORDS.has('is')).toBe(true);
    expect(STOPWORDS.has('python')).toBe(false);
    expect(STOPWORDS.has('aws')).toBe(false);
  });

  it('SKILL_SYNONYMS has common mappings', () => {
    expect(SKILL_SYNONYMS['cloud']).toContain('gcp');
    expect(SKILL_SYNONYMS['cloud']).toContain('aws');
    expect(SKILL_SYNONYMS['kubernetes']).toContain('k8s');
    expect(SKILL_SYNONYMS['python']).toContain('py');
  });

  it('TECH_KEYWORDS contains common technologies', () => {
    expect(TECH_KEYWORDS.has('python')).toBe(true);
    expect(TECH_KEYWORDS.has('aws')).toBe(true);
    expect(TECH_KEYWORDS.has('kubernetes')).toBe(true);
    expect(TECH_KEYWORDS.has('docker')).toBe(true);
    expect(TECH_KEYWORDS.has('terraform')).toBe(true);
  });

  it('ACTION_VERBS contains leadership verbs', () => {
    expect(ACTION_VERBS.has('led')).toBe(true);
    expect(ACTION_VERBS.has('managed')).toBe(true);
    expect(ACTION_VERBS.has('built')).toBe(true);
    expect(ACTION_VERBS.has('delivered')).toBe(true);
  });
});

describe('ATS Scorer - Utility Functions', () => {
  describe('resumeDataToText', () => {
    it('converts resume data to text', () => {
      const text = resumeDataToText({
        ...mockResumeData,
        name: 'John Doe',
        summary: 'Experienced engineering leader',
      });

      expect(text).toContain('John Doe');
      expect(text).toContain('Engineering Manager');
      expect(text).toContain('Experienced engineering leader');
      expect(text).toContain('GCP');
    });

    it('handles minimal data', () => {
      const text = resumeDataToText({ title: 'Engineer' });
      expect(text).toContain('Engineer');
    });
  });

  describe('formatScoreAssessment', () => {
    it('returns correct assessment for scores', () => {
      expect(formatScoreAssessment(90)).toContain('Excellent');
      expect(formatScoreAssessment(75)).toContain('Good');
      expect(formatScoreAssessment(60)).toContain('Fair');
      expect(formatScoreAssessment(40)).toContain('Weak');
    });
  });
});

describe('ATS Scorer - Real World Scenarios', () => {
  it('scores well for closely matching JD and resume', () => {
    const perfectMatchJd = `
      Engineering Manager, Cloud Infrastructure
      Requirements:
      - 10+ years software engineering experience
      - 5+ years managing engineering teams
      - GCP and AWS cloud experience
      - Kubernetes and Docker expertise
      - CI/CD pipeline design
      - Platform engineering background
    `;

    const result = calculateATSScore({
      jobDescription: perfectMatchJd,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Should score reasonably well for a matching profile
    expect(result.total).toBeGreaterThan(50);
    expect(result.details.matchedKeywords.length).toBeGreaterThan(5);
  });

  it('scores lower for mismatched JD and resume', () => {
    const mismatchedJd = `
      Data Scientist, Machine Learning
      Requirements:
      - PhD in Computer Science or related field
      - 5+ years ML/AI experience
      - TensorFlow, PyTorch expertise
      - Deep learning model development
      - Research publication track record
    `;

    const result = calculateATSScore({
      jobDescription: mismatchedJd,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Should score lower for mismatched profile
    expect(result.total).toBeLessThan(50);
    expect(result.details.missingKeywords.length).toBeGreaterThan(
      result.details.matchedKeywords.length
    );
  });

  it('provides actionable missing keywords', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: 'Generic resume without specific keywords.',
      resumeData: mockResumeData,
    });

    // Missing keywords should be populated
    expect(result.details.missingKeywords.length).toBeGreaterThan(0);
    // Each should be a non-empty string
    for (const keyword of result.details.missingKeywords) {
      expect(keyword).toBeTruthy();
      expect(typeof keyword).toBe('string');
    }
  });
});
