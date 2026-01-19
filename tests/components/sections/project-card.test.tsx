import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectCard } from '@/components/sections/project-card';
import type { Project } from '@/types';

const mockProjectWithHighlights: Project = {
  id: 'test-project',
  name: 'Test Project',
  subtitle: 'A test project subtitle',
  description: 'This is a test project description.',
  techStack: ['React', 'TypeScript', 'Node.js'],
  links: [
    { label: 'Live Site', url: 'https://example.com', icon: 'external' },
    { label: 'GitHub', url: 'https://github.com/test/test', icon: 'github' },
  ],
  highlights: [
    'First highlight item',
    'Second highlight item',
    'Third highlight item',
  ],
};

const mockProjectWithCategories: Project = {
  id: 'complex-project',
  name: 'Complex Project',
  subtitle: 'A project with categories',
  description: 'This project has organized categories.',
  techStack: ['JavaScript', 'Vercel'],
  links: [{ label: 'Live Site', url: 'https://complex.com', icon: 'external' }],
  stats: {
    label: 'Key Metrics',
    items: ['$1000 revenue', '50 users'],
  },
  categories: [
    {
      title: 'Feature Category',
      items: ['Feature one', 'Feature two'],
    },
    {
      title: 'Technical Category',
      items: ['Tech item one', 'Tech item two'],
    },
  ],
};

const mockProjectWithoutDetails: Project = {
  id: 'simple-project',
  name: 'Simple Project',
  subtitle: 'A simple project',
  description: 'No expandable details.',
  techStack: ['Python'],
  links: [{ label: 'GitHub', url: 'https://github.com/test/simple', icon: 'github' }],
};

describe('ProjectCard', () => {
  it('renders project name as heading', () => {
    render(<ProjectCard project={mockProjectWithHighlights} />);
    expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<ProjectCard project={mockProjectWithHighlights} />);
    expect(screen.getByText('A test project subtitle')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<ProjectCard project={mockProjectWithHighlights} />);
    expect(screen.getByText('This is a test project description.')).toBeInTheDocument();
  });

  it('renders tech stack badges', () => {
    render(<ProjectCard project={mockProjectWithHighlights} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
  });

  it('renders links with correct href attributes', () => {
    render(<ProjectCard project={mockProjectWithHighlights} />);
    const liveLink = screen.getByRole('link', { name: /live site/i });
    const githubLink = screen.getByRole('link', { name: /github/i });

    expect(liveLink).toHaveAttribute('href', 'https://example.com');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/test/test');
  });

  it('renders external links with target blank and rel attributes', () => {
    render(<ProjectCard project={mockProjectWithHighlights} />);
    const liveLink = screen.getByRole('link', { name: /live site/i });

    expect(liveLink).toHaveAttribute('target', '_blank');
    expect(liveLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  describe('Collapsible Details', () => {
    it('shows View Details button when project has highlights', () => {
      render(<ProjectCard project={mockProjectWithHighlights} />);
      expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    });

    it('shows View Details button when project has categories', () => {
      render(<ProjectCard project={mockProjectWithCategories} />);
      expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    });

    it('does not show View Details button when project has no details', () => {
      render(<ProjectCard project={mockProjectWithoutDetails} />);
      expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
    });

    it('does not show details content initially', () => {
      render(<ProjectCard project={mockProjectWithHighlights} />);
      expect(screen.queryByText('First highlight item')).not.toBeInTheDocument();
    });

    it('expands to show highlights on button click', () => {
      render(<ProjectCard project={mockProjectWithHighlights} />);
      const button = screen.getByRole('button', { name: /view details/i });

      fireEvent.click(button);

      expect(screen.getByText('Highlights')).toBeInTheDocument();
      expect(screen.getByText('First highlight item')).toBeInTheDocument();
      expect(screen.getByText('Second highlight item')).toBeInTheDocument();
      expect(screen.getByText('Third highlight item')).toBeInTheDocument();
    });

    it('expands to show stats and categories on button click', () => {
      render(<ProjectCard project={mockProjectWithCategories} />);
      const button = screen.getByRole('button', { name: /view details/i });

      fireEvent.click(button);

      expect(screen.getByText('Key Metrics')).toBeInTheDocument();
      expect(screen.getByText('$1000 revenue')).toBeInTheDocument();
      expect(screen.getByText('50 users')).toBeInTheDocument();
      expect(screen.getByText('Feature Category')).toBeInTheDocument();
      expect(screen.getByText('Feature one')).toBeInTheDocument();
      expect(screen.getByText('Technical Category')).toBeInTheDocument();
      expect(screen.getByText('Tech item one')).toBeInTheDocument();
    });

    it('collapses details on second button click', () => {
      render(<ProjectCard project={mockProjectWithHighlights} />);
      const button = screen.getByRole('button', { name: /view details/i });

      fireEvent.click(button);
      expect(screen.getByText('First highlight item')).toBeInTheDocument();

      fireEvent.click(button);
      expect(screen.queryByText('First highlight item')).not.toBeInTheDocument();
    });

    it('changes button text when expanded', () => {
      render(<ProjectCard project={mockProjectWithHighlights} />);
      const button = screen.getByRole('button', { name: /view details/i });

      fireEvent.click(button);

      expect(screen.getByRole('button', { name: /hide details/i })).toBeInTheDocument();
    });

    it('has correct aria-expanded attribute', () => {
      render(<ProjectCard project={mockProjectWithHighlights} />);
      const button = screen.getByRole('button', { name: /view details/i });

      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-controls pointing to details element', () => {
      render(<ProjectCard project={mockProjectWithHighlights} />);
      const button = screen.getByRole('button', { name: /view details/i });

      expect(button).toHaveAttribute('aria-controls', 'project-details-test-project');

      fireEvent.click(button);

      const details = document.getElementById('project-details-test-project');
      expect(details).toBeInTheDocument();
    });
  });
});
