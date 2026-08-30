import { openDB, QUIZ_SYNC_STORE } from "../lib/offlineDB";
import { eventBus } from "../core/events";
import { getAccessToken } from "../lib/authToken";
import {
  calculateBackoffDelay,
  clearRetryState,
  getRetryState,
  resetBackoff,
  type RetryPolicy,
  DEFAULT_RETRY_POLICY,
} from "../lib/offlineQueue";

export const QUIZ_SYNC_TAG = "sync-quiz-progress";
const QUIZ_ATTEMPTS_ENDPOINT = "/progress/quiz-attempts/";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export interface QuizAttemptPayload {
  question_id: string;
  question_text: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  nonce: string;
}

export interface PendingQuizSubmission {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  question_id: string;
  queuedAt: number;
}

export const QUIZ_RETRY_POLICY: RetryPolicy = Object.freeze({
  ...DEFAULT_RETRY_POLICY,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  jitterRatio: 0.25,
  maxAttempts: 8,
});

const quizTimers = new Map<string, ReturnType<typeof setTimeout>>();
let quizSyncInFlight = false;

/**
 * Calculate the next quiz retry using the same exponential-backoff contract
 * as progress synchronization.
 */
export function calculateQuizRetryDelay(
  attempt: number,
  random = Math.random,
): number {
  return calculateBackoffDelay(attempt, random, QUIZ_RETRY_POLICY);
}

function parseResponseBody(response: Response): Promise<unknown> {
  return response
    .clone()
    .json()
    .catch(() => null);
}

function shouldRetryQuizStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function clearQuizTimer(id: string): void {
  const timer = quizTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    quizTimers.delete(id);
  }
}

function scheduleQuizRetry(
  submission: PendingQuizSubmission,
  attempt: number,
): void {
  clearQuizTimer(submission.id);

  const state = getRetryState(submission.id);
  const delay = Math.max(
    0,
    (state?.nextRetryAt ?? 0) - Date.now(),
  ) || calculateQuizRetryDelay(attempt);

  const timer = setTimeout(() => {
    quizTimers.delete(submission.id);
    void syncQuizQueue();
  }, delay);

  quizTimers.set(submission.id, timer);
}

async function getQuizSubmissions(): Promise<{
  db: IDBDatabase;
  submissions: PendingQuizSubmission[];
}> {
  const db = await openDB();
  const tx = db.transaction(QUIZ_SYNC_STORE, "readonly");
  const store = tx.objectStore(QUIZ_SYNC_STORE);

  const submissions: PendingQuizSubmission[] = await new Promise(
    (resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    },
  );

  return { db, submissions };
}

async function deleteQuizSubmission(
  db: IDBDatabase,
  id: string,
): Promise<void> {
  const tx = db.transaction(QUIZ_SYNC_STORE, "readwrite");
  const store = tx.objectStore(QUIZ_SYNC_STORE);

  await new Promise<void>((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persist a quiz attempt that could not reach the backend and request
 * background replay.
 */
export async function queueQuizSubmission(
  payload: QuizAttemptPayload,
): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getAccessToken();

  if (token) headers.Authorization = `Bearer ${token}`;

  const submission: PendingQuizSubmission = {
    id: `quiz-sync-${payload.question_id}-${Date.now()}`,
    url: `${API_BASE}${QUIZ_ATTEMPTS_ENDPOINT}`,
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    question_id: payload.question_id,
    queuedAt: Date.now(),
  };

  try {
    const db = await openDB();
    const tx = db.transaction(QUIZ_SYNC_STORE, "readwrite");
    const store = tx.objectStore(QUIZ_SYNC_STORE);

    await new Promise<void>((resolve, reject) => {
      const req = store.put(submission);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    clearRetryState(submission.id);
  } catch (err) {
    console.error("[OfflineQuizSync] Failed to persist quiz submission:", err);
    return false;
  }

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const regWithSync = reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };

      if (regWithSync.sync) {
        await regWithSync.sync.register(QUIZ_SYNC_TAG);
      }

      navigator.serviceWorker.controller?.postMessage({
        type: "TRIGGER_QUIZ_SYNC",
      });
    } catch (err) {
      console.warn(
        "[OfflineQuizSync] Background sync registration failed/unsupported:",
        err,
      );
    }
  }

  return true;
}

export async function getPendingQuizCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(QUIZ_SYNC_STORE, "readonly");
    const store = tx.objectStore(QUIZ_SYNC_STORE);

    return await new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[OfflineQuizSync] Failed to read pending quiz count:", err);
    return 0;
  }
}

export async function syncQuizQueue(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (quizSyncInFlight) return;

  quizSyncInFlight = true;

  try {
    const { db, submissions } = await getQuizSubmissions();

    for (const submission of submissions) {
      const retryState = getRetryState(submission.id);
      if (retryState?.nextRetryAt && retryState.nextRetryAt > Date.now()) {
        scheduleQuizRetry(submission, retryState.attempts);
        continue;
      }

      const attempt = (retryState?.attempts ?? 0) + 1;

      try {
        const response = await fetch(submission.url, {
          method: submission.method,
          headers: submission.headers,
          body: submission.body,
        });

        if (response.ok) {
          await deleteQuizSubmission(db, submission.id);
          clearQuizTimer(submission.id);
          clearRetryState(submission.id);
          resetBackoff();

          eventBus.emit("quiz-sync:success", {
            id: submission.id,
            question_id: submission.question_id,
          });
          continue;
        }

        if (!shouldRetryQuizStatus(response.status)) {
          await deleteQuizSubmission(db, submission.id);
          clearQuizTimer(submission.id);
          clearRetryState(submission.id);

          eventBus.emit("quiz-sync:failed", {
            id: submission.id,
            question_id: submission.question_id,
            status: response.status,
            response: await parseResponseBody(response),
          });
          continue;
        }

        const delay = calculateQuizRetryDelay(attempt);
        const nextRetryAt = Date.now() + delay;

        updateQuizRetryState(submission.id, {
          attempts: attempt,
          nextRetryAt,
          lastAttemptAt: Date.now(),
          lastStatus: response.status,
          lastError: null,
        });

        scheduleQuizRetry(submission, attempt);
        break;
      } catch (err) {
        const delay = calculateQuizRetryDelay(attempt);
        updateQuizRetryState(submission.id, {
          attempts: attempt,
          nextRetryAt: Date.now() + delay,
          lastAttemptAt: Date.now(),
          lastStatus: null,
          lastError: err instanceof Error ? err.message : String(err),
        });

        scheduleQuizRetry(submission, attempt);
        break;
      }
    }
  } catch (err) {
    console.error("[OfflineQuizSync] Error during quiz queue sync:", err);
  } finally {
    quizSyncInFlight = false;
  }
}

function updateQuizRetryState(
  id: string,
  update: {
    attempts: number;
    nextRetryAt: number;
    lastAttemptAt: number;
    lastStatus: number | null;
    lastError: string | null;
  },
): void {
  if (typeof localStorage === "undefined") return;

  try {
    const key = "atelier_sync_retry_state";
    const states = JSON.parse(localStorage.getItem(key) || "{}");
    states[id] = update;
    localStorage.setItem(key, JSON.stringify(states));
  } catch (err) {
    console.warn("[OfflineQuizSync] Failed to persist retry state:", err);
  }
}

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "QUIZ_SYNC_SUCCESS") {
      clearQuizTimer(data.id);
      clearRetryState(data.id);
      resetBackoff();
      eventBus.emit("quiz-sync:success", {
        id: data.id,
        question_id: data.question_id,
      });
    } else if (data.type === "QUIZ_SYNC_FAILED") {
      clearQuizTimer(data.id);
      clearRetryState(data.id);
      eventBus.emit("quiz-sync:failed", {
        id: data.id,
        question_id: data.question_id,
        status: data.status,
      });
    }
  });
}
