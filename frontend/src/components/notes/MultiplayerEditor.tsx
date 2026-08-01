import React, { useRef } from "react";
import { PeerUser } from "./PeerCursorOverlay";
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  CheckSquare,
  Sparkles,
  Zap,
} from "lucide-react";

interface MultiplayerEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  onCursorMove?: (cursor: { line: number; column: number }) => void;
  peers: PeerUser[];
  currentUserId?: string;
  readOnly?: boolean;
}

export const MultiplayerEditor: React.FC<MultiplayerEditorProps> = ({
  value,
  onChange,
  onCursorMove,
  peers,
  currentUserId,
  readOnly = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lines = value.split("\n");
  const lineCount = lines.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const handleSelectionChange = () => {
    if (!textareaRef.current || !onCursorMove) return;
    const selectionStart = textareaRef.current.selectionStart;
    const textUpToCursor = value.substring(0, selectionStart);
    const lineLines = textUpToCursor.split("\n");
    const lineNumber = lineLines.length;
    const colNumber = lineLines[lineLines.length - 1].length + 1;

    onCursorMove({ line: lineNumber, column: colNumber });
  };

  const insertFormatting = (prefix: string, suffix: string = "") => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.substring(start, end);
    const replacement = `${prefix}${selectedText || "text"}${suffix}`;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText.length || 4));
    }, 50);
  };

  const activePeers = peers.filter((p) => p.user_id !== currentUserId);

  return (
    <div className="relative w-full h-full flex flex-col bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Quick Formatting Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => insertFormatting("**", "**")}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
            title="Bold (**text**)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("*", "*")}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
            title="Italic (*text*)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("# ")}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
            title="Heading 1 (# Heading)"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("## ")}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
            title="Heading 2 (## Heading)"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("```typescript\n", "\n```")}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
            title="Code Block (```code```)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("- ")}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
            title="Bullet List (- item)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting("- [ ] ")}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-gray-700 dark:text-gray-200 transition-colors"
            title="Checkbox (- [ ] task)"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Peer Cursors Bar */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {activePeers.map((peer) => (
            <span
              key={peer.user_id}
              className="px-2 py-0.5 text-[10px] font-bold text-white rounded-full flex items-center gap-1 shadow-sm"
              style={{ backgroundColor: peer.color }}
            >
              <Zap className="w-2.5 h-2.5 animate-pulse" />
              {peer.username} ({peer.cursor?.line || 1}:{peer.cursor?.column || 1})
            </span>
          ))}
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div className="relative flex-1 flex overflow-hidden font-mono text-xs sm:text-sm">
        {/* Line Numbers Gutter */}
        <div className="py-4 px-3 bg-slate-50 dark:bg-slate-950/80 border-r border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-600 select-none text-right min-w-[3rem]">
          {lines.map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Main Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={handleSelectionChange}
          onClick={handleSelectionChange}
          readOnly={readOnly}
          placeholder="Type live Markdown or Code here..."
          className="w-full h-full p-4 bg-transparent text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-600 leading-6 resize-none focus:outline-none custom-scrollbar"
          spellCheck={false}
        />
      </div>

      {/* Bottom Footer Stats Bar */}
      <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-950/90 border-t border-gray-200 dark:border-slate-800 text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between font-mono">
        <div className="flex items-center gap-3">
          <span>{lineCount} lines</span>
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
        </div>
        <div>~{readingTimeMinutes} min read</div>
      </div>
    </div>
  );
};
