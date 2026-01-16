import { resumeData } from '@/lib/resume-data';

export function Contact() {
  return (
    <footer
      id="contact"
      className="bg-[var(--color-primary)] px-6 py-16 text-white"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-8 text-white">Let&apos;s Connect</h2>
        <div className="mb-8 flex flex-col items-center justify-center gap-6 sm:flex-row">
          <a
            href={`mailto:${resumeData.email}`}
            className="flex items-center gap-2 text-lg transition-opacity hover:opacity-80"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {resumeData.email}
          </a>
          <a
            href={resumeData.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-lg transition-opacity hover:opacity-80"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
            LinkedIn
          </a>
        </div>
        <p className="text-sm opacity-75">{resumeData.location}</p>
      </div>
    </footer>
  );
}
