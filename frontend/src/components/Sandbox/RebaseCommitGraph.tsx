import React, { useState } from "react";
import { GitCommit, ArrowUp, ArrowDown, Check } from "lucide-react";

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempMessage, setTempMessage] = useState<string>("");

  const handleStartReword = (index: number, currentMsg: string) => {
    setEditingIndex(index);
    setTempMessage(currentMsg);
  };

  const handleSaveReword = (index: number) => {
    onCommitActionChange(index, "reword", tempMessage);
    setEditingIndex(null);
  };

  const getActionBadge = (action: RebaseCommit["action"] = "pick") => {
    switch (action) {
      case "pick":
        return { label: "pick", bg: "bg-emerald-400 text-black border-2 border-black font-black" };
      case "reword":
        return { label: "reword", bg: "bg-cyan-300 text-black border-2 border-black font-black" };
      case "edit":
        return { label: "edit", bg: "bg-amber-300 text-black border-2 border-black font-black" };
      case "squash":
        return { label: "squash", bg: "bg-purple-300 text-black border-2 border-black font-black" };
      case "fixup":
        return { label: "fixup", bg: "bg-indigo-300 text-black border-2 border-black font-black" };
      case "drop":
        return { label: "drop", bg: "bg-rose-400 text-black border-2 border-black font-black line-through opacity-75" };
      default:
        return { label: "pick", bg: "bg-gray-200 text-black border-2 border-black font-black" };
    }
  };

  return (
    <div className="w-full space-y-4">
      {commits.map((commit, idx) => {
        const currentAction = commit.action || "pick";
        const badge = getActionBadge(currentAction);
        const isEditing = editingIndex === idx;

        return (
          <div key={commit.hash || idx} className="relative flex items-start gap-3 sm:gap-4">
            {/* Vertical Connecting DAG Line */}
            {idx < commits.length - 1 && (
              <div className="absolute left-4 sm:left-5 top-10 bottom-0 w-1 bg-black dark:bg-[#2e2924] z-0" />
            )}

            {/* Commit Node Icon */}
            <div
              className={`relative z-10 p-2 sm:p-2.5 rounded-xl border-2 border-black dark:border-[#2e2924] transition-all shrink-0 ${
                currentAction === "drop"
                  ? "bg-slate-200 dark:bg-black text-slate-500"
                  : currentAction === "squash"
                  ? "bg-[#C3C0FF] text-black"
                  : "bg-white dark:bg-[#151411] text-black dark:text-white shadow-card-sm"
              }`}
            >
              <GitCommit className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            {/* Commit Card Container - Guaranteed 100% bounds containment */}
            <div
              className={`flex-1 min-w-0 p-3.5 sm:p-4 bg-white dark:bg-[#151411] border-2 border-black dark:border-[#2e2924] rounded-2xl space-y-3 shadow-card-sm overflow-hidden ${
                currentAction === "drop"
                  ? "opacity-60 bg-slate-100 dark:bg-black/40"
                  : currentAction === "squash"
                  ? "bg-purple-500/5 dark:bg-purple-950/20"
                  : ""
              }`}
            >
              {/* Row 1: Badges & Info */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black text-black dark:text-white bg-[#C3C0FF] px-2 py-0.5 rounded border-2 border-black">
                    {commit.hash.substring(0, 7)}
                  </span>

                  <span className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded ${badge.bg}`}>
                    {badge.label}
                  </span>

                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                    by {commit.author}
                  </span>

                  {idx === 0 && (
                    <span className="text-[10px] font-mono font-black text-black bg-amber-300 px-1.5 py-0.5 rounded border-2 border-black uppercase">
                      HEAD
                    </span>
                  )}
                </div>

                {commit.files_changed && commit.files_changed.length > 0 && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    Files: {commit.files_changed.join(", ")}
                  </span>
                )}
              </div>

              {/* Row 2: Commit Title / Reword Editor */}
              {isEditing ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={tempMessage}
                    onChange={(e) => setTempMessage(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0f0e0c] border-2 border-black dark:border-[#2e2924] rounded-xl font-mono text-xs text-black dark:text-white outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveReword(idx)}
                    className="p-1.5 bg-black text-white rounded-lg text-xs font-black hover:bg-slate-800"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p
                  className={`text-xs sm:text-sm font-bold truncate ${
                    currentAction === "drop"
                      ? "line-through text-slate-400 dark:text-slate-500"
                      : "text-black dark:text-[#f0ebe2]"
                  }`}
                >
                  {commit.new_message || commit.message}
                </p>
              )}

              {/* Row 3: Action Controls Bar (Neatly contained inside card) */}
              {!readOnly && (
                <div className="pt-2 border-t-2 border-black/10 dark:border-[#2e2924] flex flex-wrap items-center justify-between gap-2">
                  {/* Action Selector Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["pick", "reword", "squash", "drop"] as const).map((act) => (
                      <button
                        key={act}
                        onClick={() => {
                          if (act === "reword") {
                            handleStartReword(idx, commit.new_message || commit.message);
                          } else {
                            onCommitActionChange(idx, act);
                          }
                        }}
                        className={`px-2.5 py-1 text-[11px] font-mono font-black uppercase rounded-lg border-2 border-black transition-all ${
                          currentAction === act
                            ? "bg-black text-white shadow-xs"
                            : "bg-white dark:bg-[#0f0e0c] text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#1f1c18]"
                        }`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>

                  {/* Move Up / Down Buttons */}
                  <div className="flex items-center gap-1 bg-surface-low dark:bg-[#0f0e0c] p-1 rounded-lg border-2 border-black dark:border-[#2e2924]">
                    <button
                      disabled={idx === 0}
                      onClick={() => onMoveCommit(idx, idx - 1)}
                      title="Move commit up"
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#1f1c18] text-black dark:text-white disabled:opacity-20"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === commits.length - 1}
                      onClick={() => onMoveCommit(idx, idx + 1)}
                      title="Move commit down"
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#1f1c18] text-black dark:text-white disabled:opacity-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
