import React, { useEffect, useRef } from "react";
import { Download, X, Award, Sparkles, CheckCircle2 } from "lucide-react";
import {
  createBadgeShareCardCanvas,
  downloadBadgeShareCardImage,
  formatShareDate,
} from "../../lib/badgeShareCard";

export interface BadgeUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  badge: {
    id?: string | number;
    name: string;
    icon?: string;
    description?: string;
    unlockCriteria?: string;
    earnedAt?: string;
    earned?: boolean;
  } | null;
  username?: string;
}

export const BadgeUnlockModal: React.FC<BadgeUnlockModalProps> = ({
  isOpen,
  onClose,
  badge,
  username = "learner",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isOpen && badge && canvasRef.current) {
      const cardCanvas = createBadgeShareCardCanvas({
        badgeName: badge.name,
        badgeIcon: badge.icon || "🏅",
        description: badge.description || badge.unlockCriteria || "Achievement unlocked!",
        username,
        date: badge.earnedAt,
      });

      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = cardCanvas.width;
        canvasRef.current.height = cardCanvas.height;
        ctx.drawImage(cardCanvas, 0, 0);
      }
    }
  }, [isOpen, badge, username]);

  if (!isOpen || !badge) return null;

  const handleDownload = () => {
    downloadBadgeShareCardImage({
      badgeName: badge.name,
      badgeIcon: badge.icon || "🏅",
      description: badge.description || badge.unlockCriteria || "Achievement unlocked!",
      username,
      date: badge.earnedAt,
    });
  };

  const formattedDate = formatShareDate(badge.earnedAt);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="
          relative w-full max-w-lg p-6 rounded-3xl
          bg-white dark:bg-[#181614]
          border-4 border-black dark:border-[#2e2924]
          shadow-[8px_8px_0px_#000] dark:shadow-[8px_8px_0px_#2e2924]
          transition-all duration-200
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-1.5 rounded-xl border-2 border-black/20 hover:border-black hover:bg-black/5 dark:border-white/20 dark:hover:border-white transition-all text-black dark:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Celebration Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 font-mono text-xs font-black uppercase tracking-wider border border-amber-400/40">
            <Sparkles className="w-3.5 h-3.5" />
            Badge Unlocked!
          </span>
          <span className="text-xs font-bold text-slate-400">
            {formattedDate}
          </span>
        </div>

        {/* Badge Hero Presentation */}
        <div className="flex items-center gap-4 my-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-amber-50 dark:from-indigo-950/40 dark:to-amber-950/40 border-2 border-black/10 dark:border-white/10">
          <div className="text-5xl flex-shrink-0 select-none animate-bounce">
            {badge.icon || "🏅"}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="badge-modal-title"
              className="text-xl font-black text-black dark:text-white truncate"
            >
              {badge.name}
            </h3>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
              {badge.description || badge.unlockCriteria}
            </p>
            <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Earned by @{username}</span>
            </div>
          </div>
        </div>

        {/* 1200x630 Social Card Preview */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              Social Share Preview Card (1200×630)
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border-2 border-black dark:border-white/20 bg-slate-950 shadow-inner">
            <canvas
              ref={canvasRef}
              className="w-full h-auto max-h-48 object-contain block"
              aria-label={`Preview card for ${badge.name}`}
            />
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="
              w-full sm:flex-1 py-3 px-4 rounded-2xl font-black text-sm
              bg-indigo-600 text-white hover:bg-indigo-700
              border-2 border-black dark:border-white/20
              shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_#fff]
              active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
              transition-all flex items-center justify-center gap-2
            "
          >
            <Download className="w-4 h-4" />
            <span>Download Share Image</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="
              w-full sm:w-auto py-3 px-5 rounded-2xl font-bold text-sm
              bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20
              text-black dark:text-white transition-all
            "
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BadgeUnlockModal;
