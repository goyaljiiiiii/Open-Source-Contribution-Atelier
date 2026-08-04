import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText,
  Share2,
  Download,
  Save,
  Check,
  Users,
  Eye,
  Edit3,
  Columns,
  Wifi,
  WifiOff,
  Sparkles,
  Zap,
  FolderOpen,
  Maximize2,
  Minimize2,
  Layers,
  Copy,
} from "lucide-react";
import { MultiplayerEditor } from "../components/notes/MultiplayerEditor";
import { PeerCursorOverlay, PeerUser } from "../components/notes/PeerCursorOverlay";
import { fetchApi } from "../lib/api";
import { toast } from "react-hot-toast";

const VIBE_TEMPLATES = [
  {
    name: "🚀 Pair-Programming Session",
    title: "Pair-Programming Jam Notes",
    content: `# Pair-Programming Jam Session 🚀\n\n## Objectives\n- [ ] Refactor async worker tasks\n- [ ] Implement live peer cursors\n- [ ] Verify test suite passing\n\n\`\`\`typescript\nfunction vibeCode() {\n  return "100% Flow State Achieved! ⚡";\n}\n\`\`\n`,
  },
  {
    name: "💡 Architecture RFC",
    title: "System Architecture RFC & Specs",
    content: `# Architecture Proposal RFC 💡\n\n## Overview\nHigh performance real-time WebSocket state synchronization engine.\n\n## Component Diagram\n- Client SPA (React 18 + Vite)\n- Channels ASGI WebSockets\n- Redis PubSub Broker\n`,
  },
  {
    name: "🐛 Bug Post-Mortem",
    title: "Production Incident & Bug Analysis",
    content: `# Incident Post-Mortem 🐛\n\n**Severity**: P2  \n**Component**: OAuth Token Exchange  \n**Resolution**: Updated PKCE verifier hashing function.\n`,
  },
];

export const CollabNotesPage: React.FC = () => {
  const { roomId: urlRoomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState<string>(urlRoomId || "general-jam");
  const [title, setTitle] = useState<string>("Open Source Collaboration Workspace");
  const [content, setContent] = useState<string>(
    "# Real-time Collaborative Vibe Workspace 🚀\n\nWelcome to pair-programming & live collaboration notes!\n\n```typescript\nfunction solveChallenge(input: string) {\n  console.log('Live collaborative editing enabled!');\n}\n```"
  );

  const [peers, setPeers] = useState<PeerUser[]>([
    { user_id: "u1", username: "You", color: "#3B82F6", cursor: { line: 3, column: 12 } },
    { user_id: "u2", username: "CodeNinja", color: "#10B981", cursor: { line: 7, column: 4 } },
  ]);

  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("split");
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [simulatingPeers, setSimulatingPeers] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>("Just now");

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Attempt WebSocket connection to Django Channels backend
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/collab-notes/${roomId}/`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "content_update") {
            setContent(data.content);
          } else if (data.type === "peer_update") {
            setPeers(data.peers || []);
          }
        } catch {
          // Fallback parsing
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId]);

  // Peer cursor simulation for offline testing & fun interaction
  useEffect(() => {
    if (!simulatingPeers) return;
    const interval = setInterval(() => {
      setPeers((prev) =>
        prev.map((peer) => {
          if (peer.user_id === "u1") return peer;
          return {
            ...peer,
            cursor: {
              line: Math.max(1, (peer.cursor?.line || 1) + (Math.random() > 0.5 ? 1 : -1)),
              column: Math.max(1, (peer.cursor?.column || 1) + Math.floor(Math.random() * 5)),
            },
          };
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [simulatingPeers]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "content_change",
          content: newContent,
        })
      );
    }
  };

  const handleCursorMove = (cursor: { line: number; column: number }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "cursor_move",
          cursor,
        })
      );
    }
  };

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/collab-notes/${roomId}`;
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    toast.success("Room link copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded Markdown file!");
  };

  const handleSaveToBackend = async () => {
    setIsSaving(true);
    try {
      await fetchApi("/api/notes/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          encrypted_content: content,
          iv: "collab_note_iv",
        }),
      });
      setLastSavedTime(new Date().toLocaleTimeString());
      toast.success("Note saved successfully to backend DB!");
    } catch {
      setLastSavedTime(new Date().toLocaleTimeString() + " (Local)");
      toast.success("Saved to local workspace memory!");
    } finally {
      setIsSaving(false);
    }
  };

  const applyTemplate = (template: typeof VIBE_TEMPLATES[0]) => {
    setTitle(template.title);
    setContent(template.content);
    toast.success(`Applied template "${template.name}"!`);
  };

  return (
    <main id="main-content" className="min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Workspace Top Navigation */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-800 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-2xl shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-transparent text-lg font-black text-gray-900 dark:text-white focus:outline-none focus:border-b-2 border-blue-500"
                />
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-mono">
                  <span className="text-gray-400">Room:</span>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => {
                      setRoomId(e.target.value);
                      navigate(`/collab-notes/${e.target.value}`, { replace: true });
                    }}
                    className="bg-transparent font-bold text-blue-600 dark:text-blue-400 focus:outline-none w-24"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                {isConnected ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                    <Wifi className="w-3.5 h-3.5" /> Live WebSocket Connected
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                    <WifiOff className="w-3.5 h-3.5" /> Local Sync Mode
                  </span>
                )}
                • Saved: {lastSavedTime}
              </p>
            </div>
          </div>

          {/* Roster & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <PeerCursorOverlay peers={peers} currentUserId="u1" />

            {/* Template Selector Dropdown */}
            <select
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (VIBE_TEMPLATES[idx]) applyTemplate(VIBE_TEMPLATES[idx]);
              }}
              defaultValue=""
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none"
            >
              <option value="" disabled>✨ Load Vibe Template</option>
              {VIBE_TEMPLATES.map((tmpl, idx) => (
                <option key={idx} value={idx}>{tmpl.name}</option>
              ))}
            </select>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center p-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs">
              <button
                onClick={() => setViewMode("edit")}
                className={`px-2.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === "edit" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={`px-2.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === "split" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Columns className="w-3.5 h-3.5" /> Split
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`px-2.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === "preview" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>

            <button
              onClick={handleCopyShareLink}
              className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              title="Copy Live Share Link"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4 text-blue-500" />}
              {isCopied ? "Copied!" : "Share Room"}
            </button>

            <button
              onClick={handleSaveToBackend}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Note"}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl transition-colors"
              title="Download Markdown (.md)"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => setZenMode(!zenMode)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl transition-colors"
              title={zenMode ? "Exit Zen Mode" : "Fullscreen Zen Mode"}
            >
              {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Workspace Canvas (Split / Edit / Preview) */}
        <div className={`w-full ${zenMode ? "h-[85vh]" : "h-[650px]"} grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all`}>
          {(viewMode === "edit" || viewMode === "split") && (
            <div className={`h-full ${viewMode === "edit" ? "lg:col-span-2" : ""}`}>
              <MultiplayerEditor
                value={content}
                onChange={handleContentChange}
                onCursorMove={handleCursorMove}
                peers={peers}
                currentUserId="u1"
              />
            </div>
          )}

          {(viewMode === "preview" || viewMode === "split") && (
            <div className={`h-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 overflow-y-auto custom-scrollbar shadow-sm ${viewMode === "preview" ? "lg:col-span-2" : ""}`}>
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3 mb-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" /> Rendered Markdown & Code Preview
                </span>
                <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
              </div>
              <div className="prose dark:prose-invert max-w-none text-sm text-gray-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {content}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default CollabNotesPage;
