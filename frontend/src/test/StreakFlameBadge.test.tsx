import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import {
  StreakFlameBadge,
  getStreakTier,
  getStreakMilestoneText,
} from "../components/ui/StreakFlameBadge";

describe("StreakFlameBadge tier logic", () => {
  afterEach(() => {
    cleanup();
  });

  it("maps streak lengths to the correct tier", () => {
    expect(getStreakTier(0).label).toBe("Bronze");
    expect(getStreakTier(6).label).toBe("Bronze");
    expect(getStreakTier(7).label).toBe("Silver");
    expect(getStreakTier(29).label).toBe("Silver");
    expect(getStreakTier(30).label).toBe("Gold");
    expect(getStreakTier(99).label).toBe("Gold");
    expect(getStreakTier(100).label).toBe("Diamond");
  });

  it("builds milestone text with next tier info", () => {
    expect(getStreakMilestoneText(5)).toContain("Bronze · 5-day streak");
    expect(getStreakMilestoneText(5)).toContain("2 days to Silver");
    expect(getStreakMilestoneText(7)).toContain("23 days to Gold");
    expect(getStreakMilestoneText(55)).toContain("45 days to Diamond");
    expect(getStreakMilestoneText(120)).toContain("Highest tier reached");
  });

  it("includes longest streak when greater than current streak", () => {
    expect(getStreakMilestoneText(5, 12)).toContain("Best 12 days");
  });
});

describe("StreakFlameBadge rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the flame with tier metadata and milestone tooltip", () => {
    render(<StreakFlameBadge streakDays={12} longestStreak={40} />);

    const badge = screen.getByTestId("streak-flame-badge");
    expect(badge).toHaveAttribute("data-tier", "Silver");
    expect(badge).toHaveAttribute("data-streak", "12");
    expect(badge.getAttribute("aria-label")).toMatch(/Silver · 12-day streak/);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Silver · 12-day");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Best 40 days");
  });

  it("applies the tier glow style class", () => {
    render(<StreakFlameBadge streakDays={100} />);
    expect(screen.getByTestId("streak-flame-badge")).toHaveAttribute(
      "data-tier",
      "Diamond",
    );
    const glow = screen
      .getByTestId("streak-flame-badge")
      .querySelector(".sfb-glow");
    expect(glow?.className).toContain("sfb-glow--diamond");
  });
});
