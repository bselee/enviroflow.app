"use client";

import React, { useMemo } from "react";
import { Circle, WifiOff, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Controller, ControllerStatus as ControllerStatusType } from "@/types";

/**
 * Connection health status derived from controller data
 */
export type ConnectionHealth = "online" | "stale" | "offline";

/**
 * Props for ControllerStatusIndicator component
 */
export interface ControllerStatusIndicatorProps {
  /** Controller object with status and last_seen timestamp */
  controller: Pick<Controller, "status" | "last_seen" | "name">;
  /** Size variant for the status indicator */
  size?: "sm" | "md" | "lg";
  /** Whether to show the status label alongside the dot */
  showLabel?: boolean;
  /** Whether to show the icon instead of just a dot */
  showIcon?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Callback when the status indicator is clicked */
  onClick?: () => void;
}

/**
 * Calculate connection health based on controller status and last seen time.
 *
 * Logic:
 * - offline: Controller status is explicitly offline or error
 * - stale: Controller is online but hasn't been seen in >1 hour
 * - online: Controller is online and was seen recently
 */
export function getConnectionHealth(
  status: ControllerStatusType,
  lastSeen: string | null
): ConnectionHealth {
  // Explicitly offline or error status
  if (status === "offline" || status === "error") {
    return "offline";
  }

  // No last_seen timestamp - treat as offline
  if (!lastSeen) {
    return "offline";
  }

  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const minutesSinceLastSeen = (now.getTime() - lastSeenDate.getTime()) / 1000 / 60;

  // Stale if >60 minutes since last seen
  if (minutesSinceLastSeen > 60) {
    return "stale";
  }

  return "online";
}

/**
 * Format the time since last seen for tooltip display.
 * Examples: "5 minutes ago", "2 hours ago", "offline for 3 days"
 */
export function formatLastSeen(
  health: ConnectionHealth,
  lastSeen: string | null
): string {
  if (!lastSeen) {
    return "Never seen online";
  }

  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const prefix = health === "offline" ? "Offline for" : "Last seen";

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) {
    return `${prefix} ${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  }
  if (diffHours < 24) {
    return `${prefix} ${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  }
  return `${prefix} ${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

/**
 * Get visual properties (color, icon) for a given health status
 */
function getHealthStyles(health: ConnectionHealth) {
  switch (health) {
    case "online":
      return {
        dotColor: "bg-green-500",
        ringColor: "ring-green-500/20",
        textColor: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/30",
        Icon: Circle,
        label: "Online",
      };
    case "stale":
      return {
        dotColor: "bg-yellow-500",
        ringColor: "ring-yellow-500/20",
        textColor: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
        Icon: AlertTriangle,
        label: "Stale",
      };
    case "offline":
      return {
        dotColor: "bg-red-500",
        ringColor: "ring-red-500/20",
        textColor: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        Icon: WifiOff,
        label: "Offline",
      };
  }
}

/**
 * Size configuration for different variants
 */
const sizeConfig = {
  sm: {
    dot: "w-2 h-2",
    icon: "w-3 h-3",
    text: "text-xs",
    gap: "gap-1.5",
  },
  md: {
    dot: "w-3 h-3",
    icon: "w-4 h-4",
    text: "text-sm",
    gap: "gap-2",
  },
  lg: {
    dot: "w-4 h-4",
    icon: "w-5 h-5",
    text: "text-base",
    gap: "gap-2.5",
  },
};

/**
 * ControllerStatusIndicator Component
 *
 * Displays a visual indicator of controller connection health with tooltip.
 * Shows green (online), yellow (stale >1h), or red (offline) status.
 *
 * Features:
 * - Real-time status calculation based on last_seen timestamp
 * - Tooltip with human-readable last seen time
 * - Multiple size variants and display options
 * - Clickable to open diagnostics (optional)
 * - Accessible with proper ARIA labels
 *
 * @example
 * ```tsx
 * <ControllerStatusIndicator
 *   controller={controller}
 *   size="md"
 *   showLabel={true}
 *   onClick={() => openDiagnostics(controller.id)}
 * />
 * ```
 */
export function ControllerStatusIndicator({
  controller,
  size = "md",
  showLabel = false,
  showIcon = false,
  className,
  onClick,
}: ControllerStatusIndicatorProps): JSX.Element {
  const health = useMemo(
    () => getConnectionHealth(controller.status, controller.last_seen),
    [controller.status, controller.last_seen]
  );

  const styles = getHealthStyles(health);
  const sizes = sizeConfig[size];
  const lastSeenText = formatLastSeen(health, controller.last_seen);

  const StatusContent = (
    <div
      className={cn(
        "inline-flex items-center",
        sizes.gap,
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={`${controller.name} status: ${health}`}
    >
      {showIcon ? (
        <styles.Icon className={cn(sizes.icon, styles.textColor)} />
      ) : (
        <div className="relative">
          <div
            className={cn(
              "rounded-full",
              sizes.dot,
              styles.dotColor,
              "shadow-sm animate-pulse-subtle"
            )}
          />
          {health === "online" && (
            <div
              className={cn(
                "absolute inset-0 rounded-full ring-2",
                styles.ringColor,
                "animate-ping"
              )}
              style={{ animationDuration: "2s" }}
            />
          )}
        </div>
      )}
      {showLabel && (
        <span className={cn("font-medium", styles.textColor, sizes.text)}>
          {styles.label}
        </span>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{StatusContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">
              {controller.name}: {styles.label}
            </p>
            <p className="text-xs text-muted-foreground">{lastSeenText}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Calculate aggregate controller health statistics for dashboard summary.
 *
 * @param controllers - Array of controllers to analyze
 * @returns Object with counts of online, stale, and offline controllers
 */
export function getControllerHealthStats(controllers: Controller[]) {
  const stats = {
    online: 0,
    stale: 0,
    offline: 0,
    total: controllers.length,
  };

  controllers.forEach((controller) => {
    const health = getConnectionHealth(controller.status, controller.last_seen);
    stats[health]++;
  });

  return stats;
}

/**
 * Format controller health stats for display.
 * Example: "3/5 controllers online"
 */
export function formatHealthStats(stats: ReturnType<typeof getControllerHealthStats>): string {
  if (stats.total === 0) {
    return "No controllers";
  }

  const onlineCount = stats.online;
  const totalCount = stats.total;

  return `${onlineCount}/${totalCount} controller${totalCount !== 1 ? "s" : ""} online`;
}
