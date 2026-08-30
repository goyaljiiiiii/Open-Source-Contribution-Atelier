import { openDB } from "./offlineDB";
import { eventBus } from "../core/events";

export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

interface PendingSyncItem {
  lesson_slug: string;
  score?: number;
  completed?: boolean;
  timestamp: number;
}

export interface RetryPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  maxAttempts: number;
}

export interface RetryState {
  attempts: number;
  nextRetryAt: number;
  lastAttemptAt: number | null;
  lastStatus: number | null;
  lastError: string | null;
}

export const DEFAULT_RETRY_POLICY: Readonly<RetryPolicy> = Object.freeze({
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  jitterRatio: 0.25,
  maxAttempts: 8,
});

const RETRY_STATE_KEY = "atelier_sync_retry_state";
const ONLINE_EVENT_DEBOUNCE_MS = 750;

let retryTimer: ReturnType<typeof setTimeout> | undefined;
let onlineDebounceTimer: ReturnType<typeof setTimeout> | undefined;
let activeSyncPromise: Promise<void> | null = null;

/**
 * Calculate an exponential backoff delay with bounded random jitter.
 *
 * The exponential portion doubles after every failed attempt while the
 * maximum delay prevents a permanently queued action from becoming silent.
 * Jitter spreads clients over the recovery window instead of causing a
 * thundering-herd request burst.
 */
export function calculateBackoffDelay(
  attempt: number,
  random = Math.random(),
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const exponential = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** safeAttempt,
  );
  const jitter = exponential * policy.jitterRatio;
  const boundedRandom = Math.min(1, Math.max(0, random));
  const offset = (boundedRandom * 2 - 1) * jitter;

  return Math.max(0, Math.round(Math.min(policy.maxDelayMs, exponential + offset)));
}

/** Reset the process-wide retry schedule after a successful HTTP response. */
export function resetBackoff(): void {
  clearScheduledRetry();
  retryTimer = undefined;
}

/** Cancel a scheduled retry without changing persisted queue contents. */
export function clearScheduledRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
}

function readRetryState(): Record<string, RetryState> {
  if (typeof localStorage === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(RETRY_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeRetryState(states: Record<string, RetryState>): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(RETRY_STATE_KEY, JSON.stringify(states));
  } catch (err) {
    console.warn("[OfflineQueue] Failed to persist retry state:", err);
  }
}

export function getRetryState(id: string): RetryState | null {
  return readRetryState()[id] || null;
}

export function clearRetryState(id: string): void {
  const states = readRetryState();
  delete states[id];
  writeRetryState(states);
}

function updateRetryState(
  id: string,
  update: Partial<RetryState>,
): RetryState {
  const states = readRetryState();
  const previous: RetryState = states[id] || {
    attempts: 0,
    nextRetryAt: 0,
    lastAttemptAt: null,
    lastStatus: null,
    lastError: null,
  };

  const next = { ...previous, ...update };
  states[id] = next;
  writeRetryState(states);
  return next;
}

function scheduleRetry(delayMs: number): void {
  clearScheduledRetry();
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    void syncOfflineQueue();
  }, Math.max(0, delayMs));
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isSuccessfulOrDiscardable(status: number): boolean {
  return status >= 200 && status < 300 || status === 400 || status === 409;
}

async function deleteQueuedAction(
  db: IDBDatabase,
  id: string,
): Promise<void> {
  const writeTx = db.transaction("sync-queue", "readwrite");
  const writeStore = writeTx.objectStore("sync-queue");

  await new Promise<void>((resolve, reject) => {
    const deleteReq = writeStore.delete(id);
    deleteReq.onsuccess = () => resolve();
    deleteReq.onerror = () => reject(deleteReq.error);
  });
}

function removeLocalMirror(lessonSlug: string): void {
  if (typeof localStorage === "undefined") return;

  try {
    const pending = JSON.parse(
      localStorage.getItem("atelier_pending_sync") || "[]",
    );
    const filtered = pending.filter(
      (item: PendingSyncItem) => item.lesson_slug !== lessonSlug,
    );
    localStorage.setItem("atelier_pending_sync", JSON.stringify(filtered));
  } catch (err) {
    console.error("[OfflineQueue] Failed to update localStorage:", err);
  }
}

function parseBody(body: string): Record<string, any> {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function enqueueOfflineAction(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Record<string, any> | string,
  type: string,
  slugOrId: string,
) {
  const id = `${type}-${slugOrId}`;
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  const finalUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const bodyObj = typeof body === "string" ? parseBody(body) : body;

  const action: QueuedAction = {
    id,
    url: finalUrl,
    method,
    headers,
    body: bodyStr,
    timestamp: Date.now(),
  };

  try {
    const db = await openDB();
    const tx = db.transaction("sync-queue", "readwrite");
    const store = tx.objectStore("sync-queue");
    await new Promise<void>((resolve, reject) => {
      const req = store.put(action);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    clearRetryState(id);
  } catch (err) {
    console.error("[OfflineQueue] Failed to save action to IndexedDB:", err);
    return;
  }

  try {
    const pending = JSON.parse(
      localStorage.getItem("atelier_pending_sync") || "[]",
    );
    const exists = pending.some((p: any) => p.id === id);
    if (!exists) {
      pending.push({
        id,
        lesson_slug: bodyObj.lesson_slug || slugOrId,
        score: bodyObj.score ?? 100,
        completed: bodyObj.completed ?? true,
        timestamp: action.timestamp,
      });
      localStorage.setItem("atelier_pending_sync", JSON.stringify(pending));
    }
  } catch (err) {
    console.error("[OfflineQueue] Failed to mirror to localStorage:", err);
  }

  await requestBackgroundSync();
}

async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    if ("sync" in reg) {
      interface ServiceWorkerRegistrationWithSync
        extends ServiceWorkerRegistration {
        sync: { register: (tag: string) => Promise<void> };
      }

      await (reg as ServiceWorkerRegistrationWithSync).sync.register(
        "sync-progress",
      );
    }

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "TRIGGER_SYNC",
      });
    }
  } catch (err) {
    console.warn(
      "[OfflineQueue] Service worker sync registration failed/unsupported:",
      err,
    );
  }
}

export async function queueProgressSync(data: {
  lesson_slug: string;
  score?: number;
  completed?: boolean;
  headers: Record<string, string>;
}) {
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  const id = `progress-sync-${data.lesson_slug}`;

  const action: QueuedAction = {
    id,
    url: `${API_BASE}/progress/me/`,
    method: "POST",
    headers: data.headers,
    body: JSON.stringify({
      lesson_slug: data.lesson_slug,
      score: data.score,
      completed: data.completed,
    }),
    timestamp: Date.now(),
  };

  try {
    const db = await openDB();
    const tx = db.transaction("sync-queue", "readwrite");
    const store = tx.objectStore("sync-queue");

    await new Promise<void>((resolve, reject) => {
      const req = store.put(action);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    clearRetryState(id);
  } catch (err) {
    console.error("[OfflineQueue] Failed to save action:", err);
    return;
  }

  try {
    const pending = JSON.parse(
      localStorage.getItem("atelier_pending_sync") || "[]",
    );
    const exists = pending.some(
      (p: PendingSyncItem) => p.lesson_slug === data.lesson_slug,
    );

    if (!exists) {
      pending.push({
        lesson_slug: data.lesson_slug,
        score: data.score ?? 100,
        completed: data.completed ?? true,
        timestamp: action.timestamp,
      });
      localStorage.setItem("atelier_pending_sync", JSON.stringify(pending));
    }
  } catch (err) {
    console.error("[OfflineQueue] Failed to mirror to localStorage:", err);
  }

  await requestBackgroundSync();
}

async function getQueuedActions(): Promise<{
  db: IDBDatabase;
  actions: QueuedAction[];
}> {
  const db = await openDB();
  const tx = db.transaction("sync-queue", "readonly");
  const store = tx.objectStore("sync-queue");

  const actions: QueuedAction[] = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return { db, actions };
}

async function syncSingleAction(
  db: IDBDatabase,
  action: QueuedAction,
): Promise<"success" | "retry" | "discard"> {
  const current = getRetryState(action.id);
  const attempt = current?.attempts ?? 0;

  if (current?.nextRetryAt && current.nextRetryAt > Date.now()) {
    return "retry";
  }

  const attemptedAt = Date.now();
  updateRetryState(action.id, {
    attempts: attempt + 1,
    lastAttemptAt: attemptedAt,
    lastError: null,
  });

  try {
    const response = await fetch(action.url, {
      method: action.method,
      headers: action.headers,
      body: action.body,
    });

    if (isSuccessfulOrDiscardable(response.status)) {
      const bodyObj = parseBody(action.body);

      await deleteQueuedAction(db, action.id);
      if (bodyObj.lesson_slug) removeLocalMirror(bodyObj.lesson_slug);

      clearRetryState(action.id);
      resetBackoff();

      eventBus.emit("sync:success", {
        lesson_slug: bodyObj.lesson_slug,
      });

      return "success";
    }

    if (!shouldRetryStatus(response.status)) {
      clearRetryState(action.id);
      await deleteQueuedAction(db, action.id);

      eventBus.emit("sync:failed", {
        id: action.id,
        status: response.status,
      });

      return "discard";
    }

    const nextAttempt = attempt + 1;
    if (nextAttempt >= DEFAULT_RETRY_POLICY.maxAttempts) {
      const delay = DEFAULT_RETRY_POLICY.maxDelayMs;
      updateRetryState(action.id, {
        attempts: nextAttempt,
        nextRetryAt: Date.now() + delay,
        lastStatus: response.status,
      });
      return "retry";
    }

    const delay = calculateBackoffDelay(nextAttempt);
    updateRetryState(action.id, {
      attempts: nextAttempt,
      nextRetryAt: Date.now() + delay,
      lastStatus: response.status,
    });
    return "retry";
  } catch (err) {
    const nextAttempt = attempt + 1;
    const delay = calculateBackoffDelay(nextAttempt);
    updateRetryState(action.id, {
      attempts: nextAttempt,
      nextRetryAt: Date.now() + delay,
      lastError: err instanceof Error ? err.message : String(err),
    });

    return "retry";
  }
}

export async function syncOfflineQueue(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    try {
      const { db, actions } = await getQueuedActions();
      if (actions.length === 0) {
        resetBackoff();
        return;
      }

      let retryNeeded = false;

      for (const action of actions) {
        const result = await syncSingleAction(db, action);

        if (result === "retry") {
          retryNeeded = true;
          break;
        }
      }

      if (retryNeeded) {
        const states = actions
          .map((action) => getRetryState(action.id))
          .filter(Boolean) as RetryState[];

        const nextRetryAt = Math.min(
          ...states.map((state) => state.nextRetryAt || Date.now()),
        );

        scheduleRetry(Math.max(0, nextRetryAt - Date.now()));
      } else {
        resetBackoff();
      }
    } catch (err) {
      console.error("[OfflineQueue] Error during offline queue sync:", err);
      const delay = calculateBackoffDelay(1);
      scheduleRetry(delay);
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export function triggerSyncWithBackoff(): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  if (onlineDebounceTimer) clearTimeout(onlineDebounceTimer);
  onlineDebounceTimer = setTimeout(() => {
    onlineDebounceTimer = undefined;
    void syncOfflineQueue();
  }, ONLINE_EVENT_DEBOUNCE_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log(
      "[OfflineQueue] Browser went online. Starting backoff-aware sync...",
    );
    triggerSyncWithBackoff();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_SUCCESS") {
        const lesson_slug = event.data.lesson_slug;
        removeLocalMirror(lesson_slug);
        clearRetryState(`progress-sync-${lesson_slug}`);
        resetBackoff();
        eventBus.emit("sync:success", { lesson_slug });
      } else if (event.data?.type === "SYNC_CONFLICT") {
        const { lesson_slug, serverData, localData } = event.data;
        eventBus.emit("sync:conflict", {
          lesson_slug,
          serverData,
          localData,
        });
      }
    });
  }
}

export async function removeQueuedAction(id: string, lessonSlug: string) {
  try {
    const db = await openDB();
    await deleteQueuedAction(db, id);
    removeLocalMirror(lessonSlug);
    clearRetryState(id);
    console.log(`[OfflineQueue] Successfully removed queued action ${id}`);
  } catch (err) {
    console.error("[OfflineQueue] Error removing queued action:", err);
  }
}
