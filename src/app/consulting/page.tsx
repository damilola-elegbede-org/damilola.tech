import Link from "next/link";
import type { Metadata } from "next";
import { ContactForm } from "@/components/consulting/ContactForm";

export const metadata: Metadata = {
  title: "Fractional Engineering Leadership | Damilola Elegbede",
  description:
    "Fractional VP Engineering for Seed–Series B startups. Architecture reviews, team building, and DevEx strategy — 15 years at Verily & Qualcomm.",
  keywords: [
    "Fractional VP Engineering",
    "Fractional Engineering Leadership",
    "Engineering Manager",
    "Startup CTO",
    "Technical Leadership",
    "DevEx Strategy",
    "Architecture Review",
  ],
  alternates: {
    canonical: "https://damilola.tech/consulting",
  },
  openGraph: {
    title: "Fractional Engineering Leadership | Damilola Elegbede",
    description:
      "Fractional VP Engineering for Seed–Series B startups. Architecture reviews, team building, and DevEx strategy.",
    type: "website",
    url: "https://damilola.tech/consulting",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fractional Engineering Leadership | Damilola Elegbede",
    description:
      "Fractional VP Engineering for Seed–Series B startups. Architecture reviews, team building, and DevEx strategy.",
  },
};

const services = [
  {
    label: "Advisory",
    headline: "Strategic Engineering Guidance",
    description:
      "Weekly or bi-weekly sessions covering roadmap trade-offs, engineering velocity, incident response posture, and executive communication. You get a thought partner who has shipped at scale and can pressure-test your decisions before they calcify.",
    tags: ["Roadmap", "Velocity", "Incident Posture", "Exec Alignment"],
  },
  {
    label: "Architecture Review",
    headline: "System Design Assessment",
    description:
      "A structured review of your current architecture — data flows, service boundaries, deployment topology, and failure modes. Delivered as a written report with prioritized findings and a 90-day action plan your team can execute.",
    tags: ["Cloud Infra", "Service Design", "DevEx", "Scaling"],
  },
  {
    label: "Team Building",
    headline: "Hiring & Org Design",
    description:
      "Interview calibration, leveling frameworks, and org structure for engineering teams at inflection points. Helps you hire the right people and build the scaffolding that keeps them effective as the team doubles.",
    tags: ["Leveling", "Interview Design", "Org Structure", "Retention"],
  },
];

function ServiceCard({
  label,
  headline,
  description,
  tags,
}: (typeof services)[number]) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-colors hover:border-[var(--color-accent)]/40">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
        {label}
      </p>
      <h3 className="mb-3 text-xl font-semibold text-[var(--color-text)]">
        {headline}
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {description}
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)]"
          >
            {tag}
          </span>
        ))}
      </div>
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

      {/* Header */}
      <header className="mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
          Fractional Advisory
        </p>
        <h1 className="mb-5 text-4xl font-bold leading-tight text-[var(--color-text)] md:text-5xl">
          Engineering leadership,{" "}
          <span className="text-[var(--color-text-title)]">fractionally.</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-[var(--color-text-muted)]">
          15 years building and leading engineering orgs at Verily Life Sciences
          and Qualcomm. Now available to Seed–Series B startups as a fractional
          VP Engineering — without the full-time overhead.
        </p>

        {/* Availability badge */}
        <div className="mt-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: "01", label: "Discovery", detail: "90-min scoped session" },
            { step: "02", label: "Findings", detail: "Written report, yours to keep" },
            { step: "03", label: "Engagement", detail: "Monthly retainer, cancel anytime" },
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

      {/* Services */}
      <section className="mb-14">
        <h2 className="mb-6 text-2xl font-semibold text-[var(--color-text)]">
          What I offer
        </h2>
        <div className="space-y-4">
          {services.map((service) => (
            <ServiceCard key={service.label} {...service} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8"
        aria-label="Contact"
      >
        <div className="mb-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)]">
            Get in touch
          </p>
          <h2 className="mb-3 text-2xl font-semibold text-[var(--color-text)]">
            Let&apos;s talk about your team
          </h2>
          <p className="mx-auto max-w-sm text-sm text-[var(--color-text-muted)]">
            Send a short note — what you&apos;re building, where you&apos;re
            stuck, and what you need. I respond within 48 hours.
          </p>
        </div>
        <ContactForm />
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
