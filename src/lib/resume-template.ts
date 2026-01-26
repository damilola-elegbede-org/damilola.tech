/**
 * ATS-friendly resume HTML template builder.
 *
 * Generates a professional single-column resume that matches the original
 * Damilola Elegbede resume format while incorporating ATS optimizations.
 */

import type { ResumeAnalysisResult, ProposedChange } from '@/lib/types/resume-generation';

// Resume data structure (matches resume-full.json)
interface ResumeData {
  name: string;
  title: string;
  phone: string;
  email: string;
  linkedin: string;
  location: string;
  summary: string;
  experience: {
    company: string;
    title: string;
    location: string;
    dates: string;
    description: string;
    responsibilities: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: number;
    focus: string;
  }[];
  skills: {
    leadership: string[];
    cloud: string[];
    systemArchitecture: string[];
    devex: string[];
    programming: string[];
    domain: string[];
  };
}

// Static resume data - would be fetched from blob in production
const RESUME_DATA: ResumeData = {
  name: 'Damilola Elegbede',
  title: 'Engineering Manager',
  phone: '303 641 2581',
  email: 'damilola.elegbede@gmail.com',
  linkedin: 'https://linkedin.com/in/damilola-elegbede/',
  location: 'Boulder, CO 80301',
  summary:
    'Strategic engineering leader with 15+ years scaling mission-critical infrastructure at Verily Life Sciences and Qualcomm. Designed a cloud transformation supporting 30+ production systems, enabling flagship product launches (L\'Oreal LDP, T1D). Expert at building high-performance teams, driving GCP/AWS migrations, and establishing platform engineering practices that improve developer velocity and system reliability. Domain expertise in cloud (GCP/AWS) and telecom infrastructure (5G/4G/3G).',
  experience: [
    {
      company: 'Verily Life Sciences, LLC',
      title: 'Engineering Manager - Cloud Infrastructure & Developer Experience',
      location: 'Boulder, CO',
      dates: 'Sep 2022 - Nov 2024',
      description:
        'Built and led Cloud Infrastructure and Developer Experience organization (13 engineers, 4 TVCs), delivering enterprise cloud infrastructure and developer platforms. Enabled critical healthcare product launches while maintaining system uptime with only one incident across 30+ production services.',
      responsibilities: [
        'Architected and executed enterprise-wide GCP cloud transformation supporting 30+ production systems, enabling successful launches of L\'Oréal LDP and T1D healthcare platforms while establishing multi-cloud (AWS/GCP) capabilities.',
        'Built Cloud Infrastructure and developer experience functions from ground up, hiring and scaling to 13 engineers across 4 req cycles; promoted 3 ICs to senior roles, achieved 93% retention with multiple internal transfers to my org.',
        'Drove platform efficiency initiatives reducing GitHub Actions usage by 30% and establishing self-service infrastructure capabilities, improving developer velocity across 400+ engineers.',
        'Led executive stakeholder alignment across Engineering, Product, and Security organizations, influencing enterprise-wide policies on containerization, observability, and cloud architecture adopted by 15+ teams.',
        'Delivered complex multi-phase production launches including T1D platform (20+ systems, 5 deployment phases), managing cross-functional dependencies and security compliance requirements.',
        'Established Cumulus Office Hours support model and SLA framework, transforming infrastructure support from reactive to proactive while maintaining sub-4-hour resolution times for critical issues.',
      ],
    },
    {
      company: 'Qualcomm Technologies, Inc',
      title: 'Engineer, Senior Staff/Manager',
      location: 'Boulder, CO',
      dates: 'Oct 2019 - Jul 2022',
      description:
        "Led Test Base Station customer experience and release engineering teams across multiple sites, driving operational excellence for Qualcomm's 5G infrastructure serving 400+ global customers.",
      responsibilities: [
        'Transformed customer support operations from reactive to proactive model, reducing critical issue resolution time by 75% while scaling to support 400+ customer deployments globally',
        'Created self-service 5G training platform replacing quarterly live sessions, enabling 24/7 customer enablement across global time zones and reducing training operational costs by 60%',
        'Led data-driven performance optimization using Splunk analytics, identifying and resolving signal-to-noise ratio issues across 40+ customer sites, directly improving chipset performance metrics',
        'Established Release Engineering function compressing multi-day software deployment cycles to same-day delivery, accelerating time-to-market for critical 5G features',
      ],
    },
    {
      company: 'Qualcomm Technologies, Inc',
      title: 'Engineer, Staff/Manager',
      location: 'Boulder, CO',
      dates: 'Oct 2014 - Oct 2019',
      description:
        "Led 35-engineer 4G/LTE organization through matrix management across 3 global sites (Hyderabad, San Diego, Boulder), with 5-6 direct reports. Delivered mission-critical telecom infrastructure supporting 400+ customer base stations.",
      responsibilities: [
        "Delivered 6 major 4G feature releases annually while maintaining 99.9% platform stability, directly supporting Qualcomm's telecom infrastructure revenue stream",
        'Implemented CI/CD transformation reducing build times by 87% (4 hours to 30 minutes), improving productivity for 100+ engineers and accelerating feature delivery',
        'Led Agile transformation achieving 40% productivity improvement, implementing Scrum for development teams and Kanban for customer support operations',
      ],
    },
    {
      company: 'Qualcomm Technologies, Inc',
      title: 'Engineer, Senior',
      location: 'Boulder, CO',
      dates: 'Oct 2009 - Oct 2014',
      description:
        "Technical lead for 3G/UMTS software team (12 engineers), driving critical infrastructure development for Qualcomm's wireless base station products.",
      responsibilities: [
        'Drove 40% productivity improvement through Scrum implementation, enabling faster feature delivery for 3G roadmap on ~300 Base Stations',
        'Streamlined customer support operations using Kanban methodology, improving response times for ~100 monthly customer tickets by 50%',
      ],
    },
  ],
  education: [
    {
      degree: 'MBA',
      institution: 'University of Colorado, Leeds School of Business',
      year: 2021,
      focus: 'General Management & Entrepreneurship',
    },
    {
      degree: 'MS, Computer Science',
      institution: 'University of Colorado Boulder',
      year: 2009,
      focus: 'Distributed Systems & Software Engineering',
    },
    {
      degree: 'BS, Electrical & Computer Engineering',
      institution: 'University of Wisconsin-Madison',
      year: 2002,
      focus: 'Dual Major: Computer Science',
    },
  ],
  skills: {
    leadership: [
      'Cross-Functional Leadership',
      'Technical Strategy',
      'Executive Stakeholder Management',
      'Multi-Site Team Leadership',
      'Agile/Scrum/Kanban',
      'Organizational Transformation',
    ],
    cloud: ['Google Cloud Platform (GCP)', 'AWS', 'Multi-Cloud Architecture', 'Kubernetes/GKE', 'Docker', 'Terraform'],
    systemArchitecture: ['Distributed Systems', 'Microservices', 'System Software', 'Performance Optimization', 'High Availability', 'Observability'],
    devex: ['CI/CD Pipeline Design', 'GitHub Actions', 'Jenkins', 'Release Engineering', 'DevOps Practices', 'SRE Principles'],
    programming: ['Python', 'C++', 'Go', 'Java', 'Bash', 'SQL'],
    domain: ['Healthcare Technology', 'Telecom Systems (5G/4G/3G)', 'Enterprise Cloud Migration', 'Regulatory Compliance'],
  },
};

/**
 * Apply accepted changes to resume content
 */
function applyChanges(
  resume: ResumeData,
  changes: ProposedChange[],
  acceptedIndices: Set<number>
): ResumeData {
  const result = JSON.parse(JSON.stringify(resume)) as ResumeData;

  // Apply accepted changes
  changes.forEach((change, index) => {
    if (!acceptedIndices.has(index)) return;

    if (change.section === 'summary') {
      result.summary = change.modified;
    } else if (change.section.startsWith('experience.')) {
      // Parse section like "experience.verily.bullet1"
      const parts = change.section.split('.');
      if (parts.length >= 3) {
        const companyKey = parts[1].toLowerCase();
        const bulletMatch = parts[2].match(/bullet(\d+)/);

        const expIndex = result.experience.findIndex(
          (exp) => exp.company.toLowerCase().includes(companyKey)
        );

        if (expIndex >= 0 && bulletMatch) {
          const bulletIndex = parseInt(bulletMatch[1], 10) - 1;
          if (bulletIndex >= 0 && bulletIndex < result.experience[expIndex].responsibilities.length) {
            result.experience[expIndex].responsibilities[bulletIndex] = change.modified;
          }
        }
      }
    }
  });

  return result;
}

/**
 * Build professional ATS-friendly resume HTML
 */
export function buildResumeHtml(
  result: ResumeAnalysisResult,
  acceptedIndices: Set<number>
): string {
  const acceptedChanges = result.proposedChanges.filter((_, i) => acceptedIndices.has(i));
  const resume = applyChanges(RESUME_DATA, result.proposedChanges, acceptedIndices);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.35;
      color: #1a1a1a;
      max-width: 8.5in;
      padding: 0.5in 0.6in;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 12pt;
      border-bottom: 2pt solid #1a365d;
      padding-bottom: 8pt;
    }
    .name {
      font-size: 18pt;
      font-weight: bold;
      color: #1a365d;
      letter-spacing: 1pt;
      text-transform: uppercase;
    }
    .title {
      font-size: 11pt;
      color: #4a5568;
      margin-top: 2pt;
    }
    .contact {
      font-size: 9pt;
      color: #4a5568;
      margin-top: 6pt;
    }
    .contact a {
      color: #2563eb;
      text-decoration: none;
    }

    /* Section Headers */
    .section-header {
      font-size: 11pt;
      font-weight: bold;
      color: #1a365d;
      text-transform: uppercase;
      border-bottom: 1pt solid #1a365d;
      padding-bottom: 2pt;
      margin: 14pt 0 8pt 0;
      letter-spacing: 0.5pt;
    }

    /* Summary */
    .summary {
      text-align: justify;
      margin-bottom: 4pt;
    }

    /* Experience */
    .job {
      margin-bottom: 12pt;
    }
    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2pt;
    }
    .job-title {
      font-weight: bold;
      color: #1a1a1a;
    }
    .job-dates {
      font-size: 9.5pt;
      color: #4a5568;
    }
    .job-company {
      font-style: italic;
      color: #4a5568;
      font-size: 10pt;
      margin-bottom: 4pt;
    }
    .job-bullets {
      padding-left: 16pt;
    }
    .job-bullets li {
      margin-bottom: 3pt;
      text-align: justify;
    }

    /* Education */
    .education-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4pt;
    }
    .degree {
      font-weight: bold;
    }
    .institution {
      color: #4a5568;
    }
    .year {
      color: #4a5568;
      font-size: 9.5pt;
    }

    /* Skills */
    .skills-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6pt;
    }
    .skill-category {
      margin-bottom: 4pt;
    }
    .skill-label {
      font-weight: bold;
      color: #1a365d;
    }
    .skills-list {
      display: inline;
    }

    /* Optimizations note - hidden in print */
    .optimizations-note {
      font-size: 8pt;
      color: #718096;
      margin-top: 16pt;
      padding-top: 8pt;
      border-top: 1pt dashed #cbd5e0;
    }

    @media print {
      body { padding: 0; }
      .optimizations-note { display: none; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="name">${resume.name}</div>
    <div class="title">${resume.title}</div>
    <div class="contact">
      ${resume.location} | ${resume.phone} | ${resume.email} |
      <a href="${resume.linkedin}">LinkedIn</a>
    </div>
  </div>

  <!-- Summary -->
  <div class="section-header">Professional Summary</div>
  <p class="summary">${resume.summary}</p>

  <!-- Experience -->
  <div class="section-header">Professional Experience</div>
  ${resume.experience
    .map(
      (job) => `
    <div class="job">
      <div class="job-header">
        <span class="job-title">${job.title}</span>
        <span class="job-dates">${job.dates}</span>
      </div>
      <div class="job-company">${job.company}, ${job.location}</div>
      <ul class="job-bullets">
        ${job.responsibilities.map((r) => `<li>${r}</li>`).join('\n        ')}
      </ul>
    </div>
  `
    )
    .join('')}

  <!-- Education -->
  <div class="section-header">Education</div>
  ${resume.education
    .map(
      (edu) => `
    <div class="education-item">
      <div>
        <span class="degree">${edu.degree}</span> -
        <span class="institution">${edu.institution}</span>
        ${edu.focus ? `<span class="focus"> (${edu.focus})</span>` : ''}
      </div>
      <span class="year">${edu.year}</span>
    </div>
  `
    )
    .join('')}

  <!-- Skills -->
  <div class="section-header">Core Competencies</div>
  <div class="skill-category">
    <span class="skill-label">Leadership:</span>
    <span class="skills-list">${resume.skills.leadership.join(' | ')}</span>
  </div>
  <div class="skill-category">
    <span class="skill-label">Cloud & Infrastructure:</span>
    <span class="skills-list">${resume.skills.cloud.join(' | ')}</span>
  </div>
  <div class="skill-category">
    <span class="skill-label">Technical:</span>
    <span class="skills-list">${[...resume.skills.systemArchitecture.slice(0, 4), ...resume.skills.devex.slice(0, 3)].join(' | ')}</span>
  </div>
  <div class="skill-category">
    <span class="skill-label">Programming:</span>
    <span class="skills-list">${resume.skills.programming.join(' | ')}</span>
  </div>

  <!-- Optimization note -->
  <div class="optimizations-note">
    <strong>ATS Optimized for:</strong> ${result.analysis.roleTitle} at ${result.analysis.companyName}<br>
    <strong>Compatibility Score:</strong> ${result.optimizedScore.total}/100 |
    <strong>Changes Applied:</strong> ${acceptedChanges.length} |
    <strong>Generated:</strong> ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;
}
