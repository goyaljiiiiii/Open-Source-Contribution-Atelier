import { useCallback } from "react";
import { useNetworkStatus } from "../context/useNetworkStatus";
import { enqueueOfflineAction, triggerSyncWithBackoff } from "../lib/offlineQueue";
import { getAccessToken } from "../lib/authToken";
import { fetchApi } from "../lib/api";

export function useOfflineSync() {
  const { isOnline } = useNetworkStatus();

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

      if (isOnline) {
        try {
          const response = await fetchApi("/progress/me/", {
            method: "PATCH",
            body: JSON.stringify(payload),
          });

          // A successful response is the point at which a retry schedule must
          // be considered complete. The queue implementation also resets its
          // persisted state when it receives the same response.
          return response;
        } catch (error) {
          const token = getAccessToken();
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (token) headers.Authorization = `Bearer ${token}`;

          await enqueueOfflineAction(
            "/progress/me/",
            "PATCH",
            headers,
            payload,
            "progress",
            vars.lesson_slug,
          );

          triggerSyncWithBackoff();
          return {
            lesson_slug: vars.lesson_slug,
            completed: vars.completed ?? true,
            score: vars.score ?? 100,
            status: "queued",
          };
        }
      }

      const token = getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) headers.Authorization = `Bearer ${token}`;

      await enqueueOfflineAction(
        "/progress/me/",
        "PATCH",
        headers,
        payload,
        "progress",
        vars.lesson_slug,
      );

      return {
        lesson_slug: vars.lesson_slug,
        completed: vars.completed ?? true,
        score: vars.score ?? 100,
        status: "queued",
      };
    },
    [isOnline],
  );

  return { syncProgress };
}
