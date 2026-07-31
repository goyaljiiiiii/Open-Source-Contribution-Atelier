import React from "react";
import { Users, Cursor, Sparkles } from "lucide-react";

export interface PeerUser {
  user_id: string;
  username: string;
  color: string;
  cursor?: { line: number; column: number };
}

interface PeerCursorOverlayProps {
  peers: PeerUser[];
  currentUserId?: string;
}

export const PeerCursorOverlay: React.FC<PeerCursorOverlayProps> = ({
  peers,
  currentUserId,
}) => {
  const activePeers = peers.filter((p) => p.user_id !== currentUserId);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center -space-x-2 overflow-hidden">
        {peers.map((peer) => (
          <div
            key={peer.user_id}
            className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-900 font-bold text-xs text-white shadow-md transition-transform hover:scale-110"
            style={{ backgroundColor: peer.color }}
            title={`${peer.username} ${peer.user_id === currentUserId ? "(You)" : ""}`}
          >
            {peer.username.charAt(0).toUpperCase()}
            {peer.user_id === currentUserId && (
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            )}
          </div>
        ))}
      </div>

      <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 ml-1">
        <Users className="w-3.5 h-3.5 text-indigo-400" />
        {peers.length} {peers.length === 1 ? "Contributor" : "Contributors"} Online
      </span>
    </div>
  );
};
