import React from "react";
import { Inbox, LucideIcon } from "lucide-react";

export interface EmptyStateCardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  title = "No Results Found",
  description = "There is currently no data matching your criteria. Try adjusting your filters or search terms.",
  icon: Icon = Inbox,
  action,
  className = "",
}) => {
  return (
    <div className={`w-full p-8 text-center bg-white dark:bg-[#151411] border-2 border-black/10 dark:border-[#2e2924] rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm ${className}`}>
      <div className="p-3 rounded-2xl bg-surface-low dark:bg-[#1a1714] text-muted dark:text-[#a0988c] border border-black/10 dark:border-[#2e2924]">
        <Icon className="w-8 h-8" />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-black text-text dark:text-[#f0ebe2] tracking-tight">
          {title}
        </h3>
        <p className="text-xs md:text-sm text-muted dark:text-[#c4bbae] max-w-sm mx-auto font-medium">
          {description}
        </p>
      </div>

      {action && (
        <div className="pt-2">
          <button
            onClick={action.onClick}
            className="px-4 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent/90 transition-all shadow-card-sm"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
};
