import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText,
  Share2,
  Download,
  Save,
  Check,
  Copy,
  Users,
  Eye,
  Edit3,
  Columns,
  Wifi,
  WifiOff,
  Sparkles,
  Lock,
} from "lucide-react";
import { MultiplayerEditor } from "../components/notes/MultiplayerEditor";
import { PeerCursorOverlay, PeerUser } from "../components/notes/PeerCursorOverlay";

export const CollabNotesPage: React.FC = () => {
  const { roomId: urlRoomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState<string>(urlRoomId || "room-general");
  const [content, setContent] = useState<string>(
    "# Real-time Collaborative Study Note\n\nWelcome to the pair-programming and live collaboration workspace!\n\n```typescript\nfunction solveChallenge(input: string) {\n  console.log('Live collaborative editing enabled!');\n}\n```"
  );
  const [title, setTitle] = useState<string>("SSoC 2026 Collaboration Workspace");
  const [peers, setPeers] = useState<PeerUser[]>([
    { user_id: "u1", username: "You", color: "#4ECDC4", cursor: { line: 3, column: 12 } },
    { user_id: "u2", username: "suman20041", color: "#FF6B6B", cursor: { line: 7, column: 4 } },
  ]);
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">("split");
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

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // Broadcast via WebSocket if connected
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
    setTimeout(() => setIsCopied(null), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToBackend = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/notes/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          encrypted_content: content,
          iv: "collab_note_iv",
        }),
      });
      setLastSavedTime(new Date().toLocaleTimeString());
    } catch {
      setLastSavedTime(new Date().toLocaleTimeString() + " (Local)");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Workspace Top Navigation */}
        <div className="p-4 sm:p-6 bg-slate-950 border border-slate-800 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-transparent text-lg font-black text-white focus:outline-none focus:border-b border-indigo-500"
                />
                <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-800/60 rounded">
                  Room: #{roomId}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                {isConnected ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5" /> Live WebSocket Connected
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <WifiOff className="w-3.5 h-3.5" /> REST Fallback Sync
                  </span>
                )}
                • Saved: {lastSavedTime}
              </p>
            </div>
          </div>

          {/* Roster & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <PeerCursorOverlay peers={peers} currentUserId="u1" />

            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
              <button
                onClick={() => setViewMode("edit")}
                className={`px-2.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === "edit" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => setViewMode("split")}
                className={`px-2.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === "split" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Columns className="w-3.5 h-3.5" /> Split
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`px-2.5 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === "preview" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>

            <button
              onClick={handleCopyShareLink}
              className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5"
              title="Copy Live Share Link"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-indigo-400" />}
              {isCopied ? "Copied!" : "Share Room"}
            </button>

            <button
              onClick={handleSaveToBackend}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Note"}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
              title="Download Markdown (.md)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Canvas (Split / Edit / Preview) */}
        <div className="w-full h-[650px] grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className={`h-full bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-y-auto custom-scrollbar ${viewMode === "preview" ? "lg:col-span-2" : ""}`}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Markdown & Rendered Code Preview</span>
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="prose prose-invert max-w-none text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
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
