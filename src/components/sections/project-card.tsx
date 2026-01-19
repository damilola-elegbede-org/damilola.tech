'use client';

import { useState } from 'react';
import type { Project } from '@/types';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function ChevronIcon({ className, isOpen }: { className?: string; isOpen: boolean }) {
  return (
    <svg
      className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasDetails = project.stats || project.categories || project.highlights;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-all duration-200 hover:border-[var(--color-accent)] hover:shadow-[0_0_20px_rgba(96,165,250,0.2)]">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-[var(--color-text)]">
          {project.name}
        </h3>
        <p className="text-lg font-medium text-[var(--color-accent)]">
          {project.subtitle}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {project.description}
        </p>
      </div>

      {/* Tech Stack */}
      <div className="mb-4 flex flex-wrap gap-2">
        {project.techStack.map((tech) => (
          <Badge key={tech} variant="outline">
            {tech}
          </Badge>
        ))}
      </div>

      {/* Links and Toggle */}
      <div className="flex flex-wrap items-center gap-4">
        {project.links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
            aria-label={`${link.label} (opens in new tab)`}
          >
            {link.icon === 'github' ? (
              <GitHubIcon className="h-4 w-4" />
            ) : (
              <ExternalLinkIcon className="h-4 w-4" />
            )}
            <span>{link.label}</span>
          </a>
        ))}

        {hasDetails && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
            aria-expanded={isExpanded}
            aria-controls={`project-details-${project.id}`}
          >
            <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
            <ChevronIcon isOpen={isExpanded} />
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && hasDetails && (
        <div
          id={`project-details-${project.id}`}
          className="mt-6 space-y-6 rounded-lg bg-[var(--color-bg-alt)] p-4"
        >
          {/* Stats Block */}
          {project.stats && (
            <div>
              <h4 className="font-semibold text-[var(--color-text)]">
                {project.stats.label}
              </h4>
              <ul className="mt-2 space-y-2">
                {project.stats.items.map((item) => (
                  <li
                    key={`${project.id}-stat-${item.slice(0, 30)}`}
                    className="flex items-start text-sm text-[var(--color-text-muted)]"
                  >
                    <span className="mr-3 mt-0.5 flex-shrink-0 text-[var(--color-accent)]">
                      ›
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Categories */}
          {project.categories?.map((category) => (
            <div key={category.title}>
              <h4 className="font-semibold text-[var(--color-text)]">
                {category.title}
              </h4>
              <ul className="mt-2 space-y-2">
                {category.items.map((item) => (
                  <li
                    key={`${project.id}-${category.title}-${item.slice(0, 30)}`}
                    className="flex items-start text-sm text-[var(--color-text-muted)]"
                  >
                    <span className="mr-3 mt-0.5 flex-shrink-0 text-[var(--color-accent)]">
                      ›
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Simple Highlights */}
          {project.highlights && !project.categories && (
            <div>
              <h4 className="font-semibold text-[var(--color-text)]">Highlights</h4>
              <ul className="mt-2 space-y-2">
                {project.highlights.map((item) => (
                  <li
                    key={`${project.id}-highlight-${item.slice(0, 30)}`}
                    className="flex items-start text-sm text-[var(--color-text-muted)]"
                  >
                    <span className="mr-3 mt-0.5 flex-shrink-0 text-[var(--color-accent)]">
                      ›
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
