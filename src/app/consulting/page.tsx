import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fractional VPE & Engineering Leadership | Damilola Elegbede",
  description:
    "Fractional VP Engineering advisory for Seed–Series B startups. 2–5 hrs/week of hands-on engineering leadership: architecture reviews, team building, and DevEx strategy from a 15-year practitioner.",
  openGraph: {
    title: "Fractional VPE & Engineering Leadership | Damilola Elegbede",
    description:
      "Fractional VP Engineering advisory for Seed–Series B startups. Architecture reviews, team building, and DevEx strategy.",
    type: "website",
    url: "https://damilola.tech/consulting",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fractional VPE & Engineering Leadership | Damilola Elegbede",
    description:
      "Fractional VP Engineering advisory for Seed–Series B startups. Architecture reviews, team building, and DevEx strategy.",
  },
};

const tiers = [
  {
    label: "Advisory",
    badge: "async",
    headline: "On-Demand Strategic Guidance",
    scope:
      "Architecture questions, roadmap pressure-testing, and decision support — delivered asynchronously.",
    cadence: "Async Slack/email · 24 h response SLA",
    outcome:
      "Expert input on your highest-stakes engineering decisions without scheduling overhead.",
    cta: "Start a conversation",
  },
  {
    label: "Fractional VPE",
    badge: "part-time embedded",
    headline: "Embedded Engineering Leadership",
    scope:
      "2–5 hrs/week as your part-time VP Engineering: team structure, hiring bar, roadmap ownership, and exec communication.",
    cadence: "Weekly sync call + async availability",
    outcome:
      "A dedicated engineering leader who ships accountability and clarity without the full-time budget.",
    cta: "Explore fractional",
    featured: true,
  },
  {
    label: "Full Engagement",
    badge: "intensive",
    headline: "Interim VPE Coverage",
    scope:
      "10–20 hrs/week near-full-time: daily availability, incident response, board prep, and engineering org stand-up.",
    cadence: "Daily availability · twice-weekly syncs",
    outcome:
      "Full VPE coverage — the right bridge to your first permanent engineering leadership hire.",
    cta: "Discuss your needs",
  },
];

const socialProof = [
  { name: "Verily Life Sciences", sub: "Alphabet / Google" },
  { name: "Qualcomm", sub: "Semiconductors · Wireless" },
  { name: "Visa", sub: "FinTech · Payments" },
];

function TierCard({
  label,
  badge,
  headline,
  scope,
  cadence,
  outcome,
  cta,
  featured,
}: (typeof tiers)[number]) {
  return (
    <div
      className={[
        "relative rounded-xl border p-6 transition-colors",
        featured
          ? "border-[var(--color-accent)]/50 bg-[var(--color-card)] ring-1 ring-[var(--color-accent)]/20"
          : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-accent)]/40",
      ].join(" ")}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-[var(--color-accent)] px-3 py-0.5 text-xs font-semibold text-white">
          Most popular
        </span>
      )}
      <div className="mb-1 flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
          {label}
        </p>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
          {badge}
        </span>
      </div>
      <h3 className="mb-4 text-xl font-semibold text-[var(--color-text)]">
        {headline}
      </h3>
      <dl className="mb-5 space-y-3 text-sm">
        <div>
          <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Scope
          </dt>
          <dd className="leading-relaxed text-[var(--color-text-muted)]">
            {scope}
          </dd>
        </div>
        <div>
          <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Cadence
          </dt>
          <dd className="text-[var(--color-text-muted)]">{cadence}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Outcome
          </dt>
          <dd className="leading-relaxed text-[var(--color-text)]">{outcome}</dd>
        </div>
      </dl>
      <a
        href="#contact"
        className={[
          "inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]",
          featured
            ? "bg-[var(--color-accent)] text-white"
            : "border border-[var(--color-accent)] text-[var(--color-accent)]",
        ].join(" ")}
      >
        {cta} →
      </a>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[var(--color-text-muted)]">
      <span
        className="mt-0.5 flex-shrink-0 text-[var(--color-accent)]"
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );
}

export default function ConsultingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      {/* Back nav */}
      <nav className="mb-10 text-sm text-[var(--color-text-muted)]">
        <Link
          href="/"
          className="transition-colors hover:text-[var(--color-accent)]"
        >
          ← Damilola Elegbede
        </Link>
      </nav>

      {/* Hero */}
      <header className="mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
          Fractional Advisory
        </p>
        <h1 className="mb-5 text-4xl font-bold leading-tight text-[var(--color-text)] md:text-5xl">
          Engineering leadership,{" "}
          <span className="text-[var(--color-text-title)]">fractionally.</span>
        </h1>
        <p className="mb-6 max-w-xl text-lg leading-relaxed text-[var(--color-text-muted)]">
          15 years building and leading engineering orgs at Verily Life Sciences
          and Qualcomm. VP Engineering expertise for Seed–Series B startups —
          without the full-time overhead.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Work with me
          </a>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
            <span
              className="inline-block h-2 w-2 rounded-full bg-[var(--color-available)]"
              aria-hidden="true"
            />
            <span className="sr-only">Currently available — </span>
            Taking on 1–2 clients · 2–5 hrs/week
          </span>
        </div>
      </header>

      {/* Social proof */}
      <section className="mb-14" aria-label="Background and experience">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Background from
        </p>
        <div className="flex flex-wrap gap-3">
          {socialProof.map(({ name, sub }) => (
            <div
              key={name}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-4 py-3"
            >
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {name}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Is this you? */}
      <section className="mb-14">
        <h2 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">
          Is this you?
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6">
          <ul className="space-y-3">
            <CheckItem>
              Seed–Series B startup scaling past 5 engineers for the first time
            </CheckItem>
            <CheckItem>
              Founder or CTO carrying the engineering org too long — ready to
              delegate architecture decisions to someone who&apos;s been there
            </CheckItem>
            <CheckItem>
              Building a DevEx or platform function and need a practitioner who
              has run it at scale (GCP, Kubernetes, CI/CD, developer tooling)
            </CheckItem>
            <CheckItem>
              Engineering team growing fast and the hiring bar, leveling
              framework, or on-call posture isn&apos;t keeping up
            </CheckItem>
          </ul>
        </div>
      </section>

      {/* Engagement model */}
      <section className="mb-14">
        <h2 className="mb-3 text-2xl font-semibold text-[var(--color-text)]">
          How it works
        </h2>
        <p className="mb-6 text-[var(--color-text-muted)]">
          Most fractional engagements run 3–6 months with a recurring weekly or
          bi-weekly cadence. We start with a paid discovery session — a
          structured 90-minute conversation that produces a written findings doc
          you keep regardless of next steps.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { step: "01", label: "Discovery", detail: "90-min scoped session" },
            {
              step: "02",
              label: "Findings",
              detail: "Written report, yours to keep",
            },
            {
              step: "03",
              label: "Engagement",
              detail: "Monthly retainer, cancel anytime",
            },
          ].map(({ step, label, detail }) => (
            <div
              key={step}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center"
            >
              <div className="mb-1 text-2xl font-bold text-[var(--color-text-title)]">
                {step}
              </div>
              <div className="text-sm font-medium text-[var(--color-text)]">
                {label}
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                {detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Service tiers */}
      <section className="mb-14">
        <h2 className="mb-2 text-2xl font-semibold text-[var(--color-text)]">
          Service tiers
        </h2>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Pick the engagement depth that fits your stage and budget.
        </p>
        <div className="space-y-4">
          {tiers.map((tier) => (
            <TierCard key={tier.label} {...tier} />
          ))}
        </div>
      </section>

      {/* CTA / contact anchor */}
      <section
        id="contact"
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 text-center"
        aria-label="Contact"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
          Get in touch
        </p>
        <h2 className="mb-3 text-2xl font-semibold text-[var(--color-text)]">
          Let&apos;s talk about your team
        </h2>
        <p className="mx-auto mb-6 max-w-sm text-sm text-[var(--color-text-muted)]">
          Send a short note — what you&apos;re building, where you&apos;re
          stuck, and what you need. I respond within 48 hours.
        </p>
        <a
          href="mailto:damilola.elegbede@gmail.com?subject=Fractional%20VPE%20Inquiry"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          damilola.elegbede@gmail.com
        </a>
      </section>

      {/* Footer link */}
      <div className="mt-12 border-t border-[var(--color-border)] pt-8">
        <Link
          href="/"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          ← Back to main site
        </Link>
      </div>
    </main>
  );
}
