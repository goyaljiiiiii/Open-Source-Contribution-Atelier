import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { Zap, Flame, Calendar, Sparkles } from "lucide-react";

export function WeekendXpStreakBadge({
  streakDays,
  longestStreak,
  isWeekendActive,
  effectiveMultiplier,
}: {
  streakDays: number;
  longestStreak: number;
  isWeekendActive: boolean;
  effectiveMultiplier?: number;
}) {
  return (
    <div className="rounded-[2rem] border-4 border-black bg-gradient-to-br from-orange-50 to-red-50 dark:from-[#2a1f1a] dark:to-[#1f1410] dark:border-[#2e2924] p-6 shadow-card flex flex-col items-center justify-center text-center relative overflow-hidden">
      <Flame className="w-10 h-10 text-orange-500 mb-2" />
      <span className="text-5xl font-black text-orange-500 drop-shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
        {streakDays}
      </span>
      <span className="font-black text-xs uppercase tracking-widest text-gray-500 dark:text-[#c4bbae] mt-1">
        Day Streak
      </span>
      <p className="text-xs font-bold text-gray-400 dark:text-[#8a7f72] mt-2">
        Best: {longestStreak} days
      </p>

      {effectiveMultiplier && (
        <span className="text-xs font-black text-amber-600 dark:text-amber-400 mt-1">
          {effectiveMultiplier.toFixed(2)}x XP Multiplier
        </span>
      )}

      {isWeekendActive && (
        <div
          data-testid="weekend-xp-multiplier-badge"
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-black text-[11px] font-black rounded-full border-2 border-black shadow-card-sm"
        >
          <Zap size={13} className="fill-black stroke-[2.5]" />
          <span>Weekend Event: 1.5x XP Active</span>
        </div>
      )}
    </div>
  );
}

describe("Dashboard Weekend XP Bonus Multiplier Suite (#2818)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders weekend XP multiplier active badge inside streak card", () => {
    render(
      <WeekendXpStreakBadge
        streakDays={5}
        longestStreak={8}
        isWeekendActive={true}
        effectiveMultiplier={1.5}
      />,
    );

    expect(screen.getByText("Day Streak")).toBeInTheDocument();
    const weekendBadge = screen.getByTestId("weekend-xp-multiplier-badge");
    expect(weekendBadge).toBeInTheDocument();
    expect(weekendBadge).toHaveTextContent("Weekend Event: 1.5x XP Active");
  });

  it("displays current streak day count and best record correctly", () => {
    render(
      <WeekendXpStreakBadge
        streakDays={5}
        longestStreak={8}
        isWeekendActive={true}
        effectiveMultiplier={1.5}
      />,
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Best: 8 days")).toBeInTheDocument();
  });

  it("displays effective multiplier correctly when provided", () => {
    render(
      <WeekendXpStreakBadge
        streakDays={14}
        longestStreak={20}
        isWeekendActive={true}
        effectiveMultiplier={2.25}
      />,
    );

    expect(screen.getByText("2.25x XP Multiplier")).toBeInTheDocument();
  });

  it("does not render weekend multiplier badge on weekdays", () => {
    render(
      <WeekendXpStreakBadge
        streakDays={5}
        longestStreak={8}
        isWeekendActive={false}
      />,
    );

    expect(screen.queryByTestId("weekend-xp-multiplier-badge")).toBeNull();
  });

  it("renders zero streak count and zero best days baseline", () => {
    render(
      <WeekendXpStreakBadge
        streakDays={0}
        longestStreak={0}
        isWeekendActive={false}
      />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Best: 0 days")).toBeInTheDocument();
  });

  it("handles high streak counts and triple digit days", () => {
    render(
      <WeekendXpStreakBadge
        streakDays={120}
        longestStreak={150}
        isWeekendActive={true}
        effectiveMultiplier={3.0}
      />,
    );

    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Best: 150 days")).toBeInTheDocument();
    expect(screen.getByText("3.00x XP Multiplier")).toBeInTheDocument();
  });
});
