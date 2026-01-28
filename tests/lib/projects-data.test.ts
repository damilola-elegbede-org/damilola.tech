import { describe, it, expect } from 'vitest';
import { projectsData } from '@/lib/projects-data';
import type { Project, ProjectLink, ProjectCategory } from '@/types';

describe('projects-data - Data Structure', () => {
  describe('projectsData array', () => {
    it('exports an array of projects', () => {
      expect(Array.isArray(projectsData)).toBe(true);
      expect(projectsData.length).toBeGreaterThan(0);
    });

    it('contains at least 4 projects', () => {
      expect(projectsData.length).toBeGreaterThanOrEqual(4);
    });

    it('has unique project IDs', () => {
      const ids = projectsData.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(projectsData.length);
    });
  });

  describe('project required fields', () => {
    it.each(projectsData)('$name has all required fields', (project: Project) => {
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('subtitle');
      expect(project).toHaveProperty('description');
      expect(project).toHaveProperty('techStack');
      expect(project).toHaveProperty('links');
    });

    it.each(projectsData)('$name has non-empty required string fields', (project: Project) => {
      expect(typeof project.id).toBe('string');
      expect(project.id.length).toBeGreaterThan(0);

      expect(typeof project.name).toBe('string');
      expect(project.name.length).toBeGreaterThan(0);

      expect(typeof project.subtitle).toBe('string');
      expect(project.subtitle.length).toBeGreaterThan(0);

      expect(typeof project.description).toBe('string');
      expect(project.description.length).toBeGreaterThan(0);
    });

    it.each(projectsData)('$name ID is kebab-case', (project: Project) => {
      // IDs should be lowercase with hyphens
      expect(project.id).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('techStack field', () => {
    it.each(projectsData)('$name techStack is an array', (project: Project) => {
      expect(Array.isArray(project.techStack)).toBe(true);
    });

    it.each(projectsData)('$name techStack is not empty', (project: Project) => {
      expect(project.techStack.length).toBeGreaterThan(0);
    });

    it.each(projectsData)('$name techStack contains only strings', (project: Project) => {
      for (const tech of project.techStack) {
        expect(typeof tech).toBe('string');
        expect(tech.length).toBeGreaterThan(0);
      }
    });

    it.each(projectsData)('$name techStack has no duplicate entries', (project: Project) => {
      const uniqueTech = new Set(project.techStack);
      expect(uniqueTech.size).toBe(project.techStack.length);
    });

    it('all projects have diverse tech stacks', () => {
      for (const project of projectsData) {
        expect(project.techStack.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('links field', () => {
    it.each(projectsData)('$name links is an array', (project: Project) => {
      expect(Array.isArray(project.links)).toBe(true);
    });

    it.each(projectsData)('$name has at least one link', (project: Project) => {
      expect(project.links.length).toBeGreaterThan(0);
    });

    it.each(projectsData)('$name links have correct structure', (project: Project) => {
      for (const link of project.links) {
        expect(link).toHaveProperty('label');
        expect(link).toHaveProperty('url');
        expect(link).toHaveProperty('icon');

        expect(typeof link.label).toBe('string');
        expect(link.label.length).toBeGreaterThan(0);

        expect(typeof link.url).toBe('string');
        expect(link.url.length).toBeGreaterThan(0);

        expect(typeof link.icon).toBe('string');
        expect(['external', 'github']).toContain(link.icon);
      }
    });

    it.each(projectsData)('$name links have valid URLs', (project: Project) => {
      for (const link of project.links) {
        expect(link.url).toMatch(/^https?:\/\/.+/);
      }
    });

    it.each(projectsData)('$name GitHub links use github.com domain', (project: Project) => {
      const githubLinks = project.links.filter((link) => link.icon === 'github');
      for (const link of githubLinks) {
        expect(link.url).toMatch(/^https:\/\/github\.com\//);
      }
    });
  });

  describe('optional fields', () => {
    describe('highlights field', () => {
      const projectsWithHighlights = projectsData.filter((p) => p.highlights);

      it('highlights is an array when present', () => {
        for (const project of projectsWithHighlights) {
          expect(Array.isArray(project.highlights)).toBe(true);
        }
      });

      it('highlights contains only non-empty strings when present', () => {
        for (const project of projectsWithHighlights) {
          if (project.highlights) {
            expect(project.highlights.length).toBeGreaterThan(0);
            for (const highlight of project.highlights) {
              expect(typeof highlight).toBe('string');
              expect(highlight.length).toBeGreaterThan(0);
            }
          }
        }
      });
    });

    describe('categories field', () => {
      const projectsWithCategories = projectsData.filter((p) => p.categories);

      it('categories is an array when present', () => {
        for (const project of projectsWithCategories) {
          expect(Array.isArray(project.categories)).toBe(true);
        }
      });

      it('categories have correct structure when present', () => {
        for (const project of projectsWithCategories) {
          if (project.categories) {
            expect(project.categories.length).toBeGreaterThan(0);
            for (const category of project.categories) {
              expect(category).toHaveProperty('title');
              expect(category).toHaveProperty('items');

              expect(typeof category.title).toBe('string');
              expect(category.title.length).toBeGreaterThan(0);

              expect(Array.isArray(category.items)).toBe(true);
              expect(category.items.length).toBeGreaterThan(0);

              for (const item of category.items) {
                expect(typeof item).toBe('string');
                expect(item.length).toBeGreaterThan(0);
              }
            }
          }
        }
      });
    });

    describe('stats field', () => {
      const projectsWithStats = projectsData.filter((p) => p.stats);

      it('stats has correct structure when present', () => {
        for (const project of projectsWithStats) {
          if (project.stats) {
            expect(project.stats).toHaveProperty('label');
            expect(project.stats).toHaveProperty('items');

            expect(typeof project.stats.label).toBe('string');
            expect(project.stats.label.length).toBeGreaterThan(0);

            expect(Array.isArray(project.stats.items)).toBe(true);
            expect(project.stats.items.length).toBeGreaterThan(0);

            for (const item of project.stats.items) {
              expect(typeof item).toBe('string');
              expect(item.length).toBeGreaterThan(0);
            }
          }
        }
      });
    });
  });
});

describe('projects-data - Specific Projects', () => {
  describe('A Lo Cubano Boulder Fest', () => {
    const aloCubano = projectsData.find((p) => p.id === 'alo-cubano');

    it('exists in the data', () => {
      expect(aloCubano).toBeDefined();
    });

    it('has expected name', () => {
      expect(aloCubano?.name).toBe('A Lo Cubano Boulder Fest');
    });

    it('includes key technologies', () => {
      expect(aloCubano?.techStack).toContain('JavaScript');
      expect(aloCubano?.techStack).toContain('Node.js');
      expect(aloCubano?.techStack).toContain('Stripe');
    });

    it('has both live site and GitHub links', () => {
      const liveLink = aloCubano?.links.find((l) => l.icon === 'external');
      const githubLink = aloCubano?.links.find((l) => l.icon === 'github');

      expect(liveLink).toBeDefined();
      expect(githubLink).toBeDefined();
      expect(liveLink?.url).toMatch(/^https:\/\//);
      expect(githubLink?.url).toMatch(/^https:\/\/github\.com\//);
    });

    it('has highlights', () => {
      expect(aloCubano?.highlights).toBeDefined();
      expect(aloCubano?.highlights?.length).toBeGreaterThan(0);
    });

    it('has categories', () => {
      expect(aloCubano?.categories).toBeDefined();
      expect(aloCubano?.categories?.length).toBeGreaterThan(0);
    });

    it('has stats', () => {
      expect(aloCubano?.stats).toBeDefined();
      expect(aloCubano?.stats?.items.length).toBeGreaterThan(0);
    });
  });

  describe('Personal Website (damilola.tech)', () => {
    const personalSite = projectsData.find((p) => p.id === 'damilola-tech');

    it('exists in the data', () => {
      expect(personalSite).toBeDefined();
    });

    it('has expected name', () => {
      expect(personalSite?.name).toBe('Personal Website for Damilola Elegbede');
    });

    it('includes key technologies', () => {
      expect(personalSite?.techStack).toContain('Next.js');
      expect(personalSite?.techStack).toContain('TypeScript');
      expect(personalSite?.techStack).toContain('Claude API');
    });

    it('has both live site and GitHub links', () => {
      const liveLink = personalSite?.links.find((l) => l.icon === 'external');
      const githubLink = personalSite?.links.find((l) => l.icon === 'github');

      expect(liveLink).toBeDefined();
      expect(githubLink).toBeDefined();
    });

    it('has highlights', () => {
      expect(personalSite?.highlights).toBeDefined();
      expect(personalSite?.highlights?.length).toBeGreaterThan(0);
    });

    it('has stats', () => {
      expect(personalSite?.stats).toBeDefined();
      expect(personalSite?.stats?.items.length).toBeGreaterThan(0);
    });
  });

  describe('Pipedream Automation Suite', () => {
    const pipedream = projectsData.find((p) => p.id === 'pipedream-automation');

    it('exists in the data', () => {
      expect(pipedream).toBeDefined();
    });

    it('has expected name', () => {
      expect(pipedream?.name).toBe('Pipedream Automation Suite');
    });

    it('includes key technologies', () => {
      expect(pipedream?.techStack).toContain('Python');
      expect(pipedream?.techStack).toContain('Claude API');
    });

    it('has GitHub link', () => {
      const githubLink = pipedream?.links.find((l) => l.icon === 'github');
      expect(githubLink).toBeDefined();
    });

    it('has highlights', () => {
      expect(pipedream?.highlights).toBeDefined();
      expect(pipedream?.highlights?.length).toBeGreaterThan(0);
    });

    it('has stats', () => {
      expect(pipedream?.stats).toBeDefined();
      expect(pipedream?.stats?.items.length).toBeGreaterThan(0);
    });
  });

  describe('Claude Configuration System', () => {
    const claudeConfig = projectsData.find((p) => p.id === 'claude-config');

    it('exists in the data', () => {
      expect(claudeConfig).toBeDefined();
    });

    it('has expected name', () => {
      expect(claudeConfig?.name).toBe('Claude Configuration System');
    });

    it('includes key technologies', () => {
      expect(claudeConfig?.techStack).toContain('YAML');
      expect(claudeConfig?.techStack).toContain('Python');
    });

    it('has GitHub link', () => {
      const githubLink = claudeConfig?.links.find((l) => l.icon === 'github');
      expect(githubLink).toBeDefined();
    });

    it('has highlights', () => {
      expect(claudeConfig?.highlights).toBeDefined();
      expect(claudeConfig?.highlights?.length).toBeGreaterThan(0);
    });

    it('has stats', () => {
      expect(claudeConfig?.stats).toBeDefined();
      expect(claudeConfig?.stats?.items.length).toBeGreaterThan(0);
    });
  });
});

describe('projects-data - Content Quality', () => {
  it.each(projectsData)('$name description is meaningful', (project: Project) => {
    // Description should be at least 50 characters
    expect(project.description.length).toBeGreaterThan(50);
  });

  it.each(projectsData)('$name subtitle is concise', (project: Project) => {
    // Subtitle should be shorter than description
    expect(project.subtitle.length).toBeLessThan(project.description.length);
    // But still meaningful (at least 10 chars)
    expect(project.subtitle.length).toBeGreaterThan(10);
  });

  it('projects are in expected order', () => {
    const expectedOrder = [
      'alo-cubano',
      'damilola-tech',
      'pipedream-automation',
      'claude-config',
    ];

    const actualIds = projectsData.map((p) => p.id);
    expect(actualIds).toEqual(expectedOrder);
  });
});

describe('projects-data - Type Safety', () => {
  it('all projects conform to Project interface', () => {
    for (const project of projectsData) {
      // Required fields
      const requiredFields: (keyof Project)[] = [
        'id',
        'name',
        'subtitle',
        'description',
        'techStack',
        'links',
      ];

      for (const field of requiredFields) {
        expect(project[field]).toBeDefined();
      }

      // Optional fields should be undefined or correct type
      if (project.highlights !== undefined) {
        expect(Array.isArray(project.highlights)).toBe(true);
      }

      if (project.categories !== undefined) {
        expect(Array.isArray(project.categories)).toBe(true);
      }

      if (project.stats !== undefined) {
        expect(typeof project.stats).toBe('object');
        expect(project.stats).toHaveProperty('label');
        expect(project.stats).toHaveProperty('items');
      }
    }
  });

  it('ProjectLink types are correct', () => {
    for (const project of projectsData) {
      for (const link of project.links) {
        const typedLink: ProjectLink = link;
        expect(typedLink.icon).toMatch(/^(external|github)$/);
      }
    }
  });

  it('ProjectCategory types are correct', () => {
    for (const project of projectsData) {
      if (project.categories) {
        for (const category of project.categories) {
          const typedCategory: ProjectCategory = category;
          expect(typeof typedCategory.title).toBe('string');
          expect(Array.isArray(typedCategory.items)).toBe(true);
        }
      }
    }
  });
});

describe('projects-data - Consistency', () => {
  it('all projects with stats use consistent label format', () => {
    const projectsWithStats = projectsData.filter((p) => p.stats);
    for (const project of projectsWithStats) {
      if (project.stats) {
        // Label should end with 'Metrics', 'Achievements', etc.
        expect(project.stats.label.length).toBeGreaterThan(5);
        expect(project.stats.label).toMatch(/[A-Z]/); // Contains uppercase
      }
    }
  });

  it('all GitHub links follow consistent pattern', () => {
    for (const project of projectsData) {
      const githubLinks = project.links.filter((l) => l.icon === 'github');
      for (const link of githubLinks) {
        expect(link.label).toBe('GitHub');
        expect(link.url).toMatch(/^https:\/\/github\.com\/damilola-elegbede\//);
      }
    }
  });

  it('all external links have appropriate labels', () => {
    for (const project of projectsData) {
      const externalLinks = project.links.filter((l) => l.icon === 'external');
      for (const link of externalLinks) {
        expect(['Live Site', 'Demo', 'Website']).toContain(link.label);
      }
    }
  });

  it('projects with categories have at least 3 categories', () => {
    const projectsWithCategories = projectsData.filter((p) => p.categories);
    for (const project of projectsWithCategories) {
      if (project.categories) {
        expect(project.categories.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('all stats sections have 3 items', () => {
    const projectsWithStats = projectsData.filter((p) => p.stats);
    for (const project of projectsWithStats) {
      if (project.stats) {
        expect(project.stats.items.length).toBe(3);
      }
    }
  });
});
