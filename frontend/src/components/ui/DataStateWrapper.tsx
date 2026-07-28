import React from "react";
import { ErrorStateCard } from "./ErrorStateCard";
import { EmptyStateCard } from "./EmptyStateCard";
import { LucideIcon, Loader2 } from "lucide-react";

export interface DataStateWrapperProps {
  loading: boolean;
  error?: Error | string | boolean | null;
  empty?: boolean;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  loadingMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  children: React.ReactNode;
}

export const DataStateWrapper: React.FC<DataStateWrapperProps> = ({
  loading,
  error,
  empty = false,
  onRetry,
  skeleton,
  loadingMessage = "Loading data...",
  errorTitle,
  errorMessage,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  children,
}) => {
  // 1. Loading State
  if (loading) {
    if (skeleton) {
      return <>{skeleton}</>;
    }

    return (
      <div className="w-full py-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="text-xs font-bold text-muted dark:text-[#a0988c]">
          {loadingMessage}
        </span>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    const errorDetailsStr =
      error instanceof Error
        ? error.stack || error.message
        : typeof error === "string"
        ? error
        : null;

    const errorMsgStr =
      errorMessage ||
      (error instanceof Error ? error.message : typeof error === "string" ? error : undefined);

    return (
      <ErrorStateCard
        title={errorTitle}
        message={errorMsgStr}
        details={errorDetailsStr}
        onRetry={onRetry}
      />
    );
  }

  // 3. Empty State
  if (empty) {
    return (
      <EmptyStateCard
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />
    );
  }

  // 4. Success State
  return <>{children}</>;
};
