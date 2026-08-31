/* eslint-disable react-refresh/only-export-components */
import React, { useId } from "react";
import "./streakFlameBadge.css";

interface StreakTier {
  label: "Bronze" | "Silver" | "Gold" | "Diamond";
  min: number;
  max: number;
  flame: string;
  deep: string;
  accent: string;
  glow: string;
}

export const STREAK_TIERS: StreakTier[] = [
  {
    label: "Bronze",
    min: 0,
    max: 6,
    flame: "#b08d57",
    deep: "#7a5c33",
    accent: "#f0d9b5",
    glow: "rgba(176, 141, 87, 0.55)",
  },
  {
    label: "Silver",
    min: 7,
    max: 29,
    flame: "#c6ced8",
    deep: "#7f8a97",
    accent: "#eef2f6",
    glow: "rgba(198, 206, 216, 0.55)",
  },
  {
    label: "Gold",
    min: 30,
    max: 99,
    flame: "#ffb020",
    deep: "#b97a00",
    accent: "#ffe9a3",
    glow: "rgba(255, 176, 32, 0.55)",
  },
  {
    label: "Diamond",
    min: 100,
    max: Number.POSITIVE_INFINITY,
    flame: "#57b7ff",
    deep: "#1f6fdd",
    accent: "#d9f0ff",
    glow: "rgba(87, 183, 255, 0.55)",
  },
];

export function getStreakTier(streakDays: number): StreakTier {
  return (
    STREAK_TIERS.find(
      (tier) => streakDays >= tier.min && streakDays <= tier.max,
    ) ?? STREAK_TIERS[0]
  );
}

export function getStreakMilestoneText(
  streakDays: number,
  longestStreak?: number,
): string {
  const tier = getStreakTier(streakDays);
  const tierIndex = STREAK_TIERS.indexOf(tier);
  const nextTier = STREAK_TIERS[tierIndex + 1];
  const nextMilestone = nextTier
    ? `${nextTier.min - streakDays} day${
        nextTier.min - streakDays === 1 ? "" : "s"
      } to ${nextTier.label}`
    : "Highest tier reached";
  const best =
    longestStreak && longestStreak > streakDays
      ? ` · Best ${longestStreak} days`
      : "";
  return `${tier.label} · ${streakDays}-day streak · ${nextMilestone}${best}`;
}

interface StreakFlameBadgeProps {
  streakDays: number;
  longestStreak?: number;
  /** Rendered width/height in px. Defaults to 40. */
  size?: number;
  className?: string;
}

export function StreakFlameBadge({
  streakDays,
  longestStreak,
  size = 40,
  className = "",
}: StreakFlameBadgeProps) {
  const tier = getStreakTier(streakDays);
  const gradientId = useId();
  const highlightId = useId();
  const milestoneText = getStreakMilestoneText(streakDays, longestStreak);
  const dimensionStyle = { width: size, height: size };

  return (
    <div
      data-testid="streak-flame-badge"
      data-tier={tier.label}
      data-streak={streakDays}
      role="img"
      aria-label={milestoneText}
      tabIndex={0}
      className={[
        "sfb group relative inline-flex cursor-help items-center justify-center",
        className,
      ].join(" ")}
      style={dimensionStyle}
    >
      <div className={`sfb-glow sfb-glow--${tier.label.toLowerCase()}`} />

      <svg
        viewBox="0 0 64 64"
        className="sfb-flame"
        style={{ ...dimensionStyle }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tier.flame} stopOpacity="1" />
            <stop offset="55%" stopColor={tier.flame} stopOpacity="0.9" />
            <stop offset="100%" stopColor={tier.deep} stopOpacity="1" />
          </linearGradient>
          <linearGradient id={highlightId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tier.accent} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M32 6c1.6 10.3-4.2 14.8-8.2 19.6C19.7 31.4 19 37.2 21.2 42.4c2.2 5.2 7.2 10.6 10.8 15.6 0.7 1 1.4 1 2.1 0 3.6-5 8.6-10.4 10.8-15.6 2.2-5.2 1.5-11-2.6-16.8C36.2 20.8 30.4 16.3 32 6z"
          fill={`url(#${gradientId})`}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        <path
          d="M32.2 12.5c1.1 7.4-3.3 10.8-6.3 14.5-3.1 3.8-3.6 8.2-1.9 12.1 1.7 3.9 5.4 7.8 8.2 11.9 0.4 0.6 0.9 0.6 1.3 0 2.8-4.1 6.5-8 8.2-11.9 1.7-3.9 1.2-8.3-1.9-12.1-3-3.7-7.4-7.1-6.6-14.5z"
          fill={`url(#${highlightId})`}
          opacity="0.75"
        />
      </svg>

      <div
        role="tooltip"
        className="sfb-tooltip absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border-2 border-black bg-white px-3 py-1.5 text-xs font-black text-black opacity-0 shadow-card-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-[#3a3a45] dark:bg-[#1c1c24] dark:text-white"
      >
        {milestoneText}
      </div>
    </div>
  );
}

export default StreakFlameBadge;
