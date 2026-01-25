"use client";

import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Props for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show a retry button (default: true) */
  showRetry?: boolean;
  /** Custom error message to display */
  errorMessage?: string;
  /** Component name for error identification */
  componentName?: string;
}

/**
 * State for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI.
 * This prevents the entire app from crashing due to errors in specific components.
 *
 * @example
 * ```tsx
 * <ErrorBoundary componentName="Dashboard">
 *   <DashboardContent />
 * </ErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <RiskyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error(
      `[ErrorBoundary${this.props.componentName ? ` - ${this.props.componentName}` : ""}]`,
      error,
      errorInfo
    );

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const {
      children,
      fallback,
      showRetry = true,
      errorMessage,
      componentName,
    } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {componentName ? `Error in ${componentName}` : "Something went wrong"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {errorMessage ||
                "An unexpected error occurred. Please try again or refresh the page."}
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === "development" && error && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-mono text-destructive">{error.message}</p>
                {error.stack && (
                  <pre className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}

            {showRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

/**
 * Higher-order component to wrap any component with an error boundary
 *
 * @example
 * ```tsx
 * const SafeDashboard = withErrorBoundary(Dashboard, {
 *   componentName: "Dashboard",
 *   onError: (error) => console.error("Dashboard error:", error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary
      componentName={errorBoundaryProps?.componentName || displayName}
      {...errorBoundaryProps}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Minimal error fallback for inline use
 */
export function MinimalErrorFallback({
  onRetry,
  message = "Failed to load",
}: {
  onRetry?: () => void;
  message?: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <span className="text-destructive">{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="ml-auto h-7 px-2 text-xs"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

export default ErrorBoundary;
