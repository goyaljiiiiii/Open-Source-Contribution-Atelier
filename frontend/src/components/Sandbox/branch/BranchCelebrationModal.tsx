import React from "react";
import { PartyPopper, X, Star, Trophy, Award } from "lucide-react";

interface BranchCelebrationModalProps {
  show: boolean;
  totalXP: number;
  onClose: () => void;
}

export function BranchCelebrationModal({
  show,
  totalXP,
  onClose,
}: BranchCelebrationModalProps) {
  if (!show) return null;

  const badges = [
    {
      icon: Star,
      label: "Branch Master",
      desc: "Created multiple feature branches",
      color: "text-blue-500",
    },
    {
      icon: Trophy,
      label: "Merge Expert",
      desc: "Successfully merged feature branches",
      color: "text-green-500",
    },
    {
      icon: Award,
      label: "Rebase Pro",
      desc: "Rebased a branch onto main",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-[#1f1c18] border-4 border-black dark:border-[#2e2924] rounded-2xl p-8 max-w-md w-full mx-4 shadow-[8px_8px_0px_#000] dark:shadow-[8px_8px_0px_#2e2924] animate-bounce">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5 text-muted" />
        </button>

        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-yellow-400 p-4 rounded-2xl border-4 border-black shadow-card-sm animate-pulse">
              <PartyPopper className="w-10 h-10 text-black" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-text dark:text-[#f0ebe2]">
            🎉 Workflow Complete!
          </h2>
          <p className="text-sm font-bold text-muted dark:text-[#c4bbae]">
            You&apos;ve mastered the Git branch workflow!
          </p>

          <div className="bg-primary/20 border-2 border-primary rounded-xl py-3 px-4">
            <span className="text-3xl font-black text-primary">{totalXP}</span>
            <span className="text-sm font-black text-primary ml-2">
              Total XP Earned
            </span>
          </div>

          {/* Badges earned */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-black uppercase text-muted tracking-wider">
              Badges Unlocked
            </p>
            {badges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-3 bg-surface-low dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-xl px-3 py-2"
              >
                <badge.icon className={`w-5 h-5 ${badge.color}`} />
                <div className="text-left">
                  <div className="text-xs font-black text-text dark:text-[#f0ebe2]">
                    {badge.label}
                  </div>
                  <div className="text-[10px] font-bold text-muted dark:text-[#9b8f80]">
                    {badge.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full px-6 py-3 bg-primary text-black font-black text-sm rounded-xl border-4 border-black shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            Continue Learning
          </button>
        </div>
      </div>
    </div>
  );
}
