// frontend/src/hooks/useLocalSync.ts
import { useState, useEffect, useCallback } from 'react';

export function useLocalSync<T>(key: string, initialData: T) {
  const [data, setData] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialData;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save to localStorage
  const save = useCallback((newData: T) => {
    localStorage.setItem(key, JSON.stringify(newData));
    setData(newData);
  }, [key]);

  // Sync with server
  const sync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || "[]";
      if (stored) {
        setPending(JSON.parse(stored));
        console.log("Pending from localStorage:", JSON.parse(stored));
      } else {
        setPending([]);
        console.log("No pending items in localStorage");
      }
    } catch (e) {
      console.error("Failed to load pending sync from localStorage", e);
      setPending([]);
    }
  }, []);

  useEffect(() => {
    loadPending();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadPending();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [loadPending]);

  const isLessonPendingCompleted = useCallback(
    (slug: string) => {
      return pending.some((p) => p.lesson_slug === slug && p.completed);
    },
    [pending],
  );

  const getPendingXP = useCallback(
    (backendProgress: ProgressEntry[]) => {
      let pendingXP = 0;
      pending.forEach((p) => {
        const inBackend = backendProgress.some(
          (bp) => bp.lesson_slug === p.lesson_slug,
        );
        if (!inBackend) {
          pendingXP += p.score || 0;
        }
      });
      return pendingXP;
    },
    [pending],
  );

  return {
    pending,
    isLessonPendingCompleted,
    getPendingXP,
    refresh: loadPending,
  };
}