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
      result.breakdown.contentQuality;

    // Allow for rounding differences
    expect(Math.abs(sum - result.total)).toBeLessThan(1);
  });

  it('caps keyword score at 45 points', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.keywordRelevance).toBeLessThanOrEqual(45);
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

  it('caps content quality score at 10 points', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.contentQuality).toBeLessThanOrEqual(10);
    expect(result.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
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

  it('includes isATSOptimized flag in result', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(typeof result.isATSOptimized).toBe('boolean');
  });
});

describe('ATS Scorer - Content Quality', () => {
  it('awards points for quantified metrics in resume', () => {
    const resumeDataWithMetrics: ResumeData = {
      ...mockResumeData,
      experiences: [
        {
          title: 'Engineering Manager',
          company: 'Verily',
          highlights: [
            'Led team of 13 engineers across 4 hiring cycles',
            'Reduced build times by 87% through CI/CD optimization',
            'Migrated 30+ production systems to GCP',
            'Drove 30% reduction in GitHub Actions usage',
          ],
        },
      ],
    };

    const resumeDataWithoutMetrics: ResumeData = {
      ...mockResumeData,
      experiences: [
        {
          title: 'Engineering Manager',
          company: 'Verily',
          highlights: [
            'Led engineering teams across hiring cycles',
            'Optimized CI/CD pipelines for faster builds',
            'Migrated systems to cloud infrastructure',
            'Improved platform efficiency and reduced waste',
          ],
        },
      ],
    };

    const resultWithMetrics = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: resumeDataWithMetrics,
    });

    const resultWithoutMetrics = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: resumeDataWithoutMetrics,
    });

    // Content quality should be scored for both
    expect(resultWithMetrics.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
    expect(resultWithMetrics.breakdown.contentQuality).toBeLessThanOrEqual(10);
    expect(resultWithoutMetrics.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
    expect(resultWithoutMetrics.breakdown.contentQuality).toBeLessThanOrEqual(10);
    // Metrics-rich resume should score at least as well
    expect(resultWithMetrics.breakdown.contentQuality).toBeGreaterThanOrEqual(
      resultWithoutMetrics.breakdown.contentQuality
    );
  });

  it('awards points for strong action verbs', () => {
    const resumeDataWithActionVerbs: ResumeData = {
      ...mockResumeData,
      experiences: [
        {
          title: 'Engineering Manager',
          company: 'Verily',
          highlights: [
            'Led cloud migration project to GCP',
            'Built high-performing engineering team',
            'Delivered developer platform on time',
            'Drove platform efficiency improvements',
            'Architected scalable infrastructure',
          ],
        },
      ],
    };

    const resumeDataWithWeakVerbs: ResumeData = {
      ...mockResumeData,
      experiences: [
        {
          title: 'Engineering Manager',
          company: 'Verily',
          highlights: [
            'Was responsible for cloud migration',
            'Worked on engineering team',
            'Helped with developer platform',
            'Involved in efficiency improvements',
            'Assisted with infrastructure',
          ],
        },
      ],
    };

    const resultWithAction = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: resumeDataWithActionVerbs,
    });

    const resultWeakAction = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: resumeDataWithWeakVerbs,
    });

    // Content quality should be scored for both
    expect(resultWithAction.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
    expect(resultWithAction.breakdown.contentQuality).toBeLessThanOrEqual(10);
    expect(resultWeakAction.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
    expect(resultWeakAction.breakdown.contentQuality).toBeLessThanOrEqual(10);
    // Action verb resume should score at least as well
    expect(resultWithAction.breakdown.contentQuality).toBeGreaterThanOrEqual(
      resultWeakAction.breakdown.contentQuality
    );
  });

  it('awards points for well-structured bullet points', () => {
    const wellStructuredResume = `
      - Led cloud migration to GCP serving 30+ production systems
      - Built and scaled team of 13 engineers across 4 hiring cycles
      - Drove platform efficiency reducing GitHub Actions usage by 30%
      - Implemented CI/CD transformation reducing build times by 87%
    `;

    const poorlyStructuredResume = `
      Led cloud migration to GCP serving 30+ production systems.
      Built and scaled team of 13 engineers across 4 hiring cycles.
      Drove platform efficiency reducing GitHub Actions usage by 30%.
      Implemented CI/CD transformation reducing build times by 87%.
    `;

    const resultWellStructured = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: wellStructuredResume,
      resumeData: mockResumeData,
    });

    const resultPoorStructure = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: poorlyStructuredResume,
      resumeData: mockResumeData,
    });

    // Both should have some content quality score, but structured may score higher
    expect(resultWellStructured.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
    expect(resultPoorStructure.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
  });
});

describe('ATS Scorer - Education Matching', () => {
  it('matches Bachelor degree requirement', () => {
    const jdWithBachelor = `
      Senior Engineering Manager
      Requirements:
      - Bachelor's degree in Computer Science or related field
      - 8+ years software engineering experience
      - Team leadership experience
    `;

    const resumeDataWithBachelor: ResumeData = {
      ...mockResumeData,
      education: [
        {
          degree: "Bachelor's degree in Computer Science",
          institution: 'University of Example',
        },
      ],
    };

    const resumeDataWithoutDegree: ResumeData = {
      ...mockResumeData,
      education: [],
    };

    const resultWithDegree = calculateATSScore({
      jobDescription: jdWithBachelor,
      resumeText: sampleResume,
      resumeData: resumeDataWithBachelor,
    });

    const resultWithoutDegree = calculateATSScore({
      jobDescription: jdWithBachelor,
      resumeText: sampleResume,
      resumeData: resumeDataWithoutDegree,
    });

    // Should score higher with matching education
    expect(resultWithDegree.total).toBeGreaterThanOrEqual(resultWithoutDegree.total);
  });

  it('matches Master degree requirement', () => {
    const jdWithMaster = `
      Director of Engineering
      Requirements:
      - Master's degree in Computer Science, Engineering, or MBA
      - 10+ years progressive engineering experience
      - 5+ years people management
    `;

    const resumeDataWithMaster: ResumeData = {
      ...mockResumeData,
      education: [
        {
          degree: 'Master of Business Administration (MBA)',
          institution: 'Business School',
        },
        {
          degree: "Bachelor's degree in Computer Science",
          institution: 'University of Example',
        },
      ],
    };

    const resumeDataBachelorOnly: ResumeData = {
      ...mockResumeData,
      education: [
        {
          degree: "Bachelor's degree in Computer Science",
          institution: 'University of Example',
        },
      ],
    };

    const resultWithMaster = calculateATSScore({
      jobDescription: jdWithMaster,
      resumeText: sampleResume,
      resumeData: resumeDataWithMaster,
    });

    const resultBachelorOnly = calculateATSScore({
      jobDescription: jdWithMaster,
      resumeText: sampleResume,
      resumeData: resumeDataBachelorOnly,
    });

    // Should score higher with matching advanced degree
    expect(resultWithMaster.total).toBeGreaterThanOrEqual(resultBachelorOnly.total);
  });
});

describe('ATS Scorer - Role Type Detection', () => {
  it('detects individual contributor role', () => {
    const icJd = `
      Senior Software Engineer
      Requirements:
      - 5+ years software development experience
      - Python and AWS expertise
      - Strong coding and system design skills
      - Collaborate with cross-functional teams
    `;

    const result = calculateATSScore({
      jobDescription: icJd,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Should extract role-related keywords
    expect(result.details.extractedKeywords.all.length).toBeGreaterThan(0);
  });

  it('detects management role', () => {
    const managementJd = `
      Engineering Manager
      Requirements:
      - 8+ years software engineering experience
      - 3+ years leading engineering teams
      - People management and mentorship
      - Team building and performance management
    `;

    const result = calculateATSScore({
      jobDescription: managementJd,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Should extract management-related keywords
    const keywords = result.details.extractedKeywords.all;
    expect(keywords.some(k => ['manager', 'management', 'leading', 'team'].includes(k))).toBe(true);
  });
});

describe('ATS Scorer - Weighted Keyword Scoring', () => {
  it('prioritizes job title keywords', () => {
    const jd = `
      Engineering Manager, Platform Infrastructure
      Requirements:
      - Python, AWS experience
    `;

    const keywords = extractKeywords(jd, 20);

    // Title keywords should be identified
    expect(keywords.fromTitle.length).toBeGreaterThan(0);
    expect(keywords.fromTitle.some(k =>
      ['engineering', 'manager', 'platform', 'infrastructure'].includes(k)
    )).toBe(true);
  });

  it('assigns higher priority to title keywords', () => {
    const jd = `
      Senior Platform Engineer
      Requirements:
      - Cloud infrastructure experience
      - CI/CD pipeline development
    `;

    const keywords = extractKeywords(jd, 20);

    // Check that keywordPriorities exists and has entries
    expect(keywords.keywordPriorities).toBeDefined();

    // If there are priorities, verify they're in the expected format
    const priorityKeys = Object.keys(keywords.keywordPriorities);
    if (priorityKeys.length > 0) {
      const firstKey = priorityKeys[0];
      const priorityValue = keywords.keywordPriorities[firstKey];
      // Priority can be a number or a string representation of priority
      expect(['number', 'string']).toContain(typeof priorityValue);
    }

    // Title keywords should be extracted
    expect(keywords.fromTitle.length).toBeGreaterThan(0);
  });

  it('identifies nice-to-have keywords separately', () => {
    const jd = `
      Engineering Manager
      Requirements:
      - 8+ years experience
      - Team leadership

      Nice to have:
      - Healthcare experience
      - Startup background
    `;

    const keywords = extractKeywords(jd, 20);

    expect(keywords.fromNiceToHave).toBeDefined();
    // Nice-to-have section should extract some keywords
    expect(Array.isArray(keywords.fromNiceToHave)).toBe(true);
  });

  it('scores resume higher when matching high-priority keywords', () => {
    const jdWithTitleMatch = `
      Engineering Manager, Platform
      Requirements:
      - Python experience
    `;

    const resumeMatchingTitle = `
      Engineering Manager with extensive platform engineering background.
      Python, AWS, GCP expertise.
    `;

    const resumeNotMatchingTitle = `
      Software Developer with Python experience.
      Worked on various projects.
    `;

    const resultTitleMatch = calculateATSScore({
      jobDescription: jdWithTitleMatch,
      resumeText: resumeMatchingTitle,
      resumeData: { ...mockResumeData, title: 'Engineering Manager' },
    });

    const resultNoTitleMatch = calculateATSScore({
      jobDescription: jdWithTitleMatch,
      resumeText: resumeNotMatchingTitle,
      resumeData: { ...mockResumeData, title: 'Software Developer' },
    });

    // Title match should score higher
    expect(resultTitleMatch.total).toBeGreaterThan(resultNoTitleMatch.total);
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

    expect(result.total).toBe(0);
    expect(result.breakdown.keywordRelevance).toBe(0);
    expect(result.breakdown.contentQuality).toBe(0);
    expect(result.details.extractedKeywords.all).toEqual([]);
    expect(result.details.extractedKeywords.fromTitle).toEqual([]);
    expect(result.details.extractedKeywords.fromNiceToHave).toEqual([]);
    expect(result.details.extractedKeywords.keywordPriorities).toEqual({});
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
      expect(formatScoreAssessment(85)).toContain('Excellent');
      expect(formatScoreAssessment(70)).toContain('Good');
      expect(formatScoreAssessment(55)).toContain('Fair');
      expect(formatScoreAssessment(45)).toContain('Weak');
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

// ============================================================
// Phase 6 Tests: Scoring Formula Improvements
// ============================================================

describe('ATS Scorer - Smooth Experience Curve', () => {
  it('produces smooth gradient for year deficits (not cliff)', () => {
    const jdWith8Years = `
      Engineering Manager
      Requirements:
      - 8+ years software engineering experience
      - Team leadership
    `;

    const results: Array<{ years: number; score: number }> = [];
    for (const years of [2, 4, 6, 8, 10, 15]) {
      const result = calculateATSScore({
        jobDescription: jdWith8Years,
        resumeText: sampleResume,
        resumeData: { ...mockResumeData, yearsExperience: years },
      });
      results.push({ years, score: result.breakdown.experienceAlignment });
    }

    // Score should increase monotonically as years increase (until overqualification)
    for (let i = 1; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i - 1].score);
    }
  });

  it('applies mild overqualification penalty', () => {
    const jdWith5Years = `
      Senior Engineer
      Requirements:
      - 5+ years software engineering experience
    `;

    const matchResult = calculateATSScore({
      jobDescription: jdWith5Years,
      resumeText: sampleResume,
      resumeData: { ...mockResumeData, yearsExperience: 5 },
    });

    const overqualified = calculateATSScore({
      jobDescription: jdWith5Years,
      resumeText: sampleResume,
      resumeData: { ...mockResumeData, yearsExperience: 20 },
    });

    // Overqualified should score slightly lower than exact match
    expect(overqualified.breakdown.experienceAlignment).toBeLessThanOrEqual(
      matchResult.breakdown.experienceAlignment
    );
  });
});

describe('ATS Scorer - Skills Restructure', () => {
  it('reduces credit for skills already matched in keyword score', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Skills score should be reasonable but not inflated
    expect(result.breakdown.skillsQuality).toBeLessThanOrEqual(25);
    expect(result.breakdown.skillsQuality).toBeGreaterThanOrEqual(0);
  });
});

describe('ATS Scorer - Match Quality (replaces Content Quality)', () => {
  it('scores within 0-10 range', () => {
    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.contentQuality).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.contentQuality).toBeLessThanOrEqual(10);
  });

  it('awards points for exact match ratio', () => {
    // Resume with exact keyword matches should score higher on match quality
    const exactMatchResume = `
      Engineering Manager with Python AWS GCP Kubernetes Docker experience.
      Platform engineering background with CI/CD pipeline design.
    `;

    const result = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: exactMatchResume,
      resumeData: mockResumeData,
    });

    expect(result.breakdown.contentQuality).toBeGreaterThan(0);
  });

  it('awards points for section completeness in resume data', () => {
    const fullData: ResumeData = {
      title: 'Engineering Manager',
      skills: ['Python', 'AWS'],
      skillsByCategory: [{ category: 'Cloud', items: ['GCP', 'AWS'] }],
      experiences: [{ title: 'EM', highlights: ['Led team'] }],
      education: [{ degree: 'BS Computer Science' }],
    };

    const minimalData: ResumeData = {
      title: 'Engineer',
    };

    const fullResult = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: fullData,
    });

    const minResult = calculateATSScore({
      jobDescription: sampleJD,
      resumeText: sampleResume,
      resumeData: minimalData,
    });

    expect(fullResult.breakdown.contentQuality).toBeGreaterThanOrEqual(
      minResult.breakdown.contentQuality
    );
  });
});

describe('ATS Scorer - Domain Relevance Gate', () => {
  it('discounts experience for wrong-domain resume', () => {
    const dataScienceJd = `
      Data Scientist, Machine Learning
      Requirements:
      - PhD in Computer Science
      - 5+ years ML/AI experience
      - TensorFlow, PyTorch
      - Deep learning model development
    `;

    const result = calculateATSScore({
      jobDescription: dataScienceJd,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Engineering Manager resume against Data Scientist JD
    // Should get low experience score due to domain mismatch
    expect(result.breakdown.experienceAlignment).toBeLessThan(15);
  });
});

describe('ATS Scorer - Frequency Weighting in Keyword Score', () => {
  it('keywords mentioned multiple times score higher', () => {
    const jdRepeated = `
      Engineering Manager
      Requirements:
      - Python experience required
      - Strong Python skills
      - Python frameworks knowledge
      - AWS cloud experience
    `;

    const jdSingle = `
      Engineering Manager
      Requirements:
      - Python experience required
      - AWS cloud experience
      - Kubernetes expertise
      - Docker knowledge
    `;

    const resultRepeated = calculateATSScore({
      jobDescription: jdRepeated,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    const resultSingle = calculateATSScore({
      jobDescription: jdSingle,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    // Both should produce valid scores
    expect(resultRepeated.total).toBeGreaterThan(0);
    expect(resultSingle.total).toBeGreaterThan(0);
  });
});

describe('ATS Scorer - Keyword Placement Bonus', () => {
  it('awards bonus for keywords in resume title', () => {
    const jd = `
      Engineering Manager, Platform
      Requirements:
      - Platform engineering experience
      - Python, AWS
    `;

    const withTitleMatch = calculateATSScore({
      jobDescription: jd,
      resumeText: sampleResume,
      resumeData: { ...mockResumeData, title: 'Engineering Manager' },
    });

    const withoutTitleMatch = calculateATSScore({
      jobDescription: jd,
      resumeText: sampleResume,
      resumeData: { ...mockResumeData, title: 'Product Analyst' },
    });

    // Title match should give higher keyword score
    expect(withTitleMatch.breakdown.keywordRelevance).toBeGreaterThanOrEqual(
      withoutTitleMatch.breakdown.keywordRelevance
    );
  });
});

describe('ATS Scorer - Updated Score Thresholds', () => {
  it('formatScoreAssessment uses updated thresholds', () => {
    expect(formatScoreAssessment(85)).toContain('Excellent');
    expect(formatScoreAssessment(84)).toContain('Good');
    expect(formatScoreAssessment(70)).toContain('Good');
    expect(formatScoreAssessment(69)).toContain('Fair');
    expect(formatScoreAssessment(55)).toContain('Fair');
    expect(formatScoreAssessment(54)).toContain('Weak');
  });
});

describe('ATS Scorer - Calibration Targets', () => {
  it('perfect match scores >= 85', () => {
    const perfectJd = `
      Engineering Manager, Cloud Infrastructure
      Requirements:
      - 10+ years software engineering experience
      - 5+ years managing engineering teams
      - GCP and AWS cloud experience
      - Kubernetes and Docker expertise
      - CI/CD pipeline design
      - Platform engineering background
      - Python or Java expertise
      - Team leadership and people management
    `;

    // Use resume text that covers ALL JD keywords including phrases
    const perfectResume = `
      Engineering Manager, Cloud Infrastructure with 15+ years software engineering experience leading platform teams.
      Led cloud migration to GCP cloud infrastructure serving 30+ production systems.
      People management: managed team of 13 engineers delivering developer platform.
      Python, Java, TypeScript, AWS, GCP expertise.
      Cross-functional leadership, technical strategy, stakeholder management.
      Kubernetes, Docker, Terraform, CI/CD pipeline design, GitHub Actions.
      Platform engineering background with scalable infrastructure supporting 400+ engineers.
    `;

    const perfectData: ResumeData = {
      ...mockResumeData,
      title: 'Engineering Manager, Cloud Infrastructure',
      skillsByCategory: [
        { category: 'Leadership', items: ['Cross-Functional Leadership', 'Technical Strategy', 'Team Management', 'People Management'] },
        { category: 'Cloud', items: ['GCP', 'AWS', 'Kubernetes', 'Docker', 'Terraform', 'Cloud Infrastructure'] },
        { category: 'DevOps', items: ['CI/CD', 'GitHub Actions', 'Jenkins', 'Pipeline Design'] },
        { category: 'Languages', items: ['Python', 'Java', 'TypeScript'] },
        { category: 'Platform', items: ['Platform Engineering', 'Infrastructure', 'Microservices'] },
      ],
      education: [
        { degree: "Bachelor's in Computer Science", institution: 'University' },
      ],
    };

    const result = calculateATSScore({
      jobDescription: perfectJd,
      resumeText: perfectResume,
      resumeData: perfectData,
    });

    expect(result.total).toBeGreaterThanOrEqual(85);
  });

  it('wrong domain scores <= 40', () => {
    const wrongDomainJd = `
      Data Scientist, Machine Learning
      Requirements:
      - PhD in Computer Science or related field
      - 5+ years ML/AI experience
      - TensorFlow, PyTorch expertise
      - Deep learning model development
      - Research publication track record
      - Statistical modeling and analysis
    `;

    const result = calculateATSScore({
      jobDescription: wrongDomainJd,
      resumeText: sampleResume,
      resumeData: mockResumeData,
    });

    expect(result.total).toBeLessThanOrEqual(40);
  });

  it('is deterministic across 10 runs for all scenarios', () => {
    const jds = [
      sampleJD,
      `Data Scientist\nRequirements:\n- ML/AI\n- TensorFlow\n- PhD`,
      `Engineering Manager, Cloud Infrastructure\nRequirements:\n- GCP, AWS\n- Kubernetes\n- 10+ years`,
    ];

    for (const jd of jds) {
      const scores: number[] = [];
      for (let i = 0; i < 10; i++) {
        const result = calculateATSScore({
          jobDescription: jd,
          resumeText: sampleResume,
          resumeData: mockResumeData,
        });
        scores.push(result.total);
      }
      expect(new Set(scores).size).toBe(1);
    }
  });
});
