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
        '451K lines of code across 931 JavaScript files',
        '3,229 tests at 92% coverage with 71 DB migrations',
        '$3,850 revenue processed at first event',
      ],
    },
    highlights: [
      'Circuit breaker pattern with automatic database failover and health monitoring',
      'Multi-tier caching (Redis L2 + Memory L1) with intelligent promotion',
      'Live scoring system with real-time WebSocket updates for competitions',
      '3-tier disaster recovery: PITR (24h) + daily backups (30d) + monthly snapshots',
      'Apple Wallet and Google Wallet pass generation with JWT-based QR codes',
    ],
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
    name: 'Personal Website for Damilola Elegbede',
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
        '~3,600 source LOC with 78% test coverage',
        '22 unit tests + 3 E2E suites across 5 browsers',
        '18 React components with 4 streaming API routes',
      ],
    },
    highlights: [
      'Full-context LLM (no RAG) with Anthropic prompt caching for cost optimization',
      'Build-time prompt generation eliminates runtime blob fetches',
      'Split-template architecture: shared context + role-specific instructions',
      'Streaming responses with abort controller and ReadableStream management',
      'Security-first: sensitive data in Vercel Blob, public repo clean',
    ],
  },
  {
    id: 'pipedream-automation',
    name: 'Pipedream Automation Suite',
    subtitle: 'AI-powered productivity automation with bidirectional sync',
    description:
      '10 production workflows with custom CI/CD pipeline (1,634 LOC) solving Pipedream\u0027s missing deployment API. AI-powered task prioritization using Claude Opus 4.5.',
    techStack: ['Python', 'Playwright', 'Claude API', 'Notion API', 'Gmail API', 'Pipedream'],
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/pipedream-automation',
        icon: 'github',
      },
    ],
    stats: {
      label: 'Technical Metrics',
      items: [
        '10 workflows with 8,620 LOC across 40 Python files',
        '6 APIs integrated with 60%+ test coverage enforced',
        'Custom deployment engine: 2,678 LOC browser automation',
      ],
    },
    highlights: [
      'Built CI/CD when vendor has no API: Playwright automation with Google SSO',
      'AI task scoring using Claude Opus 4.5 with batch processing (40 tasks/batch)',
      'Production resilience: 4 different rate limit strategies across services',
      'Bidirectional sync: Gmail/Notion/Tasks/Calendar with idempotency guarantees',
      'ThreadPoolExecutor parallelization: 6 Claude workers, 10 Notion workers',
    ],
  },
  {
    id: 'claude-config',
    name: 'Claude Configuration System',
    subtitle: 'Enterprise-grade AI assistant customization framework',
    description:
      'Production AI orchestration framework: 12 agents (consolidated from 31) achieving 4-6x performance through multi-instance parallelization.',
    techStack: ['YAML', 'Markdown', 'Python', 'Shell', 'Claude Code', 'GitHub Actions'],
    links: [
      {
        label: 'GitHub',
        url: 'https://github.com/damilola-elegbede/claude-config',
        icon: 'github',
      },
    ],
    stats: {
      label: 'Framework Scale',
      items: [
        '107K+ lines with 80 automation scripts',
        '12 agents, 20 commands, 17 skills, 85+ docs',
        '4-6x performance via multi-instance parallelization',
      ],
    },
    highlights: [
      'Strategic consolidation: 31 agents merged to 12 while maintaining full functionality',
      'SYSTEM BOUNDARY security architecture prevents unauthorized agent escalation',
      'Thinking-level calibration: ultrathink tokens (31,999) for complex reasoning',
      'One-command deployment (/sync) with automatic backup and rollback',
      'Three-tier execution model: Direct, Skills, Agents for optimal efficiency',
      'Composable workflows: /ship-it supports flags (-d -t -c -r -p -pr)',
    ],
  },
];
