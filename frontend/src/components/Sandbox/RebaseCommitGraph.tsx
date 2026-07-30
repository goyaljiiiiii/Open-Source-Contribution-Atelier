import React from "react";
import { GitCommit, GitBranch, ArrowDown, Trash2, Edit2, Layers, Check, MoveUp, MoveDown } from "lucide-react";

export interface RebaseCommit {
  hash: string;
  message: string;
  author: string;
  files_changed?: string[];
  action?: "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";
  new_message?: string;
}

interface RebaseCommitGraphProps {
  commits: RebaseCommit[];
  onCommitActionChange: (index: number, action: RebaseCommit["action"], newMessage?: string) => void;
  onMoveCommit: (fromIndex: number, toIndex: number) => void;
  readOnly?: boolean;
}

export const RebaseCommitGraph: React.FC<RebaseCommitGraphProps> = ({
  commits,
  onCommitActionChange,
  onMoveCommit,
  readOnly = false,
}) => {
  const getActionBadgeClass = (action: RebaseCommit["action"] = "pick") => {
    switch (action) {
      case "pick":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "reword":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "edit":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "squash":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "fixup":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
      case "drop":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40 line-through opacity-60";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="w-full space-y-4">
      {commits.map((commit, idx) => {
        const currentAction = commit.action || "pick";

        return (
          <div key={commit.hash || idx} className="relative flex items-center gap-4 group">
            {/* Connecting Vertical Line */}
            {idx < commits.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-800 z-0" />
            )}

            {/* Commit Node Icon */}
            <div
              className={`relative z-10 p-2.5 rounded-xl border transition-all ${
                currentAction === "drop"
                  ? "bg-slate-950 text-slate-600 border-slate-800"
                  : currentAction === "squash"
                  ? "bg-purple-950 text-purple-400 border-purple-800"
                  : "bg-slate-900 text-indigo-400 border-slate-700"
              }`}
            >
              <GitCommit className="w-5 h-5" />
            </div>

            {/* Commit Card Container */}
            <div
              className={`flex-1 p-4 bg-slate-900 border rounded-2xl transition-all shadow-lg ${
                currentAction === "drop"
                  ? "border-slate-800/60 bg-slate-950/60 opacity-60"
                  : currentAction === "squash"
                  ? "border-purple-800/60 bg-purple-950/20"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded">
                      {commit.hash.substring(0, 7)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      by {commit.author}
                    </span>
                    {idx === 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-300 bg-indigo-950 border border-indigo-800 rounded">
                        HEAD
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-xs font-bold ${
                      currentAction === "drop" ? "line-through text-slate-500" : "text-slate-100"
                    }`}
                  >
                    {commit.new_message || commit.message}
                  </p>

                  {commit.files_changed && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {commit.files_changed.map((file) => (
                        <span
                          key={file}
                          className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-950 rounded border border-slate-800"
                        >
                          {file}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rebase Action Dropdown & Controls */}
                {!readOnly && (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                      <button
                        onClick={() => onMoveCommit(idx, idx - 1)}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveCommit(idx, idx + 1)}
                        disabled={idx === commits.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Action Selector */}
                    <select
                      value={currentAction}
                      onChange={(e) =>
                        onCommitActionChange(idx, e.target.value as RebaseCommit["action"])
                      }
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border uppercase tracking-wider focus:outline-none transition-colors cursor-pointer ${getActionBadgeClass(
                        currentAction
                      )}`}
                    >
                      <option value="pick">pick</option>
                      <option value="reword">reword</option>
                      <option value="squash">squash</option>
                      <option value="fixup">fixup</option>
                      <option value="edit">edit</option>
                      <option value="drop">drop</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
