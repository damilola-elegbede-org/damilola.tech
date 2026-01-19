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
    strategicContext: 'The organization was navigating a critical inflection point: migrating from internal infrastructure to public cloud.',
    leadershipChallenge: 'The hardest part was organizational. Building trust with teams who had little reason to prioritize requests.',
    keyInsight: 'Enterprise cloud transformation is fundamentally a people and process challenge.',
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
      expect(screen.queryByText(/Strategic Context/)).not.toBeInTheDocument();

      // Click to open
      fireEvent.click(button);
      expect(screen.getByText('Strategic Context')).toBeInTheDocument();
      expect(screen.getByText('Leadership Challenge')).toBeInTheDocument();
      expect(screen.getByText('Key Insight')).toBeInTheDocument();

      // Verify actual content
      expect(screen.getByText(/navigating a critical inflection point/)).toBeInTheDocument();
      expect(screen.getByText(/The hardest part was organizational/)).toBeInTheDocument();
      expect(screen.getByText(/Enterprise cloud transformation is fundamentally/)).toBeInTheDocument();

      // Click to close
      fireEvent.click(button);
      expect(screen.queryByText('Strategic Context')).not.toBeInTheDocument();
    });
  });
});
