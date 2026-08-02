// frontend/src/app/providers.tsx
import React from 'react';
import { OfflineSyncProvider } from '../context/OfflineSyncContext';
import { OfflineSyncBanner } from '../components/ui/OfflineSyncBanner';

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <OfflineSyncProvider>
      <OfflineSyncBanner />
      {children}
    </OfflineSyncProvider>
  );
};
