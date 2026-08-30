import React, { useState, useEffect } from "react";
import { Shield, Key, Trash2, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../api";
import { formatTimeAgo } from "../../lib/dates";

interface UserAppToken {
  id: number;
  client_id: string;
  client_name: string;
  scope: string;
  access_token_expires_at: string;
  created_at: string;
  is_revoked: boolean;
  last_sync?: string | null;
}

function formatLastSyncedLabel(lastSync?: string | null): string {
  if (!lastSync) return "Never synced";
  const syncedAt = new Date(lastSync);
  if (Number.isNaN(syncedAt.getTime())) return "Never synced";
  return `Last synced ${formatTimeAgo(syncedAt)}`;
}

export function ConnectedApps() {
  const [tokens, setTokens] = useState<UserAppToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const fetchUserApps = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<UserAppToken[]>("/oauth/user-apps/");
      setTokens(res.data || []);
    } catch (err) {
      console.error("Failed to fetch connected apps:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserApps();
  }, []);

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      const res = await api.post<{ last_sync: string }>(
        `/oauth/user-apps/${id}/sync/`,
      );
      const lastSync = res.data?.last_sync ?? new Date().toISOString();
      setTokens((prev) =>
        prev.map((token) =>
          token.id === id ? { ...token, last_sync: lastSync } : token,
        ),
      );
      toast.success("Sync completed successfully!");
    } catch (err) {
      console.error("Failed to sync application:", err);
      toast.error("Failed to sync. Please try again.");
    } finally {
      setSyncingId(null);
    }
  };

  const handleRevoke = async (id: number) => {
    if (
      !confirm("Are you sure you want to revoke access for this application?")
    )
      return;
    try {
      await api.post(`/oauth/user-apps/${id}/revoke/`);
      fetchUserApps();
    } catch (err) {
      console.error("Failed to revoke application access:", err);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 p-4 md:p-8 bg-surface dark:bg-[#0a0a0f] text-text dark:text-[#f0ebe2]">
      <div className="pb-4 border-b-2 border-black/10 dark:border-[#2e2924]">
        <h1 className="text-3xl font-black text-text dark:text-[#f0ebe2] flex items-center gap-2">
          <Shield className="w-8 h-8 text-accent" /> Connected Applications
        </h1>
        <p className="text-sm font-medium text-muted dark:text-[#c4bbae]">
          Third-party apps and integrations authorized to access your account
          data.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted dark:text-[#a0988c]">
          Loading authorized applications...
        </div>
      ) : tokens.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col items-center gap-3 shadow-sm">
          <Key className="w-12 h-12 text-muted/40" />
          <h3 className="text-lg font-bold text-text dark:text-[#f0ebe2]">
            No Active Applications
          </h3>
          <p className="text-xs text-muted dark:text-[#a0988c] max-w-sm">
            You haven't granted third-party applications access to your account.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="p-5 bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-xl flex items-center justify-between gap-4 shadow-sm flex-wrap"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-text dark:text-[#f0ebe2]">
                    {token.client_name}
                  </h3>
                  <span className="text-xs font-mono text-muted">
                    ({token.client_id})
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-muted dark:text-[#a0988c]">
                    Granted Permissions:
                  </span>
                  {token.scope.split(" ").map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-mono text-[11px] rounded font-bold"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <span
                  className={`inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    token.last_sync
                      ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {formatLastSyncedLabel(token.last_sync)}
                </span>

                <div className="text-[11px] text-muted dark:text-[#a0988c]">
                  Authorized on{" "}
                  {new Date(token.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleSync(token.id)}
                  disabled={syncingId === token.id}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-3 py-2 rounded-xl transition-colors border border-indigo-200 dark:border-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${syncingId === token.id ? "animate-spin" : ""}`}
                  />
                  {syncingId === token.id ? "Syncing..." : "Sync Now"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevoke(token.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-2 rounded-xl transition-colors border border-red-200 dark:border-red-900/50"
                >
                  <Trash2 className="w-4 h-4" /> Revoke Access
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
