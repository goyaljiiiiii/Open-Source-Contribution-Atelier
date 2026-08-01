import React, { useState } from "react";
import { AlertTriangle, Check, X, Sparkles } from "lucide-react";
import { RebaseCommit } from "./RebaseCommitGraph";

interface RebaseControlsModalProps {
  commits: RebaseCommit[];
  conflicts: { commit_hash: string; file: string; conflict_hunk: string }[];
  onResolveConflict: () => void;
  onClose: () => void;
}

export const RebaseControlsModal: React.FC<RebaseControlsModalProps> = ({
  conflicts,
  onResolveConflict,
  onClose,
}) => {
  const [resolvedHunks, setResolvedHunks] = useState<Record<number, boolean>>({});

  const handleToggleResolve = (idx: number) => {
    setResolvedHunks((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const allResolved = conflicts.length === 0 || conflicts.every((_, i) => resolvedHunks[i]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-3xl shadow-2xl overflow-hidden text-text dark:text-[#f0ebe2]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-surface-low dark:bg-[#0f0e0c] border-b-2 border-black/10 dark:border-[#2e2924]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-black text-text dark:text-white">
              Interactive Rebase Conflict Resolution
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-text dark:hover:text-white rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Hunks List */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-400 font-medium">
            Git rebase paused due to conflicting changes in reordered commits. Resolve the conflict markers below to execute <code className="font-mono text-amber-500">git rebase --continue</code>.
          </p>

          {conflicts.map((conflict, idx) => (
            <div
              key={idx}
              className="p-4 bg-surface-low/50 dark:bg-[#0f0e0c] border-2 border-amber-500/30 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-500">
                  File: {conflict.file} ({conflict.commit_hash.substring(0, 7)})
                </span>
                <button
                  onClick={() => handleToggleResolve(idx)}
                  className={`px-3 py-1 text-xs font-bold rounded-xl border-2 transition-all flex items-center gap-1 ${
                    resolvedHunks[idx]
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {resolvedHunks[idx] ? "Resolved" : "Mark Resolved"}
                </button>
              </div>

              <pre className="p-3 bg-white dark:bg-[#1a1714] border border-black/10 dark:border-[#2e2924] rounded-xl font-mono text-xs text-rose-500 dark:text-rose-400 overflow-x-auto">
                {conflict.conflict_hunk}
              </pre>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-low dark:bg-[#0f0e0c] border-t-2 border-black/10 dark:border-[#2e2924] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-text rounded-xl"
          >
            Cancel Rebase
          </button>

          <button
            onClick={onResolveConflict}
            disabled={!allResolved}
            className={`px-5 py-2.5 text-xs font-black rounded-xl flex items-center gap-2 transition-all shadow-card-sm ${
              allResolved
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-surface-low text-slate-400 cursor-not-allowed border border-black/10 dark:border-[#2e2924]"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Continue Rebase (git rebase --continue)
          </button>
        </div>
      </div>
    </div>
  );
};
