import { useRef, useState, useEffect } from "react";
import { Search, Upload, Trophy, HelpCircle, ArrowUpRight, CheckCircle2, Zap, Play, Sparkles, Filter, ShieldCheck, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../features/auth/AuthContext";
import { fetchApi } from "../lib/api";
import toast from "react-hot-toast";

export interface ChallengeItem {
  id: string;
  title: string;
  category: "Git Operations" | "Conflict Resolution" | "Code Review" | "DevOps & Security";
  difficulty: "beginner" | "intermediate" | "advanced";
  summary: string;
  xpReward: number;
  badge: string;
  route: string;
  instruction: string;
  hint: string;
  initialCode?: string;
  expectedKeyword?: string;
}

const INTERACTIVE_CHALLENGES: ChallengeItem[] = [
  {
    id: "merge-conflict-rescue",
    title: "🔀 Merge Conflict Resolution Drill",
    category: "Conflict Resolution",
    difficulty: "intermediate",
    summary: "Resolve complex git merge conflict markers in a feature branch without losing upstream changes.",
    xpReward: 50,
    badge: "Conflict Ninja 🥷",
    route: "/conflict-scenario-builder",
    instruction: "Identify and resolve the merge conflict markers (<<<<<<<, =======, >>>>>>>) in the code below. Remove markers and keep both upstream and feature additions.",
    hint: "Remove git conflict headers and ensure the final function contains both upstream fix and local feature.",
    initialCode: `<<<<<<< HEAD\nfunction formatUser(name: string) { return name.trim().toUpperCase(); }\n=======\nfunction formatUser(name: string, role = "contributor") { return \`\${name} (\${role})\`; }\n>>>>>>> feature/user-formatting`,
    expectedKeyword: "formatUser",
  },
  {
    id: "git-rebase-interactive",
    title: "⚡ Git Rebase Scenario Lab",
    category: "Git Operations",
    difficulty: "intermediate",
    summary: "Squash messy feature branch commits into clean atomic commits before opening a pull request.",
    xpReward: 50,
    badge: "Rebase Master ⚡",
    route: "/git-rebase",
    instruction: "Use git rebase -i HEAD~3 to squash 3 WIP commits into a single descriptive commit message.",
    hint: "In interactive rebase, change 'pick' to 'squash' (or 's') for the subsequent commits.",
  },
  {
    id: "git-bisect-debug",
    title: "🔍 Git Bisect Bug Hunting Game",
    category: "Git Operations",
    difficulty: "advanced",
    summary: "Isolate a breaking regression commit in a 50-commit history using binary search git bisect.",
    xpReward: 75,
    badge: "Bug Sleuth 🔍",
    route: "/git-bisect",
    instruction: "Run 'git bisect start', mark HEAD as bad and origin/main as good, then test each bisect commit.",
    hint: "Use git bisect run npm test to automate binary search finding the culprit commit.",
  },
  {
    id: "git-stash-stack",
    title: "💾 Git Stash & Working Tree Rescue",
    category: "Git Operations",
    difficulty: "beginner",
    summary: "Safely stash uncommitted changes when emergency hotfixes require switching branches immediately.",
    xpReward: 50,
    badge: "Stash Wizard 🧙",
    route: "/git-stash",
    instruction: "Stash working directory changes with 'git stash push -m WIP', switch to main, apply hotfix, then pop stash.",
    hint: "Use 'git stash pop' to restore stashed changes onto your feature branch.",
  },
  {
    id: "tone-coach-workshop",
    title: "💬 Maintainer Code Review Tone Workshop",
    category: "Code Review",
    difficulty: "beginner",
    summary: "Analyze code review feedback and optimize maintainer replies for constructive community tone.",
    xpReward: 50,
    badge: "Empathy Diplomat 🤝",
    route: "/tone-coach",
    instruction: "Rephrase abrasive pull request feedback into constructive, actionable guidance.",
    hint: "Acknowledge the contributor's effort first before explaining requested changes.",
  },
  {
    id: "a11y-compliance-audit",
    title: "♿ Accessibility (A11y) WCAG Linter Drill",
    category: "DevOps & Security",
    difficulty: "intermediate",
    summary: "Audit HTML elements for missing ARIA labels, alt tags, and keyboard navigation compliance.",
    xpReward: 60,
    badge: "A11y Champion ♿",
    route: "/a11y-sandbox",
    instruction: "Add required aria-label, alt attributes, and keyboard focus rings to interactive elements.",
    hint: "All interactive buttons require descriptive aria-labels and visible focus indicators.",
  },
  {
    id: "submodule-dependency-sync",
    title: "📦 Git Submodule Sync & Update Drill",
    category: "Git Operations",
    difficulty: "advanced",
    summary: "Initialize and sync external git submodules across monorepo package boundaries.",
    xpReward: 75,
    badge: "Submodule Sync 📦",
    route: "/git-submodules",
    instruction: "Run 'git submodule update --init --recursive' to fetch submodules at targeted commit hashes.",
    hint: "Remember to commit updated submodule pointers in the parent repository.",
  },
  {
    id: "pr-diff-ai-summarizer",
    title: "📝 PR Diff AI Summarizer Challenge",
    category: "Code Review",
    difficulty: "intermediate",
    summary: "Generate concise, executive pull request release notes from raw multi-file git diffs.",
    xpReward: 50,
    badge: "Diff Architect 📝",
    route: "/pr-diff-summarizer",
    instruction: "Paste a multi-file git diff and generate structured release summary notes.",
    hint: "Group changes by feature area, bug fixes, and breaking schema alterations.",
  },
];

export function ChallengePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // Completed challenges state (persisted in localStorage)
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("osca_completed_challenges");
      return saved ? JSON.parse(saved) : ["git-stash-stack"];
    } catch {
      return ["git-stash-stack"];
    }
  });

  // Active Challenge Modal state
  const [activeModalChallenge, setActiveModalChallenge] = useState<ChallengeItem | null>(null);
  const [userSolutionCode, setUserSolutionCode] = useState("");
  const [showHintModal, setShowHintModal] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("osca_completed_challenges", JSON.stringify(completedIds));
    } catch {
      // Ignore
    }
  }, [completedIds]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetchApi("/challenges/bulk-upload/", {
        method: "POST",
        body: formData,
      });
      setUploadMessage("✅ " + (response.message || "Upload successful"));
      toast.success("Challenges uploaded successfully!");
    } catch (error: unknown) {
      const errMsg = (error as Error).message || "Failed to upload";
      setUploadMessage("❌ Error: " + errMsg);
      toast.error("Upload failed: " + errMsg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleOpenDrillModal = (item: ChallengeItem) => {
    setActiveModalChallenge(item);
    setUserSolutionCode(item.initialCode || "");
    setShowHintModal(false);
  };

  const handleCompleteDrill = (item: ChallengeItem) => {
    if (!completedIds.includes(item.id)) {
      setCompletedIds((prev) => [...prev, item.id]);
      toast.success(`🎉 Challenge Completed! +${item.xpReward} XP Awarded!`);
    } else {
      toast.success("Drill completed!");
    }
    setActiveModalChallenge(null);
  };

  const filtered = INTERACTIVE_CHALLENGES.filter((c) => {
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.summary.toLowerCase().includes(search.toLowerCase()) ||
      c.badge.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty = !difficulty || c.difficulty === difficulty;
    const matchesCategory = !category || c.category === category;
    return matchesSearch && matchesDifficulty && matchesCategory;
  });

  const totalXP = completedIds.reduce((acc, id) => {
    const found = INTERACTIVE_CHALLENGES.find((ch) => ch.id === id);
    return acc + (found ? found.xpReward : 50);
  }, 0);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8 animate-fade-in select-none">
      {/* Header Banner */}
      <div className="border-4 border-black bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-200 p-6 sm:p-8 rounded-3xl shadow-card dark:from-amber-950 dark:via-yellow-900 dark:to-slate-900 dark:border-amber-500/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-black text-white dark:bg-amber-400 dark:text-black font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                Interactive Contribution Gym
              </span>
              <span className="bg-emerald-500 text-white font-black text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <Zap size={12} /> {completedIds.length} / {INTERACTIVE_CHALLENGES.length} Drills Done
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
              <Trophy size={36} className="text-amber-600 dark:text-amber-400" /> Contribution Challenges &amp; Drills
            </h1>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-300 mt-2 leading-relaxed max-w-2xl">
              Master hands-on git operations, conflict resolution, rebase squashing, accessibility audits, and PR review workflows with real interactive drills.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border-4 border-black dark:border-slate-700 p-4 rounded-2xl shadow-card text-center shrink-0 min-w-[180px]">
            <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 block">Total XP Earned</span>
            <span className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 block mt-1">
              +{totalXP} XP
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-1">
              {completedIds.length === INTERACTIVE_CHALLENGES.length ? "🏆 All Drills Mastered!" : "Keep Leveling Up!"}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Upload Section */}
      {user?.is_staff && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border-4 border-black bg-[#ffebc2] p-5 shadow-card dark:bg-yellow-900/20 dark:border-yellow-700/50">
          <div>
            <h3 className="font-black text-sm uppercase flex items-center gap-2 text-slate-900 dark:text-white">
              <span>🛠️</span> Admin Challenge Importer
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-400 mt-1 font-bold">
              Bulk import new challenges via JSON. Format: Array of objects.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border-2 border-black bg-white px-4 py-2.5 text-xs font-black shadow-card-sm hover:-translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer text-slate-900"
            >
              <Upload size={16} />
              {isUploading ? "Uploading..." : "Upload JSON File"}
            </button>
          </div>
          {uploadMessage && (
            <div className="w-full sm:w-auto text-xs font-black border-2 border-black bg-white px-3 py-2 rounded-lg text-slate-900">
              {uploadMessage}
            </div>
          )}
        </div>
      )}

      {/* Search and Category Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 border-2 border-black dark:border-white/10 rounded-2xl">
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="challenge-search-input"
            type="text"
            placeholder="Search drills, topics, badges..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border-2 border-black bg-white py-2 pl-10 pr-4 text-xs font-bold text-slate-900 focus:outline-none dark:bg-[#121216] dark:text-white dark:border-white/15 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 border-2 border-black dark:border-slate-700 rounded-xl text-xs">
            <button
              onClick={() => setDifficulty(null)}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all",
                difficulty === null ? "bg-black text-white dark:bg-white dark:text-black" : "text-slate-600 dark:text-slate-300"
              )}
            >
              All
            </button>
            {["beginner", "intermediate", "advanced"].map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={clsx(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all",
                  difficulty === d ? "bg-amber-400 text-black font-black" : "text-slate-600 dark:text-slate-300"
                )}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            value={category || ""}
            onChange={(e) => setCategory(e.target.value || null)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border-2 border-black dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="Git Operations">Git Operations</option>
            <option value="Conflict Resolution">Conflict Resolution</option>
            <option value="Code Review">Code Review</option>
            <option value="DevOps & Security">DevOps & Security</option>
          </select>
        </div>
      </div>

      {/* Challenges Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filtered.map((item) => {
          const isCompleted = completedIds.includes(item.id);
          return (
            <div
              key={item.id}
              className={clsx(
                "border-4 border-black bg-white rounded-3xl shadow-card dark:bg-[#1a191f] dark:border-white/10 flex flex-col justify-between overflow-hidden transition-all hover:-translate-y-1",
                isCompleted && "border-emerald-500 dark:border-emerald-500/50"
              )}
            >
              {/* Header portion */}
              <div className="p-6 border-b-2 border-black/5 dark:border-white/5 space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-black shadow-card-xs",
                        item.difficulty === "beginner" && "bg-green-100 text-green-800",
                        item.difficulty === "intermediate" && "bg-amber-100 text-amber-850",
                        item.difficulty === "advanced" && "bg-red-100 text-red-800"
                      )}
                    >
                      {item.difficulty}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                  </div>
                  {isCompleted ? (
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 size={14} /> DONE
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              {/* Bottom button strip */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 flex items-center justify-between gap-3">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Zap size={14} /> +{item.xpReward} XP Reward
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDrillModal(item)}
                    className="px-3 py-2 border-2 border-black bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-card-sm hover:-translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    Quick Drill <Play size={12} />
                  </button>
                  <button
                    onClick={() => navigate(item.route)}
                    className="px-3.5 py-2 border-2 border-black bg-[#ffd166] text-black text-xs font-black uppercase tracking-wider rounded-xl shadow-card-sm hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
                  >
                    Open Simulator <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full border-4 border-dashed border-black/10 dark:border-white/10 rounded-2xl py-16 text-center">
            <HelpCircle size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-400">
              No matching drills found. Try loosening your search or difficulty filters!
            </p>
          </div>
        )}
      </div>

      {/* Quick Drill Interactive Modal */}
      {activeModalChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-4 border-black dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-800">
                  {activeModalChallenge.category} • +{activeModalChallenge.xpReward} XP
                </span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                  {activeModalChallenge.title}
                </h2>
              </div>
              <button
                onClick={() => setActiveModalChallenge(null)}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white font-black text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-1">
                  Drill Instruction:
                </h4>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {activeModalChallenge.instruction}
                </p>
              </div>

              {activeModalChallenge.initialCode !== undefined && (
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-1">
                    Interactive Editor Workspace:
                  </h4>
                  <textarea
                    value={userSolutionCode}
                    onChange={(e) => setUserSolutionCode(e.target.value)}
                    rows={6}
                    className="w-full p-4 font-mono text-xs bg-slate-950 text-emerald-400 rounded-2xl border-2 border-black focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              )}

              {showHintModal && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-2xl text-xs font-bold text-amber-800 dark:text-amber-300">
                  💡 Hint: {activeModalChallenge.hint}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowHintModal(!showHintModal)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
              >
                <Sparkles size={14} /> {showHintModal ? "Hide Hint" : "Show Hint"}
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(activeModalChallenge.route)}
                  className="px-4 py-2 text-xs font-black border-2 border-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl shadow-card-sm hover:-translate-y-0.5"
                >
                  Open Full Simulator →
                </button>
                <button
                  onClick={() => handleCompleteDrill(activeModalChallenge)}
                  className="px-5 py-2.5 text-xs font-black border-2 border-black bg-emerald-400 text-black rounded-xl shadow-card-sm hover:-translate-y-0.5 flex items-center gap-1.5"
                >
                  <ShieldCheck size={16} /> Complete &amp; Claim +{activeModalChallenge.xpReward} XP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChallengePage;
