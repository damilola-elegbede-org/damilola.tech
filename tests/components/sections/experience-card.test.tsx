import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExperienceCard } from '@/components/sections/experience-card';

const mockExperience = {
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

  it('toggles AI context on button click', () => {
    render(<ExperienceCard experience={mockExperience} />);
    const button = screen.getByRole('button', { name: /ai context/i });

    // AI context should not be visible initially
    expect(screen.queryByText(/ask the ai chatbot/i)).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(button);
    expect(screen.getByText(/ask the ai chatbot/i)).toBeInTheDocument();

    // Click to close
    fireEvent.click(button);
    expect(screen.queryByText(/ask the ai chatbot/i)).not.toBeInTheDocument();
  });
});
