import React, { useState } from "react";
import { AlertTriangle, Check, X, Code, Sparkles, Terminal } from "lucide-react";
import { RebaseCommit } from "./RebaseCommitGraph";

interface RebaseControlsModalProps {
  commits: RebaseCommit[];
  conflicts: { commit_hash: string; file: string; conflict_hunk: string }[];
  onResolveConflict: () => void;
  onClose: () => void;
}

export const RebaseControlsModal: React.FC<RebaseControlsModalProps> = ({
  commits,
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
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              Interactive Rebase Conflict Resolution
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Hunks List */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <p className="text-xs text-slate-300">
            Git rebase paused due to conflicting changes in reordered commits. Resolve the conflict markers below to continue rebase.
          </p>

          {conflicts.map((conflict, idx) => (
            <div
              key={idx}
              className="p-4 bg-slate-950 border border-amber-900/50 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">
                  File: {conflict.file} ({conflict.commit_hash.substring(0, 7)})
                </span>
                <button
                  onClick={() => handleToggleResolve(idx)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                    resolvedHunks[idx]
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                      : "bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {resolvedHunks[idx] ? "Resolved" : "Mark Resolved"}
                </button>
              </div>

              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xs text-rose-300 overflow-x-auto">
                {conflict.conflict_hunk}
              </pre>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"
          >
            Cancel Rebase
          </button>

          <button
            onClick={onResolveConflict}
            disabled={!allResolved}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg ${
              allResolved
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
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
