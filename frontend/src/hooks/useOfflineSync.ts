// frontend/src/hooks/useOfflineSync.ts
import { useContext, useCallback } from "react";
import { OfflineSyncContext } from "../context/OfflineSyncContext";
import { getAccessToken } from "../lib/authToken";
import { fetchApi } from "../lib/api";

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);

  if (!context) {
    throw new Error("useOfflineSync must be used within an OfflineSyncProvider");
  }

  const { isOnline, pendingCount, lastSyncAt, triggerSync } = context;

  const syncProgress = useCallback(
    async (vars: {
      lesson_slug: string;
      score?: number;
      completed?: boolean;
    }) => {
      const payload = {
        lesson_slug: vars.lesson_slug,
        score: vars.score ?? 100,
        completed: vars.completed ?? true,
      };

      const token = getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      if (isOnline) {
        return fetchApi("/api/progress/me/", {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        // Intercepted by Service Worker fetch handler when offline
        const response = await fetch(`/api/progress/me/`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });

        return {
          lesson_slug: vars.lesson_slug,
          completed: vars.completed ?? true,
          score: vars.score ?? 100,
          status: "queued",
        };
      }
    },
    [isOnline]
  );

  return {
    isOnline,
    pendingCount,
    lastSyncAt,
    triggerSync,
    syncProgress,
  };
}
