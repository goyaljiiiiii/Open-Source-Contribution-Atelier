import React from "react";
import { Flame, Trophy, Award, CheckCircle2, Milestone } from "lucide-react";

export interface StreakMilestone {
  days: number;
  multiplier: number;
  label: string;
}

export const DEFAULT_STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, multiplier: 1.1, label: "3-Day Sprint" },
  { days: 7, multiplier: 1.25, label: "1-Week Streak" },
  { days: 14, multiplier: 1.5, label: "2-Week Master" },
  { days: 30, multiplier: 2.0, label: "1-Month Legend" },
];

export interface StreakMilestoneProgressBarProps {
  currentStreak: number;
  longestStreak?: number;
  milestones?: StreakMilestone[];
  className?: string;
  onMilestoneClick?: (milestone: StreakMilestone) => void;
}

export const StreakMilestoneProgressBar: React.FC<StreakMilestoneProgressBarProps> = ({
  currentStreak,
  longestStreak = 0,
  milestones = DEFAULT_STREAK_MILESTONES,
  className = "",
  onMilestoneClick,
}) => {
  const maxDays = milestones[milestones.length - 1]?.days || 30;
  const progressPercent = Math.min(100, Math.round((currentStreak / maxDays) * 100));

  const nextMilestone = milestones.find((m) => m.days > currentStreak);
  const daysToNext = nextMilestone ? nextMilestone.days - currentStreak : 0;

  return (
    <div
      data-testid="streak-milestone-progress-widget"
      className={`rounded-2xl border-4 border-black bg-white dark:bg-[#1f1c18] dark:border-[#2e2924] p-6 shadow-card ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 dark:bg-orange-950/40 rounded-xl border-2 border-black">
            <Flame className="w-6 h-6 text-orange-500 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black dark:text-[#f0ebe2] flex items-center gap-2">
              Streak Milestone Track
            </h3>
            <p className="text-xs font-bold text-gray-500 dark:text-[#c4bbae]">
              {nextMilestone
                ? `${daysToNext} more ${daysToNext === 1 ? "day" : "days"} to unlock ${nextMilestone.label} (${nextMilestone.multiplier}x XP boost)`
                : "Max Milestone Achieved! You're earning 2.0x XP!"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 border-2 border-black rounded-full text-xs font-black text-amber-900 dark:text-amber-300">
            Current: {currentStreak} Days
          </span>
          {longestStreak > 0 && (
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 border-2 border-black rounded-full text-xs font-black text-slate-700 dark:text-slate-300">
              Best: {longestStreak} Days
            </span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative mt-6 mb-8">
        <div
          role="progressbar"
          aria-valuenow={currentStreak}
          aria-valuemin={0}
          aria-valuemax={maxDays}
          aria-label={`Streak milestone progress: ${currentStreak} of ${maxDays} days`}
          className="h-4 w-full bg-gray-100 dark:bg-slate-800 border-2 border-black rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 border-r-2 border-black transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Milestone Pin Indicators */}
        <div className="relative w-full flex justify-between mt-3 px-1">
          {milestones.map((milestone) => {
            const isUnlocked = currentStreak >= milestone.days;
            return (
              <div
                key={milestone.days}
                data-testid={`milestone-step-${milestone.days}`}
                className="flex flex-col items-center"
              >
                <button
                  type="button"
                  onClick={() => onMilestoneClick && onMilestoneClick(milestone)}
                  aria-label={`${milestone.label} (${milestone.days} days, ${milestone.multiplier}x XP boost) - ${
                    isUnlocked ? "Unlocked" : "Locked"
                  }`}
                  className={`w-7 h-7 rounded-full border-2 border-black flex items-center justify-center text-xs font-black transition-transform hover:scale-110 ${
                    isUnlocked
                      ? "bg-green-400 text-black shadow-card-sm"
                      : "bg-white dark:bg-slate-700 text-gray-400 dark:text-slate-400"
                  }`}
                >
                  {isUnlocked ? (
                    <CheckCircle2 size={16} className="stroke-[3]" />
                  ) : (
                    <span>{milestone.days}d</span>
                  )}
                </button>
                <span
                  className={`text-[11px] font-black mt-1 ${
                    isUnlocked
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500 dark:text-slate-400"
                  }`}
                >
                  {milestone.multiplier}x
                </span>
                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 hidden sm:inline-block">
                  {milestone.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
