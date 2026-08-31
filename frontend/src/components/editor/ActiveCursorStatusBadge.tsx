import React from "react";

export type CursorPosition = {
  row: number;
  col: number;
};

export type ActiveCollaboratorCursor = {
  id: number;
  name: string;
  cursor?: CursorPosition;
  color?: string;
  isSelf?: boolean;
};

const COLOR_PALETTE = [
  "#f59e0b", // Amber
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
];

export function getCollaboratorColor(id: number): string {
  return COLOR_PALETTE[Math.abs(id) % COLOR_PALETTE.length];
}

export function ActiveCursorStatusBadge({
  collaborator,
}: {
  collaborator: ActiveCollaboratorCursor;
}) {
  const color = collaborator.color || getCollaboratorColor(collaborator.id);
  const hasCursor = Boolean(collaborator.cursor);
  const row = (collaborator.cursor?.row ?? 0) + 1;
  const col = (collaborator.cursor?.col ?? 0) + 1;

  return (
    <div
      role="status"
      aria-label={`Collaborator ${collaborator.name} ${
        hasCursor ? `cursor at line ${row}, column ${col}` : "online"
      }`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 shadow-sm"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color: color,
      }}
    >
      <span className="relative flex h-2 w-2">
        {hasCursor && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: color }}
        />
      </span>

      <span className="font-bold truncate max-w-[120px]">
        {collaborator.name}
        {collaborator.isSelf ? " (You)" : ""}
      </span>

      {hasCursor && (
        <span
          className="text-[10px] font-mono opacity-80 pl-1 border-l"
          style={{ borderColor: `${color}40` }}
        >
          Ln {row}, Col {col}
        </span>
      )}
    </div>
  );
}
