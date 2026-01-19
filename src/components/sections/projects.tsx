'use client';

import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';
import { projectsData } from '@/lib/projects-data';
import { ProjectCard } from './project-card';

export function Projects() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="projects"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'px-6 py-20 transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      )}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-3xl text-[var(--color-text)] md:text-4xl">
          Projects
        </h2>
        <div className="space-y-6">
          {projectsData.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}
