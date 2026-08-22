import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BadgeTooltip, { SimpleBadgeTooltip } from '../components/BadgeTooltip';

describe('BadgeTooltip Component', () => {
  const defaultProps = {
    name: 'Master Committer',
    description: 'Pushed 100 commits to main branch',
    unlockCriteria: 'Reach 100 commits',
    isEarned: true,
    icon: '🏆',
  };

  it('renders trigger children element', () => {
    render(
      <BadgeTooltip {...defaultProps}>
        <button>Hover or Focus Me</button>
      </BadgeTooltip>
    );

    expect(screen.getByRole('button', { name: 'Hover or Focus Me' })).toBeInTheDocument();
  });

  it('reveals tooltip on focus and hides on blur', async () => {
    render(
      <BadgeTooltip {...defaultProps}>
        <button>Focusable Badge</button>
      </BadgeTooltip>
    );

    const trigger = screen.getByRole('button', { name: 'Focusable Badge' });

    // Initially tooltip content is closed/hidden
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Focus trigger
    fireEvent.focus(trigger);

    // Tooltip should be visible on focus
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
    expect(screen.getByText('Master Committer')).toBeInTheDocument();
    expect(screen.getByText('Pushed 100 commits to main branch')).toBeInTheDocument();

    // Blur trigger
    fireEvent.blur(trigger);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('links trigger and tooltip content via aria-describedby', async () => {
    render(
      <BadgeTooltip {...defaultProps}>
        <button>A11y Badge</button>
      </BadgeTooltip>
    );

    const trigger = screen.getByRole('button', { name: 'A11y Badge' });

    fireEvent.focus(trigger);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute('id');
      const tooltipId = tooltip.getAttribute('id');
      expect(trigger).toHaveAttribute('aria-describedby', tooltipId);
    });
  });

  it('ensures tooltip content has tabIndex={-1} so keyboard focus is not trapped', async () => {
    render(
      <BadgeTooltip {...defaultProps}>
        <button>No Focus Trap Badge</button>
      </BadgeTooltip>
    );

    const trigger = screen.getByRole('button', { name: 'No Focus Trap Badge' });
    fireEvent.focus(trigger);

    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('SimpleBadgeTooltip', () => {
    it('reveals simple tooltip on focus and hides on blur', async () => {
      render(
        <SimpleBadgeTooltip {...defaultProps}>
          <button>Simple Badge</button>
        </SimpleBadgeTooltip>
      );

      const triggerWrapper = screen.getByTitle(/Master Committer/i);

      fireEvent.focus(triggerWrapper);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
      expect(screen.getByRole('tooltip')).toHaveTextContent('Master Committer');

      fireEvent.blur(triggerWrapper);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('links simple tooltip via aria-describedby and tabIndex={-1}', async () => {
      render(
        <SimpleBadgeTooltip {...defaultProps}>
          <button>Simple A11y Badge</button>
        </SimpleBadgeTooltip>
      );

      const triggerWrapper = screen.getByTitle(/Master Committer/i);

      fireEvent.focus(triggerWrapper);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('tabIndex', '-1');
        const tooltipId = tooltip.getAttribute('id');
        expect(triggerWrapper).toHaveAttribute('aria-describedby', tooltipId);
      });
    });
  });
});
