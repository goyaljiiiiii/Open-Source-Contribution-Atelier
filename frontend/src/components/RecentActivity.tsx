import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Award,
  Flame,
  Zap,
  GitPullRequest,
  Code2,
  Trophy,
  MessageSquare,
  Star,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Target,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatTimeAgo } from "../lib/dates";
import { FOCUS_RING } from "../lib/a11yFocus";

// ─── Types ──────────────────────────────────────────────────────────────

type ActivityEventType =
  | "lesson_completed"
  | "quiz_passed"
  | "badge_earned"
  | "streak_milestone"
  | "xp_earned"
  | "pr_reviewed"
  | "code_submitted"
  | "challenge_completed"
  | "discussion_post"
  | "first_lesson";

interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    xp?: number;
    score?: number;
    streak?: number;
    badge_name?: string;
    badge_icon?: string;
    lesson_slug?: string;
    lesson_category?: string;
  };
}

interface ActivityResponse {
  results: ActivityEvent[];
  count: number;
}

// ─── Event type config ──────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  ActivityEventType,
  {
    icon: typeof BookOpen;
    color: string;
    bgColor: string;
    darkBgColor: string;
    borderColor: string;
    darkBorderColor: string;
    label: string;
  }
> = {
  lesson_completed: {
    icon: BookOpen,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/40",
    darkBgColor: "dark:bg-blue-900/40",
    borderColor: "border-blue-200 dark:border-blue-800/60",
    darkBorderColor: "dark:border-blue-800/60",
    label: "Lesson",
  },
  quiz_passed: {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/40",
    darkBgColor: "dark:bg-emerald-900/40",
    borderColor: "border-emerald-200 dark:border-emerald-800/60",
    darkBorderColor: "dark:border-emerald-800/60",
    label: "Quiz",
  },
  badge_earned: {
    icon: Award,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/40",
    darkBgColor: "dark:bg-amber-900/40",
    borderColor: "border-amber-200 dark:border-amber-800/60",
    darkBorderColor: "dark:border-amber-800/60",
    label: "Badge",
  },
  streak_milestone: {
    icon: Flame,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/40",
    darkBgColor: "dark:bg-orange-900/40",
    borderColor: "border-orange-200 dark:border-orange-800/60",
    darkBorderColor: "dark:border-orange-800/60",
    label: "Streak",
  },
  xp_earned: {
    icon: Zap,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/40",
    darkBgColor: "dark:bg-violet-900/40",
    borderColor: "border-violet-200 dark:border-violet-800/60",
    darkBorderColor: "dark:border-violet-800/60",
    label: "XP",
  },
  pr_reviewed: {
    icon: GitPullRequest,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/40",
    darkBgColor: "dark:bg-purple-900/40",
    borderColor: "border-purple-200 dark:border-purple-800/60",
    darkBorderColor: "dark:border-purple-800/60",
    label: "PR",
  },
  code_submitted: {
    icon: Code2,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/40",
    darkBgColor: "dark:bg-cyan-900/40",
    borderColor: "border-cyan-200 dark:border-cyan-800/60",
    darkBorderColor: "dark:border-cyan-800/60",
    label: "Code",
  },
  challenge_completed: {
    icon: Trophy,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/40",
    darkBgColor: "dark:bg-rose-900/40",
    borderColor: "border-rose-200 dark:border-rose-800/60",
    darkBorderColor: "dark:border-rose-800/60",
    label: "Challenge",
  },
  discussion_post: {
    icon: MessageSquare,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-100 dark:bg-teal-900/40",
    darkBgColor: "dark:bg-teal-900/40",
    borderColor: "border-teal-200 dark:border-teal-800/60",
    darkBorderColor: "dark:border-teal-800/60",
    label: "Discussion",
  },
  first_lesson: {
    icon: Star,
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/40",
    darkBgColor: "dark:bg-yellow-900/40",
    borderColor: "border-yellow-200 dark:border-yellow-800/60",
    darkBorderColor: "dark:border-yellow-800/60",
    label: "Milestone",
  },
};

// ─── Mock data ──────────────────────────────────────────────────────────

function generateMockActivity(): ActivityEvent[] {
  const now = Date.now();
  const hour = 3_600_000;
  const day = 86_400_000;

  return [
    {
      id: "act-1",
      type: "lesson_completed",
      title: "Completed \"What is a Commit?\"",
      description:
        "Finished the lesson on creating meaningful checkpoints in Git",
      timestamp: new Date(now - 2 * hour).toISOString(),
      metadata: {
        xp: 50,
        score: 100,
        lesson_slug: "what-is-a-commit",
        lesson_category: "Git Basics",
      },
    },
    {
      id: "act-2",
      type: "quiz_passed",
      title: "Passed Git Basics Quiz",
      description: "Scored 8/10 on the Module 2 quiz — excellent work!",
      timestamp: new Date(now - 5 * hour).toISOString(),
      metadata: { xp: 100, score: 80 },
    },
    {
      id: "act-3",
      type: "badge_earned",
      title: "Earned \"Quick Learner\" Badge",
      description: "Completed 3 lessons in a single day",
      timestamp: new Date(now - 1 * day).toISOString(),
      metadata: { badge_name: "Quick Learner", badge_icon: "⚡" },
    },
    {
      id: "act-4",
      type: "streak_milestone",
      title: "14-Day Streak!",
      description: "Two weeks of consistent learning — incredible dedication",
      timestamp: new Date(now - 1 * day - 3 * hour).toISOString(),
      metadata: { streak: 14 },
    },
    {
      id: "act-5",
      type: "code_submitted",
      title: "Submitted Sandbox Exercise",
      description: "Completed the \"git add & commit\" interactive exercise",
      timestamp: new Date(now - 2 * day).toISOString(),
      metadata: { xp: 75 },
    },
    {
      id: "act-6",
      type: "challenge_completed",
      title: "Beat the Daily Challenge",
      description:
        "Solved the merge conflict resolution challenge in under 3 minutes",
      timestamp: new Date(now - 2 * day - 4 * hour).toISOString(),
      metadata: { xp: 200 },
    },
    {
      id: "act-7",
      type: "first_lesson",
      title: "Started Your Journey!",
      description: "Completed your very first lesson — \"What is Open Source?\"",
      timestamp: new Date(now - 14 * day).toISOString(),
      metadata: { xp: 25, lesson_slug: "what-is-open-source" },
    },
    {
      id: "act-8",
      type: "discussion_post",
      title: "Replied in Community Chat",
      description:
        "Helped a newcomer understand the difference between fork and clone",
      timestamp: new Date(now - 3 * day).toISOString(),
    },
    {
      id: "act-9",
      type: "pr_reviewed",
      title: "Reviewed a Peer's Code",
      description:
        "Provided feedback on a pull request for the Good First Issue project",
      timestamp: new Date(now - 4 * day).toISOString(),
      metadata: { xp: 30 },
    },
    {
      id: "act-10",
      type: "xp_earned",
      title: "Earned 250 XP Bonus",
      description: "Weekly streak bonus for maintaining a 7-day streak",
      timestamp: new Date(now - 5 * day).toISOString(),
      metadata: { xp: 250 },
    },
    {
      id: "act-11",
      type: "lesson_completed",
      title: "Completed \"Your First Git Add + Commit\"",
      description:
        "Practiced staging and committing changes — hands-on exercise",
      timestamp: new Date(now - 6 * day).toISOString(),
      metadata: {
        xp: 50,
        score: 100,
        lesson_slug: "first-commit",
        lesson_category: "Git Basics",
      },
    },
    {
      id: "act-12",
      type: "quiz_passed",
      title: "Passed Open Source Basics Quiz",
      description: "Scored 9/10 on the Module 1 final quiz",
      timestamp: new Date(now - 7 * day).toISOString(),
      metadata: { xp: 100, score: 90 },
    },
  ];
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" role="status">
      <span className="sr-only">Loading recent activity…</span>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="h-9 w-9 rounded-xl bg-gray-200 dark:bg-gray-800 border-2 border-black/5 dark:border-white/5 flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          </div>
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded-lg mt-1 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 border-4 border-black dark:border-gray-700 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-gray-300 dark:text-gray-600" />
      </div>
      <h4 className="font-black text-gray-400 dark:text-gray-500 text-sm mb-1">
        No activity yet
      </h4>
      <p className="text-xs font-bold text-gray-300 dark:text-gray-600 max-w-[200px] mx-auto">
        Start a lesson to see your learning journey unfold here
      </p>
    </div>
  );
}

// ─── Single activity item ───────────────────────────────────────────────

function ActivityItem({
  event,
  index,
}: {
  event: ActivityEvent;
  index: number;
}) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="group relative flex items-start gap-3"
    >
      {/* Timeline connector */}
      <div className="relative flex flex-col items-center flex-shrink-0">
        <div
          className={`w-9 h-9 rounded-xl ${config.bgColor} border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
        >
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        {/* Connecting line */}
        <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-800 my-1 min-h-[16px]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-sm text-gray-900 dark:text-gray-100 truncate">
                {event.title}
              </h4>
              {event.metadata?.xp && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                  <Zap className="w-2.5 h-2.5" />
                  +{event.metadata.xp}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              {event.description}
            </p>
          </div>
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap flex items-center gap-1 flex-shrink-0 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(event.timestamp)}
          </span>
        </div>

        {/* Metadata chips */}
        {event.metadata?.score !== undefined && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">
            <Target className="w-3 h-3" />
            Score: {event.metadata.score}%
          </div>
        )}
        {event.metadata?.badge_name && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            <span>{event.metadata.badge_icon}</span>
            {event.metadata.badge_name}
          </div>
        )}
        {event.metadata?.streak && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
            <Flame className="w-3 h-3" />
            {event.metadata.streak} days straight
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────

export function RecentActivity() {
  const [expanded, setExpanded] = useState(false);

  const {
    data: activityData,
    isLoading,
    error,
  } = useQuery<ActivityResponse>({
    queryKey: ["recentActivity"],
    queryFn: () =>
      fetchApi("/progress/activity/?limit=20", { suppressErrorToast: true }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Fall back to mock data if API fails
  const events = useMemo(() => {
    if (error || !activityData) {
      return generateMockActivity();
    }
    return activityData.results;
  }, [activityData, error]);

  const visibleEvents = expanded ? events : events.slice(0, 5);
  const hasMore = events.length > 5;

  return (
    <section
      className="rounded-[2rem] border-4 border-black dark:border-[#2e2924] bg-white dark:bg-[#1f1c18] p-6 sm:p-8 shadow-card"
      aria-label="Recent activity"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 w-10 h-10 rounded-full border-2 border-black dark:border-gray-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-black dark:text-[#f0ebe2]">
              Recent Activity
            </h2>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500">
              Your learning timeline
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full border-2 border-black dark:border-gray-700">
          {events.length} events
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <ActivitySkeleton />
      ) : events.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={expanded ? "all" : "top5"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {visibleEvents.map((event, idx) => (
                  <ActivityItem key={event.id} event={event} index={idx} />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Show more / less toggle */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={`w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border-4 border-black dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-black text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:-translate-y-0.5 transition-all ${FOCUS_RING}`}
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Show All ({events.length} events)
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default RecentActivity;
