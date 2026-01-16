import { Badge } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

export function Skills() {
  return (
    <section id="skills" className="bg-[var(--color-bg-alt)] px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-[var(--color-primary)]">Skills</h2>
        <div className="grid gap-8 md:grid-cols-2">
          {resumeData.skills.map((skillGroup) => (
            <div key={skillGroup.category}>
              <h3 className="mb-4 text-lg font-semibold text-[var(--color-primary)]">
                {skillGroup.category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {skillGroup.items.map((skill) => (
                  <Badge key={skill} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
