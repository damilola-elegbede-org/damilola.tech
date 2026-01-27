import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChangePreviewPanel } from '@/components/admin/ChangePreviewPanel';
import type { ProposedChange, Gap, ReviewedChange } from '@/lib/types/resume-generation';

const mockChanges: ProposedChange[] = [
  {
    section: 'summary',
    original: 'Technology executive with 10+ years of experience',
    modified: 'Cloud infrastructure leader with 10+ years driving digital transformation',
    reason: 'Added cloud keywords to match JD requirements',
    keywordsAdded: ['cloud', 'infrastructure', 'digital transformation'],
    impactPoints: 4,
  },
  {
    section: 'experience.verily.bullet1',
    original: 'Led engineering teams across multiple projects',
    modified: 'Spearheaded cross-functional engineering teams delivering healthcare AI solutions',
    reason: 'Added healthcare AI context and action verb',
    keywordsAdded: ['healthcare', 'AI', 'cross-functional'],
    impactPoints: 3,
  },
  {
    section: 'experience.google.bullet2',
    original: 'Managed platform development',
    modified: 'Architected scalable platform serving 100M+ users with 99.9% uptime',
    reason: 'Added metrics and scale',
    keywordsAdded: ['scalable', 'platform'],
    impactPoints: 5,
  },
];

const mockGaps: Gap[] = [
  {
    requirement: '5+ years Kubernetes experience',
    severity: 'critical',
    inResume: false,
    mitigation: 'Mention container orchestration experience in interview',
  },
];

describe('ChangePreviewPanel', () => {
  describe('Pending State (Default)', () => {
    it('renders all changes as pending by default', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={mockChanges}
          gaps={mockGaps}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      // Should show all changes
      expect(screen.getByText('Proposed Changes (3)')).toBeInTheDocument();

      // Each change should have Accept, Edit & Accept, and Reject buttons
      const acceptButtons = screen.getAllByRole('button', { name: /accept/i });
      expect(acceptButtons.length).toBeGreaterThanOrEqual(3); // At least 3 accept buttons
    });

    it('shows Accept, Edit & Accept, and Reject buttons for pending changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit & accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
    });

    it('displays original and proposed text', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByText(mockChanges[0].original)).toBeInTheDocument();
      expect(screen.getByText(mockChanges[0].modified)).toBeInTheDocument();
    });
  });

  describe('Accept Flow', () => {
    it('calls onAcceptChange when Accept button is clicked', () => {
      const onAcceptChange = vi.fn();
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={onAcceptChange}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));

      expect(onAcceptChange).toHaveBeenCalledWith(0, undefined);
    });

    it('shows Accepted badge for accepted changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'accepted',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByText('Accepted')).toBeInTheDocument();
    });

    it('shows green border for accepted changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'accepted',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      // The card should have green styling
      const card = screen.getByTestId('change-card-0');
      expect(card.className).toContain('border-green');
    });
  });

  describe('Edit Flow', () => {
    it('enters edit mode when Edit & Accept is clicked', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /edit & accept/i }));

      // Should show textarea with proposed text
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue(mockChanges[0].modified);
    });

    it('shows Save & Accept and Cancel buttons in edit mode', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /edit & accept/i }));

      expect(screen.getByRole('button', { name: /save & accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('calls onAcceptChange with edited text when Save & Accept is clicked', () => {
      const onAcceptChange = vi.fn();
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={onAcceptChange}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /edit & accept/i }));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'My custom edited text' } });

      fireEvent.click(screen.getByRole('button', { name: /save & accept/i }));

      expect(onAcceptChange).toHaveBeenCalledWith(0, 'My custom edited text');
    });

    it('exits edit mode and preserves original when Cancel is clicked', () => {
      const onAcceptChange = vi.fn();
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={onAcceptChange}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /edit & accept/i }));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Should be discarded' } });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Should return to pending state with original buttons
      expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument();
      expect(onAcceptChange).not.toHaveBeenCalled();
    });

    it('shows Edited badge for accepted changes with edits', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'accepted',
          editedText: 'User edited this text',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByText('Accepted')).toBeInTheDocument();
      expect(screen.getByText('Edited')).toBeInTheDocument();
    });
  });

  describe('Reject Flow', () => {
    it('shows feedback input when Reject is clicked', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

      // Should show feedback input
      expect(screen.getByPlaceholderText(/optional feedback/i)).toBeInTheDocument();
    });

    it('calls onRejectChange with feedback when confirmed', () => {
      const onRejectChange = vi.fn();
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={onRejectChange}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

      const feedbackInput = screen.getByPlaceholderText(/optional feedback/i);
      fireEvent.change(feedbackInput, { target: { value: 'Too aggressive for this role' } });

      fireEvent.click(screen.getByRole('button', { name: /confirm reject/i }));

      expect(onRejectChange).toHaveBeenCalledWith(0, 'Too aggressive for this role');
    });

    it('allows rejection without feedback', () => {
      const onRejectChange = vi.fn();
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={onRejectChange}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm reject/i }));

      expect(onRejectChange).toHaveBeenCalledWith(0, undefined);
    });

    it('shows Rejected badge and feedback for rejected changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'rejected',
          feedback: 'Too aggressive for this company',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText(/too aggressive for this company/i)).toBeInTheDocument();
    });

    it('shows red border for rejected changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      const card = screen.getByTestId('change-card-0');
      expect(card.className).toContain('border-red');
    });
  });

  describe('Revert Flow', () => {
    it('shows Revert to Pending button for accepted changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'accepted',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /revert to pending/i })).toBeInTheDocument();
    });

    it('shows Revert to Pending button for rejected changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /revert to pending/i })).toBeInTheDocument();
    });

    it('calls onRevertChange when Revert to Pending is clicked', () => {
      const onRevertChange = vi.fn();
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'accepted',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={[mockChanges[0]]}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={onRevertChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /revert to pending/i }));

      expect(onRevertChange).toHaveBeenCalledWith(0);
    });
  });

  describe('Bulk Actions', () => {
    it('shows Accept All Pending and Reject All Pending buttons when there are pending changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={mockChanges}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /accept all pending/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject all pending/i })).toBeInTheDocument();
    });

    it('shows Revert All button when there are non-pending changes', () => {
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'accepted',
          reviewedAt: new Date().toISOString(),
        }],
        [1, {
          originalChange: mockChanges[1],
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={mockChanges}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /revert all/i })).toBeInTheDocument();
    });

    it('calls onAcceptChange for all pending changes when Accept All Pending is clicked', () => {
      const onAcceptChange = vi.fn();
      // One change already accepted
      const reviewedChanges = new Map<number, ReviewedChange>([
        [0, {
          originalChange: mockChanges[0],
          status: 'accepted',
          reviewedAt: new Date().toISOString(),
        }],
      ]);

      render(
        <ChangePreviewPanel
          changes={mockChanges}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={onAcceptChange}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /accept all pending/i }));

      // Should only call for pending changes (indices 1 and 2)
      expect(onAcceptChange).toHaveBeenCalledTimes(2);
      expect(onAcceptChange).toHaveBeenCalledWith(1, undefined);
      expect(onAcceptChange).toHaveBeenCalledWith(2, undefined);
    });
  });

  describe('Gaps Section', () => {
    it('renders gaps when provided', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={mockChanges}
          gaps={mockGaps}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.getByText('Gaps Identified (1)')).toBeInTheDocument();
      expect(screen.getByText('5+ years Kubernetes experience')).toBeInTheDocument();
    });

    it('does not render gaps section when no gaps', () => {
      const reviewedChanges = new Map<number, ReviewedChange>();

      render(
        <ChangePreviewPanel
          changes={mockChanges}
          gaps={[]}
          reviewedChanges={reviewedChanges}
          onAcceptChange={vi.fn()}
          onRejectChange={vi.fn()}
          onRevertChange={vi.fn()}
        />
      );

      expect(screen.queryByText(/gaps identified/i)).not.toBeInTheDocument();
    });
  });
});
