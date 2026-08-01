import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, GitCommit, GitMerge, RefreshCw, LogOut } from "lucide-react";

type Commit = {
  sha: string;
  message: string;
  branch: string;
  parentSha: string | null;
  mergeParentSha: string | null;
};

type GitState = {
  commits: Commit[];
  branches: Record<string, string>; // branch name -> commit sha
  currentBranch: string;
};

const INITIAL_STATE: GitState = {
  commits: [
    {
      sha: "c100000",
      message: "Initial commit",
      branch: "main",
      parentSha: null,
      mergeParentSha: null,
    },
  ],
  branches: { main: "c100000" },
  currentBranch: "main",
};

const BRANCH_Y_MAP: Record<string, number> = {
  main: 40,
  feature: 120,
};

const NODE_X_SPACING = 80;

function generateSha() {
  return Math.random().toString(16).substring(2, 8);
}

export function GitVisualizer() {
  const [state, setState] = useState<GitState>(INITIAL_STATE);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const handleCommit = () => {
    setState((prev) => {
      const parentSha = prev.branches[prev.currentBranch];
      const newSha = generateSha();
      const newCommit: Commit = {
        sha: newSha,
        message: `Commit on ${prev.currentBranch}`,
        branch: prev.currentBranch,
        parentSha,
        mergeParentSha: null,
      };

      return {
        ...prev,
        commits: [...prev.commits, newCommit],
        branches: { ...prev.branches, [prev.currentBranch]: newSha },
      };
    });
  };

  const handleBranch = () => {
    setState((prev) => {
      if (prev.branches["feature"]) return prev; // Already exists
      return {
        ...prev,
        branches: { ...prev.branches, feature: prev.branches[prev.currentBranch] },
      };
    });
  };

  const handleCheckout = (branchName: string) => {
    setState((prev) => ({
      ...prev,
      currentBranch: branchName,
    }));
  };

  const handleMerge = () => {
    setState((prev) => {
      if (prev.currentBranch !== "main" || !prev.branches["feature"]) return prev;

      const mainSha = prev.branches["main"];
      const featureSha = prev.branches["feature"];

      if (mainSha === featureSha) return prev; // Up to date

      const newSha = generateSha();
      const newCommit: Commit = {
        sha: newSha,
        message: `Merge branch 'feature'`,
        branch: "main",
        parentSha: mainSha,
        mergeParentSha: featureSha,
      };

      return {
        ...prev,
        commits: [...prev.commits, newCommit],
        branches: { ...prev.branches, main: newSha },
      };
    });
  };

  const resetState = () => setState(INITIAL_STATE);

  // Compute Layout
  const layout = useMemo(() => {
    return state.commits.map((commit, index) => ({
      ...commit,
      x: index * NODE_X_SPACING + 40,
      y: BRANCH_Y_MAP[commit.branch] ?? 40,
    }));
  }, [state.commits]);

  const edges = useMemo(() => {
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number; isMerge: boolean }[] = [];

    layout.forEach((node) => {
      if (node.parentSha) {
        const parentNode = layout.find((n) => n.sha === node.parentSha);
        if (parentNode) {
          lines.push({
            id: `${parentNode.sha}-${node.sha}`,
            x1: parentNode.x,
            y1: parentNode.y,
            x2: node.x,
            y2: node.y,
            isMerge: false,
          });
        }
      }

      if (node.mergeParentSha) {
        const mergeNode = layout.find((n) => n.sha === node.mergeParentSha);
        if (mergeNode) {
          lines.push({
            id: `${mergeNode.sha}-${node.sha}-merge`,
            x1: mergeNode.x,
            y1: mergeNode.y,
            x2: node.x,
            y2: node.y,
            isMerge: true,
          });
        }
      }
    });
    return lines;
  }, [layout]);

  const maxCanvasWidth = Math.max(800, layout.length * NODE_X_SPACING + 100);

  const hasFeatureBranch = !!state.branches["feature"];
  const isFeatureUpToDate = hasFeatureBranch && state.branches["main"] === state.branches["feature"];

  return (
    <article className="space-y-4 rounded-xl border border-black/10 bg-surface p-5 shadow-sm dark:border-white/10 dark:bg-[#12121a]">
      <div className="flex flex-col gap-4 border-b border-black/10 pb-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-bold">Interactive Git Visualizer</h3>
          <p className="mt-1 text-sm text-muted dark:text-[#c4bbae]">
            Visualize branching and merging with live Git commands.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCommit}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <GitCommit size={16} /> git commit
          </button>

          {!hasFeatureBranch ? (
            <button
              type="button"
              onClick={handleBranch}
              className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <GitBranch size={16} /> git branch feature
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleCheckout(state.currentBranch === "main" ? "feature" : "main")}
              className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <LogOut size={16} /> checkout {state.currentBranch === "main" ? "feature" : "main"}
            </button>
          )}

          {state.currentBranch === "main" && hasFeatureBranch && !isFeatureUpToDate && (
            <button
              type="button"
              onClick={handleMerge}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <GitMerge size={16} /> git merge feature
            </button>
          )}

          <button
            type="button"
            onClick={resetState}
            className="ml-auto p-2 text-muted hover:text-black dark:text-[#c4bbae] dark:hover:text-white"
            aria-label="Reset visualizer"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-lg border border-black/5 bg-black/[0.02] p-4 dark:border-white/5 dark:bg-white/[0.02]">
        <div className="flex min-w-[max-content] items-center text-sm font-medium text-muted dark:text-[#c4bbae] mb-2">
          Current HEAD: <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-xs text-primary dark:text-primary">{state.currentBranch}</span>
        </div>
        
        <svg width={maxCanvasWidth} height="200" className="block min-w-full">
          <g>
            <AnimatePresence>
              {edges.map((edge) => (
                <motion.path
                  key={edge.id}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  d={`M ${edge.x1} ${edge.y1} C ${edge.x1 + 40} ${edge.y1}, ${edge.x2 - 40} ${edge.y2}, ${edge.x2} ${edge.y2}`}
                  fill="none"
                  strokeWidth="3"
                  className={edge.isMerge ? "stroke-emerald-400 dark:stroke-emerald-600" : "stroke-black/20 dark:stroke-white/20"}
                  strokeDasharray={edge.isMerge ? "6,6" : "none"}
                />
              ))}
            </AnimatePresence>
          </g>

          <g>
            <AnimatePresence>
              {layout.map((node) => {
                const isHead = state.branches[state.currentBranch] === node.sha;
                const branchPointers = Object.entries(state.branches)
                  .filter(([, sha]) => sha === node.sha)
                  .map(([name]) => name);

                return (
                  <motion.g
                    key={node.sha}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseEnter={() => setHoveredNode(node.sha)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                  >
                    <circle
                      r="12"
                      className="fill-surface stroke-[3px] dark:fill-[#12121a]"
                      style={{
                        stroke: node.branch === "main" ? "#3b82f6" : "#8b5cf6", // blue-500 / violet-500
                      }}
                    />
                    {isHead && (
                      <circle
                        r="18"
                        className="fill-transparent stroke-primary stroke-2 opacity-50"
                        strokeDasharray="4,4"
                      />
                    )}

                    {/* Tooltip implementation using foreignObject to keep things contained or just title */}
                    <title>
                      {`Commit: ${node.sha}\nMessage: ${node.message}\nBranch: ${node.branch}`}
                      {branchPointers.length > 0 ? `\nPointers: ${branchPointers.join(", ")}` : ""}
                    </title>
                    
                    {/* Branch Labels */}
                    {branchPointers.map((branchName, idx) => (
                      <text
                        key={branchName}
                        y={-24 - idx * 16}
                        x={0}
                        textAnchor="middle"
                        className="fill-black/60 text-[10px] font-bold dark:fill-white/60"
                      >
                        {branchName} {state.currentBranch === branchName ? "(HEAD)" : ""}
                      </text>
                    ))}
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </g>
        </svg>

        {/* Floating Tooltip Div */}
        {hoveredNode && (
          <div className="absolute top-4 right-4 rounded-md border border-black/10 bg-surface/90 p-3 text-xs shadow-md backdrop-blur dark:border-white/10 dark:bg-[#12121a]/90">
            {(() => {
              const commit = state.commits.find((c) => c.sha === hoveredNode);
              if (!commit) return null;
              return (
                <>
                  <div className="font-mono text-primary font-bold">{commit.sha}</div>
                  <div className="mt-1 font-semibold">{commit.message}</div>
                  <div className="mt-2 text-muted dark:text-[#c4bbae]">
                    Branch: <span className="font-medium">{commit.branch}</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </article>
  );
}
