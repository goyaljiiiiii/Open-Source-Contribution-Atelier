// frontend/src/context/OfflineSyncContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

interface OfflineSyncContextType {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  triggerSync: () => Promise<void>;
}

export const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isOnline: true,
  pendingCount: 0,
  lastSyncAt: null,
  triggerSync: async () => {},
});

const DB_NAME = 'offline-sync-db';
const STORE_NAME = 'offline-queue';

// Helper to inspect IndexedDB directly from React client
const getIndexedDBPendingCount = (): Promise<number> => {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(0);
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) return resolve(0);
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    };
    request.onerror = () => resolve(0);
  });
};

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const refreshPendingCount = async () => {
    const count = await getIndexedDBPendingCount();
    setPendingCount(count);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial count fetch
    refreshPendingCount();

    // Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('OfflineSync SW registered:', registration.scope);
      }).catch((err) => {
        console.warn('SW registration failed:', err);
      });

      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'OFFLINE_QUEUE_CHANGE') {
          setPendingCount(event.data.pendingCount);
          if (event.data.pendingCount === 0) {
            setLastSyncAt(new Date());
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
    }
    await refreshPendingCount();
  };

  return (
    <OfflineSyncContext.Provider value={{ isOnline, pendingCount, lastSyncAt, triggerSync }}>
      {children}
    </OfflineSyncContext.Provider>
  );
};
