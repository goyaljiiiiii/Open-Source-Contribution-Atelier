import React, { useMemo } from "react";
import { FileText, Copy, Check } from "lucide-react";
import type { RegexMatch } from "./types";
import { GROUP_COLORS } from "./patternLibrary";

interface MatchHighlighterProps {
  testString: string;
  onTestStringChange: (val: string) => void;
  matches: RegexMatch[];
}

export function MatchHighlighter({
  testString,
  onTestStringChange,
  matches,
}: MatchHighlighterProps) {
  const [copied, setCopied] = React.useState(false);

  const highlightedParts = useMemo(() => {
    if (!testString || matches.length === 0) return [{ text: testString, highlight: false, matchIdx: -1 }];

    const parts: { text: string; highlight: boolean; matchIdx: number }[] = [];
    let lastEnd = 0;

    matches.forEach((m, i) => {
      if (m.start > lastEnd) {
        parts.push({ text: testString.slice(lastEnd, m.start), highlight: false, matchIdx: -1 });
      }
      parts.push({ text: m.text, highlight: true, matchIdx: i });
      lastEnd = m.end;
    });

    if (lastEnd < testString.length) {
      parts.push({ text: testString.slice(lastEnd), highlight: false, matchIdx: -1 });
    }

    return parts;
  }, [testString, matches]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(testString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
            Test String
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[10px] font-black px-2.5 py-1 rounded-full border ${
              matches.length > 0
                ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
                : "bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
            }`}
          >
            {matches.length} match{matches.length !== 1 ? "es" : ""}
          </span>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Copy test string"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Highlighted preview */}
        <div className="bg-white dark:bg-[#0f0e0c] border-2 border-black/10 dark:border-[#2e2924] rounded-xl p-4 min-h-[80px] font-mono text-sm leading-relaxed text-text dark:text-[#f0ebe2] whitespace-pre-wrap break-all">
          {highlightedParts.length === 0 || (highlightedParts.length === 1 && !highlightedParts[0].highlight) ? (
            <span className="text-muted dark:text-[#9b8f80] italic">
              {testString || "Type or paste test text below..."}
            </span>
          ) : (
            highlightedParts.map((part, i) =>
              part.highlight ? (
                <mark
                  key={i}
                  className="bg-yellow-300 dark:bg-yellow-500/30 text-black dark:text-yellow-200 px-0.5 rounded font-bold"
                  title={`Match ${part.matchIdx + 1}`}
                >
                  {part.text}
                </mark>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )
          )}
        </div>

        {/* Editable textarea */}
        <textarea
          value={testString}
          onChange={(e) => onTestStringChange(e.target.value)}
          className="w-full h-32 px-4 py-3 font-mono text-xs text-text dark:text-[#f0ebe2] bg-white dark:bg-[#0f0e0c] border-2 border-black dark:border-[#2e2924] rounded-xl outline-none focus:border-primary transition-colors resize-y placeholder-[#9b8f80]"
          placeholder="Enter test string to match against..."
          spellCheck={false}
        />

        {/* Match details table */}
        {matches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b-2 border-black/10 dark:border-[#2e2924]">
                  <th className="text-left py-2 px-2 font-black text-muted dark:text-[#9b8f80]">#</th>
                  <th className="text-left py-2 px-2 font-black text-muted dark:text-[#9b8f80]">Match</th>
                  <th className="text-left py-2 px-2 font-black text-muted dark:text-[#9b8f80]">Index</th>
                  <th className="text-left py-2 px-2 font-black text-muted dark:text-[#9b8f80]">Groups</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 50).map((m, i) => (
                  <tr
                    key={i}
                    className="border-b border-black/5 dark:border-[#2e2924]/50 hover:bg-primary/5 transition-colors"
                  >
                    <td className="py-1.5 px-2 font-bold text-muted dark:text-[#9b8f80]">{i + 1}</td>
                    <td className="py-1.5 px-2">
                      <span className="bg-yellow-200 dark:bg-yellow-500/20 text-yellow-900 dark:text-yellow-300 px-1.5 py-0.5 rounded font-bold">
                        {m.text.length > 40 ? m.text.slice(0, 40) + "…" : m.text}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-muted dark:text-[#c4bbae]">
                      {m.start}–{m.end}
                    </td>
                    <td className="py-1.5 px-2">
                      {m.groups.length > 0 && m.groups.some((g) => g !== undefined) ? (
                        <div className="flex flex-wrap gap-1">
                          {m.groups.map((g, gi) =>
                            g !== undefined ? (
                              <span
                                key={gi}
                                className="px-1.5 py-0.5 rounded border font-bold"
                                style={{
                                  backgroundColor: `${GROUP_COLORS[gi % GROUP_COLORS.length]}15`,
                                  color: GROUP_COLORS[gi % GROUP_COLORS.length],
                                  borderColor: `${GROUP_COLORS[gi % GROUP_COLORS.length]}40`,
                                }}
                              >
                                ${gi + 1}: {g}
                              </span>
                            ) : null
                          )}
                        </div>
                      ) : (
                        <span className="text-muted dark:text-[#9b8f80]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matches.length > 50 && (
              <p className="text-[10px] font-bold text-muted dark:text-[#9b8f80] mt-2 text-center">
                Showing 50 of {matches.length} matches
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
