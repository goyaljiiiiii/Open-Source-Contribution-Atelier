import React, { useState } from 'react';

export interface LintIssue {
  line: number;
  message: string;
  rule: string;
}

export interface LinterSectionProps {
  title: string;
  severity: 'Error' | 'Warning' | 'Convention';
  issues: LintIssue[];
}

export function DockerfileLinterSection({ title, severity, issues }: LinterSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (issues.length === 0) return null;

  // Design tokens for severity styling tags
  const styles = {
    Error: {
      bg: 'bg-rose-500/10 hover:bg-rose-500/15',
      border: 'border-rose-500/20',
      text: 'text-rose-400',
      badge: 'bg-rose-500/20 text-rose-300'
    },
    Warning: {
      bg: 'bg-amber-500/10 hover:bg-amber-500/15',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-300'
    },
    Convention: {
      bg: 'bg-blue-500/10 hover:bg-blue-500/15',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300'
    }
  }[severity];

  return (
    <div className={`border ${styles.border} rounded-xl overflow-hidden mb-4 bg-slate-900/20 backdrop-blur-sm transition-all duration-200`}>
      {/* Header Panel acting as the collapse trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between p-4 text-left font-semibold ${styles.bg} ${styles.text} transition-colors duration-150`}
      >
        <div className="flex items-center space-x-3">
          <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}>
            ▶
          </span>
          <span className="text-sm font-bold tracking-tight">{title}</span>
          <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${styles.badge}`}>
            {issues.length}
          </span>
        </div>
      </button>

      {/* Issues Accordion Content Area */}
      {isOpen && (
        <div className="border-t border-slate-800/40 bg-slate-950/20 p-2 divide-y divide-slate-800/40 animate-fade-in">
          {issues.map((issue, idx) => (
            <div key={idx} className="p-3 text-xs flex items-start space-x-4 text-slate-300">
              <span className="font-mono bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded shadow-sm shrink-0">
                Line {issue.line}
              </span>
              <div className="flex-1 space-y-1">
                <p className="leading-relaxed text-slate-200">{issue.message}</p>
                <p className="text-[10px] text-slate-500 font-mono">Rule: {issue.rule}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DockerfileLinterSection;
