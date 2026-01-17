import type { ResumeData, SuggestedQuestion } from '@/types';

export const resumeData: ResumeData = {
  name: 'Damilola Elegbede',
  title: 'Engineering Manager',
  tagline: 'Building high-performance organizations that deliver enterprise-scale solutions',
  brandingStatement:
    'An engineering leader who is an engineer at heart with business acumen. Known for building effective teams through cross-collaboration with strategic partners. Guided by the 3P\'s (People, Process, Product) and principles of servant-leadership, growth, and inclusion.',
  email: 'damilola.elegbede@gmail.com',
  linkedin: 'https://linkedin.com/in/damilola-elegbede/',
  github: 'https://github.com/damilola-elegbede',
  location: 'Boulder, CO',
  openToRoles: [
    'Engineering Manager',
    'Senior Engineering Manager',
  ],
  experienceTags: [
    'Ex-Verily',
    'Ex-Qualcomm',
    'MBA + MS CS',
  ],
  experiences: [
    {
      id: 'verily',
      company: 'Verily Life Sciences',
      title: 'Engineering Manager - Cloud Infrastructure & DevEx',
      location: 'Boulder, CO',
      startDate: 'Sep 2022',
      endDate: 'Nov 2024',
      highlights: [
        'Architected and executed enterprise-wide GCP cloud transformation supporting 30+ production systems, establishing infrastructure patterns that became organizational standards',
        'Built Cloud Infrastructure and developer experience functions from ground up, growing team to 13 engineers across 3 sub-teams with 93% retention through org restructuring',
        'Drove platform efficiency initiatives reducing GitHub Actions usage by 30% and deployment times by 40% through strategic automation and optimization',
        'Led executive stakeholder alignment across Engineering, Product, and Security, translating technical debt into business risk language for VP-level buy-in',
        "Delivered complex multi-phase production launches including T1D platform and L'Oréal LDP partnership, coordinating cross-functional teams under tight deadlines",
        'Established Cumulus Office Hours support model and SLA framework, improving developer satisfaction scores by 25% and reducing infrastructure tickets by 35%',
      ],
    },
    {
      id: 'qualcomm-staff-manager',
      company: 'Qualcomm Technologies',
      title: 'Engineer, Senior Staff/Manager',
      location: 'Boulder, CO',
      startDate: 'Oct 2019',
      endDate: 'Jul 2022',
      highlights: [
        'Led 5G customer experience engineering for tier-1 carriers (Verizon, AT&T, T-Mobile), managing 8-engineer team across Boulder and San Diego sites',
        'Transformed customer support operations achieving 75% faster issue resolution through systematic triage processes and knowledge base development',
        'Delivered critical 5G software releases for flagship devices including Samsung Galaxy S21, Google Pixel 5, and OnePlus 9 series',
        'Established cross-functional partnerships with Product, QA, and Field teams enabling faster time-to-market for carrier-specific features',
      ],
    },
    {
      id: 'qualcomm-staff',
      company: 'Qualcomm Technologies',
      title: 'Engineer, Staff/Manager',
      location: 'Boulder, CO',
      startDate: 'Oct 2014',
      endDate: 'Oct 2019',
      highlights: [
        'Developed modem software for 4G/LTE chipsets powering flagship smartphones, specializing in protocol stack optimization and carrier certification',
        'Led technical initiatives improving code quality metrics by 40% through test automation and continuous integration practices',
        'Mentored 5 junior engineers through technical growth plans, with 3 earning promotions within 2 years',
      ],
    },
    {
      id: 'qualcomm-senior',
      company: 'Qualcomm Technologies',
      title: 'Senior Engineer',
      location: 'Boulder, CO',
      startDate: 'Oct 2009',
      endDate: 'Oct 2014',
      highlights: [
        'Contributed to 3G/4G modem development for mobile devices, implementing embedded software features for cellular connectivity',
        'Collaborated with cross-functional teams on product delivery for major OEM customers including Apple, Samsung, and HTC',
      ],
    },
    {
      id: 'qualcomm-engineer',
      company: 'Qualcomm Technologies',
      title: 'Engineer',
      location: 'Boulder, CO',
      startDate: 'Aug 2002',
      endDate: 'Oct 2009',
      highlights: [
        'Developed embedded software for CDMA and early 3G modem platforms supporting commercial device launches',
        'Built automated test frameworks reducing manual testing overhead by 60% and improving release quality',
      ],
    },
  ],
  skills: [
    {
      category: 'Leadership',
      items: [
        'Cross-Functional Leadership',
        'Executive Stakeholder Management',
        'Multi-Site Teams (35+ engineers)',
        'Agile/Scrum/Kanban',
        'Organizational Transformation',
        'Talent Development',
      ],
    },
    {
      category: 'Cloud & Infrastructure',
      items: [
        'GCP',
        'AWS',
        'Kubernetes/GKE',
        'Docker',
        'Terraform',
        'Service Mesh',
        'Cloud Architecture',
      ],
    },
    {
      category: 'Developer Experience',
      items: [
        'CI/CD Pipelines',
        'GitHub Actions',
        'Jenkins',
        'Platform Engineering',
        'SRE Practices',
        'Developer Productivity',
      ],
    },
    {
      category: 'Technical',
      items: [
        'System Design',
        'API Architecture',
        'Python',
        'Go',
        'C/C++',
        'Distributed Systems',
      ],
    },
  ],
  skillsAssessment: {
    expert: [
      'Cloud Infrastructure & Platform Engineering',
      'Team Leadership & Organization Building',
      'Developer Experience & Productivity',
      'Cross-Functional Stakeholder Management',
      'Enterprise System Migration',
    ],
    proficient: [
      'CI/CD & Release Engineering',
      'Agile/Scrum/Kanban',
      'Distributed Systems & High Availability',
      'Observability & Monitoring',
      'SRE Practices',
    ],
    familiar: [
      'Programming (Python, C++, Go, Java)',
      'Healthcare & Regulatory Compliance',
      'Telecom Systems (5G/4G/3G)',
      'Data Analytics & Splunk',
    ],
  },
  education: [
    {
      id: 'mba',
      degree: 'MBA',
      institution: 'University of Colorado, Leeds School of Business',
    },
    {
      id: 'ms',
      degree: 'MS Computer Science',
      institution: 'University of Colorado Boulder',
    },
    {
      id: 'bs',
      degree: 'BS Electrical & Computer Engineering / Computer Science',
      institution: 'University of Wisconsin-Madison',
    },
  ],
};

export const suggestedQuestions: SuggestedQuestion[] = [
  {
    label: 'Leadership Philosophy',
    question: "What's your leadership philosophy?",
  },
  {
    label: 'Developer Growth',
    question: 'How do you develop engineers into senior roles?',
  },
  {
    label: 'Scaling Teams',
    question: 'Tell me about a time you scaled a team',
  },
  {
    label: 'Conflict Resolution',
    question: 'How do you handle team conflict?',
  },
  {
    label: 'Technical Debt',
    question: "What's your approach to technical debt vs features?",
  },
];
