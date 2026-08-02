import React, { useState, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  CheckCircle2,
  Sparkles,
  GitBranch,
  Code,
  Server,
  Cpu,
  Award,
  ShieldCheck,
} from "lucide-react";
import { SkillNode } from "./SkillNodeDetailModal";

export interface SkillEdge {
  id: string;
  source: string;
  target: string;
  status: "active" | "locked" | "completed";
}

interface SkillGraphCanvasProps {
  nodes: SkillNode[];
  edges: SkillEdge[];
  selectedDomain: string;
  searchQuery: string;
  onNodeSelect: (node: SkillNode) => void;
}

export const SkillGraphCanvas: React.FC<SkillGraphCanvasProps> = ({
  nodes,
  edges,
  selectedDomain,
  searchQuery,
  onNodeSelect,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<SkillNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter nodes based on domain and search
  const filteredNodes = nodes.filter((node) => {
    const matchesDomain =
      selectedDomain === "all" || node.domain === selectedDomain;
    const matchesSearch =
      searchQuery === "" ||
      node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesSearch;
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  // Map icons for skill domains/categories
  const getSkillIcon = (domain: string, category: string) => {
    if (domain === "frontend") return <Code className="w-5 h-5" />;
    if (domain === "backend") return <Server className="w-5 h-5" />;
    if (domain === "devops") return <Cpu className="w-5 h-5" />;
    if (category.includes("Leadership")) return <Award className="w-5 h-5" />;
    if (category.includes("Quality")) return <ShieldCheck className="w-5 h-5" />;
    return <GitBranch className="w-5 h-5" />;
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.15, 1.8));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.15, 0.6));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[650px] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-2xl"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-xl shadow-lg">
        <button
          onClick={handleZoomIn}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-slate-700 mx-1" />
        <button
          onClick={handleResetZoom}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Domain Legend */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 p-2 bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-xl text-[11px] text-slate-300">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/60">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
          <span>Mastered Node</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/60">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-500/50" />
          <span>Unlocked Node</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/60">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
          <span>Prerequisite Locked</span>
        </div>
      </div>

      {/* Main Canvas Workspace Container */}
      <div
        className="w-full h-full transform-gpu transition-transform duration-75 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg className="w-[1200px] h-[700px] overflow-visible">
          <defs>
            <linearGradient id="edgeCompleted" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="edgeActive" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818CF8" stopOpacity="0.8" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Connecting Progression Edges */}
          {edges.map((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode) return null;
            if (!filteredNodeIds.has(sourceNode.id) && !filteredNodeIds.has(targetNode.id)) {
              return null;
            }

            const x1 = sourceNode.position.x + 80;
            const y1 = sourceNode.position.y + 35;
            const x2 = targetNode.position.x + 80;
            const y2 = targetNode.position.y + 35;

            // Bezier curve calculation
            const dx = x2 - x1;
            const controlX1 = x1 + dx * 0.5;
            const controlX2 = x2 - dx * 0.5;
            const pathData = `M ${x1} ${y1} C ${controlX1} ${y1}, ${controlX2} ${y2}, ${x2} ${y2}`;

            const isCompleted = sourceNode.status === "completed" && targetNode.status === "completed";
            const isActive = sourceNode.status === "completed" && targetNode.status === "unlocked";

            return (
              <g key={edge.id}>
                {/* Background trace line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="3"
                  strokeDasharray={edge.status === "locked" ? "6 6" : "none"}
                />
                {/* Active glowing progression line */}
                {(isCompleted || isActive) && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isCompleted ? "url(#edgeCompleted)" : "url(#edgeActive)"}
                    strokeWidth="3.5"
                    filter="url(#glow)"
                    className={isActive ? "animate-pulse" : ""}
                  />
                )}
              </g>
            );
          })}

          {/* Render RPG Skill Nodes */}
          {filteredNodes.map((node) => {
            const isHovered = hoveredNode?.id === node.id;
            const isCompleted = node.status === "completed";
            const isUnlocked = node.status === "unlocked";
            const isLocked = node.status === "locked";

            return (
              <g
                key={node.id}
                transform={`translate(${node.position.x}, ${node.position.y})`}
                onClick={() => onNodeSelect(node)}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer group"
              >
                {/* Outer Glow Halo for Unlocked / Active Node */}
                {(isCompleted || isUnlocked) && (
                  <rect
                    x="-6"
                    y="-6"
                    width="172"
                    height="82"
                    rx="20"
                    fill="none"
                    stroke={isCompleted ? "#10B981" : "#6366F1"}
                    strokeWidth="2"
                    strokeOpacity={isHovered ? "0.8" : "0.3"}
                    filter="url(#glow)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Main Node Card Body */}
                <rect
                  x="0"
                  y="0"
                  width="160"
                  height="70"
                  rx="16"
                  className={`transition-all duration-200 ${
                    isCompleted
                      ? "fill-slate-900 stroke-emerald-500/80 stroke-2"
                      : isUnlocked
                      ? "fill-slate-900 stroke-indigo-500/80 stroke-2"
                      : "fill-slate-950 stroke-slate-800 stroke-1 opacity-75"
                  } ${isHovered ? "scale-105" : ""}`}
                />

                {/* Node Domain Pill Tag */}
                <rect
                  x="10"
                  y="8"
                  width="140"
                  height="16"
                  rx="4"
                  className={
                    isCompleted
                      ? "fill-emerald-950/60"
                      : isUnlocked
                      ? "fill-indigo-950/60"
                      : "fill-slate-900"
                  }
                />
                <text
                  x="80"
                  y="19"
                  textAnchor="middle"
                  className="text-[9px] font-bold uppercase tracking-wider fill-slate-400"
                >
                  {node.category}
                </text>

                {/* Icon & Title Container */}
                <foreignObject x="10" y="28" width="140" height="38">
                  <div className="flex items-center gap-2 h-full">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isUnlocked
                          ? "bg-indigo-500/20 text-indigo-400"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4 text-slate-500" />
                      ) : (
                        getSkillIcon(node.domain, node.category)
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p
                        className={`text-xs font-bold leading-tight truncate ${
                          isCompleted
                            ? "text-emerald-200"
                            : isUnlocked
                            ? "text-slate-100"
                            : "text-slate-500"
                        }`}
                      >
                        {node.title}
                      </p>
                      <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5 mt-0.5">
                        <Sparkles className="w-3 h-3" /> +{node.xp_reward} XP
                      </p>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
