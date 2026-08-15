import React, { useState, useEffect } from "react";

interface UpdateAvailableBannerProps {
  needRefresh?: boolean;
  onUpdate?: () => void;
  onDismiss?: () => void;
}

export const UpdateAvailableBanner: React.FC<UpdateAvailableBannerProps> = ({
  needRefresh: propNeedRefresh,
  onUpdate: propOnUpdate,
  onDismiss: propOnDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [updateHandler, setUpdateHandler] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (propNeedRefresh) {
      setIsVisible(true);
    }
  }, [propNeedRefresh]);

  useEffect(() => {
    const handlePwaRefresh = (event: CustomEvent<{ updateSW: (reload?: boolean) => void }>) => {
      setIsVisible(true);
      if (event.detail && typeof event.detail.updateSW === "function") {
        setUpdateHandler(() => () => event.detail.updateSW(true));
      }
    };

    window.addEventListener(
      "pwa-need-refresh" as any,
      handlePwaRefresh as EventListener,
    );

    return () => {
      window.removeEventListener(
        "pwa-need-refresh" as any,
        handlePwaRefresh as EventListener,
      );
    };
  }, []);

  const handleUpdate = () => {
    if (propOnUpdate) {
      propOnUpdate();
    } else if (updateHandler) {
      updateHandler();
    } else {
      window.location.reload();
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (propOnDismiss) {
      propOnDismiss();
    }
  };

  if (!isVisible) return null;

  return (
    <div
      data-testid="pwa-update-banner"
      role="region"
      aria-label="Application update available"
      className="fixed bottom-4 right-4 z-50 max-w-md w-full p-4 bg-surface dark:bg-slate-900 border-4 border-black dark:border-slate-700 rounded-2xl shadow-card-lg animate-in slide-in-from-bottom-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl p-2 bg-[#ffebc2] border-2 border-black rounded-xl">
            🚀
          </span>
          <div>
            <h4 className="font-extrabold text-black dark:text-slate-100 text-sm">
              New Version Available
            </h4>
            <p className="text-xs text-muted dark:text-slate-300 mt-0.5 leading-snug">
              A new version of Atelier is ready. Update now to load the latest features.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-black/10 dark:border-slate-800">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs font-bold text-black dark:text-slate-300 bg-transparent hover:bg-black/5 dark:hover:bg-slate-800 border-2 border-transparent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Later
        </button>
        <button
          onClick={handleUpdate}
          className="px-4 py-1.5 text-xs font-extrabold text-black bg-[#4ade80] hover:bg-[#22c55e] border-2 border-black rounded-lg shadow-card-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Update Now
        </button>
      </div>
    </div>
  );
};
