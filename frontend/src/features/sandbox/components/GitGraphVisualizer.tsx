import { useMemo } from "react";
import type { GitDagNode } from "../engine/gitWasmEngine";

interface GitGraphVisualizerProps {
  nodes: GitDagNode[];
  width?: number;
  height?: number;
}

const NODE_W = 120;
const NODE_H = 36;
const COL_GAP = 48;
const ROW_GAP = 56;

/** Simple SVG DAG visualisation of commit history. */
export function GitGraphVisualizer({
  nodes,
  width = 640,
  height = 320,
}: GitGraphVisualizerProps) {
  const layout = useMemo(() => {
    if (nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>(), edges: [] as Array<[string, string]> };

    const oidSet = new Set(nodes.map((n) => n.oid));
    const depth = new Map<string, number>();
    const lane = new Map<string, number>();

    const computeDepth = (oid: string, seen = new Set<string>()): number => {
      if (depth.has(oid)) return depth.get(oid)!;
      if (seen.has(oid)) return 0;
      seen.add(oid);
      const node = nodes.find((n) => n.oid === oid);
      if (!node || node.parents.length === 0) {
        depth.set(oid, 0);
        return 0;
      }
      const d = Math.max(...node.parents.map((p) => computeDepth(p, seen))) + 1;
      depth.set(oid, d);
      return d;
    };

    nodes.forEach((n) => computeDepth(n.oid));

    const byDepth = new Map<number, GitDagNode[]>();
    for (const n of nodes) {
      const d = depth.get(n.oid) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(n);
    }

    const positions = new Map<string, { x: number; y: number }>();
    for (const [d, group] of byDepth) {
      group.forEach((n, i) => {
        lane.set(n.oid, i);
        positions.set(n.oid, {
          x: 40 + d * (NODE_W + COL_GAP),
          y: 40 + i * (NODE_H + ROW_GAP),
        });
      });
    }

    const edges: Array<[string, string]> = [];
    for (const n of nodes) {
      for (const p of n.parents) {
        if (oidSet.has(p)) edges.push([n.oid, p]);
      }
    }

    return { positions, edges };
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-500 text-sm">
        No commits yet — run git init &amp; git commit
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-lg border border-zinc-700 bg-zinc-900"
      role="img"
      aria-label="Git commit graph"
    >
      {layout.edges.map(([from, to]) => {
        const a = layout.positions.get(from);
        const b = layout.positions.get(to);
        if (!a || !b) return null;
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x + NODE_W / 2}
            y1={a.y + NODE_H}
            x2={b.x + NODE_W / 2}
            y2={b.y}
            stroke="#52525b"
            strokeWidth={2}
          />
        );
      })}
      {nodes.map((n) => {
        const pos = layout.positions.get(n.oid);
        if (!pos) return null;
        const label =
          n.message.length > 14 ? `${n.message.slice(0, 12)}…` : n.message;
        return (
          <g key={n.oid}>
            <rect
              x={pos.x}
              y={pos.y}
              width={NODE_W}
              height={NODE_H}
              rx={6}
              fill="#27272a"
              stroke="#10b981"
              strokeWidth={1.5}
            />
            <text
              x={pos.x + 8}
              y={pos.y + 14}
              fill="#a1a1aa"
              fontSize={9}
              fontFamily="monospace"
            >
              {n.oid.slice(0, 7)}
            </text>
            <text
              x={pos.x + 8}
              y={pos.y + 28}
              fill="#e4e4e7"
              fontSize={10}
              fontFamily="sans-serif"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
