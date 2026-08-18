import React, { useState } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/themes/prism-tomorrow.css";
import { Copy, Check, FileCode, Terminal, Code, Cpu } from "lucide-react";
import { toast } from "react-hot-toast";

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  collapsible?: boolean;
  className?: string;
}

const LANGUAGE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  ts: { label: "TS", bg: "bg-blue-500/20", text: "text-blue-400" },
  typescript: { label: "TS", bg: "bg-blue-500/20", text: "text-blue-400" },
  js: { label: "JS", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  javascript: { label: "JS", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  python: { label: "Python", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  py: { label: "Python", bg: "bg-emerald-500/20", text: "text-emerald-400" },
  bash: { label: "Bash", bg: "bg-purple-500/20", text: "text-purple-400" },
  sh: { label: "Bash", bg: "bg-purple-500/20", text: "text-purple-400" },
  json: { label: "JSON", bg: "bg-amber-500/20", text: "text-amber-400" },
  yaml: { label: "YAML", bg: "bg-red-500/20", text: "text-red-400" },
  yml: { label: "YAML", bg: "bg-red-500/20", text: "text-red-400" },
  sql: { label: "SQL", bg: "bg-cyan-500/20", text: "text-cyan-400" },
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "typescript",
  filename,
  showLineNumbers = true,
  highlightLines = [],
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const langKey = language.toLowerCase();
  const badgeInfo = LANGUAGE_BADGES[langKey] || {
    label: language.toUpperCase(),
    bg: "bg-gray-800",
    text: "text-gray-300",
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Prism Highlight
  const getHighlightedCode = () => {
    let grammar = Prism.languages.javascript;
    if (langKey === "python" || langKey === "py") grammar = Prism.languages.python;
    else if (langKey === "typescript" || langKey === "ts") grammar = Prism.languages.typescript;
    else if (langKey === "bash" || langKey === "sh") grammar = Prism.languages.bash;
    else if (langKey === "json") grammar = Prism.languages.json;
    else if (langKey === "yaml" || langKey === "yml") grammar = Prism.languages.yaml;

    if (!grammar) return code;
    return Prism.highlight(code.trim(), grammar, langKey);
  };

  const lines = code.trim().split("\n");

  return (
    <div className={`w-full rounded-2xl border border-gray-800 bg-[#0d0f17] shadow-xl overflow-hidden text-gray-200 font-mono text-xs ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#131622] border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          {langKey === "bash" || langKey === "sh" ? (
            <Terminal className="w-4 h-4 text-purple-400" />
          ) : (
            <FileCode className="w-4 h-4 text-blue-400" />
          )}

          {filename && (
            <span className="text-xs font-semibold text-gray-300 font-mono">
              {filename}
            </span>
          )}

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${badgeInfo.bg} ${badgeInfo.text}`}
          >
            {badgeInfo.label}
          </span>
        </div>

        {/* Copy to Clipboard Action */}
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            copied
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-[#1c2030] hover:bg-[#252b40] text-gray-300 border border-gray-700"
          }`}
          aria-label="Copy to Clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Code Display Area */}
      <div className="p-4 overflow-x-auto bg-[#07090f]">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightLines.includes(lineNum);
              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isHighlighted ? "bg-blue-500/15 border-l-2 border-blue-500" : ""
                  }`}
                >
                  {showLineNumbers && (
                    <td className="pr-4 text-right select-none text-gray-600 font-mono text-[11px] w-8">
                      {lineNum}
                    </td>
                  )}
                  <td className="whitespace-pre text-gray-200">
                    <span
                      dangerouslySetInnerHTML={{
                        __html: Prism.highlight(
                          line,
                          Prism.languages[langKey] || Prism.languages.javascript,
                          langKey,
                        ),
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CodeBlock;
