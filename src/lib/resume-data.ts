import type { ResumeData, SuggestedQuestion } from '@/types';

export const resumeData: ResumeData = {
  name: 'Damilola Elegbede',
  title: 'Engineering Manager',
  tagline: 'Building high-performance organizations that deliver enterprise-scale solutions',
  brandingStatement:
    'An engineering leader who is an engineer at heart with business acumen. Known for building effective teams through cross-collaboration with strategic partners. Guided by the 3P\'s (People, Process, Product) and principles of servant-leadership, growth, and inclusion.',
  email: 'damilola.elegbede@gmail.com',
  linkedin: 'https://linkedin.com/in/damilola-elegbede/',
  location: 'Boulder, CO',
  experiences: [
    {
      id: 'verily',
      company: 'Verily Life Sciences',
      title: 'Engineering Manager - Cloud Infrastructure & DevEx',
      location: 'Boulder, CO',
      startDate: 'Sep 2022',
      endDate: 'Nov 2024',
      highlights: [
        'Architected enterprise-wide GCP transformation spanning 30+ production systems',
        'Built and led 13-engineer organization with 93% retention rate',
        "Enabled L'Oréal LDP and T1D healthcare platform launches",
        'Established platform engineering practices reducing deployment friction by 40%',
      ],
    },
    {
      id: 'qualcomm',
      company: 'Qualcomm Technologies',
      title: 'Engineer, Senior Staff/Manager',
      location: 'Boulder, CO',
      startDate: 'Oct 2019',
      endDate: 'Jul 2022',
      highlights: [
        'Led 5G customer experience and release engineering for tier-1 carriers',
        'Transformed support operations achieving 75% faster issue resolution',
        'Managed cross-functional team of 8 engineers across multiple time zones',
        'Delivered critical software releases for Samsung, Google, and OnePlus devices',
      ],
    },
    {
      id: 'qualcomm-senior',
      company: 'Qualcomm Technologies',
      title: 'Senior Engineer',
      location: 'Boulder, CO',
      startDate: 'Dec 2014',
      endDate: 'Oct 2019',
      highlights: [
        'Developed modem software for 4G/LTE chipsets powering flagship smartphones',
        'Led technical initiatives improving code quality and test coverage',
        'Mentored junior engineers and established team best practices',
      ],
    },
    {
      id: 'qualcomm-engineer',
      company: 'Qualcomm Technologies',
      title: 'Engineer',
      location: 'Boulder, CO',
      startDate: 'Jun 2010',
      endDate: 'Dec 2014',
      highlights: [
        'Contributed to 3G/4G modem development for mobile devices',
        'Implemented embedded software features for cellular connectivity',
        'Collaborated with cross-functional teams on product delivery',
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
