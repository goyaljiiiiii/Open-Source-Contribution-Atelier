import React, { useMemo } from "react";
import {
  GitBranch,
  GitCommitHorizontal,
  RotateCcw,
} from "lucide-react";
import type { BranchCommit, BranchSimState } from "./types";
import { BRANCH_COLORS } from "./types";

interface BranchGraphProps {
  state: BranchSimState;
  selectedCommit: BranchCommit | null;
  onSelectCommit: (commit: BranchCommit | null) => void;
  onReset: () => void;
}

const COMMIT_RADIUS = 12;
const NODE_SPACING_Y = 80;
const TOP_PADDING = 40;
const SIDE_PADDING = 60;

function getBranchColor(branchName: string): string {
  return BRANCH_COLORS[branchName] || "#6b7280";
}

function CommitNode({
  commit,
  isSelected,
  isHead,
  onClick,
}: {
  commit: BranchCommit;
  isSelected: boolean;
  isHead: boolean;
  onClick: () => void;
}) {
  const color = getBranchColor(commit.branch);
  return (
    <g onClick={onClick} className="cursor-pointer">
      {/* Outer glow for head */}
      {isHead && (
        <circle
          cx={commit.x}
          cy={commit.y}
          r={COMMIT_RADIUS + 6}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray="4 3"
          opacity={0.5}
        >
          <animate
            attributeName="r"
            values={`${COMMIT_RADIUS + 4};${COMMIT_RADIUS + 8};${COMMIT_RADIUS + 4}`}
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.3;0.6;0.3"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={commit.x}
          cy={commit.y}
          r={COMMIT_RADIUS + 4}
          fill="none"
          stroke="#FFD700"
          strokeWidth={3}
        />
      )}
      {/* Main circle */}
      <circle
        cx={commit.x}
        cy={commit.y}
        r={COMMIT_RADIUS}
        fill={isHead ? color : "#1f1c18"}
        stroke={color}
        strokeWidth={3}
      />
      {/* Inner dot */}
      <circle
        cx={commit.x}
        cy={commit.y}
        r={4}
        fill={isHead ? "#fff" : color}
      />
      {/* Commit message */}
      <text
        x={commit.x + COMMIT_RADIUS + 10}
        y={commit.y - 6}
        fill="#f0ebe2"
        fontSize={11}
        fontFamily="monospace"
        fontWeight={700}
      >
        {commit.id}
      </text>
      <text
        x={commit.x + COMMIT_RADIUS + 10}
        y={commit.y + 10}
        fill="#c4bbae"
        fontSize={10}
        fontFamily="monospace"
      >
        {commit.message.length > 36
          ? commit.message.slice(0, 36) + "…"
          : commit.message}
      </text>
    </g>
  );
}

function EdgeLine({
  from,
  to,
  color,
  isMerge,
}: {
  from: BranchCommit;
  to: BranchCommit;
  color: string;
  isMerge?: boolean;
}) {
  if (isMerge) {
    const midY = (from.y + to.y) / 2;
    return (
      <path
        d={`M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray="6 3"
        opacity={0.7}
      />
    );
  }
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={color}
      strokeWidth={3}
    />
  );
}

export function BranchGraph({
  state,
  selectedCommit,
  onSelectCommit,
  onReset,
}: BranchGraphProps) {
  const { commits, branches, headCommitId } = state;

  const commitMap = useMemo(() => {
    const map = new Map<string, BranchCommit>();
    commits.forEach((c) => map.set(c.id, c));
    return map;
  }, [commits]);

  // Calculate SVG dimensions
  const maxX = Math.max(...commits.map((c) => c.x)) + SIDE_PADDING + 200;
  const maxY = Math.max(...commits.map((c) => c.y)) + TOP_PADDING + 80;

  // Build edges
  const edges: {
    from: BranchCommit;
    to: BranchCommit;
    color: string;
    isMerge?: boolean;
  }[] = [];
  commits.forEach((commit) => {
    const color = getBranchColor(commit.branch);
    commit.parentIds.forEach((pid) => {
      const parent = commitMap.get(pid);
      if (parent) {
        edges.push({
          from: parent,
          to: commit,
          color,
          isMerge: false,
        });
      }
    });
    commit.mergeParentIds?.forEach((mpid) => {
      const parent = commitMap.get(mpid);
      if (parent) {
        edges.push({
          from: parent,
          to: commit,
          color: getBranchColor(parent.branch),
          isMerge: true,
        });
      }
    });
  });

  return (
    <div className="bg-surface-low dark:bg-[#151411] border-4 border-black dark:border-[#2e2924] rounded-2xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black dark:border-[#2e2924]">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <span className="font-black text-xs uppercase tracking-wider text-text dark:text-[#f0ebe2]">
            Branch Graph
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Branch legend */}
          <div className="flex items-center gap-3 mr-4">
            {branches.map((b) => (
              <div key={b.id} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full border-2 border-black"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-[10px] font-mono font-bold text-muted dark:text-[#c4bbae]">
                  {b.name}
                  {b.isHead && " (HEAD)"}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase bg-red-100 text-red-700 border-2 border-red-300 rounded-lg hover:bg-red-200 transition-all dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="overflow-auto p-2" style={{ maxHeight: 420 }}>
        <svg width={maxX} height={maxY} viewBox={`0 0 ${maxX} ${maxY}`}>
          {/* Background grid */}
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map((edge, i) => (
            <EdgeLine
              key={`edge-${i}`}
              from={edge.from}
              to={edge.to}
              color={edge.color}
              isMerge={edge.isMerge}
            />
          ))}

          {/* Branch label lanes on left */}
          {branches.map((b, idx) => {
            const branchCommits = commits.filter(
              (c) => c.branch === b.name,
            );
            if (branchCommits.length === 0) return null;
            const firstC = branchCommits[0];
            return (
              <g key={`label-${b.id}`}>
                <text
                  x={20}
                  y={firstC.y + 4}
                  fill={b.color}
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight={900}
                >
                  {b.name}
                </text>
                {b.isHead && (
                  <text
                    x={20}
                    y={firstC.y + 18}
                    fill="#FFD700"
                    fontSize={8}
                    fontFamily="monospace"
                    fontWeight={900}
                  >
                    ◄ HEAD
                  </text>
                )}
              </g>
            );
          })}

          {/* Commits */}
          {commits.map((commit) => (
            <CommitNode
              key={commit.id}
              commit={commit}
              isSelected={selectedCommit?.id === commit.id}
              isHead={commit.id === headCommitId}
              onClick={() =>
                onSelectCommit(
                  selectedCommit?.id === commit.id ? null : commit,
                )
              }
            />
          ))}
        </svg>
      </div>

      {/* Commit detail footer */}
      {selectedCommit && (
        <div className="px-4 py-3 border-t-4 border-black dark:border-[#2e2924] bg-white dark:bg-[#0f0e0c]">
          <div className="flex items-center gap-3">
            <GitCommitHorizontal
              className="w-5 h-5"
              style={{ color: getBranchColor(selectedCommit.branch) }}
            />
            <div>
              <div className="font-mono text-xs font-black text-text dark:text-[#f0ebe2]">
                {selectedCommit.id} — {selectedCommit.message}
              </div>
              <div className="font-mono text-[10px] text-muted dark:text-[#c4bbae]">
                branch: {selectedCommit.branch} | parents:{" "}
                {selectedCommit.parentIds.length > 0
                  ? selectedCommit.parentIds.join(", ")
                  : "(root)"}
                {selectedCommit.mergeParentIds?.length
                  ? ` + merge: ${selectedCommit.mergeParentIds.join(", ")}`
                  : ""}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
