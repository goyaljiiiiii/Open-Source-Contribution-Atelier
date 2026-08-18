import React, { useState } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Home } from "lucide-react";
import { Link } from "react-router-dom";

export interface ErrorStateCardProps {
  title?: string;
  message?: string;
  details?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  fullScreen?: boolean;
  className?: string;
}

export const ErrorStateCard: React.FC<ErrorStateCardProps> = ({
  title = "Failed to Load Data",
  message = "An unexpected error occurred while communicating with the server. Please check your network connection and try again.",
  details,
  onRetry,
  retryLabel = "Retry Request",
  fullScreen = false,
  className = "",
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const containerClasses = fullScreen
    ? "min-h-[400px] w-full flex items-center justify-center p-6"
    : "w-full p-6";

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="w-full max-w-xl mx-auto bg-white dark:bg-[#151411] border-2 border-red-500/30 dark:border-red-500/30 rounded-2xl p-6 shadow-lg flex flex-col items-center text-center gap-4 animate-in fade-in duration-200">
        {/* Warning Icon Badge */}
        <div className="p-3.5 rounded-2xl bg-red-500/15 text-red-500 border border-red-500/30">
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Title & User Message */}
        <div className="space-y-1.5">
          <h3 className="text-xl font-black text-text dark:text-[#f0ebe2] tracking-tight">
            {title}
          </h3>
          <p className="text-xs md:text-sm text-muted dark:text-[#c4bbae] max-w-md mx-auto font-medium">
            {message}
          </p>
        </div>

        {/* Optional Technical Details Accordion */}
        {details && (
          <div className="w-full text-left pt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs font-bold text-muted hover:text-text dark:text-[#a0988c] dark:hover:text-[#f0ebe2] transition-colors mx-auto"
            >
              {showDetails ? "Hide Diagnostic Details" : "Show Diagnostic Details"}
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showDetails && (
              <div className="mt-2 p-3 bg-surface-low dark:bg-[#0c0b0a] border border-black/10 dark:border-[#2e2924] rounded-xl text-left overflow-x-auto max-h-40">
                <pre className="text-[11px] font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {details}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2 flex-wrap justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white font-bold text-xs rounded-xl shadow-card-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              {retryLabel}
            </button>
          )}

          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-surface-low dark:bg-[#1a1714] hover:bg-black/5 dark:hover:bg-white/5 text-text dark:text-[#f0ebe2] font-bold text-xs rounded-xl border border-black/10 dark:border-[#2e2924] transition-all"
          >
            <Home className="w-4 h-4 text-muted" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
