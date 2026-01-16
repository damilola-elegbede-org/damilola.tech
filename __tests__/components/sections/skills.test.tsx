import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skills } from '@/components/sections/skills';

describe('Skills', () => {
  it('renders the section heading', () => {
    render(<Skills />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Skills');
  });

  it('renders all skill categories', () => {
    render(<Skills />);
    expect(screen.getByText('Leadership')).toBeInTheDocument();
    expect(screen.getByText('Cloud & Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Developer Experience')).toBeInTheDocument();
    expect(screen.getByText('Technical')).toBeInTheDocument();
  });

  it('renders skill badges', () => {
    render(<Skills />);
    expect(screen.getByText('GCP')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes/GKE')).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<Skills />);
    expect(document.getElementById('skills')).toBeInTheDocument();
  });
});
