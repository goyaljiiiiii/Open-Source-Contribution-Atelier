import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Runtime cache used for Vite's content chunks.
 *
 * Dynamic imports are intentionally not part of Workbox's precache manifest
 * because their hashed filenames are generated during the build. Cache them
 * on first request instead, allowing an already-downloaded module to remain
 * available after the network disappears.
 */
const MODULE_CACHE_NAME = "atelier-modules-v1";
const MODULE_CACHE_MAX_ENTRIES = 150;
const MODULE_CACHE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MODULE_CHUNK_PATTERN = /^\/assets\/(?:Module|module)-[^/]+\.js$/;
const GENERIC_CHUNK_PATTERN = /^\/assets\/[^/]+\.js$/;

function isModuleChunkRequest({ request, url }) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  return MODULE_CHUNK_PATTERN.test(url.pathname) || GENERIC_CHUNK_PATTERN.test(url.pathname);
}

function isJavaScriptChunkResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return response.ok && (
    contentType.includes("javascript") ||
    contentType.includes("application/octet-stream") ||
    contentType === ""
  );
}

async function cacheModuleResponse({ request, preloadResponse }) {
  const response = preloadResponse || await fetch(request);

  if (!isJavaScriptChunkResponse(response)) {
    return response;
  }

  const cache = await caches.open(MODULE_CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function offlineChunkFallback(request) {
  const cache = await caches.open(MODULE_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) return cached;

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Offline module unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f7f8; color: #222; }
    main { max-width: 32rem; padding: 2rem; text-align: center; }
    h1 { font-size: 1.35rem; margin-bottom: .75rem; }
    p { line-height: 1.55; color: #555; }
    button { border: 0; border-radius: .5rem; padding: .7rem 1rem; cursor: pointer; font: inherit; }
  </style>
</head>
<body>
  <main>
    <h1>This learning module is not available offline yet.</h1>
    <p>Reconnect to the internet and open this module once so its JavaScript content can be stored for future offline use.</p>
    <button onclick="location.reload()">Try again</button>
  </main>
</body>
</html>`,
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

registerRoute(
  isModuleChunkRequest,
  async ({ request, preloadResponse }) => {
    try {
      return await cacheModuleResponse({ request, preloadResponse });
    } catch (error) {
      console.warn("[ServiceWorker] Dynamic module unavailable:", request.url, error);
      return offlineChunkFallback(request);
    }
  },
  "GET",
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/content/"),
  new CacheFirst({
    cacheName: "content-runtime-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

const API_CACHE_PATHS = [
  "/api/dashboard/",
  "/api/progress/",
  "/api/leaderboard/",
  "/api/recommendations/",
  "/api/challenges/",
  "/api/users/me/learning-path/",
  "/api/content/lessons/",
];

registerRoute(
  ({ request, url }) => {
    if (request.method !== "GET") return false;
    return API_CACHE_PATHS.some((p) => url.pathname.startsWith(p));
  },
  new NetworkFirst({
    cacheName: "api-runtime-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60,
      }),
    ],
  }),
);

const DB_NAME = "atelier-offline-db";
const STORE_NAME = "sync-queue";
const QUIZ_STORE_NAME = "pending_quiz_sync";
const DB_VERSION = 3;

self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activated");
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const cacheNames = await caches.keys();
      const obsoleteModuleCaches = cacheNames.filter(
        (name) => name.startsWith("atelier-modules-") && name !== MODULE_CACHE_NAME,
      );
      await Promise.all(obsoleteModuleCaches.map((name) => caches.delete(name)));
    })(),
  );
});

self.addEventListener("sync", (event) => {
  console.log("[ServiceWorker] Sync event fired for tag:", event.tag);
  if (event.tag === "sync-progress") event.waitUntil(syncProgressQueue());
  if (event.tag === "sync-quiz-progress") event.waitUntil(syncQuizQueue());
});

self.addEventListener("message", (event) => {
  console.log("[ServiceWorker] Message received:", event.data);
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data && event.data.type === "TRIGGER_SYNC") {
    event.waitUntil(syncProgressQueue());
  } else if (event.data && event.data.type === "TRIGGER_QUIZ_SYNC") {
    event.waitUntil(syncQuizQueue());
  } else if (event.data && event.data.type === "CLEAR_MODULE_CACHE") {
    event.waitUntil(clearModuleCache());
  }
});

self.addEventListener("push", (event) => {
  console.log("[ServiceWorker] Push event received:", event);
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "New Notification";
    const options = {
      body: data.message || "You have a new message.",
      icon: "/vite.svg",
      badge: "/vite.svg",
      data: { url: data.url || "/" },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("[ServiceWorker] Error parsing push data", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  console.log("[ServiceWorker] Notification click Received.");
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
      }),
  );
});

async function clearModuleCache() {
  const deleted = await caches.delete(MODULE_CACHE_NAME);
  await notifyClients({ type: "MODULE_CACHE_CLEARED", deleted });
}

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(QUIZ_STORE_NAME)) {
        const quizStore = db.createObjectStore(QUIZ_STORE_NAME, { keyPath: "id" });
        quizStore.createIndex("queuedAt", "queuedAt", { unique: false });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const request = transaction.objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage(message));
}

async function syncProgressQueue() {
  console.log("[ServiceWorker] Starting background queue sync...");
  let db;
  try { db = await openDB(); } catch (err) {
    console.error("[ServiceWorker] Failed to open IndexedDB:", err);
    return;
  }

  let actions;
  try { actions = await getAllFromStore(db, STORE_NAME); } catch (err) {
    console.error("[ServiceWorker] Failed to read IndexedDB store:", err);
    return;
  }

  if (!actions || actions.length === 0) return;

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body,
      });

      let lesson_slug = null;
      if (action.id && action.id.startsWith("progress-sync-")) {
        lesson_slug = action.id.replace("progress-sync-", "");
      }

      if (response.ok || response.status === 400) {
        await deleteFromStore(db, STORE_NAME, action.id);
        await notifyClients({
          type: "SYNC_SUCCESS",
          id: action.id,
          lesson_slug,
          entity_type: action.entity_type,
          entity_id: action.entity_id,
        });
      } else if (response.status === 409) {
        const serverData = await response.clone().json().catch(() => ({}));
        let localData = {};
        try { localData = JSON.parse(action.body); } catch (e) {}

        await notifyClients({
          type: "SYNC_CONFLICT",
          id: action.id,
          lesson_slug,
          serverData,
          localData,
        });
      }
    } catch (err) {
      console.error(`[ServiceWorker] Fetch error for action ${action.id}:`, err);
    }
  }
}

async function syncQuizQueue() {
  console.log("[ServiceWorker] Starting offline quiz submission sync...");
  let db;
  try { db = await openDB(); } catch (err) {
    console.error("[ServiceWorker] Failed to open IndexedDB:", err);
    return;
  }

  let submissions;
  try { submissions = await getAllFromStore(db, QUIZ_STORE_NAME); } catch (err) {
    console.error("[ServiceWorker] Failed to read quiz submission queue:", err);
    return;
  }

  if (!submissions || submissions.length === 0) return;

  for (const submission of submissions) {
    try {
      const response = await fetch(submission.url, {
        method: submission.method,
        headers: submission.headers,
        body: submission.body,
      });

      if (response.ok) {
        await deleteFromStore(db, QUIZ_STORE_NAME, submission.id);
        await notifyClients({
          type: "QUIZ_SYNC_SUCCESS",
          id: submission.id,
          question_id: submission.question_id,
        });
      } else if (response.status !== 401 && response.status < 500) {
        await deleteFromStore(db, QUIZ_STORE_NAME, submission.id);
        await notifyClients({
          type: "QUIZ_SYNC_FAILED",
          id: submission.id,
          question_id: submission.question_id,
          status: response.status,
        });
      }
    } catch (err) {
      console.error(`[ServiceWorker] Fetch error for quiz submission ${submission.id}:`, err);
    }
  }
}
