import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";

export interface IncompleteLesson {
  id?: number;
  lesson_slug: string;
  lesson_title: string;
  summary?: string;
  progress_percentage: number;
  score?: number;
  updated_at?: string;
}

export interface ContinueLearningProps {
  lessons?: IncompleteLesson[];
  isLoading?: boolean;
  lastLesson?: {
    slug: string;
    title: string;
    progress: number;
  } | null;
}

export function ContinueLearning({ lessons = [], isLoading = false, lastLesson }: ContinueLearningProps) {
  // Support legacy single-item prop if passed
  const displayLessons: IncompleteLesson[] = lessons.length > 0 
    ? lessons 
    : lastLesson 
      ? [{ lesson_slug: lastLesson.slug, lesson_title: lastLesson.title, progress_percentage: lastLesson.progress }]
      : [];

  if (isLoading) {
    return (
      <div className="continue-learning-section mb-8 rounded-xl border border-slate-700/50 bg-slate-900/60 p-6 backdrop-blur-md">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-slate-800" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-slate-800/50 p-4" />
          ))}
        </div>
      </div>
    );
  }

  if (displayLessons.length === 0) {
    return null;
  }

  return (
    <section className="continue-learning-section mb-8 rounded-xl border border-indigo-500/20 bg-slate-900/80 p-6 shadow-lg shadow-indigo-500/5 backdrop-blur-md" data-testid="continue-learning">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Continue Learning</h2>
            <p className="text-xs text-slate-400">Pick up right where you left off</p>
          </div>
        </div>
        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
          {displayLessons.length} {displayLessons.length === 1 ? "lesson" : "lessons"} in progress
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {displayLessons.slice(0, 3).map((item) => (
          <div
            key={item.lesson_slug}
            className="group relative flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-800/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:bg-slate-800/80 hover:shadow-md hover:shadow-indigo-500/10"
            data-testid={`continue-card-${item.lesson_slug}`}
          >
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate text-sm font-semibold text-slate-200 group-hover:text-indigo-300">
                  {item.lesson_title}
                </span>
                <span className="ml-2 text-xs font-bold text-indigo-400">
                  {item.progress_percentage}%
                </span>
              </div>
              {item.summary && (
                <p className="mb-4 line-clamp-2 text-xs text-slate-400">
                  {item.summary}
                </p>
              )}
            </div>

            <div>
              {/* Progress bar */}
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${Math.max(5, Math.min(100, item.progress_percentage))}%` }}
                />
              </div>

              <Link
                to={`/lessons/${item.lesson_slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600/20 px-3 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-600 hover:text-white"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
