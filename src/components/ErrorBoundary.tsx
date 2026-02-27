"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches rendering errors in its subtree.
 * In development, shows the full stack trace.
 * In production, logs to console.error and shows a generic message.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` (${this.props.label})` : ""}]`, error, info);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isDev = process.env.NODE_ENV === "development";

      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-destructive font-semibold text-sm">
              {this.props.label ? `${this.props.label}: ` : ""}Something went wrong
            </span>
          </div>
          {isDev && this.state.error && (
            <pre className="text-xs text-destructive/80 overflow-auto max-h-48 bg-destructive/5 rounded p-2 font-mono">
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          )}
          {!isDev && (
            <p className="text-xs text-muted-foreground">
              An unexpected error occurred. Please reload the page.
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-xs text-primary hover:underline"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
