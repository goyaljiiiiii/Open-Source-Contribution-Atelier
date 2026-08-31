import React, { useState, useMemo } from "react";
import { BookOpen, Search, Copy, Check } from "lucide-react";
import { CHEAT_SHEET, CATEGORIES } from "./patternLibrary";
import type { CheatEntry } from "./types";

interface CheatSheetProps {
  onInsertToken: (token: string) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3 text-muted" />
      )}
    </button>
  );
}

export function CheatSheet({ onInsertToken }: CheatSheetProps) {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(CATEGORIES[0].key);

  const filtered = useMemo(() => {
    if (!search.trim()) return CHEAT_SHEET;
    const q = search.toLowerCase();
    return CHEAT_SHEET.filter(
      (e) =>
        e.token.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CheatEntry[]>();
    filtered.forEach((e) => {
      if (!map.has(e.category)) map.set(e.category, []);
      map.get(e.category)!.push(e);
    });
    return map;
  }, [filtered]);

  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
            Cheat Sheet
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold text-muted dark:text-[#9b8f80]">
          {filtered.length} tokens
        </span>
      </div>

      <div className="p-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#0f0e0c] border-2 border-black dark:border-[#2e2924] rounded-lg px-3 py-2 mb-3">
          <Search className="w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tokens..."
            className="flex-1 bg-transparent font-mono text-xs font-bold text-text dark:text-[#f0ebe2] outline-none placeholder-[#9b8f80]"
          />
        </div>

        {/* Categories */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto">
          {CATEGORIES.map((cat) => {
            const entries = grouped.get(cat.key) || [];
            if (entries.length === 0) return null;
            const isExpanded = expandedCategory === cat.key || search.trim().length > 0;

            return (
              <div key={cat.key}>
                <button
                  onClick={() => setExpandedCategory(isExpanded && !search.trim() ? null : cat.key)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-left rounded-lg hover:bg-white/50 dark:hover:bg-[#1f1c18]/50 transition-colors"
                >
                  <span className="font-black text-[11px] uppercase text-muted dark:text-[#c4bbae]">
                    {cat.label}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-muted/60 dark:text-[#9b8f80]/60">
                    {entries.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-0.5 mt-1">
                    {entries.map((entry) => (
                      <button
                        key={entry.token}
                        onClick={() => onInsertToken(entry.token)}
                        className="group w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/80 dark:hover:bg-[#1f1c18]/80 transition-all text-left"
                        title={`Insert "${entry.token}" into pattern`}
                      >
                        <code className="font-mono text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded min-w-[60px] text-center border border-primary/20">
                          {entry.token}
                        </code>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-text dark:text-[#f0ebe2] block truncate">
                            {entry.description}
                          </span>
                          <span className="text-[10px] font-mono text-muted dark:text-[#9b8f80] block truncate">
                            {entry.example}
                          </span>
                        </div>
                        <CopyButton text={entry.token} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
