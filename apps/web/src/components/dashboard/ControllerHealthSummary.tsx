"use client";

import React from "react";
import { Cpu, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getControllerHealthStats,
  formatHealthStats,
  ControllerStatusIndicator,
} from "@/components/controllers/ControllerStatusIndicator";
import type { Controller } from "@/types";

/**
 * Props for ControllerHealthSummary component
 */
export interface ControllerHealthSummaryProps {
  /** Array of controllers to display health for */
  controllers: Controller[];
  /** Optional className for styling */
  className?: string;
  /** Whether to show the full list or just summary */
  compact?: boolean;
}

/**
 * ControllerHealthSummary Component
 *
 * Displays an aggregate view of controller connection health.
 * Shows total online/offline count and individual controller status indicators.
 *
 * Features:
 * - Aggregate statistics (e.g., "3/5 controllers online")
 * - Individual status indicators for each controller
 * - Click to navigate to controllers page
 * - Compact mode for minimal space usage
 *
 * @example
 * ```tsx
 * <ControllerHealthSummary
 *   controllers={controllers}
 *   compact={false}
 * />
 * ```
 */
export function ControllerHealthSummary({
  controllers,
  className,
  compact = false,
}: ControllerHealthSummaryProps): JSX.Element | null {
  const router = useRouter();
  const stats = getControllerHealthStats(controllers);

  // Don't render if no controllers
  if (controllers.length === 0) {
    return null;
  }

  const handleNavigateToControllers = () => {
    router.push("/controllers");
  };

  // Compact mode - just show the summary with a single click target
  if (compact) {
    return (
      <button
        onClick={handleNavigateToControllers}
        className={cn(
          "flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left w-full",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Controllers</p>
            <p className="text-sm font-medium">{formatHealthStats(stats)}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    );
  }

  // Full mode - show individual controller status
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Controllers</h3>
            <p className="text-sm text-muted-foreground">
              {formatHealthStats(stats)}
            </p>
          </div>
        </div>
        <button
          onClick={handleNavigateToControllers}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.online}
          </p>
          <p className="text-xs text-green-700 dark:text-green-300">Online</p>
        </div>
        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.stale}
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">Stale</p>
        </div>
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats.offline}
          </p>
          <p className="text-xs text-red-700 dark:text-red-300">Offline</p>
        </div>
      </div>

      {/* Individual controller status */}
      {controllers.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">
            Individual Status
          </p>
          <div className="space-y-2">
            {controllers.slice(0, 5).map((controller) => (
              <div
                key={controller.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ControllerStatusIndicator
                    controller={controller}
                    size="sm"
                  />
                  <span className="text-sm truncate">{controller.name}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {controller.brand.replace("_", " ")}
                </span>
              </div>
            ))}
            {controllers.length > 5 && (
              <button
                onClick={handleNavigateToControllers}
                className="w-full text-center text-xs text-primary hover:underline py-2"
              >
                +{controllers.length - 5} more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
