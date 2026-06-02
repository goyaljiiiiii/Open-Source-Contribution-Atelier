import { useMemo } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { Link } from "react-router-dom";
import SkeletonCard from "../components/ui/skeletons/SkeletonCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

export function DashboardPage() {
  const { user } = useAuth();

  // 1. Fetch Admin Dashboard stats (only queries if user is staff)
  const { data: adminData, isLoading: isAdminLoading, error: adminError } = useQuery({
    queryKey: ["adminDashboardStats"],
    queryFn: () => fetchApi("/dashboard/admin/"),
    enabled: !!user?.is_staff,
  });

  // 2. Fetch Contributor Dashboard stats (only queries if user is NOT staff)
  const { data: contributorData, isLoading: isContributorLoading, error: contributorError } = useQuery({
    queryKey: ["contributorDashboardStats"],
    queryFn: () => fetchApi("/dashboard/contributor/"),
    enabled: !!user && !user.is_staff,
  });

  // Fetch standard lists for fallback or lessons listing if needed
  const { data: lessons = [], isLoading: isLessonsLoading } = useQuery({
    queryKey: ["lessons"],
    queryFn: () => fetchApi("/content/lessons/"),
    enabled: !user?.is_staff,
  });

  const availableLessons = useMemo(() => {
    if (!lessons || !contributorData) return [];
    // Just slice the first 3 lessons for learning queue
    return lessons.slice(0, 3);
  }, [lessons, contributorData]);

  if (isAdminLoading || isContributorLoading || isLessonsLoading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]" aria-busy="true">
        <div className="space-y-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="space-y-6">
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // Handle case where user is an Admin
  if (user?.is_staff) {
    if (adminError || !adminData) {
      return (
        <div className="p-8 text-center bg-red-100 rounded-2xl border-4 border-black font-bold">
          Failed to load Admin Dashboard stats. Please try again.
        </div>
      );
    }

    const { system_stats, contributor_activity, pending_prs } = adminData;

    // Data for Issue status chart
    const issueStatusData = [
      { name: "Open", value: system_stats.open_issues },
      { name: "In Progress", value: system_stats.in_progress_issues },
      { name: "Solved", value: system_stats.solved_issues },
    ];
    const COLORS = ["#ffcc00", "#ff9500", "#ff3b30"];

    return (
      <div className="space-y-10 pt-4 pb-12">
        {/* Admin Header */}
        <section className="rounded-[2rem] border-4 border-black bg-primary p-8 sm:p-10 shadow-card relative overflow-hidden dark:border-[#2e2924] dark:shadow-none">
          <div className="relative z-10">
            <span className="font-black text-sm bg-white text-black px-4 py-2 rounded-full border-2 border-black rotate-[-2deg] inline-block shadow-sm mb-4 dark:bg-[#151411] dark:text-[#f0ebe2] dark:border-[#2e2924]">
              MAINTAINER CONTROL PANEL 🛠️
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-white drop-shadow-[3px_3px_0_#000] mb-4 dark:drop-shadow-none">
              Project Health & Contributor Atelier
            </h1>
            <p className="text-xl font-bold text-black bg-white/95 p-4 rounded-xl border-4 border-black shadow-card-sm inline-block max-w-lg leading-relaxed dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none dark:text-[#f0ebe2]">
              Track system status, review active contributor XP journeys, and merge pull requests.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 text-[10rem] opacity-25 rotate-12 pointer-events-none">
            📈
          </div>
        </section>

        {/* Stats Blocks */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-between hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🚨</span>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted dark:text-[#c4bbae]">System Issues</h3>
                <p className="text-4xl font-black text-primary drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{system_stats.total_issues}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-muted/20 text-xs font-bold text-muted flex justify-between dark:text-[#c4bbae]">
              <span>Solved: {system_stats.solved_issues}</span>
              <span>Open: {system_stats.open_issues}</span>
            </div>
          </div>

          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-between hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <div className="flex items-center gap-3">
              <span className="text-4xl">💻</span>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted dark:text-[#c4bbae]">Pull Requests</h3>
                <p className="text-4xl font-black text-tertiary drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{system_stats.total_prs}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-muted/20 text-xs font-bold text-muted flex justify-between dark:text-[#c4bbae]">
              <span>Merged: {system_stats.merged_prs}</span>
              <span>Pending: {system_stats.pending_prs}</span>
            </div>
          </div>

          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-between hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <div className="flex items-center gap-3">
              <span className="text-4xl">👥</span>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted dark:text-[#c4bbae]">Active Contributors</h3>
                <p className="text-4xl font-black text-accent drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{system_stats.active_contributors}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-muted/20 text-xs font-bold text-muted dark:text-[#c4bbae]">
              Collaborating on guided open source practice
            </div>
          </div>
        </section>

        {/* Charts & Analytics */}
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Contributor Activity Bar Chart */}
          <div className="rounded-3xl border-4 border-black bg-white p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
              <span>📊</span> Contributor Activity & XP Standings
            </h2>
            <div className="h-[300px] w-full">
              {contributor_activity.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contributor_activity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="username" tick={{ fontStyle: "bold", fill: "#6b5a49" }} />
                    <YAxis tick={{ fontStyle: "bold", fill: "#6b5a49" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "4px solid #000000",
                        borderRadius: "12px",
                        boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
                        fontWeight: "bold",
                      }}
                    />
                    <Legend wrapperStyle={{ fontWeight: "bold" }} />
                    <Bar dataKey="xp" name="Total XP Bounties" fill="#ff9500" stroke="#000000" strokeWidth={2} />
                    <Bar dataKey="prs_merged" name="PRs Merged" fill="#ff3b30" stroke="#000000" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border-4 border-dashed border-black rounded-2xl p-8 dark:border-[#2e2924]">
                  <p className="font-bold text-muted dark:text-[#c4bbae]">No contributor activity recorded yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Issue Allocation Pie Chart */}
          <div className="rounded-3xl border-4 border-black bg-white p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-black mb-6 flex items-center gap-2">
                <span>🎯</span> Issue Allocation Breakdown
              </h2>
              <div className="h-[200px] w-full flex justify-center items-center">
                {system_stats.total_issues > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={issueStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {issueStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#000" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "4px solid #000000",
                          borderRadius: "12px",
                          fontWeight: "bold",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="font-bold text-muted dark:text-[#c4bbae]">No issues available to analyze.</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              {issueStatusData.map((item, index) => (
                <div key={item.name} className="p-2 rounded-xl border-2 border-black" style={{ backgroundColor: `${COLORS[index]}15` }}>
                  <span className="block font-black text-xs" style={{ color: COLORS[index] }}>● {item.name}</span>
                  <span className="font-black text-lg text-text dark:text-[#f0ebe2]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PR Review Queue */}
        <section className="rounded-3xl border-4 border-black bg-accent p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <h2 className="text-3xl font-black mb-6 flex items-center gap-2 text-black dark:text-[#f0ebe2]">
            <span>📬</span> Pending Pull Requests Queue ({pending_prs.length})
          </h2>
          <div className="space-y-4">
            {pending_prs.length > 0 ? (
              pending_prs.map((pr: any) => (
                <div key={pr.id} className="rounded-2xl border-4 border-black bg-white p-5 shadow-card-sm dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[10px] bg-black text-white px-2 py-0.5 rounded-full dark:bg-[#2e2924] dark:text-[#f0ebe2]">PENDING REVIEW</span>
                      <span className="text-xs font-bold text-muted dark:text-[#c4bbae]">Opened: {new Date(pr.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-black text-xl mt-2 dark:text-[#f0ebe2]">{pr.title}</h3>
                    <p className="text-sm font-bold text-muted mt-1 dark:text-[#c4bbae]">
                      Submitted by: <span className="text-primary">@{pr.contributor}</span> · Issue: {pr.issue_title}
                    </p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button className="grow md:grow-0 rounded-xl bg-surface-low border-2 border-black px-4 py-2 text-xs font-black hover:-translate-y-0.5 shadow-card-sm hover:shadow-card active:translate-y-0 active:shadow-card-sm cursor-pointer transition-all dark:bg-[#0f0e0c] dark:text-[#f0ebe2] dark:border-[#2e2924]">
                      Comment
                    </button>
                    <button className="grow md:grow-0 rounded-xl bg-[#c3c0ff] border-2 border-black px-4 py-2 text-xs font-black hover:-translate-y-0.5 shadow-card-sm hover:shadow-card active:translate-y-0 active:shadow-card-sm cursor-pointer transition-all">
                      Approve & Merge
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border-4 border-dashed border-black dark:bg-[#151411] dark:border-[#2e2924]">
                <p className="font-bold text-muted dark:text-[#c4bbae]">All practice submissions merged. Clean working tree! 🌟</p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // Handle case where user is a Contributor
  if (contributorError || !contributorData) {
    return (
      <div className="p-8 text-center bg-red-100 rounded-2xl border-4 border-black font-bold">
        Failed to load Contributor stats. Please try again.
      </div>
    );
  }

  const { personal_stats, assigned_issues, recent_prs, progress_tracker } = contributorData;

  return (
    <div className="space-y-10 pt-4 pb-12">
      {/* Contributor Header */}
      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[2rem] border-4 border-black bg-tertiary p-8 sm:p-10 shadow-card relative overflow-hidden dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <div className="relative z-10">
            <span className="font-black text-sm bg-white text-black px-4 py-2 rounded-full border-2 border-black rotate-[-2deg] inline-block shadow-sm mb-4 dark:bg-[#151411] dark:text-[#f0ebe2] dark:border-[#2e2924]">
              LEVEL {progress_tracker.completed_lessons + 1} CONTRIBUTOR 🚀
            </span>
            <h1 className="text-4xl sm:text-5xl font-black text-white drop-shadow-[3px_3px_0_#000] mb-4 dark:text-[#f0ebe2] dark:drop-shadow-none">
              Welcome back, {user?.username}.
            </h1>
            <p className="text-xl font-bold text-black bg-white/90 p-4 rounded-xl border-4 border-black shadow-card-sm inline-block max-w-lg leading-relaxed dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none dark:text-[#f0ebe2]">
              You have earned {personal_stats.total_xp} XP bounties so far. Keep solving issues!
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 text-[10rem] opacity-20 rotate-12 pointer-events-none">
            💻
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-center items-center hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <span className="text-4xl mb-1">🔥</span>
            <span className="text-4xl font-black text-primary drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{personal_stats.streak_days}</span>
            <span className="font-bold text-black uppercase tracking-widest text-[10px] mt-1 dark:text-[#c4bbae]">Streak Days</span>
          </div>

          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-center items-center hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <span className="text-4xl mb-1">🎯</span>
            <span className="text-4xl font-black text-accent drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{personal_stats.total_xp}</span>
            <span className="font-bold text-black uppercase tracking-widest text-[10px] mt-1 dark:text-[#c4bbae]">Earned XP</span>
          </div>

          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-center items-center hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <span className="text-4xl mb-1">🏆</span>
            <span className="text-4xl font-black text-primary drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">#{personal_stats.rank}</span>
            <span className="font-bold text-black uppercase tracking-widest text-[10px] mt-1 dark:text-[#c4bbae]">Atelier Rank</span>
          </div>

          <div className="rounded-[2rem] border-4 border-black bg-white p-6 shadow-card flex flex-col justify-center items-center hover:-translate-y-1 transition-transform dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
            <span className="text-4xl mb-1">✅</span>
            <span className="text-4xl font-black text-accent drop-shadow-[2px_2px_0_#000] dark:drop-shadow-none">{personal_stats.prs_merged}</span>
            <span className="font-bold text-black uppercase tracking-widest text-[10px] mt-1 dark:text-[#c4bbae]">PRs Merged</span>
          </div>
        </div>
      </section>

      {/* Curriculum Queue & Progress Chart */}
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border-4 border-black bg-white p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <h2 className="text-3xl font-black mb-6 flex items-center gap-3">
            <span className="bg-primary text-white w-10 h-10 rounded-full border-2 border-black flex items-center justify-center text-lg dark:border-[#2e2924] dark:bg-primary/20 dark:text-primary">
              📚
            </span>
            Contribution Curriculum Queue
          </h2>
          <div className="space-y-4">
            {availableLessons.length > 0 ? (
              availableLessons.map((lesson: any) => (
                <Link
                  key={lesson.slug}
                  to={`/lessons/${lesson.slug}`}
                  className="flex flex-col gap-2 p-5 rounded-2xl border-4 border-black bg-surface-lowest shadow-card-sm hover:shadow-card hover:-translate-y-1 transition-all dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none dark:hover:bg-[#1f1c18]"
                >
                  <div className="flex justify-between items-end">
                    <h3 className="font-black text-xl dark:text-[#f0ebe2]">{lesson.title}</h3>
                    <span className="font-black text-[10px] bg-black text-white px-2 py-0.5 rounded-full uppercase dark:bg-[#2e2924]">
                      {lesson.difficulty || "beginner"}
                    </span>
                  </div>
                  <p className="font-bold text-sm text-muted dark:text-[#c4bbae]">{lesson.summary}</p>
                  <div className="flex justify-between text-xs font-bold text-primary mt-1">
                    <span>⏱️ {lesson.estimated_minutes || 10} min lesson</span>
                    <span>Start mission →</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center bg-surface-low rounded-2xl border-4 border-dashed border-black dark:bg-[#0f0e0c] dark:border-[#2e2924]">
                <p className="font-bold text-muted dark:text-[#c4bbae]">All curriculum modules completed! 🎉</p>
              </div>
            )}
          </div>
        </div>

        {/* Completion Rate Chart */}
        <div className="rounded-3xl border-4 border-black bg-white p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <span>🎯</span> Track Completion Rate
            </h2>
            <div className="h-[180px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Completed", value: progress_tracker.completed_lessons },
                      { name: "Remaining", value: Math.max(0, progress_tracker.total_lessons - progress_tracker.completed_lessons) },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    <Cell fill="#ff3b30" stroke="#000" strokeWidth={2} />
                    <Cell fill="#fdfbf7" stroke="#e0e0e0" strokeWidth={2} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black text-text dark:text-[#f0ebe2]">{progress_tracker.completion_percentage}%</span>
                <span className="text-[10px] uppercase font-bold text-muted dark:text-[#c4bbae]">COMPLETED</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-dashed border-muted/20 text-center font-bold text-sm text-muted dark:text-[#c4bbae]">
            📊 Completed {progress_tracker.completed_lessons} of {progress_tracker.total_lessons} total track modules
          </div>
        </div>
      </section>

      {/* Assigned Issues Queue & Recent PRs */}
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {/* Assigned Issues */}
        <div className="rounded-3xl border-4 border-black bg-accent p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <h2 className="text-3xl font-black mb-6 text-black dark:text-[#f0ebe2] flex items-center gap-2">
            <span>🚨</span> Your Assigned Issues ({assigned_issues.length})
          </h2>
          <div className="space-y-4">
            {assigned_issues.length > 0 ? (
              assigned_issues.map((issue: any) => (
                <div key={issue.id} className="rounded-2xl border-4 border-black bg-white p-5 shadow-card-sm dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none">
                  <div className="flex justify-between items-start">
                    <span className="font-black text-[9px] bg-black text-white px-2 py-0.5 rounded-full uppercase dark:bg-[#2e2924]">
                      {issue.status.toUpperCase()}
                    </span>
                    <span className="font-black text-primary text-sm">{issue.points} XP Bounty</span>
                  </div>
                  <h3 className="font-black text-lg mt-3 dark:text-[#f0ebe2]">{issue.title}</h3>
                  <p className="text-sm text-muted mt-1 dark:text-[#c4bbae]">{issue.description}</p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border-4 border-dashed border-black dark:bg-[#151411] dark:border-[#2e2924]">
                <p className="font-bold text-muted dark:text-[#c4bbae]">No active issues assigned. Browse the challenges board! 🔍</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent PR Activity */}
        <div className="rounded-3xl border-4 border-black bg-[#ffb5e8] p-6 shadow-card dark:bg-[#1f1c18] dark:border-[#2e2924] dark:shadow-none">
          <h2 className="text-3xl font-black mb-6 text-black dark:text-[#f0ebe2] flex items-center gap-2">
            <span>💻</span> Recent Practice Submissions ({recent_prs.length})
          </h2>
          <div className="space-y-4">
            {recent_prs.length > 0 ? (
              recent_prs.map((pr: any) => {
                const getStatusColor = (status: string) => {
                  if (status === "merged") return "bg-green-100 text-green-800 border-green-800";
                  if (status === "closed") return "bg-red-100 text-red-800 border-red-800";
                  return "bg-yellow-100 text-yellow-800 border-yellow-800";
                };
                return (
                  <div key={pr.id} className="rounded-2xl border-4 border-black bg-white p-5 shadow-card-sm dark:bg-[#151411] dark:border-[#2e2924] dark:shadow-none flex justify-between items-center gap-4">
                    <div>
                      <h3 className="font-black text-lg dark:text-[#f0ebe2]">{pr.title}</h3>
                      <p className="text-xs font-bold text-muted mt-1 dark:text-[#c4bbae]">
                        Issue: {pr.issue_title} · Submitted: {new Date(pr.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`font-black text-[9px] px-2.5 py-1 rounded-full border-2 uppercase ${getStatusColor(pr.status)}`}>
                      {pr.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border-4 border-dashed border-black dark:bg-[#151411] dark:border-[#2e2924]">
                <p className="font-bold text-muted dark:text-[#c4bbae]">No practice pull requests submitted yet.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
