// frontend/src/components/ui/OfflineSyncBanner.tsx
import React from 'react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export const OfflineSyncBanner: React.FC = () => {
  const { pendingCount } = useOfflineSync();

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div
      data-testid="offline-sync-banner"
      style={{
        backgroundColor: '#f59e0b',
        color: '#ffffff',
        padding: '0.5rem 1rem',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '0.875rem',
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
      }}
    >
      <span>📤 You have {pendingCount} unsynced progress events — reconnecting...</span>
    </div>
  );
};
