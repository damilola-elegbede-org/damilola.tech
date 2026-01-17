import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExperienceCard } from '@/components/sections/experience-card';
import type { Experience } from '@/types';

const mockExperience: Experience = {
  id: 'test-exp',
  company: 'Test Company',
  title: 'Senior Engineer',
  location: 'Boulder, CO',
  startDate: 'Jan 2020',
  endDate: 'Dec 2024',
  highlights: [
    'Led technical initiatives',
    'Delivered critical projects',
  ],
};

const mockExperienceWithAiContext: Experience = {
  id: 'test-exp-ai',
  company: 'AI Context Company',
  title: 'Engineering Manager',
  location: 'Boulder, CO',
  startDate: 'Jan 2022',
  endDate: 'Present',
  highlights: ['Built infrastructure platform'],
  aiContext: {
    situation: 'Joined during a critical transition period with no cloud infrastructure.',
    approach: 'Built the Cloud Infrastructure function from scratch.',
    technicalWork: 'Led cloud environment actuations across multiple environments.',
    lessonsLearned: 'Enterprise cloud transformation is fundamentally a people challenge.',
  },
};

const mockExperienceWithAiContextNoTechnical: Experience = {
  id: 'test-exp-no-tech',
  company: 'No Technical Company',
  title: 'Staff Engineer',
  location: 'Boulder, CO',
  startDate: 'Jan 2019',
  endDate: 'Dec 2021',
  highlights: ['Led team initiatives'],
  aiContext: {
    situation: 'Legacy systems needed modernization.',
    approach: 'Implemented incremental migration strategy.',
    lessonsLearned: 'Small wins build momentum for larger changes.',
  },
};

describe('ExperienceCard', () => {
  it('renders company name', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByRole('heading', { name: 'Test Company' })).toBeInTheDocument();
  });

  it('renders title', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
  });

  it('renders date range and location', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('Jan 2020 - Dec 2024 • Boulder, CO')).toBeInTheDocument();
  });

  it('renders highlights', () => {
    render(<ExperienceCard experience={mockExperience} />);
    expect(screen.getByText('Led technical initiatives')).toBeInTheDocument();
    expect(screen.getByText('Delivered critical projects')).toBeInTheDocument();
  });

  describe('AI Context', () => {
    it('does not show AI Context button when aiContext is not provided', () => {
      render(<ExperienceCard experience={mockExperience} />);
      expect(screen.queryByRole('button', { name: /ai context/i })).not.toBeInTheDocument();
    });

    it('shows AI Context button when aiContext is provided', () => {
      render(<ExperienceCard experience={mockExperienceWithAiContext} />);
      expect(screen.getByRole('button', { name: /ai context/i })).toBeInTheDocument();
    });

    it('toggles structured AI context content on button click', () => {
      render(<ExperienceCard experience={mockExperienceWithAiContext} />);
      const button = screen.getByRole('button', { name: /ai context/i });

      // AI context content should not be visible initially
      expect(screen.queryByText(/Situation/)).not.toBeInTheDocument();

      // Click to open
      fireEvent.click(button);
      expect(screen.getByText('Situation')).toBeInTheDocument();
      expect(screen.getByText('Approach')).toBeInTheDocument();
      expect(screen.getByText('Technical Work')).toBeInTheDocument();
      expect(screen.getByText('Lessons Learned')).toBeInTheDocument();

      // Verify actual content
      expect(screen.getByText(/Joined during a critical transition period/)).toBeInTheDocument();
      expect(screen.getByText(/Built the Cloud Infrastructure function/)).toBeInTheDocument();
      expect(screen.getByText(/Led cloud environment actuations/)).toBeInTheDocument();
      expect(screen.getByText(/Enterprise cloud transformation is fundamentally/)).toBeInTheDocument();

      // Click to close
      fireEvent.click(button);
      expect(screen.queryByText('Situation')).not.toBeInTheDocument();
    });

    it('does not show Technical Work section when technicalWork is not provided', () => {
      render(<ExperienceCard experience={mockExperienceWithAiContextNoTechnical} />);
      const button = screen.getByRole('button', { name: /ai context/i });

      fireEvent.click(button);

      expect(screen.getByText('Situation')).toBeInTheDocument();
      expect(screen.getByText('Approach')).toBeInTheDocument();
      expect(screen.queryByText('Technical Work')).not.toBeInTheDocument();
      expect(screen.getByText('Lessons Learned')).toBeInTheDocument();
    });
  });
});
