import React, { useRef } from "react";
import { PeerUser } from "./PeerCursorOverlay";

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

  const handleSelectionChange = () => {
    if (!textareaRef.current || !onCursorMove) return;
    const selectionStart = textareaRef.current.selectionStart;
    const textUpToCursor = value.substring(0, selectionStart);
    const lineLines = textUpToCursor.split("\n");
    const lineNumber = lineLines.length;
    const colNumber = lineLines[lineLines.length - 1].length + 1;

    onCursorMove({ line: lineNumber, column: colNumber });
  };

  const activePeers = peers.filter((p) => p.user_id !== currentUserId);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Markdown & Code Editor
          </span>
          <span>{lineCount} lines</span>
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
        </div>

        {/* Peer Cursor Tags Indicator */}
        <div className="flex items-center gap-2">
          {activePeers.map((peer) => (
            <span
              key={peer.user_id}
              className="px-2 py-0.5 text-[10px] font-bold text-white rounded-full flex items-center gap-1"
              style={{ backgroundColor: peer.color }}
            >
              {peer.username} ({peer.cursor?.line || 1}:{peer.cursor?.column || 1})
            </span>
          ))}
        </div>
      </div>

      {/* Editor Body with Line Numbers */}
      <div className="relative flex-1 flex overflow-hidden font-mono text-xs sm:text-sm">
        {/* Line Numbers Gutter */}
        <div className="py-4 px-3 bg-slate-950/80 border-r border-slate-800/80 text-slate-600 select-none text-right min-w-[3rem]">
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
          className="w-full h-full p-4 bg-transparent text-slate-100 placeholder-slate-600 leading-6 resize-none focus:outline-none custom-scrollbar"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
