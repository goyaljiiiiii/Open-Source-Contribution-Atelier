// frontend/sw.js

const CACHE_NAME = 'app-cache-v1';
const DB_NAME = 'offline-sync-db';
const DB_VERSION = 1;
const STORE_NAME = 'offline-queue';

// Mutating API endpoints to intercept when offline
const MUTATING_PATTERNS = [
  /\/api\/progress\//,
  /\/api\/xp\//,
  /\/api\/quiz\//,
  /\/api\/lessons\/.*\/complete/
];

// --- IndexedDB Helper Functions ---

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addToQueue(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateQueueItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Helper to notify active clients about queue count changes
async function notifyClients() {
  const clients = await self.clients.matchAll();
  const queue = await getAllQueue();
  clients.forEach((client) => {
    client.postMessage({
      type: 'OFFLINE_QUEUE_CHANGE',
      pendingCount: queue.length
    });
  });
}

// --- Service Worker Event Listeners ---

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Check if URL matches any targeted mutating pattern
function isTargetEndpoint(url) {
  return MUTATING_PATTERNS.some((pattern) => pattern.test(url));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

  if (isMutating && isTargetEndpoint(request.url)) {
    event.respondWith(
      (async () => {
        // Generate or retain X-Request-ID for idempotency
        const requestId =
          request.headers.get('X-Request-ID') ||
          (self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : `req-${Date.now()}-${Math.random()}`);

        if (!navigator.onLine) {
          await queueRequest(request, requestId);
          return new Response(
            JSON.stringify({ offline: true, message: 'Request queued for offline sync' }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Clone request to preserve headers and body
          const reqClone = request.clone();
          const response = await fetch(reqClone);
          return response;
        } catch (error) {
          // Network failure mid-fetch
          await queueRequest(request, requestId);
          return new Response(
            JSON.stringify({ offline: true, message: 'Network failed; request queued for background sync' }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          );
        }
      })()
    );
  }
});

async function queueRequest(request, requestId) {
  const bodyText = await request.clone().text();
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key] = value;
  }
  headers['X-Request-ID'] = requestId;

  const item = {
    url: request.url,
    method: request.method,
    headers: headers,
    body: bodyText,
    timestamp: Date.now(),
    retryCount: 0
  };

  await addToQueue(item);
  await notifyClients();

  if ('sync' in self.registration) {
    try {
      await self.registration.sync.register('sync-progress');
    } catch (err) {
      console.warn('Background sync registration failed:', err);
    }
  }
}

// --- Background Sync Event ---

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  const queue = await getAllQueue();
  // FIFO order replay
  queue.sort((a, b) => a.id - b.id);

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body || undefined
      });

      if (response.ok || (response.status >= 200 && response.status < 300)) {
        await removeFromQueue(item.id);
      } else if (response.status >= 400 && response.status < 500) {
        // Client error (4xx) - drop from queue
        await removeFromQueue(item.id);
      } else if (response.status >= 500) {
        // Server error (5xx) - retry with exponential backoff up to 3 attempts
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount >= 3) {
          await removeFromQueue(item.id);
        } else {
          await updateQueueItem(item);
          // Exponential backoff delay
          await new Promise((res) => setTimeout(res, Math.pow(2, item.retryCount) * 1000));
        }
      }
    } catch (err) {
      // Re-throw or break to allow Background Sync retry mechanism
      break;
    }
  }

  await notifyClients();
}

// Listen for messages from frontend to manually trigger sync or query queue count
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'GET_PENDING_COUNT') {
    const queue = await getAllQueue();
    event.ports[0].postMessage({ pendingCount: queue.length });
  } else if (event.data && event.data.type === 'TRIGGER_SYNC') {
    await replayQueue();
  }
});
