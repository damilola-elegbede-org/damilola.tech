import { SocialLinks } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

export function Contact() {
  return (
    <footer
      id="contact"
      className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-8"
    >
      <div className="mx-auto max-w-3xl text-center">
        {/* Social Links */}
        <SocialLinks className="mb-4 justify-center" iconSize="lg" />

        {/* Location */}
        <p className="text-sm text-[var(--color-text-muted)]">{resumeData.location}</p>
      </div>
    </footer>
  );
}
