import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Case Studies | Damilola Elegbede",
  description:
    "Deep-dives into production engineering problems — how I diagnosed, fixed, and shipped complex systems under real constraints.",
};

const caseStudies = [
  {
    slug: "alcbf",
    title: "A Lo Cubano Boulder Fest",
    tagline: "Production ticketing platform — 4 data bugs found and fixed 3 weeks before a live dance event",
    stack: ["Node.js", "Vercel", "Turso (LibSQL)", "Stripe"],
    metrics: [
      { value: "7", label: "PRs shipped concurrently" },
      { value: "3", label: "Production data bugs fixed" },
      { value: "May 15", label: "Go-live with verified data" },
    ],
    theme: "Event infrastructure & data correctness under deadline pressure",
  },
  {
    slug: "scf-dance",
    title: "Salsa Con Flow Dance",
    tagline: "Full-stack booking platform — built, secured, and hardened for a professional Latin dance instructor",
    stack: ["Next.js", "TypeScript", "Vercel", "Playwright"],
    metrics: [
      { value: "100%", label: "CI check pass rate" },
      { value: "4", label: "Security layers added" },
      { value: "Node 20", label: "Upgraded before June deadline" },
    ],
    theme: "Platform delivery, security hardening & CI reliability",
  },
];

export default function CaseStudiesIndex() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <header className="mb-16">
        <p className="mb-2 text-sm uppercase tracking-widest text-[var(--color-accent)]">
          Engineering Work
        </p>
        <h1 className="mb-4 text-4xl font-bold text-[var(--color-text)] md:text-5xl">
          Case Studies
        </h1>
        <p className="text-lg text-[var(--color-text-muted)]">
          Real production systems, real constraints. Each write-up covers what broke,
          why it broke, how I diagnosed and fixed it, and what the outcome was.
        </p>
      </header>

      <div className="space-y-8">
        {caseStudies.map((cs) => (
          <Link
            key={cs.slug}
            href={`/case-studies/${cs.slug}`}
            className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 transition-colors hover:border-[var(--color-accent)]"
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-[var(--color-accent)]">
              {cs.theme}
            </p>
            <h2 className="mb-3 text-2xl font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
              {cs.title}
            </h2>
            <p className="mb-6 text-[var(--color-text-muted)]">{cs.tagline}</p>

            <div className="mb-6 grid grid-cols-3 gap-4">
              {cs.metrics.map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-xl font-bold text-[var(--color-accent)]">{value}</div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">{label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {cs.stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)]"
                >
                  {tech}
                </span>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm text-[var(--color-accent)]">
              Read case study
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-16 border-t border-[var(--color-border)] pt-8">
        <Link
          href="/#projects"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          ← Back to Projects
        </Link>
      </div>
    </main>
  );
}
