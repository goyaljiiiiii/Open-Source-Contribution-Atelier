import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChallengeTimer } from "../components/ui/ChallengeTimer";

describe("ChallengeTimer onExpire idempotency and stability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("formats countdown correctly", () => {
    render(<ChallengeTimer initialSeconds={125} />);
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("fires onExpire exactly once when timer expires", () => {
    const handleExpire = vi.fn();
    render(<ChallengeTimer initialSeconds={2} onExpire={handleExpire} />);

    expect(handleExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleExpire).not.toHaveBeenCalled();
    expect(screen.getByText("0:01")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleExpire).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Time expired!")).toBeInTheDocument();

    // Advance further time
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(handleExpire).toHaveBeenCalledTimes(1);
  });

  it("does not fire onExpire repeatedly when parent passes a new inline callback on re-render", () => {
    const handleExpire1 = vi.fn();
    const { rerender } = render(<ChallengeTimer initialSeconds={1} onExpire={() => handleExpire1()} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleExpire1).toHaveBeenCalledTimes(1);

    // Parent re-renders with a brand new inline arrow function
    const handleExpire2 = vi.fn();
    rerender(<ChallengeTimer initialSeconds={1} onExpire={() => handleExpire2()} />);

    // Fast-forward or trigger more renders
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Neither the old nor the new callback should be called again for the already-expired timer
    expect(handleExpire1).toHaveBeenCalledTimes(1);
    expect(handleExpire2).not.toHaveBeenCalled();
  });

  it("resets countdown and re-arms when initialSeconds prop changes", () => {
    const handleExpire = vi.fn();
    const { rerender } = render(<ChallengeTimer initialSeconds={1} onExpire={handleExpire} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(handleExpire).toHaveBeenCalledTimes(1);

    // Reset with new initialSeconds
    rerender(<ChallengeTimer initialSeconds={3} onExpire={handleExpire} />);
    expect(screen.getByText("0:03")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(handleExpire).toHaveBeenCalledTimes(2);
  });
});
