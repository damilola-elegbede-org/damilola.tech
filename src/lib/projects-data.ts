import type { Project } from "@/types";

export const projectsData: Project[] = [
  {
    id: "cortex-agent-fleet",
    name: "Cortex Agent Fleet",
    subtitle: "Multi-agent AI system with autonomous task orchestration",
    description:
      "Production multi-agent platform running 2 specialized AI agents on a Mac Mini with centralized orchestration. Features inter-agent communication, automated SDLC with sub-agent delegation, config drift detection, incident monitoring, and a Signal-based command interface.",
    techStack: [
      "TypeScript",
      "Next.js",
      "Node.js",
      "OpenClaw",
      "Claude API",
      "OpenAI Codex",
      "launchd",
      "Tailscale",
    ],
    links: [
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede-org/cortex",
        icon: "github",
      },
      {
        label: "Activity",
        url: "/projects/cortex/activity",
        icon: "external",
      },
    ],
    stats: {
      label: "System Scale",
      items: [
        "2 specialized agents with 8 sub-agent slots (4 Codex + 2 Sonnet builders, 2 verifiers)",
        "6 autonomous cron jobs: drift detection, incident monitoring, alerts, overnight queue",
        "Nexus forum with cross-agent coordination across 4 rooms",
      ],
    },
    highlights: [
      "Dual-agent architecture: Engineer (Dara) + Chief of Staff (Clara) with domain isolation",
      "Sub-agent delegation: builders implement, verifiers audit (read-only) \u2014 never concurrent",
      "Inter-agent Nexus forum: threaded communication with role-based auth (HMAC-SHA256)",
      "Automated SDLC: branch \u2192 build \u2192 verify \u2192 commit \u2192 PR \u2192 CodeRabbit review",
      "Config drift detection: daily manifest-driven sync with secret scanning gate",
      "Signal-based command interface: natural language to agent orchestration",
      "launchd service management with watchdog auto-recovery and health checks",
      "Tailscale-secured dashboard with real-time agent status and session observability",
    ],
    categories: [
      {
        title: "Agent Architecture",
        items: [
          "Engineer agent (Opus 4): architecture, planning, sub-agent orchestration",
          "Chief of Staff agent (Sonnet 4): career ops, email, calendar, job search automation",
          "Builder sub-agents (Codex + Sonnet): restricted tool access, focused task execution",
          "Verifier sub-agents: read-only audit with test execution and security review",
        ],
      },
      {
        title: "Orchestration & Communication",
        items: [
          "Nexus forum: threaded async communication with @mention routing",
          "Signal integration: bidirectional messaging with E.164 routing",
          "Session management: isolated cron sessions, persistent agent sessions",
          "Sub-agent lifecycle: spawn, steer, monitor, kill with tool restrictions",
        ],
      },
      {
        title: "Automation & Operations",
        items: [
          "Config drift detection: manifest-driven comparison with secret scanning",
          "Incident monitoring: automated alert triage with escalation paths",
          "Ghost directory cleanup: hourly scan with forensic logging",
          "Overnight work queue: scheduled check-in for async task assignment",
        ],
      },
      {
        title: "Security & Infrastructure",
        items: [
          "HMAC-SHA256 token derivation for inter-service auth",
          "Secret scanning gate: blocks drift sync if credentials detected in files",
          "Tool restriction policies: deny-lists per agent role (builders, verifiers)",
          "launchd services with watchdog restart and health endpoints",
        ],
      },
    ],
  },
  {
    id: "alo-cubano",
    name: "A Lo Cubano Boulder Fest",
    subtitle: "Full-stack event management platform for Latin dance festivals",
    description:
      "Complete ticketing and event management system built from scratch to handle multi-tier pricing, payment processing, and attendee check-in.",
    techStack: ["JavaScript", "Node.js", "Vercel", "Stripe", "Brevo", "Turso"],
    links: [
      {
        label: "Live Site",
        url: "https://alocubanoboulderfest.org",
        icon: "external",
      },
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/alocubano.boulderfest",
        icon: "github",
      },
    ],
    stats: {
      label: "Technical Achievements",
      items: [
        "451K lines of code across 931 JavaScript files",
        "3,229 tests at 92% coverage with 71 DB migrations",
        "Significant revenue processed at inaugural event",
      ],
    },
    highlights: [
      "Circuit breaker pattern with automatic database failover and health monitoring",
      "Multi-tier caching (Redis L2 + Memory L1) with intelligent promotion",
      "Live scoring system with real-time WebSocket updates for competitions",
      "3-tier disaster recovery: PITR (24h) + daily backups (30d) + monthly snapshots",
      "Apple Wallet and Google Wallet pass generation with JWT-based QR codes",
    ],
    categories: [
      {
        title: "Ticketing & Payments",
        items: [
          "Stripe Checkout integration with tiered pricing (Early Bird, Regular, Door)",
          "PayPal support for customers preferring alternative payment methods",
          "Unified cart system supporting multiple ticket types in single transaction",
          "Automatic promo code validation with percentage and fixed discounts",
        ],
      },
      {
        title: "Attendee Management",
        items: [
          "Unique QR codes generated for each ticket purchase",
          "Real-time check-in dashboard with search and manual override",
          "Duplicate scan prevention with visual/audio feedback",
          "Export attendee lists for venue coordination",
        ],
      },
      {
        title: "Email Automation",
        items: [
          "Brevo integration for transactional emails",
          "Branded confirmation emails with QR codes and event details",
          "Reminder emails 48 hours before event",
          "Post-event thank you with photo gallery links",
        ],
      },
      {
        title: "Admin Dashboard",
        items: [
          "Real-time sales analytics and revenue tracking",
          "Ticket inventory management with capacity limits",
          "Promo code creation and usage analytics",
          "Attendee search with purchase history",
        ],
      },
      {
        title: "Infrastructure",
        items: [
          "Vercel deployment with automatic preview environments",
          "Serverless API routes for payment webhooks",
          "Secure environment variable management",
          "Mobile-responsive admin interface",
        ],
      },
      {
        title: "Mobile & Security",
        items: [
          "Apple Wallet and Google Wallet pass generation",
          "JWT-based QR codes with dual caching (24h HTTP + 7d client)",
          "Three-tier database backup strategy with Turso PITR",
        ],
      },
    ],
  },
  {
    id: "damilola-tech",
    name: "Personal Website for Damilola Elegbede",
    subtitle: "This site — AI-powered career landing page",
    description:
      "Personal portfolio with an AI chatbot that answers recruiter questions about experience, skills, and role fit using Claude with full context.",
    techStack: [
      "Next.js",
      "TypeScript",
      "Tailwind CSS",
      "Claude API",
      "Vercel",
    ],
    links: [
      {
        label: "Live Site",
        url: "https://damilola.tech",
        icon: "external",
      },
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/damilola.tech",
        icon: "github",
      },
    ],
    stats: {
      label: "Technical Metrics",
      items: [
        "13K source LOC with 48% test-to-code ratio",
        "34 unit tests + 6 E2E suites across 5 browsers",
        "36 React components with 21 API routes (12 public + 9 admin)",
      ],
    },
    highlights: [
      "Full-context LLM (no RAG) with Anthropic prompt caching for cost optimization",
      "Production admin portal: JWT auth, 10 pages, real-time analytics dashboard",
      "Distributed rate limiting: Redis + circuit breaker with graceful degradation",
      "Comprehensive audit system: 18 event types with IP anonymization",
      "ATS resume generator: Claude-powered optimization with PDF export",
      "Security hardening: CSRF, SSRF prevention, timing-safe comparisons",
      "UTM traffic tracking: Full attribution with source/medium/campaign analytics",
      "Private content submodule: Git submodule with Vercel Blob sync workflows",
      "Deterministic ATS scoring: Reproducible algorithm with weighted criteria",
    ],
  },
  {
    id: "pipedream-automation",
    name: "Pipedream Automation Suite",
    subtitle: "AI-powered productivity automation with bidirectional sync",
    description:
      "10 production workflows with custom CI/CD pipeline (1,634 LOC) solving Pipedream\u0027s missing deployment API. AI-powered task prioritization using Claude Opus 4.5.",
    techStack: [
      "Python",
      "Playwright",
      "Claude API",
      "Notion API",
      "Gmail API",
      "Pipedream",
    ],
    links: [
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/pipedream-automation",
        icon: "github",
      },
    ],
    stats: {
      label: "Technical Metrics",
      items: [
        "10 workflows with 8,620 LOC across 40 Python files",
        "6 APIs integrated with 60%+ test coverage enforced",
        "Custom deployment engine: 2,678 LOC browser automation",
      ],
    },
    highlights: [
      "Built CI/CD when vendor has no API: Playwright automation with Google SSO",
      "AI task scoring using Claude Opus 4.5 with batch processing (40 tasks/batch)",
      "Production resilience: 4 different rate limit strategies across services",
      "Bidirectional sync: Gmail/Notion/Tasks/Calendar with idempotency guarantees",
      "ThreadPoolExecutor parallelization: 6 Claude workers, 10 Notion workers",
    ],
  },
  {
    id: "claude-config",
    name: "Claude Configuration System",
    subtitle: "Enterprise-grade AI assistant customization framework",
    description:
      "Production AI orchestration framework: 12 agents (consolidated from 31) achieving 4-6x performance through multi-instance parallelization.",
    techStack: [
      "YAML",
      "Markdown",
      "Python",
      "Shell",
      "Claude Code",
      "GitHub Actions",
    ],
    links: [
      {
        label: "GitHub",
        url: "https://github.com/damilola-elegbede/claude-config",
        icon: "github",
      },
    ],
    stats: {
      label: "Framework Scale",
      items: [
        "107K+ lines with 80 automation scripts",
        "12 agents, 20 commands, 17 skills, 85+ docs",
        "Substantial performance improvement via multi-instance parallelization",
      ],
    },
    highlights: [
      "Strategic consolidation: 31 agents merged to 12 while maintaining full functionality",
      "SYSTEM BOUNDARY security architecture prevents unauthorized agent escalation",
      "Thinking-level calibration: ultrathink tokens (31,999) for complex reasoning",
      "One-command deployment (/sync) with automatic backup and rollback",
      "Three-tier execution model: Direct, Skills, Agents for optimal efficiency",
      "Composable workflows: /ship-it supports flags (-d -t -c -r -p -pr)",
    ],
  },
];
