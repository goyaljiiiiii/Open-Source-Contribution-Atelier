import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { fetchApi } from "../../lib/api";
import { FOCUS_RING } from "../../lib/a11yFocus";
import type { WeeklyGoalData } from "./types";

export function WeeklyGoalTracker() {
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: goalData, isLoading, error } = useQuery<WeeklyGoalData>({
    queryKey: ["weeklyGoal"],
    queryFn: () => fetchApi("/progress/weekly-goal/"),
  });

  const updateGoalMutation = useMutation({
    mutationFn: (newTargets: {
      target_lessons: number;
      target_xp: number;
      target_minutes: number;
    }) =>
      fetchApi("/progress/weekly-goal/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTargets),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weeklyGoal"] });
      setIsEditOpen(false);
    },
  });

  const [formValues, setFormValues] = useState({
    target_lessons: 5,
    target_xp: 500,
    target_minutes: 120,
  });

  const handleOpenEdit = () => {
    if (goalData) {
      setFormValues({
        target_lessons: goalData.target_lessons,
        target_xp: goalData.target_xp,
        target_minutes: goalData.target_minutes,
      });
    }
    setIsEditOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateGoalMutation.mutate(formValues);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm animate-pulse space-y-4">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          <div className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          <div className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !goalData) {
    return null;
  }

  const {
    target_lessons,
    target_xp,
    target_minutes,
    completed_lessons,
    earned_xp,
    minutes_spent,
    lessons_progress_pct,
    xp_progress_pct,
    minutes_progress_pct,
    overall_progress_pct,
    daily_breakdown,
  } = goalData;

  const isCompleted = overall_progress_pct >= 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Weekly Learning Goal
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" /> Goal Reached!
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-5-00 dark:text-slate-400">
              Track your weekly targets and keep your momentum going
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenEdit}
          className={`flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${FOCUS_RING}`}
        >
          <Edit3 className="h-3.5 w-3.5" /> Edit Goal
        </button>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Overall Week Completion
          </span>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {overall_progress_pct}%
          </span>
        </div>
        <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isCompleted
                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
            }`}
            style={{ width: `${overall_progress_pct}%` }}
          />
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Lessons */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Lessons Completed
              </span>
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {completed_lessons} / {target_lessons}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${lessons_progress_pct}%` }}
            />
          </div>
        </div>

        {/* XP */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                XP Earned
              </span>
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {earned_xp} / {target_xp}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${xp_progress_pct}%` }}
            />
          </div>
        </div>

        {/* Minutes */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 transition-all hover:shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Time Spent
              </span>
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {minutes_spent}m / {target_minutes}m
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${minutes_progress_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Daily Activity Timeline (Mon - Sun) */}
      <div>
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
          This Week's Activity
        </h4>
        <div className="grid grid-cols-7 gap-2">
          {daily_breakdown.map((day) => (
            <div
              key={day.date}
              className={`flex flex-col items-center justify-center rounded-xl p-2.5 border transition-all ${
                day.is_today
                  ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40"
                  : day.is_active
                  ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/30"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20"
              }`}
            >
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {day.day_name}
              </span>
              {day.is_active ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    day.is_today
                      ? "border-indigo-500 bg-indigo-200 dark:bg-indigo-900"
                      : "border-slate-300 dark:border-slate-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-500" /> Adjust Weekly Goal
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Lessons (per week)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formValues.target_lessons}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      target_lessons: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target XP (per week)
                </label>
                <input
                  type="number"
                  min="50"
                  max="50000"
                  step="50"
                  value={formValues.target_xp}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      target_xp: Math.max(50, parseInt(e.target.value) || 50),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Learning Time (minutes per week)
                </label>
                <input
                  type="number"
                  min="15"
                  max="10080"
                  step="15"
                  value={formValues.target_minutes}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      target_minutes: Math.max(15, parseInt(e.target.value) || 15),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateGoalMutation.isPending}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 text-xs font-semibold shadow-sm transition-colors"
                >
                  {updateGoalMutation.isPending ? "Saving..." : "Save Goals"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
