import { useUserProgress } from "../hooks/useUserProgress";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { lessons, Lesson } from "../lib/lessons";
import { Link } from "react-router-dom";
import SkeletonCard from "../components/ui/skeletons/SkeletonCard";

export function DashboardPage() {
  const { progress, totalXP, isLoading: isProgressLoading } = useUserProgress();
  
  const { data: challenges = [], isLoading: isChallengesLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: () => fetchApi("/challenges/"),
  });

  if (isProgressLoading || isChallengesLoading) {
    return (
      <div
        className="grid gap-6 xl:grid-cols-[1fr_0.8fr]"
        aria-busy="true"
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const completedCount = progress.filter(p => p.completed).length;
  const streakDays = completedCount; // Simplified logic
  
  // Find next lessons (not completed yet)
  const availableLessons = lessons.filter(l => 
    !progress.some(p => p.lesson_slug === l.slug && p.completed)
  ).slice(0, 3);

  return (
    <div className="space-y-10 pt-4">
      {/* Header */}
      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[2rem] border-4 border-black bg-tertiary p-8 sm:p-10 shadow-card relative overflow-hidden dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <div className="relative z-10">
            <span className="font-black text-sm bg-white text-black px-4 py-2 rounded-full border-2 border-black rotate-[-2deg] inline-block shadow-sm mb-4 dark:bg-[#151411] dark:text-[#f0ebe2] dark:border-[#2e2924]">
              LEVEL {completedCount + 1} CONTRIBUTOR 🚀
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-white drop-shadow-[3px_3px_0_#000] mb-4 dark:text-[#f0ebe2] dark:drop-shadow-none">
              Welcome back to the Command Line.
            </h1>
            <p className="text-xl font-bold text-black bg-white/90 p-4 rounded-xl border-4 border-black shadow-card-sm inline-block max-w-lg leading-relaxed dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none dark:text-[#f0ebe2]">
              You've earned {totalXP} XP so far. Keep pushing code!
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 text-[10rem] opacity-20 rotate-12 pointer-events-none">
            💻
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-center items-center hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <span className="text-5xl mb-2">🔥</span>
            <span className="text-4xl font-black text-primary drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{streakDays}</span>
            <span className="font-bold text-black uppercase tracking-widest text-xs mt-1 dark:text-[#c4bbae]">Commit Streak</span>
          </div>
          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-center items-center hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <span className="text-5xl mb-2">🎯</span>
            <span className="text-4xl font-black text-accent drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{totalXP}</span>
            <span className="font-bold text-black uppercase tracking-widest text-xs mt-1 dark:text-[#c4bbae]">XP Bounties</span>
          </div>
        </div>
      </section>

      {/* Main Track */}
      <section className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <div className="rounded-3xl border-4 border-black bg-white p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
            <span className="bg-primary text-white w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-lg dark:border-[#2e2924] dark:bg-primary/20 dark:text-primary">
              📝
            </span>
            Contribution Queue
          </h2>
          <div className="space-y-4">
            {availableLessons.length > 0 ? (
              availableLessons.map((lesson, i) => (
                <Link key={lesson.slug} to={`/lessons/${lesson.slug}`} className="flex flex-col gap-2 p-5 rounded-2xl border-4 border-black bg-surface-lowest shadow-card-sm hover:shadow-card hover:-translate-y-1 transition-all dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none dark:hover:bg-[#1f1c18]">
                  <div className="flex justify-between items-end">
                    <h3 className="font-black text-xl dark:text-[#f0ebe2]">{lesson.title}</h3>
                    <span className="font-bold text-sm text-muted italic dark:text-[#c4bbae]">{lesson.description}</span>
                  </div>
                  <div className="h-6 w-full rounded-full border-4 border-black bg-surface-low overflow-hidden dark:bg-[#0f0e0c] dark:border-[#2e2924]">
                    <div className="h-full bg-primary border-black border-r-4 dark:border-[#2e2924]" style={{ width: `0%` }}></div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center bg-surface-low rounded-2xl border-4 border-dashed border-black dark:bg-[#0f0e0c] dark:border-[#2e2924]">
                <p className="font-bold text-muted dark:text-[#c4bbae]">All current track modules completed! 🎉</p>
              </div>
            )}
          </div>
        </div>

        {/* Challenges */}
        <div className="rounded-3xl border-4 border-black bg-accent p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <h2 className="text-3xl font-black mb-6 text-black dark:text-[#f0ebe2]">High Priority Issues 🚨</h2>
          <div className="space-y-4">
            {challenges.map((challenge: any) => (
              <div key={challenge.id} className="rounded-2xl border-4 border-black bg-white p-5 shadow-card-sm dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none">
                <span className="font-black text-[10px] bg-black text-white px-3 py-1 rounded-full dark:bg-[#2e2924] dark:text-[#f0ebe2]">{challenge.difficulty.toUpperCase()}</span>
                <h3 className="font-black text-lg mt-3 dark:text-[#f0ebe2]">{challenge.title}</h3>
                <p className="text-sm text-muted mt-1 dark:text-[#c4bbae]">{challenge.summary}</p>
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-muted dark:text-[#c4bbae]">Reward:</span>
                  <span className="font-black text-primary">{challenge.points} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

