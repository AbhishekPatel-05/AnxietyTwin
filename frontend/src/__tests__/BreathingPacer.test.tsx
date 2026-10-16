import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BreathingPacer } from '../components/BreathingPacer';

describe('BreathingPacer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial ready state and disclaimers correctly', () => {
    render(<BreathingPacer />);

    expect(screen.getByText(/Optional Grounding Support: 4-7-8 Breathing Pacer/i)).toBeInTheDocument();
    expect(screen.getByText(/completely voluntary/i)).toBeInTheDocument();
    expect(screen.getByText(/does not substitute for medical or psychiatric care/i)).toBeInTheDocument();

    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Ready');
    expect(screen.getByTestId('pacer-countdown-ready')).toHaveTextContent('4-7-8');
    expect(screen.getByTestId('pacer-status')).toHaveTextContent('Press Start');

    expect(screen.getByRole('button', { name: /start 4-7-8 breathing/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop breathing pacer/i })).not.toBeInTheDocument();
  });

  it('starts countdown on click and updates every second visibly (4, 3, 2, 1, 0)', () => {
    render(<BreathingPacer />);
    const startBtn = screen.getByRole('button', { name: /start 4-7-8 breathing/i });

    fireEvent.click(startBtn);

    // Initial state: Inhale (4s) at 4s
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Inhale (4s)');
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('4s');
    expect(screen.getByTestId('pacer-status')).toHaveTextContent('Cycle Active');
    expect(screen.getByRole('button', { name: /pause breathing pacer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop breathing pacer/i })).toBeInTheDocument();

    // Advance 1 second -> 3s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('3s');

    // Advance 1 second -> 2s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('2s');

    // Advance 1 second -> 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('1s');

    // Advance 1 second -> 0s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('0s');
  });

  it('automatically transitions between Inhale (4s) -> Hold (7s) -> Exhale (8s) -> Inhale (4s)', () => {
    render(<BreathingPacer />);
    fireEvent.click(screen.getByRole('button', { name: /start 4-7-8 breathing/i }));

    // Inhale countdown (4, 3, 2, 1, 0)
    for (let s = 4; s >= 0; s--) {
      expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Inhale (4s)');
      expect(screen.getByTestId('pacer-countdown')).toHaveTextContent(`${s}s`);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    // Now transitioned to Hold (7s) starting at 7s
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Hold (7s)');
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('7s');

    // Hold countdown (7, 6, 5, 4, 3, 2, 1, 0)
    for (let s = 7; s >= 0; s--) {
      expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Hold (7s)');
      expect(screen.getByTestId('pacer-countdown')).toHaveTextContent(`${s}s`);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    // Now transitioned to Exhale (8s) starting at 8s
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Exhale (8s)');
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('8s');

    // Exhale countdown (8, 7, 6, 5, 4, 3, 2, 1, 0)
    for (let s = 8; s >= 0; s--) {
      expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Exhale (8s)');
      expect(screen.getByTestId('pacer-countdown')).toHaveTextContent(`${s}s`);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    // Automatically transitions back to Inhale (4s)
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Inhale (4s)');
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('4s');
  });

  it('handles Pause and Resume accurately without resetting or skipping seconds', () => {
    render(<BreathingPacer />);
    fireEvent.click(screen.getByRole('button', { name: /start 4-7-8 breathing/i }));

    // Advance 2 seconds (4s -> 3s -> 2s)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('2s');

    // Click Pause
    const pauseBtn = screen.getByRole('button', { name: /pause breathing pacer/i });
    fireEvent.click(pauseBtn);

    // Verify UI reflects paused state
    expect(screen.getByTestId('pacer-status')).toHaveTextContent('Paused');
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('2s');
    expect(screen.getByRole('button', { name: /resume breathing pacer/i })).toBeInTheDocument();

    // Advance time by 5 seconds while paused; countdown must stay frozen
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('2s');
    expect(screen.getByTestId('pacer-status')).toHaveTextContent('Paused');

    // Click Resume
    const resumeBtn = screen.getByRole('button', { name: /resume breathing pacer/i });
    fireEvent.click(resumeBtn);

    expect(screen.getByTestId('pacer-status')).toHaveTextContent('Cycle Active');
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('2s');

    // Advance 1 second after resume -> 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('1s');
  });

  it('handles Stop & Reset from active and paused states cleanly', () => {
    render(<BreathingPacer />);
    fireEvent.click(screen.getByRole('button', { name: /start 4-7-8 breathing/i }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('3s');

    // Click Stop & Reset
    const stopBtn = screen.getByRole('button', { name: /stop breathing pacer/i });
    fireEvent.click(stopBtn);

    // State reset
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Ready');
    expect(screen.getByTestId('pacer-countdown-ready')).toHaveTextContent('4-7-8');
    expect(screen.getByTestId('pacer-status')).toHaveTextContent('Press Start');
    expect(screen.getByRole('button', { name: /start 4-7-8 breathing/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop breathing pacer/i })).not.toBeInTheDocument();

    // Advancing timers should not do anything
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('pacer-phase')).toHaveTextContent('Ready');
  });

  it('prevents timer glitches and duplicate intervals during rapid pause/resume toggling', () => {
    render(<BreathingPacer />);
    const toggleBtn = screen.getByRole('button', { name: /start 4-7-8 breathing/i });
    fireEvent.click(toggleBtn);

    // Toggle pause and resume multiple times rapidly
    fireEvent.click(screen.getByRole('button', { name: /pause breathing pacer/i }));
    fireEvent.click(screen.getByRole('button', { name: /resume breathing pacer/i }));
    fireEvent.click(screen.getByRole('button', { name: /pause breathing pacer/i }));
    fireEvent.click(screen.getByRole('button', { name: /resume breathing pacer/i }));

    // Now advance 1 second - it should decrease by exactly 1, not multiple
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('3s');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('pacer-countdown')).toHaveTextContent('2s');
  });
});
