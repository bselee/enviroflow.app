"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Wifi, WifiOff, RefreshCw, Clock, AlertCircle } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/use-sensor-readings";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the RealTimeIndicator component.
 */
export interface RealTimeIndicatorProps {
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Timestamp of last data update (ISO string or Date) */
  lastUpdate: string | Date | null;
  /** Whether the data is considered stale */
  isStale?: boolean;
  /** Callback for manual refresh */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Display variant */
  variant?: "default" | "compact" | "detailed";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status configuration for visual display.
 */
interface StatusConfig {
  label: string;
  description: string;
  icon: typeof Wifi;
  colorClass: string;
  bgClass: string;
  pulseClass?: string;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_CONFIG: Record<ConnectionStatus, StatusConfig> = {
  connecting: {
    label: "Connecting",
    description: "Establishing real-time connection...",
    icon: Wifi,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    pulseClass: "animate-pulse",
  },
  connected: {
    label: "Live",
    description: "Real-time updates active",
    icon: Wifi,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
  },
  reconnecting: {
    label: "Reconnecting",
    description: "Connection lost, attempting to reconnect...",
    icon: RefreshCw,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    pulseClass: "animate-spin",
  },
  polling: {
    label: "Polling",
    description: "Using periodic refresh (WebSocket unavailable)",
    icon: Clock,
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
  },
  error: {
    label: "Offline",
    description: "Connection failed. Click to retry.",
    icon: WifiOff,
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formats a timestamp to relative time (e.g., "2 min ago").
 */
function formatRelativeTime(timestamp: string | Date | null): string {
  if (!timestamp) return "Never";

  const now = new Date();
  const then = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 5) {
    return "Just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return then.toLocaleDateString();
}

/**
 * Formats a timestamp to absolute time for tooltip.
 */
function formatAbsoluteTime(timestamp: string | Date | null): string {
  if (!timestamp) return "No data received";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Live indicator dot with optional pulse animation.
 */
function StatusDot({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  const isLive = status === "connected";

  return (
    <span className={cn("relative inline-flex", className)}>
      {/* Pulse ring for live status */}
      {isLive && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
            config.colorClass.replace("text-", "bg-")
          )}
        />
      )}
      {/* Core dot */}
      <span
        className={cn(
          "relative inline-flex rounded-full h-2 w-2",
          config.colorClass.replace("text-", "bg-")
        )}
      />
    </span>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * RealTimeIndicator - Shows connection status and last update time.
 *
 * Displays the current state of the real-time data connection and when data
 * was last received. Provides visual feedback for connection issues and
 * supports manual refresh.
 *
 * Features:
 * - Live connection indicator with pulse animation
 * - Relative time display (auto-updates)
 * - Connection status tooltip with details
 * - Manual refresh button
 * - Stale data warning
 * - Multiple display variants (default, compact, detailed)
 *
 * @example
 * ```tsx
 * const { connectionStatus, refetch } = useSensorReadings();
 *
 * <RealTimeIndicator
 *   connectionStatus={connectionStatus}
 *   lastUpdate={lastUpdateTime}
 *   onRefresh={refetch}
 *   isStale={isDataStale}
 * />
 * ```
 */
export function RealTimeIndicator({
  connectionStatus,
  lastUpdate,
  isStale = false,
  onRefresh,
  isRefreshing = false,
  variant = "default",
  className,
}: RealTimeIndicatorProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Auto-update relative time every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const config = STATUS_CONFIG[connectionStatus];
  const Icon = config.icon;
  const relativeTime = formatRelativeTime(lastUpdate);
  const absoluteTime = formatAbsoluteTime(lastUpdate);

  // Compact variant - just the dot and minimal info
  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 cursor-default",
                className
              )}
            >
              <StatusDot status={connectionStatus} />
              {isStale && (
                <AlertCircle className="w-3 h-3 text-amber-500" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="space-y-1">
              <div className="font-medium">{config.label}</div>
              <div className="text-xs text-muted-foreground">
                Last update: {relativeTime}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed variant - full information display
  if (variant === "detailed") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg border",
          isDark
            ? "bg-gray-800/50 border-gray-700"
            : "bg-white border-gray-200",
          className
        )}
      >
        {/* Status icon */}
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full",
            config.bgClass
          )}
        >
          <Icon className={cn("w-4 h-4", config.colorClass, config.pulseClass)} />
        </div>

        {/* Status info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {config.label}
            </span>
            {isStale && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-500">
                <AlertCircle className="w-3 h-3" />
                Stale
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {config.description}
          </div>
        </div>

        {/* Last update time */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-right">
                <div
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {relativeTime}
                </div>
                <div className="text-xs text-muted-foreground">Last update</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <span>{absoluteTime}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing || connectionStatus === "reconnecting"}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-700",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label="Refresh data"
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 text-muted-foreground",
                isRefreshing && "animate-spin"
              )}
            />
          </button>
        )}
      </div>
    );
  }

  // Default variant - balanced display
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full cursor-default",
              config.bgClass,
              className
            )}
          >
            {/* Status dot/icon */}
            {connectionStatus === "connected" ? (
              <StatusDot status={connectionStatus} />
            ) : (
              <Icon
                className={cn("w-3.5 h-3.5", config.colorClass, config.pulseClass)}
              />
            )}

            {/* Label */}
            <span className={cn("text-xs font-medium", config.colorClass)}>
              {config.label}
            </span>

            {/* Stale indicator */}
            {isStale && connectionStatus === "connected" && (
              <AlertCircle className="w-3 h-3 text-amber-500" />
            )}

            {/* Last update (if not connecting/reconnecting) */}
            {connectionStatus !== "connecting" &&
              connectionStatus !== "reconnecting" && (
                <span className="text-xs text-muted-foreground">
                  {relativeTime}
                </span>
              )}

            {/* Refresh button (inline) */}
            {onRefresh && connectionStatus === "error" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                disabled={isRefreshing}
                className="ml-1 p-0.5 rounded hover:bg-white/20 transition-colors"
                aria-label="Retry connection"
              >
                <RefreshCw
                  className={cn(
                    "w-3 h-3",
                    config.colorClass,
                    isRefreshing && "animate-spin"
                  )}
                />
              </button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4", config.colorClass)} />
              <span className="font-medium">{config.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {lastUpdate && (
              <p className="text-xs">
                <span className="text-muted-foreground">Last update:</span>{" "}
                {absoluteTime}
              </p>
            )}
            {isStale && (
              <p className="text-xs text-amber-500">
                Data is older than 5 minutes and may not reflect current conditions.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Export status config for external customization.
 */
export { STATUS_CONFIG as REALTIME_STATUS_CONFIG };
