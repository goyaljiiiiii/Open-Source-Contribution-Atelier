import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "../../lib/logger";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    // Log the error to the centralized error reporting service
    logger.error(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-base">
          <div className="max-w-md w-full bg-white rounded-2xl border-4 border-black shadow-card p-8 text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-accent opacity-20 border-4 border-black"></div>

            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 border-4 border-black mb-6">
                <span className="text-3xl" aria-hidden="true">
                  ⚠️
                </span>
              </div>

              <h1 className="text-2xl font-black mb-2 uppercase tracking-tight">
                Something went wrong
              </h1>

              <p className="text-muted mb-4">
                We've encountered an unexpected error.
              </p>

              {this.state.error && (
                <div className="mb-6 p-3 bg-red-50 border-2 border-red-500 rounded-xl text-left text-xs font-mono text-red-700 overflow-x-auto break-words">
                  <strong>Error:</strong> {this.state.error.message}
                </div>
              )}

              <button
                onClick={this.handleReset}
                className="w-full inline-flex items-center justify-center rounded-lg border-4 border-black bg-primary px-6 py-3 font-black text-black shadow-gel hover:-translate-y-1 active:translate-y-1 transition-all uppercase"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
