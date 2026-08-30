import React from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { RegexFlags } from "./types";

interface RegexInputProps {
  pattern: string;
  flags: RegexFlags;
  error: string | null;
  onPatternChange: (val: string) => void;
  onFlagToggle: (flag: keyof RegexFlags) => void;
}

const FLAG_META: { key: keyof RegexFlags; label: string; desc: string }[] = [
  { key: "g", label: "g", desc: "Global" },
  { key: "i", label: "i", desc: "Case-insensitive" },
  { key: "m", label: "m", desc: "Multiline" },
  { key: "s", label: "s", desc: "Dotall" },
];

export function RegexInput({
  pattern,
  flags,
  error,
  onPatternChange,
  onFlagToggle,
}: RegexInputProps) {
  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <Search className="w-4 h-4 text-primary" />
        <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
          Regular Expression
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Pattern input */}
        <div className="flex items-center bg-white dark:bg-[#0f0e0c] border-4 border-black dark:border-[#2e2924] rounded-xl overflow-hidden focus-within:border-primary transition-colors">
          <span className="px-3 font-mono text-lg font-black text-primary select-none">/</span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => onPatternChange(e.target.value)}
            className="flex-1 py-3 pr-2 font-mono text-sm font-bold text-text dark:text-[#f0ebe2] bg-transparent outline-none placeholder-[#9b8f80]"
            placeholder="Enter regex pattern..."
            spellCheck={false}
            autoComplete="off"
          />
          <span className="px-1 font-mono text-lg font-black text-primary select-none">/</span>
          <span className="pr-3 font-mono text-sm font-bold text-muted dark:text-[#9b8f80]">
            {Object.entries(flags)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join("") || "—"}
          </span>
        </div>

        {/* Flag toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase text-muted dark:text-[#9b8f80] mr-1">Flags:</span>
          {FLAG_META.map((f) => (
            <button
              key={f.key}
              onClick={() => onFlagToggle(f.key)}
              title={f.desc}
              className={`px-2.5 py-1 font-mono text-xs font-black rounded-lg border-2 transition-all ${
                flags[f.key]
                  ? "bg-primary text-black border-black shadow-card-sm"
                  : "bg-white dark:bg-[#1f1c18] text-muted dark:text-[#9b8f80] border-black/15 dark:border-[#2e2924] hover:border-black dark:hover:border-[#c4bbae]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 border-2 border-red-300 dark:border-red-800 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs font-bold text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
