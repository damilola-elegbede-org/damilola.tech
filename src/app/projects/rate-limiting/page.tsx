import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Production API Rate Limiting — Case Study | Damilola Elegbede",
  description:
    "How I built production-grade API rate limiting with Upstash Redis sliding-window algorithm, fail-open design, and per-IP enforcement at the Next.js edge middleware layer.",
  openGraph: {
    title: "Production API Rate Limiting — Case Study | Damilola Elegbede",
    description:
      "Sliding-window rate limiting via Upstash Redis at the Next.js edge — 100 req/min per IP, fail-open under Redis failure, 9-test suite covering boundary and proxy-chain cases.",
    type: "article",
    url: "https://damilola.tech/projects/rate-limiting",
    images: [
      {
        url: "https://damilola.tech/og-image.png",
        width: 1200,
        height: 630,
        alt: "Production API Rate Limiting Case Study",
      },
    ],
  },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-semibold text-[var(--color-text)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center">
      <div className="text-2xl font-bold text-[var(--color-accent)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[var(--color-text-muted)]">
      <span className="mt-1 flex-shrink-0 text-[var(--color-accent)]">›</span>
      <span>{children}</span>
    </li>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mb-6 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-text-muted)]">
      <code>{children}</code>
    </pre>
  );
}

export default function RateLimitingCaseStudy() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-[var(--color-text-muted)]">
        <Link href="/#projects" className="hover:text-[var(--color-accent)] transition-colors">
          ← Back to Projects
        </Link>
      </nav>

      {/* Header */}
      <header className="mb-12">
        <p className="mb-2 text-sm uppercase tracking-widest text-[var(--color-accent)]">
          Case Study
        </p>
        <h1 className="mb-4 text-4xl font-bold text-[var(--color-text)] md:text-5xl">
          Production API Rate Limiting
        </h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          Sliding-window rate limiting at the Next.js edge layer using Upstash Redis — per-IP
          enforcement with a deliberate fail-open design that keeps the site available when
          Redis is unreachable.
        </p>
      </header>

      {/* Impact Metrics */}
      <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric value="100" label="Max req/min per IP" />
        <Metric value="0ms" label="Overhead when Redis is down (fail-open)" />
        <Metric value="9" label="Unit tests including boundary + proxy cases" />
        <Metric value="Edge" label="Runtime — no cold-start latency" />
      </div>

      <Section title="The Problem">
        <p className="mb-4 text-[var(--color-text-muted)]">
          The{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            /api/v1/*
          </code>{" "}
          routes on damilola.tech include a Claude-powered job-scoring endpoint and a
          resume-tailoring endpoint — both hit the Anthropic API and incur non-trivial cost
          per call. Without a rate limit, a single client could exhaust the monthly token
          budget in minutes and take down the AI chat features for all users.
        </p>
        <p className="text-[var(--color-text-muted)]">
          The constraint: protection must work at the edge (before any serverless function
          cold-starts), be distributed across Vercel&apos;s global edge nodes, and degrade
          gracefully — blocking all traffic because a Redis instance is unavailable would be
          worse than the abuse it prevents.
        </p>
      </Section>

      <Section title="Architecture">
        <h3 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
          Sliding-Window via Time-Bucketed Keys
        </h3>
        <p className="mb-4 text-[var(--color-text-muted)]">
          The implementation uses a fixed-window approximation that behaves like a sliding
          window through key naming. Each window is 60 seconds wide; the key includes both
          the IP and the current window ID:
        </p>
        <CodeBlock>{`const windowId = Math.floor(Date.now() / 1000 / WINDOW_SEC);
const key = \`ratelimit:api:\${ip}:\${windowId}\`;`}</CodeBlock>
        <p className="mb-6 text-[var(--color-text-muted)]">
          Keys expire after 2× the window duration (120s TTL) — the extra window ensures
          Redis cleans up counters from the previous period without an explicit delete.
          A single Upstash pipeline call performs{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">INCR</code> +{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">EXPIRE</code>{" "}
          atomically, keeping the rate-check to a single round trip.
        </p>

        <h3 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
          Fail-Open Design
        </h3>
        <p className="mb-4 text-[var(--color-text-muted)]">
          There are three explicit fail-open paths — all return{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            NextResponse.next()
          </code>{" "}
          rather than blocking:
        </p>
        <ul className="mb-6 space-y-2">
          <Bullet>
            <strong>Missing env vars</strong> — if{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              UPSTASH_REDIS_REST_URL
            </code>{" "}
            or{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              UPSTASH_REDIS_REST_TOKEN
            </code>{" "}
            are absent (local dev, misconfigured env), requests pass through without
            any Redis call.
          </Bullet>
          <Bullet>
            <strong>Non-OK HTTP response</strong> — if Upstash returns a 5xx, the check
            is skipped rather than failing the request.
          </Bullet>
          <Bullet>
            <strong>Network error</strong> — the{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">fetch</code>{" "}
            call is wrapped in try/catch; a thrown network exception passes through
            instead of surfacing a 500.
          </Bullet>
        </ul>

        <h3 className="mb-3 text-lg font-semibold text-[var(--color-text)]">
          IP Extraction
        </h3>
        <p className="text-[var(--color-text-muted)]">
          Next.js 15 removed{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            NextRequest.ip
          </code>
          . The middleware reads the real client IP from{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            x-forwarded-for
          </code>{" "}
          (Vercel&apos;s canonical header), taking the first entry to handle multi-proxy
          chains (
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            &quot;203.0.113.1, 10.0.0.1, 172.16.0.1&quot; → &quot;203.0.113.1&quot;
          </code>
          ), with{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            x-real-ip
          </code>{" "}
          as a fallback and{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            &apos;unknown&apos;
          </code>{" "}
          as a shared bucket when both are absent.
        </p>
      </Section>

      <Section title="Implementation Highlights">
        <p className="mb-4 text-[var(--color-text-muted)]">
          The full middleware from{" "}
          <code className="rounded bg-[var(--color-card)] px-1 text-xs">
            middleware.ts
          </code>
          :
        </p>
        <CodeBlock>{`export const runtime = 'edge';
export const RATE_LIMIT = 100;   // max requests per window per IP
export const WINDOW_SEC = 60;    // fixed window size in seconds

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fail-open: Redis unavailable → no rate limiting
  if (!redisUrl || !redisToken) return NextResponse.next();

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const windowId = Math.floor(Date.now() / 1000 / WINDOW_SEC);
  const key = \`ratelimit:api:\${ip}:\${windowId}\`;

  let count: number;
  try {
    const res = await fetch(\`\${redisUrl}/pipeline\`, {
      method: 'POST',
      headers: { Authorization: \`Bearer \${redisToken}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, WINDOW_SEC * 2],   // 2-window TTL ensures cleanup
      ]),
    });
    if (!res.ok) return NextResponse.next();   // fail open on Redis error
    const [{ result: incr }] = await res.json();
    count = incr;
  } catch {
    return NextResponse.next();   // fail open on network error
  }

  if (count > RATE_LIMIT) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json',
                                'Retry-After': String(WINDOW_SEC) } },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/v1/:path*' };`}</CodeBlock>
      </Section>

      <Section title="Key Engineering Decisions">
        <ul className="space-y-4">
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                Availability over strictness
              </strong>
              <p className="mt-1">
                The fail-open choice is intentional: a portfolio site that becomes
                inaccessible because of a Redis outage is a worse outcome than a brief
                window of unthrottled traffic. Strictness would be the right call for a
                financial API; for a career portfolio, uptime is the priority.
              </p>
            </div>
          </Bullet>
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                Edge runtime, not serverless functions
              </strong>
              <p className="mt-1">
                Middleware runs before any serverless function cold-starts. Moving rate
                limiting to the edge means abuse is stopped before the expensive
                Anthropic API call is ever initiated — cheaper per blocked request and
                faster to respond (no function spin-up).
              </p>
            </div>
          </Bullet>
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                Pipeline for atomic INCR + EXPIRE
              </strong>
              <p className="mt-1">
                Using Upstash&apos;s{" "}
                <code className="rounded bg-[var(--color-card)] px-1 text-xs">
                  /pipeline
                </code>{" "}
                endpoint keeps the counter increment and TTL refresh in a single
                round trip. A two-step INCR → EXPIRE sequence over REST would risk a
                leaked key (INCR succeeds, EXPIRE fails, counter never expires) in the
                presence of partial failures.
              </p>
            </div>
          </Bullet>
          <Bullet>
            <div>
              <strong className="text-[var(--color-text)]">
                Fixed window is sufficient here
              </strong>
              <p className="mt-1">
                A pure sliding-window algorithm requires per-request log storage or a
                sorted set, adding latency and Upstash command cost. The fixed-window
                approximation is adequate for abuse prevention on a portfolio site —
                the 2× burst at a window boundary is acceptable and well-understood.
              </p>
            </div>
          </Bullet>
        </ul>
      </Section>

      <Section title="Test Coverage">
        <p className="mb-4 text-[var(--color-text-muted)]">
          9 vitest unit tests cover the full behavior surface:
        </p>
        <ul className="space-y-2">
          <Bullet>Requests under the limit pass through (200)</Bullet>
          <Bullet>
            Requests exceeding{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              RATE_LIMIT
            </code>{" "}
            return 429 with JSON body and{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              Retry-After
            </code>{" "}
            header
          </Bullet>
          <Bullet>
            Exactly{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              RATE_LIMIT
            </code>{" "}
            requests pass (boundary: count === limit → 200)
          </Bullet>
          <Bullet>
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              RATE_LIMIT + 1
            </code>{" "}
            triggers the 429 (boundary: count just over → blocked)
          </Bullet>
          <Bullet>Missing env vars → fail open (no Redis call)</Bullet>
          <Bullet>Redis non-OK response → fail open</Bullet>
          <Bullet>Network error (fetch throws) → fail open</Bullet>
          <Bullet>
            Multi-proxy{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              x-forwarded-for
            </code>{" "}
            extracts first (client) IP
          </Bullet>
          <Bullet>
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              x-real-ip
            </code>{" "}
            fallback used when{" "}
            <code className="rounded bg-[var(--color-card)] px-1 text-xs">
              x-forwarded-for
            </code>{" "}
            is absent
          </Bullet>
        </ul>
      </Section>

      <Section title="Tech Stack">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          {[
            "Next.js 15 Middleware",
            "TypeScript",
            "Upstash Redis (REST)",
            "Vercel Edge Runtime",
            "vitest (unit tests)",
          ].map((tech) => (
            <div
              key={tech}
              className="flex items-center gap-2 py-1 text-sm text-[var(--color-text-muted)]"
            >
              <span className="text-[var(--color-accent)]">›</span>
              {tech}
            </div>
          ))}
        </div>
      </Section>

      {/* Footer links */}
      <div className="flex flex-wrap gap-6 border-t border-[var(--color-border)] pt-8">
        <a
          href="https://github.com/damilola-elegbede-org/damilola.tech/blob/main/middleware.ts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          View Source →
        </a>
        <Link
          href="/#projects"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          ← All Projects
        </Link>
      </div>
    </main>
  );
}
