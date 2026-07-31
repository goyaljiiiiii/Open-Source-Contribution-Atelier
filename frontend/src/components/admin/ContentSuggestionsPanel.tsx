import React from "react";
import { Sparkles, AlertTriangle, Info, Code, FileText, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { analyzeLessonMarkdown, LessonAnalysisReport, AnalysisSuggestion } from "../../utils/lessonContentAnalyzer";

interface ContentSuggestionsPanelProps {
  markdown: string;
  onApplyFix?: (suggestion: AnalysisSuggestion) => void;
}

export function ContentSuggestionsPanel({ markdown, onApplyFix }: ContentSuggestionsPanelProps) {
  const report: LessonAnalysisReport = analyzeLessonMarkdown(markdown);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-emerald-500 text-white";
    if (score >= 50) return "bg-amber-500 text-white";
    return "bg-rose-500 text-white";
  };

  return (
    <div className="bg-white dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl p-5 shadow-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-[#2e2924] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-black dark:text-[#f0ebe2]">AI Content Quality Inspector</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Automated markdown readability & structure suggestions</p>
          </div>
        </div>

        {/* Readability Score Badge */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">Flesch Reading Ease</p>
            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Grade {report.gradeLevel}</p>
          </div>
          <div
            className={`px-3 py-1.5 rounded-xl font-mono text-sm font-black shadow-sm ${getScoreColor(
              report.readingEaseScore,
            )}`}
          >
            {report.readingEaseScore}/100
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
        <div className="p-2 bg-slate-50 dark:bg-[#1f1c18] rounded-xl border border-slate-200 dark:border-[#2e2924]">
          <span className="text-slate-400 block text-[10px]">WORDS</span>
          <span className="font-bold text-sm text-black dark:text-white">{report.wordCount}</span>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-[#1f1c18] rounded-xl border border-slate-200 dark:border-[#2e2924]">
          <span className="text-slate-400 block text-[10px]">SENTENCES</span>
          <span className="font-bold text-sm text-black dark:text-white">{report.sentenceCount}</span>
        </div>
        <div className="p-2 bg-slate-50 dark:bg-[#1f1c18] rounded-xl border border-slate-200 dark:border-[#2e2924]">
          <span className="text-slate-400 block text-[10px]">SUGGESTIONS</span>
          <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">{report.suggestions.length}</span>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {report.suggestions.length === 0 ? (
          <div className="text-center py-6 text-emerald-600 dark:text-emerald-400 flex flex-col items-center gap-1">
            <CheckCircle2 size={28} />
            <p className="font-bold text-sm">Excellent content quality!</p>
            <p className="text-xs text-slate-500">No readability issues, passive voice, or missing code blocks detected.</p>
          </div>
        ) : (
          report.suggestions.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border-2 transition-all ${
                item.severity === "warning"
                  ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/50"
                  : "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.type === "code" && <Code size={16} className="text-amber-600 shrink-0" />}
                  {item.type === "missing_alt" && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                  {item.type === "internal_link" && <LinkIcon size={16} className="text-indigo-600 shrink-0" />}
                  {item.type !== "code" && item.type !== "missing_alt" && item.type !== "internal_link" && (
                    <Info size={16} className="text-indigo-600 shrink-0" />
                  )}
                  <h4 className="font-bold text-xs text-black dark:text-[#f0ebe2]">{item.title}</h4>
                </div>
                {item.line && (
                  <span className="text-[10px] font-mono bg-slate-200 dark:bg-[#2e2924] px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">
                    Line {item.line}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{item.message}</p>

              {item.suggestedFix && onApplyFix && (
                <button
                  onClick={() => onApplyFix(item)}
                  className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-white dark:bg-[#151411] px-2.5 py-1 rounded-md border border-indigo-300 dark:border-indigo-800 shadow-sm"
                >
                  Apply Suggested Link/Fix
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
