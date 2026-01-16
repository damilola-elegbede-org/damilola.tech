import { resumeData } from '@/lib/resume-data';

export function About() {
  return (
    <section id="about" className="bg-[var(--color-bg-alt)] px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-center text-[var(--color-primary)]">About</h2>
        <p className="text-lg leading-relaxed text-[var(--color-text)]">
          {resumeData.brandingStatement}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-[var(--color-text-muted)]">
          With 15+ years of experience at companies like Verily Life Sciences and
          Qualcomm, I specialize in building high-performance engineering
          organizations that deliver enterprise-scale solutions. My expertise
          spans cloud infrastructure (GCP/AWS), platform engineering, and
          developer experience, with a proven track record of leading teams of
          35+ engineers across multiple sites.
        </p>
      </div>
    </section>
  );
}
