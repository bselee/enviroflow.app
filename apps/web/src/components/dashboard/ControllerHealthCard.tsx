"use client";

import React from "react";
import { Activity, TrendingDown, TrendingUp, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { getHealthIndicator, getHealthDescription } from "@/lib/health-scoring";
import type { Controller, HealthScore } from "@/types";

/**
 * Props for ControllerHealthCard component
 */
export interface ControllerHealthCardProps {
  /** Controller to display health for */
  controller: Controller;
  /** Health score data (if available) */
  healthScore?: HealthScore | null;
  /** Whether the data is loading */
  isLoading?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * ControllerHealthCard Component
 *
 * Displays health score and metrics for an individual controller.
 * Shows score badge, emoji indicator, and key metrics breakdown.
 *
 * Features:
 * - Health score (0-100) with color-coded indicator
 * - Emoji status: 🟢 (90+) 🟡 (70-89) 🔴 (<70)
 * - Metrics breakdown on hover/click
 * - Compact mode for dashboard cards
 * - Loading state support
 *
 * @example
 * ```tsx
 * <ControllerHealthCard
 *   controller={controller}
 *   healthScore={healthScore}
 *   onClick={() => router.push(`/controllers/${controller.id}`)}
 * />
 * ```
 */
export function ControllerHealthCard({
  controller,
  healthScore,
  isLoading = false,
  onClick,
  className,
  compact = false,
}: ControllerHealthCardProps): JSX.Element {
  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card p-4 space-y-3",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  // No health score available
  if (!healthScore) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-card p-4",
          onClick && "cursor-pointer hover:bg-accent/50 transition-colors",
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{controller.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">No data</span>
        </div>
      </div>
    );
  }

  const indicator = getHealthIndicator(healthScore.score);
  const description = getHealthDescription(indicator.level);

  // Compact mode - minimal display
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors",
                className
              )}
              onClick={onClick}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{indicator.emoji}</span>
                  <span className="text-sm font-medium truncate">
                    {controller.name}
                  </span>
                </div>
                <span className={cn("text-sm font-bold", indicator.color)}>
                  {healthScore.score}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">{description}</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>Uptime: {Math.round(healthScore.metrics.uptimePercent)}%</p>
              <p>
                Freshness:{" "}
                {healthScore.metrics.latestReadingAge
                  ? formatAge(healthScore.metrics.latestReadingAge)
                  : "N/A"}
              </p>
              <p>
                Errors: {healthScore.metrics.errorCount}/
                {healthScore.metrics.totalActions}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full mode - detailed display
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 space-y-4",
        onClick && "cursor-pointer hover:bg-accent/50 transition-colors",
        className
      )}
      onClick={onClick}
    >
      {/* Header with score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              indicator.bgColor
            )}
          >
            <Activity className={cn("w-5 h-5", indicator.color)} />
          </div>
          <div>
            <h3 className="font-semibold text-base">{controller.name}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{indicator.emoji}</span>
            <span className={cn("text-3xl font-bold", indicator.color)}>
              {healthScore.score}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Health Score</span>
        </div>
      </div>

      {/* Metrics breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {/* Uptime */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Uptime</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>
                    {healthScore.metrics.uptimeHours.toFixed(1)}h /{" "}
                    {healthScore.metrics.totalHours.toFixed(1)}h in last 24h
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-lg font-bold">
            {Math.round(healthScore.metrics.uptimePercent)}%
          </p>
        </div>

        {/* Freshness */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Freshness</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>
                    Latest reading:{" "}
                    {healthScore.metrics.latestReadingAge
                      ? formatAge(healthScore.metrics.latestReadingAge)
                      : "No data"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-lg font-bold">
            {Math.round(healthScore.metrics.freshnessScore)}
          </p>
        </div>

        {/* Error Rate */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Errors</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>
                    {healthScore.metrics.errorCount} errors in{" "}
                    {healthScore.metrics.totalActions} actions
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-lg font-bold">
            {healthScore.metrics.errorRate.toFixed(1)}%
          </p>
        </div>

        {/* Sync Lag */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Sync</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>
                    Avg sync lag:{" "}
                    {healthScore.metrics.avgSyncLag
                      ? formatLag(healthScore.metrics.avgSyncLag)
                      : "N/A"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-lg font-bold">
            {Math.round(healthScore.metrics.syncLagScore)}
          </p>
        </div>
      </div>

      {/* Timestamp */}
      <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
        <span>
          Last checked:{" "}
          {new Date(healthScore.calculatedAt).toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </span>
        <span className="capitalize">{controller.brand.replace("_", " ")}</span>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format age in milliseconds to human-readable string
 */
function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/**
 * Format lag in milliseconds to human-readable string
 */
function formatLag(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
