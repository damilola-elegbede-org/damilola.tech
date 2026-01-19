import type { Project } from '@/types';

export const projectsData: Project[] = [
  {
    id: 'alo-cubano',
    name: 'A Lo Cubano Boulder Fest',
    subtitle: 'Full-stack event management platform for Latin dance festivals',
    description:
      'Complete ticketing and event management system built from scratch to handle multi-tier pricing, payment processing, and attendee check-in.',
    techStack: ['JavaScript', 'Node.js', 'Vercel', 'Stripe', 'Brevo', 'Turso'],
    links: [
      {
        label: 'Live Site',
        url: 'https://alocubanoboulderfest.org',
        icon: 'external',
      },
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/alocubano.boulderfest',
        icon: 'github',
      },
    ],
    stats: {
      label: 'Technical Achievements',
      items: [
        '3,229 tests across 104 files with 92% coverage',
        '333 pull requests merged during development',
        '$3,850 revenue processed at first event (47 tickets)',
      ],
    },
    categories: [
      {
        title: 'Ticketing & Payments',
        items: [
          'Stripe Checkout integration with tiered pricing (Early Bird, Regular, Door)',
          'PayPal support for customers preferring alternative payment methods',
          'Unified cart system supporting multiple ticket types in single transaction',
          'Automatic promo code validation with percentage and fixed discounts',
        ],
      },
      {
        title: 'Attendee Management',
        items: [
          'Unique QR codes generated for each ticket purchase',
          'Real-time check-in dashboard with search and manual override',
          'Duplicate scan prevention with visual/audio feedback',
          'Export attendee lists for venue coordination',
        ],
      },
      {
        title: 'Email Automation',
        items: [
          'Brevo integration for transactional emails',
          'Branded confirmation emails with QR codes and event details',
          'Reminder emails 48 hours before event',
          'Post-event thank you with photo gallery links',
        ],
      },
      {
        title: 'Admin Dashboard',
        items: [
          'Real-time sales analytics and revenue tracking',
          'Ticket inventory management with capacity limits',
          'Promo code creation and usage analytics',
          'Attendee search with purchase history',
        ],
      },
      {
        title: 'Infrastructure',
        items: [
          'Vercel deployment with automatic preview environments',
          'Serverless API routes for payment webhooks',
          'Secure environment variable management',
          'Mobile-responsive admin interface',
        ],
      },
      {
        title: 'Mobile & Security',
        items: [
          'Apple Wallet and Google Wallet pass generation',
          'JWT-based QR codes with dual caching (24h HTTP + 7d client)',
          'Three-tier database backup strategy with Turso PITR',
        ],
      },
    ],
  },
  {
    id: 'damilola-tech',
    name: 'damilola.tech',
    subtitle: 'This site — AI-powered career landing page',
    description:
      'Personal portfolio with an AI chatbot that answers recruiter questions about experience, skills, and role fit using Claude with full context.',
    techStack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Claude API', 'Vercel'],
    links: [
      {
        label: 'Live Site',
        url: 'https://damilola.tech',
        icon: 'external',
      },
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/damilola.tech',
        icon: 'github',
      },
    ],
    stats: {
      label: 'Technical Metrics',
      items: [
        '490+ test assertions with 61% test-to-code ratio',
        '35+ ARIA attributes for WCAG accessibility compliance',
        '3,455 lines of TypeScript in strict mode',
      ],
    },
    highlights: [
      'Streaming AI responses with ReadableStream chunked delivery',
      'Full context window approach — 100K+ tokens of career data, no RAG',
      'Real-time Fit Assessment with PDF export and role title extraction',
      'Session persistence via localStorage with 50-message history',
      'Build-time prompt compilation with split-template architecture',
    ],
  },
  {
    id: 'pipedream-automation',
    name: 'Pipedream Automation Suite',
    subtitle: 'AI-powered productivity automation with bidirectional sync',
    description:
      '5 production workflows automating task management across Gmail, Notion, and Google Tasks with Claude AI scoring.',
    techStack: ['Pipedream', 'Node.js', 'Claude API', 'Notion API', 'Gmail API'],
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/pipedream-automation',
        icon: 'github',
      },
    ],
    stats: {
      label: 'Automation Metrics',
      items: [
        '5 deployed workflows with 2,349 lines of automation code',
        '19 pull requests refining workflow logic and error handling',
        'Parallel execution with 6-10 concurrent workers',
      ],
    },
    highlights: [
      'Gmail → Notion task creation with HTML extraction and deduplication',
      'Bidirectional sync between Notion tasks and Google Tasks',
      'AI-powered Horizon scoring (0-100) using Claude for task prioritization',
      'Exponential backoff with rate limit handling for API reliability',
      'Multi-threaded execution for scoring 100+ tasks in parallel',
    ],
  },
  {
    id: 'claude-config',
    name: 'Claude Configuration System',
    subtitle: 'Enterprise-grade AI assistant customization framework',
    description:
      'Comprehensive Claude Code configuration powering 550 PRs and 39 issues (77% resolved) across 16 repositories.',
    techStack: ['YAML', 'Markdown', 'Claude Code', 'Shell', 'Git'],
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/claude-config',
        icon: 'github',
      },
    ],
    stats: {
      label: 'Scale & Impact',
      items: [
        '550 pull requests generated across 16 active repositories',
        '39 issues tracked with 77% resolution rate (30 closed, 9 open)',
        '1,743 versioned backups tracking configuration evolution',
      ],
    },
    highlights: [
      '20 custom slash commands (/ship-it, /review, /commit, /debug, /pr, etc.)',
      '12 specialized agents with domain expertise routing',
      '17 integrated skills for career, coding, and automation tasks',
      'Three orchestration patterns: Parallel, Pipeline, Analyze-Then-Execute',
      'Binary delegation framework for optimal task classification',
      'Quality gates enforcement — never bypass hooks or skip tests',
    ],
  },
];
