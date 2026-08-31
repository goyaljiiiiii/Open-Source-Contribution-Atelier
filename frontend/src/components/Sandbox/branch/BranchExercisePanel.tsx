import React from "react";
import {
  CheckCircle2,
  Circle,
  Trophy,
  Lightbulb,
  Target,
} from "lucide-react";
import type { BranchExercise } from "./types";

interface BranchExercisePanelProps {
  exercises: BranchExercise[];
  currentExerciseIdx: number;
  onSelectExercise: (idx: number) => void;
  totalXP: number;
}

const CATEGORY_META: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  branch: {
    label: "Branching",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-950/30",
    borderColor: "border-blue-300 dark:border-blue-800",
  },
  merge: {
    label: "Merging",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-950/30",
    borderColor: "border-green-300 dark:border-green-800",
  },
  rebase: {
    label: "Rebasing",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-950/30",
    borderColor: "border-purple-300 dark:border-purple-800",
  },
  "cherry-pick": {
    label: "Cherry-Pick",
    color: "text-pink-700 dark:text-pink-300",
    bgColor: "bg-pink-100 dark:bg-pink-950/30",
    borderColor: "border-pink-300 dark:border-pink-800",
  },
  stash: {
    label: "Stashing",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-100 dark:bg-amber-950/30",
    borderColor: "border-amber-300 dark:border-amber-800",
  },
};

export function BranchExercisePanel({
  exercises,
  currentExerciseIdx,
  onSelectExercise,
  totalXP,
}: BranchExercisePanelProps) {
  const completedCount = exercises.filter((e) => e.completed).length;
  const progress = (completedCount / exercises.length) * 100;

  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
            Exercises
          </span>
          <span className="text-[10px] font-mono font-black bg-primary text-black px-2 py-0.5 rounded-full">
            {completedCount}/{exercises.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-950/20 px-2.5 py-1 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
          <Trophy className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
          <span className="font-black text-xs text-yellow-700 dark:text-yellow-300">
            {totalXP} XP
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3">
        <div className="h-2 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Exercise list */}
      <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
        {exercises.map((exercise, idx) => {
          const isActive = idx === currentExerciseIdx;
          const meta = CATEGORY_META[exercise.category];
          return (
            <button
              key={exercise.id}
              onClick={() => onSelectExercise(idx)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                isActive
                  ? "border-primary bg-primary/10 shadow-card-sm"
                  : exercise.completed
                    ? "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10"
                    : "border-transparent hover:border-black/10 dark:hover:border-[#2e2924]/50 hover:bg-white/50 dark:hover:bg-[#1f1c18]/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  {exercise.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle
                      className={`w-4 h-4 ${
                        isActive
                          ? "text-primary"
                          : "text-[#9b8f80] dark:text-[#4a4540]"
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black text-xs ${
                        isActive
                          ? "text-text dark:text-[#f0ebe2]"
                          : exercise.completed
                            ? "text-green-700 dark:text-green-400 line-through"
                            : "text-muted dark:text-[#c4bbae]"
                      }`}
                    >
                      {exercise.title}
                    </span>
                    <span
                      className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {isActive && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-bold text-muted dark:text-[#9b8f80]">
                        {exercise.description}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Lightbulb className="w-3 h-3 text-yellow-500" />
                        <code className="text-[10px] font-mono font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 px-1.5 py-0.5 rounded">
                          {exercise.hint}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono font-black text-primary flex-shrink-0">
                  +{exercise.xp}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
