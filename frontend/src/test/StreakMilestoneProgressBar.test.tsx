import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import {
  StreakMilestoneProgressBar,
  DEFAULT_STREAK_MILESTONES,
} from "../components/dashboard/StreakMilestoneProgressBar";

describe("StreakMilestoneProgressBar Component Suite (#2819)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders streak milestone progress widget with accessible progressbar", () => {
    render(
      <StreakMilestoneProgressBar currentStreak={5} longestStreak={10} />,
    );

    const widget = screen.getByTestId("streak-milestone-progress-widget");
    expect(widget).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "5");
    expect(progressbar).toHaveAttribute("aria-valuemax", "30");
    expect(progressbar).toHaveAttribute(
      "aria-label",
      "Streak milestone progress: 5 of 30 days",
    );
  });

  it("displays next milestone requirements and days remaining correctly", () => {
    render(
      <StreakMilestoneProgressBar currentStreak={5} longestStreak={10} />,
    );

    // Next milestone is 7 days (1-Week Streak) -> 2 days remaining
    expect(
      screen.getByText(/2 more days to unlock 1-Week Streak/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Current: 5 Days")).toBeInTheDocument();
    expect(screen.getByText("Best: 10 Days")).toBeInTheDocument();
  });

  it("indicates single day remaining grammar properly", () => {
    render(
      <StreakMilestoneProgressBar currentStreak={6} longestStreak={10} />,
    );

    expect(
      screen.getByText(/1 more day to unlock 1-Week Streak/i),
    ).toBeInTheDocument();
  });

  it("displays completion state when all milestones are surpassed", () => {
    render(
      <StreakMilestoneProgressBar currentStreak={35} longestStreak={40} />,
    );

    expect(
      screen.getByText(/Max Milestone Achieved! You're earning 2.0x XP!/i),
    ).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "35");
  });

  it("renders milestone checkpoints with unlocked indicators", () => {
    render(
      <StreakMilestoneProgressBar currentStreak={10} longestStreak={12} />,
    );

    // 3d and 7d should be unlocked
    const step3 = screen.getByTestId("milestone-step-3");
    expect(step3).toBeInTheDocument();
    expect(step3).toHaveTextContent("1.1x");

    const step7 = screen.getByTestId("milestone-step-7");
    expect(step7).toBeInTheDocument();
    expect(step7).toHaveTextContent("1.25x");

    // 14d should not be unlocked yet
    const step14 = screen.getByTestId("milestone-step-14");
    expect(step14).toBeInTheDocument();
    expect(step14).toHaveTextContent("14d");
  });

  it("triggers onMilestoneClick callback when clicking a milestone pin button", () => {
    const handleMilestoneClick = vi.fn();
    render(
      <StreakMilestoneProgressBar
        currentStreak={10}
        onMilestoneClick={handleMilestoneClick}
      />,
    );

    const step3Btn = screen.getByRole("button", {
      name: /3-Day Sprint \(3 days, 1.1x XP boost\) - Unlocked/i,
    });
    expect(step3Btn).toBeInTheDocument();
    fireEvent.click(step3Btn);

    expect(handleMilestoneClick).toHaveBeenCalledTimes(1);
    expect(handleMilestoneClick).toHaveBeenCalledWith(
      expect.objectContaining({ days: 3, multiplier: 1.1 }),
    );
  });

  it("handles custom milestone configurations gracefully", () => {
    const customMilestones = [
      { days: 5, multiplier: 1.2, label: "5-Day Tier" },
      { days: 20, multiplier: 1.8, label: "20-Day Tier" },
    ];

    render(
      <StreakMilestoneProgressBar
        currentStreak={4}
        milestones={customMilestones}
      />,
    );

    expect(
      screen.getByText(/1 more day to unlock 5-Day Tier/i),
    ).toBeInTheDocument();

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuemax", "20");
  });

  it("renders with zero streak count and missing longest streak baseline", () => {
    render(<StreakMilestoneProgressBar currentStreak={0} />);

    expect(screen.getByText("Current: 0 Days")).toBeInTheDocument();
    expect(
      screen.getByText(/3 more days to unlock 3-Day Sprint/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Best:/i)).toBeNull();
  });

  it("applies optional className prop to container wrapper", () => {
    render(
      <StreakMilestoneProgressBar
        currentStreak={3}
        className="custom-dashboard-class"
      />,
    );

    const widget = screen.getByTestId("streak-milestone-progress-widget");
    expect(widget).toHaveClass("custom-dashboard-class");
  });

  it("calculates exact progressbar width percentages accurately", () => {
    const { rerender } = render(
      <StreakMilestoneProgressBar currentStreak={15} />,
    );

    // 15 / 30 = 50%
    const progressbar = screen.getByRole("progressbar");
    const barFill = progressbar.firstElementChild as HTMLElement;
    expect(barFill).toHaveStyle({ width: "50%" });

    // 30 / 30 = 100%
    rerender(<StreakMilestoneProgressBar currentStreak={30} />);
    expect(barFill).toHaveStyle({ width: "100%" });
  });
});
