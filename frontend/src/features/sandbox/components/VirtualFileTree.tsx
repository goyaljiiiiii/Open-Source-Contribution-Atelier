import { useState } from "react";
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import type { FileTreeNode } from "../engine/virtualFileSystem";

interface VirtualFileTreeProps {
  tree: FileTreeNode | null;
  onSelectFile?: (path: string) => void;
}

function TreeNode({
  node,
  depth,
  onSelectFile,
}: {
  node: FileTreeNode;
  depth: number;
  onSelectFile?: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = node.type === "dir";
  const padding = depth * 16;

  if (isDir) {
    const children = node.children ?? [];
    if (node.name === "/" && children.length === 0) {
      return (
        <div className="text-zinc-500 text-sm px-2 py-4">Empty workspace</div>
      );
    }
    return (
      <div>
        {node.name !== "/" && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 w-full text-left py-0.5 hover:bg-zinc-800 rounded text-zinc-300 text-sm"
            style={{ paddingLeft: padding }}
          >
            {open ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            )}
            <Folder className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>{node.name}</span>
          </button>
        )}
        {open &&
          children.map((child) => (
            <TreeNode
              key={`${child.name}-${child.type}`}
              node={child}
              depth={node.name === "/" ? depth : depth + 1}
              onSelectFile={onSelectFile}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => node.path && onSelectFile?.(node.path)}
      className="flex items-center gap-1 w-full text-left py-0.5 hover:bg-zinc-800 rounded text-zinc-400 text-sm"
      style={{ paddingLeft: padding + 18 }}
    >
      <File className="w-3.5 h-3.5 shrink-0 text-sky-400" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

/** Tree view of the sandbox virtual filesystem. */
export function VirtualFileTree({ tree, onSelectFile }: VirtualFileTreeProps) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2 min-h-[200px] max-h-[400px] overflow-y-auto font-mono">
      {tree ? (
        <TreeNode node={tree} depth={0} onSelectFile={onSelectFile} />
      ) : (
        <div className="text-zinc-500 text-sm px-2 py-4">Loading…</div>
      )}
    </div>
  );
}
