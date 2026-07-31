import { useEffect, useRef } from "react";

type CursorInfo = {
  row: number;
  col: number;
};

type RemoteCursorData = {
  id: number;
  name: string;
  cursor: CursorInfo;
  color?: string;
};

const CURSOR_COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

function getColor(id: number): string {
  return CURSOR_COLORS[id % CURSOR_COLORS.length];
}

export function RemoteCursorOverlay({
  cursors,
  editorRef,
}: {
  cursors: RemoteCursorData[];
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    const container = containerRef.current;
    if (!editor || !container) return;

    const updatePositions = () => {
      const editorRect = editor.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 20;
      const charWidth = 8;

      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.right = "0";
      container.style.bottom = "0";
      container.style.pointerEvents = "none";

      const labels = container.querySelectorAll<HTMLElement>("[data-cursor-id]");
      labels.forEach((label) => {
        const cursorData = cursors.find(
          (c) => c.id === Number(label.dataset.cursorId),
        );
        if (!cursorData) {
          label.style.display = "none";
          return;
        }
        label.style.display = "block";
        const top = cursorData.cursor.row * lineHeight + editor.scrollTop;
        const left = cursorData.cursor.col * charWidth;
        label.style.top = `${top}px`;
        label.style.left = `${left}px`;
      });
    };

    editor.addEventListener("scroll", updatePositions);
    updatePositions();
    return () => editor.removeEventListener("scroll", updatePositions);
  }, [cursors, editorRef]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      {cursors.map((c) => (
        <div
          key={c.id}
          data-cursor-id={c.id}
          className="absolute flex items-center gap-1 text-xs font-bold px-1 py-0.5 rounded-sm whitespace-nowrap transition-all"
          style={{
            backgroundColor: getColor(c.id),
            color: "#fff",
            display: "none",
          }}
        >
          <span
            className="inline-block w-0.5 h-4"
            style={{ backgroundColor: getColor(c.id) }}
          />
          {c.name}
        </div>
      ))}
    </div>
  );
}
