/**
 * ErrorGuidance Component
 *
 * Displays user-friendly error messages with troubleshooting steps.
 * Helps users understand what went wrong and how to fix it.
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  KeyRound,
  WifiOff,
  PowerOff,
  SearchX,
  Clock,
  ServerCrash,
  Settings,
  Timer,
  HelpCircle,
  LogIn,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  type ErrorGuidance as ErrorGuidanceType,
  type ErrorCategory,
  getErrorGuidance,
  getErrorColor,
  type ControllerBrand,
} from "@/lib/error-guidance";

// ============================================
// Icon Mapping
// ============================================

const CATEGORY_ICONS: Record<ErrorCategory, React.ElementType> = {
  auth: LogIn,
  credentials: KeyRound,
  network: WifiOff,
  offline: PowerOff,
  not_found: SearchX,
  rate_limit: Clock,
  validation: AlertCircle,
  server: ServerCrash,
  configuration: Settings,
  timeout: Timer,
  unknown: HelpCircle,
};

// ============================================
// Props
// ============================================

interface ErrorGuidanceProps {
  /** The error to display (string, Error object, or API response) */
  error: string | Error | { error?: string; message?: string; status?: number };
  /** Controller brand for brand-specific guidance */
  brand?: ControllerBrand;
  /** Context for more specific guidance */
  context?: "connection" | "sensors" | "discovery" | "general";
  /** HTTP status code if known */
  statusCode?: number;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when action button is clicked */
  onAction?: (action: string) => void;
  /** Whether to show expanded troubleshooting steps by default */
  defaultExpanded?: boolean;
  /** Custom className */
  className?: string;
  /** Compact mode - shows less detail */
  compact?: boolean;
}

// ============================================
// Component
// ============================================

export function ErrorGuidance({
  error,
  brand,
  context = "general",
  statusCode,
  onRetry,
  onAction,
  defaultExpanded = false,
  className,
  compact = false,
}: ErrorGuidanceProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  // Get error guidance
  const guidance = React.useMemo(
    () => getErrorGuidance(error, { brand, context, statusCode }),
    [error, brand, context, statusCode]
  );

  // Get colors and icon
  const colors = getErrorColor(guidance.category);
  const Icon = CATEGORY_ICONS[guidance.category];

  // Handle action button click
  const handleAction = () => {
    if (guidance.primaryAction) {
      if (guidance.primaryAction.action === "retry" && onRetry) {
        onRetry();
      } else if (onAction) {
        onAction(guidance.primaryAction.action);
      }
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border",
          colors.bg,
          colors.border,
          className
        )}
      >
        <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", colors.icon)} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", colors.text)}>
            {guidance.title}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {guidance.steps[0]}
          </p>
        </div>
        {guidance.retryable && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        colors.bg,
        colors.border,
        className
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              colors.bg,
              "border",
              colors.border
            )}
          >
            <Icon className={cn("w-5 h-5", colors.icon)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold", colors.text)}>
              {guidance.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {guidance.message}
            </p>
          </div>
        </div>

        {/* Quick tip - first troubleshooting step */}
        <div className="mt-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">{guidance.steps[0]}</p>
        </div>
      </div>

      {/* Expandable troubleshooting steps */}
      {guidance.steps.length > 1 && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-full px-4 py-2 flex items-center justify-between",
              "text-sm font-medium border-t",
              colors.border,
              "hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            )}
          >
            <span className={colors.text}>
              {isExpanded ? "Hide" : "Show"} troubleshooting steps
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isExpanded && (
            <div className={cn("px-4 pb-4 border-t", colors.border)}>
              <ul className="mt-3 space-y-2">
                {guidance.steps.slice(1).map((step, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="font-medium text-muted-foreground/70 mt-0.5">
                      {index + 2}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>

              {/* Help links */}
              {(guidance.helpUrl || guidance.supportInfo) && (
                <div className="mt-4 pt-3 border-t border-dashed flex flex-wrap gap-2">
                  {guidance.helpUrl && (
                    <a
                      href={guidance.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Get more help
                    </a>
                  )}
                  {guidance.supportInfo && (
                    <span className="text-sm text-muted-foreground">
                      Contact: {guidance.supportInfo}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Action buttons */}
      {(guidance.primaryAction || guidance.retryable) && (
        <div
          className={cn(
            "px-4 py-3 flex items-center justify-end gap-2 border-t bg-black/5 dark:bg-white/5",
            colors.border
          )}
        >
          {guidance.retryAfter && (
            <span className="text-xs text-muted-foreground mr-auto">
              {guidance.retryable
                ? `Wait ${guidance.retryAfter}s before retrying`
                : ""}
            </span>
          )}
          {guidance.primaryAction && (
            <Button
              variant={guidance.retryable ? "default" : "outline"}
              size="sm"
              onClick={handleAction}
            >
              {guidance.primaryAction.action === "retry" && (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {guidance.primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Simple Error Alert (for inline use)
// ============================================

interface ErrorAlertProps {
  error: string | Error | { error?: string; message?: string };
  className?: string;
  onDismiss?: () => void;
}

export function ErrorAlert({ error, className, onDismiss }: ErrorAlertProps) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : error.error || error.message || "An error occurred";

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg",
        "bg-destructive/10 border border-destructive/20",
        className
      )}
    >
      <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
      <p className="text-sm text-destructive flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-destructive/70 hover:text-destructive"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================
// Connection Status with Error
// ============================================

interface ConnectionStatusProps {
  status: "online" | "offline" | "error" | "connecting";
  error?: string | Error | { error?: string; message?: string };
  lastSeen?: Date | string;
  brand?: ControllerBrand;
  onRetry?: () => void;
  className?: string;
}

export function ConnectionStatus({
  status,
  error,
  lastSeen,
  brand,
  onRetry,
  className,
}: ConnectionStatusProps) {
  const lastSeenDate = lastSeen
    ? typeof lastSeen === "string"
      ? new Date(lastSeen)
      : lastSeen
    : null;

  const lastSeenText = lastSeenDate
    ? `Last seen: ${lastSeenDate.toLocaleString()}`
    : undefined;

  if (status === "online") {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-600 dark:text-green-400">Online</span>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
        <span className="text-muted-foreground">Connecting...</span>
      </div>
    );
  }

  if (status === "offline" || status === "error") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-muted-foreground">Offline</span>
          {lastSeenText && (
            <span className="text-xs text-muted-foreground/70">
              ({lastSeenText})
            </span>
          )}
        </div>
        {error && (
          <ErrorGuidance
            error={error}
            brand={brand}
            context="connection"
            onRetry={onRetry}
            compact
          />
        )}
      </div>
    );
  }

  return null;
}

export default ErrorGuidance;
