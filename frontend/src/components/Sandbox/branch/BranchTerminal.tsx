import React, { useRef, useEffect } from "react";
import { Terminal, Trash2 } from "lucide-react";

interface BranchTerminalProps {
  logs: string[];
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClearLogs: () => void;
  currentBranch: string;
}

export function BranchTerminal({
  logs,
  input,
  onInputChange,
  onSubmit,
  onClearLogs,
  currentBranch,
}: BranchTerminalProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="bg-[#0a0a0f] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[#2e2924] bg-[#151411]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="font-mono text-[10px] font-bold text-[#c4bbae] uppercase tracking-wider">
            Branch Workflow Terminal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
            {currentBranch}
          </span>
          <button
            onClick={onClearLogs}
            className="text-[#9b8f80] hover:text-red-400 transition-colors"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs area */}
      <div
        className="p-4 font-mono text-xs leading-relaxed overflow-y-auto"
        style={{ maxHeight: 280 }}
      >
        {logs.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap ${
              line.startsWith("$")
                ? "text-green-400 font-bold"
                : line.startsWith("✅") || line.startsWith("🎉")
                  ? "text-yellow-400 font-bold"
                  : line.startsWith("❌")
                    ? "text-red-400"
                    : line.startsWith("⚠️")
                      ? "text-amber-400"
                      : "text-[#c4bbae]"
            }`}
          >
            {line}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t-2 border-[#2e2924] bg-[#0f0e0c]"
      >
        <span className="font-mono text-xs font-bold text-green-400 select-none">
          <span className="text-[#9b8f80]">~/repo</span>
          <span className="text-[#4a4540]"> (</span>
          <span className="text-green-400">{currentBranch}</span>
          <span className="text-[#4a4540]">)</span>
          <span className="text-green-400"> $</span>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          className="flex-1 bg-transparent font-mono text-xs text-green-400 outline-none placeholder-[#4a4540]"
          placeholder="Type a git command..."
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  );
}
