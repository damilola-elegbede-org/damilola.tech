import { Card, CardContent } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

export function Education() {
  return (
    <section id="education" className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-center text-[var(--color-primary)]">
          Education
        </h2>
        <div className="space-y-4">
          {resumeData.education.map((edu) => (
            <Card key={edu.id}>
              <CardContent>
                <h3 className="text-lg font-semibold text-[var(--color-primary)]">
                  {edu.degree}
                </h3>
                <p className="text-[var(--color-text-muted)]">
                  {edu.institution}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
