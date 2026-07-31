import React, { useState, useEffect } from "react";
import {
  GitBranch,
  GitCommit,
  RotateCcw,
  Play,
  CheckCircle2,
  Sparkles,
  Terminal,
  Layers,
  Award,
  HelpCircle,
} from "lucide-react";
import { RebaseCommitGraph, RebaseCommit } from "../components/Sandbox/RebaseCommitGraph";
import { RebaseControlsModal } from "../components/Sandbox/RebaseControlsModal";

interface RebaseScenario {
  id: string;
  title: string;
  difficulty: string;
  xp_reward: number;
  description: string;
  base_branch: string;
  initial_commits: RebaseCommit[];
}

const DEFAULT_SCENARIOS: RebaseScenario[] = [
  {
    id: "squash-5-to-1",
    title: "Squash 5 WIP Draft Commits before PR Merge",
    difficulty: "Beginner",
    xp_reward: 150,
    description: "You created 5 small 'wip' commits while building a feature. Use interactive rebase to squash them into 1 clean commit.",
    base_branch: "main",
    initial_commits: [
      { hash: "a1b2c3d", message: "feat: add user authentication form", author: "contributor", files_changed: ["src/auth.ts"], action: "pick" },
      { hash: "e4f5g6h", message: "wip fix typo in auth", author: "contributor", files_changed: ["src/auth.ts"], action: "squash" },
      { hash: "i7j8k9l", message: "wip add validation regex", author: "contributor", files_changed: ["src/auth.ts"], action: "squash" },
      { hash: "m0n1o2p", message: "wip update styles", author: "contributor", files_changed: ["src/styles.css"], action: "squash" },
      { hash: "q3r4s5t", message: "wip cleanup console.log", author: "contributor", files_changed: ["src/auth.ts"], action: "squash" },
    ],
  },
  {
    id: "reword-and-clean",
    title: "Reword Bad Messages & Drop Debug Code",
    difficulty: "Intermediate",
    xp_reward: 200,
    description: "Fix non-descriptive commit messages with 'reword' and remove temporary debug logging commits with 'drop'.",
    base_branch: "main",
    initial_commits: [
      { hash: "b8c9d0e", message: "add stuff", author: "contributor", files_changed: ["src/api.ts"], action: "reword", new_message: "feat: implement API retry adapter" },
      { hash: "f1g2h3i", message: "TEMP: debug print statements", author: "contributor", files_changed: ["src/api.ts"], action: "drop" },
      { hash: "j4k5l6m", message: "feat: connect websocket client", author: "contributor", files_changed: ["src/ws.ts"], action: "pick" },
    ],
  },
];

export const GitRebaseVisualizerPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<RebaseScenario[]>(DEFAULT_SCENARIOS);
  const [activeScenario, setActiveScenario] = useState<RebaseScenario>(DEFAULT_SCENARIOS[0]);
  const [commits, setCommits] = useState<RebaseCommit[]>(DEFAULT_SCENARIOS[0].initial_commits);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<{ commit_hash: string; file: string; conflict_hunk: string }[]>([]);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [earnedXP, setEarnedXP] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/sandbox/rebase-simulator/")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.scenarios) {
          setScenarios(data.scenarios);
          setActiveScenario(data.scenarios[0]);
          setCommits(data.scenarios[0].initial_commits);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectScenario = (sc: RebaseScenario) => {
    setActiveScenario(sc);
    setCommits(sc.initial_commits);
    setExecutionLogs([]);
    setConflicts([]);
    setIsCompleted(false);
  };

  const handleCommitActionChange = (index: number, action: RebaseCommit["action"], newMessage?: string) => {
    setCommits((prev) =>
      prev.map((c, i) => (i === index ? { ...c, action, new_message: newMessage || c.new_message } : c))
    );
  };

  const handleMoveCommit = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= commits.length) return;
    const updated = [...commits];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setCommits(updated);
  };

  const handleExecuteRebase = async () => {
    setIsExecuting(true);
    try {
      const res = await fetch("/api/sandbox/rebase-simulator/execute/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_commit: activeScenario.base_branch,
          commit_actions: commits.map((c) => ({ action: c.action || "pick", commit: c, new_message: c.new_message })),
          scenario_id: activeScenario.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setExecutionLogs(data.execution_logs || []);

        if (data.conflicts && data.conflicts.length > 0) {
          setConflicts(data.conflicts);
          setShowConflictModal(true);
        } else {
          verifyCompletion(data.rebased_commits);
        }
      }
    } catch {
      // Local demo execution fallback
      const logs = commits.map(
        (c) => `${(c.action || "pick").toUpperCase()} ${c.hash.substring(0, 7)} - ${c.message}`
      );
      setExecutionLogs(["git rebase -i main", ...logs, "Successfully rebased and updated refs/heads/feature."]);
      setIsCompleted(true);
      setEarnedXP(activeScenario.xp_reward);
    } finally {
      setIsExecuting(false);
    }
  };

  const verifyCompletion = async (rebasedCommits: RebaseCommit[]) => {
    try {
      const res = await fetch("/api/sandbox/rebase-simulator/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: activeScenario.id,
          rebased_commits: rebasedCommits,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.completed) {
          setIsCompleted(true);
          setEarnedXP(data.reward_xp || activeScenario.xp_reward);
        }
      }
    } catch {
      setIsCompleted(true);
      setEarnedXP(activeScenario.xp_reward);
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-purple-400" /> Git Scenario Simulator
                </span>
                <span className="text-xs text-slate-400">Interactive Rebase & Commit Squashing</span>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                Git Interactive Rebase Visualizer
              </h1>
              <p className="mt-2 text-sm text-slate-300 max-w-2xl">
                Master <code className="text-amber-400 font-mono">git rebase -i</code> workflows visually. Reorder, reword, squash, and fixup commits before submitting pull requests.
              </p>
            </div>

            {/* Scenario Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {scenarios.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleSelectScenario(sc)}
                  className={`px-4 py-2.5 text-xs font-bold rounded-2xl whitespace-nowrap transition-all ${
                    activeScenario.id === sc.id
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {sc.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Challenge Goal Description Card */}
        <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Current Challenge Goal:
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold text-amber-300 bg-amber-950 border border-amber-800 rounded">
                +{activeScenario.xp_reward} XP
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-200">{activeScenario.description}</p>
          </div>

          <button
            onClick={handleExecuteRebase}
            disabled={isExecuting}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            {isExecuting ? "Executing Rebase..." : "Run Rebase (git rebase -i)"}
          </button>
        </div>

        {/* Completion Celebration Alert */}
        {isCompleted && (
          <div className="p-6 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-200">Rebase Scenario Mastered!</h3>
                <p className="text-xs text-emerald-300/80">
                  Congratulations! You earned <strong className="text-amber-300">+{earnedXP} Contributor XP</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Canvas (Commit Graph & Terminal Logs) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Commit DAG Visualizer */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-purple-400" /> Interactive Commit DAG Graph
            </h2>

            <RebaseCommitGraph
              commits={commits}
              onCommitActionChange={handleCommitActionChange}
              onMoveCommit={handleMoveCommit}
            />
          </div>

          {/* Terminal Execution Logs */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" /> Terminal Rebase Execution Log
            </h2>

            <div className="h-[450px] p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs text-slate-300 overflow-y-auto custom-scrollbar space-y-2">
              <p className="text-slate-500"># Interactive Rebase instruction Todo list</p>
              {commits.map((c, i) => (
                <div key={i} className="text-slate-400">
                  <span className="text-amber-400 font-bold">{(c.action || "pick").toLowerCase()}</span>{" "}
                  <span className="text-slate-200">{c.hash.substring(0, 7)}</span> {c.new_message || c.message}
                </div>
              ))}

              <div className="pt-4 border-t border-slate-800 space-y-1">
                {executionLogs.map((log, idx) => (
                  <p key={idx} className="text-emerald-400">
                    $ {log}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Conflict Resolution Modal */}
        {showConflictModal && (
          <RebaseControlsModal
            commits={commits}
            conflicts={conflicts}
            onClose={() => setShowConflictModal(false)}
            onResolveConflict={() => {
              setShowConflictModal(false);
              verifyCompletion(commits);
            }}
          />
        )}
      </div>
    </main>
  );
};

export default GitRebaseVisualizerPage;
