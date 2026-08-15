import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../features/auth/AuthContext";
import { useLessonEditorWS } from "../../hooks/useLessonEditorWS";
import { RemoteCursorOverlay } from "./RemoteCursorOverlay";

type CursorInfo = {
  row: number;
  col: number;
};

type RemoteCursorData = {
  id: number;
  name: string;
  cursor: CursorInfo;
};

export function LessonCollaborativeEditor({
  slug,
  initialContent,
  onContentChange,
}: {
  slug: string;
  initialContent: string;
  onContentChange?: (content: string) => void;
}) {
  const { user } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursorData[]>([]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const handleDocInit = useCallback(
    (state: { content: string; revision: number }) => {
      setContent(state.content);
      onContentChange?.(state.content);
    },
    [onContentChange],
  );

  const handleRemoteOp = useCallback(
    (_op: unknown[], _revision: number) => {
      // In a full implementation, this would apply the OT op
      // to the local editor content. For now, the WS consumer
      // handles full state sync, and we re-fetch on rebase.
    },
    [],
  );

  const handleRemoteCursor = useCallback(
    (cursor: RemoteCursorData) => {
      setRemoteCursors((prev) => {
        const filtered = prev.filter((c) => c.id !== cursor.id);
        return [...filtered, cursor];
      });
    },
    [],
  );

  const handleRebase = useCallback(
    (state: { content: string; revision: number }) => {
      setContent(state.content);
      onContentChange?.(state.content);
    },
    [onContentChange],
  );

  const handlePresence = useCallback(
    (_action: "join" | "leave", _user: { id: number; name: string }) => {
      // The hook manages collaborator list; no extra action needed.
    },
    [],
  );

  const handleSaveAck = useCallback(() => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const { connected, collaborators, sendOp, sendCursor, sendSave } =
    useLessonEditorWS({
      slug,
      onDocInit: handleDocInit,
      onRemoteOp: handleRemoteOp,
      onRemoteCursor: handleRemoteCursor,
      onPresence: handlePresence,
      onSaveAck: handleSaveAck,
      onRebase: handleRebase,
    });

  const getCursorPos = (
    el: HTMLTextAreaElement,
  ): { row: number; col: number } => {
    const text = el.value;
    const pos = el.selectionStart;
    const before = text.slice(0, pos);
    const row = before.split("\n").length - 1;
    const lines = before.split("\n");
    const col = lines[lines.length - 1]?.length ?? 0;
    return { row, col };
  };

  const handleSelect = useCallback(() => {
    const el = editorRef.current;
    if (!el || !user) return;
    const cursor = getCursorPos(el);
    sendCursor(cursor, { id: user.id, name: user.username });
  }, [sendCursor, user]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      const oldContent = contentRef.current;

      // Build a simple OT op representing the full replacement
      // In a real implementation, this would compute a minimal diff
      setContent(newContent);
      contentRef.current = newContent;
      onContentChange?.(newContent);

      const op = buildReplaceOp(oldContent, newContent);
      if (op.length > 0) {
        sendOp(op);
      }
    },
    [sendOp, onContentChange],
  );

  const handleSave = useCallback(() => {
    setSaveStatus("saving");
    sendSave();
  }, [sendSave]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-white dark:bg-[#151411] border border-black/10 dark:border-[#2e2924] rounded-xl">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs font-mono text-muted dark:text-[#a0988c]">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {collaborators.map((c) => (
            <span
              key={c.id}
              className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent"
            >
              {c.name}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-xs text-amber-500">Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-green-500">Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-500">Error</span>
          )}
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs font-bold bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            Save
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onSelect={handleSelect}
          onMouseUp={handleSelect}
          onKeyUp={handleSelect}
          className="w-full min-h-[400px] p-4 font-mono text-sm bg-white dark:bg-[#151411] border border-black/10 dark:border-[#2e2924] rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
          spellCheck={false}
        />
        <RemoteCursorOverlay
          cursors={remoteCursors}
          editorRef={editorRef}
        />
      </div>
    </div>
  );
}

function buildReplaceOp(
  oldContent: string,
  newContent: string,
): unknown[] {
  // Simple full-replacement operation
  const op: unknown[] = [];
  if (oldContent) {
    op.push({ delete: oldContent.length });
  }
  if (newContent) {
    op.push({ insert: newContent });
  }
  return op;
}
