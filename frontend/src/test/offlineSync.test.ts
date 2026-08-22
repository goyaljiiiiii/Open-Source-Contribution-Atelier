import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventBus } from "../core/events";

interface MockIDBRequest {
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  result?: unknown;
  error?: unknown;
}

const mockStore = new Map<string, any>();

// IDB request callbacks are assigned after open()/put() return, so resolution
// must be async. queueMicrotask keeps these mocks independent of the centrally
// managed fake timers in setup.ts (which does not stub microtasks).
function makeSuccessRequest(result: unknown): MockIDBRequest {
  const req: MockIDBRequest = {
    onsuccess: null,
    onerror: null,
    result,
  };
  queueMicrotask(() => {
    if (req.onsuccess)
      req.onsuccess({ target: { result } } as unknown as Event);
  });
  return req;
}

function makeErrorRequest(error: unknown): MockIDBRequest {
  const req: MockIDBRequest = { onsuccess: null, onerror: null };
  queueMicrotask(() => {
    if (req.onerror) req.onerror({ target: { error } } as unknown as Event);
  });
  return req;
}

const defaultPut = (item: any) => {
  mockStore.set(item.id, item);
  return makeSuccessRequest(item.id);
};

const objectStoreMock = {
  put: vi.fn().mockImplementation(defaultPut),
  getAll: vi.fn().mockImplementation(() => {
    return makeSuccessRequest(Array.from(mockStore.values()));
  }),
  delete: vi.fn().mockImplementation((id: string) => {
    mockStore.delete(id);
    return makeSuccessRequest(undefined);
  }),
  count: vi.fn().mockImplementation(() => {
    return makeSuccessRequest(mockStore.size);
  }),
};

const mockIDBDatabase = {
  transaction: vi.fn().mockReturnValue({
    objectStore: vi.fn().mockReturnValue(objectStoreMock),
  }),
};

globalThis.indexedDB = {
  open: vi.fn(),
} as unknown as typeof globalThis.indexedDB;

const swListeners: Record<string, ((event: any) => void)[]> = {};
const syncRegister = vi.fn().mockResolvedValue(undefined);
const swPostMessage = vi.fn();

function setupServiceWorkerMock() {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        sync: { register: syncRegister },
      }),
      controller: { postMessage: swPostMessage },
      addEventListener: (type: string, cb: (event: any) => void) => {
        if (!swListeners[type]) swListeners[type] = [];
        swListeners[type].push(cb);
      },
    },
  });
}

type OfflineSyncModule = typeof import("../services/offlineSync");

let mod: OfflineSyncModule;
let freshEventBus: typeof eventBus;

async function loadModules() {
  vi.resetModules();
  mod = await import("../services/offlineSync");
  freshEventBus = (await import("../core/events")).eventBus;
}

const SAMPLE_PAYLOAD = {
  question_id: "git-basics-q0",
  question_text: "What does git init do?",
  selected_answer: "Creates a repository",
  correct_answer: "Creates a repository",
  is_correct: true,
  nonce: "abc-123",
};

describe("OfflineQuizSync service", () => {
  beforeEach(async () => {
    mockStore.clear();
    localStorage.clear();
    localStorage.setItem("accessToken", "test-token");
    for (const key of Object.keys(swListeners)) delete swListeners[key];
    vi.clearAllMocks();
    objectStoreMock.put.mockImplementation(defaultPut);
    setupServiceWorkerMock();

    const openReq: MockIDBRequest = { onsuccess: null, onerror: null };
    (globalThis.indexedDB.open as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        queueMicrotask(() => {
          if (openReq.onsuccess)
            openReq.onsuccess({
              target: { result: mockIDBDatabase },
            } as unknown as Event);
        });
        return openReq;
      },
    );

    await loadModules();
  });

  it("should persist an offline quiz submission and schedule background sync", async () => {
    const queued = await mod.queueQuizSubmission(SAMPLE_PAYLOAD);
    expect(queued).toBe(true);

    expect(mockStore.size).toBe(1);
    const [record] = Array.from(mockStore.values());
    expect(record.id.startsWith("quiz-sync-git-basics-q0-")).toBe(true);
    expect(record.url.endsWith("/progress/quiz-attempts/")).toBe(true);
    expect(record.method).toBe("POST");
    expect(record.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(record.body).nonce).toBe("abc-123");

    expect(syncRegister).toHaveBeenCalledWith("sync-quiz-progress");
    expect(swPostMessage).toHaveBeenCalledWith({ type: "TRIGGER_QUIZ_SYNC" });
  }, 60000);

  it("should report failure when the IndexedDB write fails", async () => {
    objectStoreMock.put.mockImplementationOnce(() =>
      makeErrorRequest(new Error("disk full")),
    );

    const queued = await mod.queueQuizSubmission(SAMPLE_PAYLOAD);

    expect(queued).toBe(false);
    expect(syncRegister).not.toHaveBeenCalled();
    expect(swPostMessage).not.toHaveBeenCalled();
  }, 60000);

  it("should count queued submissions", async () => {
    await mod.queueQuizSubmission(SAMPLE_PAYLOAD);
    await mod.queueQuizSubmission({
      ...SAMPLE_PAYLOAD,
      question_id: "git-basics-q1",
    });

    expect(await mod.getPendingQuizCount()).toBe(2);
  }, 60000);

  it("should bridge SW QUIZ_SYNC_SUCCESS messages onto the event bus", async () => {
    const successSpy = vi.fn();
    const failedSpy = vi.fn();
    freshEventBus.on("quiz-sync:success", successSpy);
    freshEventBus.on("quiz-sync:failed", failedSpy);

    const listeners = swListeners["message"] || [];
    expect(listeners.length).toBeGreaterThan(0);
    for (const cb of listeners) {
      cb({
        data: {
          type: "QUIZ_SYNC_SUCCESS",
          id: "quiz-sync-x-1",
          question_id: "q1",
        },
      });
      cb({
        data: {
          type: "QUIZ_SYNC_FAILED",
          id: "quiz-sync-y-2",
          question_id: "q2",
          status: 403,
        },
      });
      cb({ data: { type: "UNRELATED" } });
    }

    expect(successSpy).toHaveBeenCalledWith({
      id: "quiz-sync-x-1",
      question_id: "q1",
    });
    expect(failedSpy).toHaveBeenCalledWith({
      id: "quiz-sync-y-2",
      question_id: "q2",
      status: 403,
    });

    freshEventBus.off("quiz-sync:success", successSpy);
    freshEventBus.off("quiz-sync:failed", failedSpy);
  }, 60000);
});
