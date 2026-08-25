import { openDB, QUIZ_SYNC_STORE } from "../lib/offlineDB";
import { eventBus } from "../core/events";
import { getAccessToken } from "../lib/authToken";

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

/**
 * Persist a quiz attempt that could not reach the backend (offline / network
 * failure) and schedule a Service Worker background sync to flush it once the
 * network is restored.
 *
 * Returns true when the submission was safely persisted for replay.
 */
export async function queueQuizSubmission(
  payload: QuizAttemptPayload,
): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

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
    console.log(
      `[OfflineQuizSync] Queued quiz attempt ${submission.id} in IndexedDB`,
    );
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
        console.log(
          `[OfflineQuizSync] Registered background sync tag '${QUIZ_SYNC_TAG}'`,
        );
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "TRIGGER_QUIZ_SYNC",
        });
      }
    } catch (err) {
      console.warn(
        "[OfflineQuizSync] Background sync registration failed/unsupported:",
        err,
      );
    }
  }

  return true;
}

/** Number of quiz submissions waiting in the offline queue. */
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

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "QUIZ_SYNC_SUCCESS") {
      eventBus.emit("quiz-sync:success", {
        id: data.id,
        question_id: data.question_id,
      });
    } else if (data.type === "QUIZ_SYNC_FAILED") {
      eventBus.emit("quiz-sync:failed", {
        id: data.id,
        question_id: data.question_id,
        status: data.status,
      });
    }
  });
}
