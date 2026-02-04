"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ComparisonOperator } from "./types";

interface HysteresisVizProps {
  operator?: ComparisonOperator;
  threshold: number;
  resetThreshold?: number;
  unit?: string;
  size?: "compact" | "normal";
  className?: string;
}

export function HysteresisViz({
  operator,
  threshold,
  resetThreshold,
  unit = "",
  size = "compact",
  className,
}: HysteresisVizProps) {
  if (resetThreshold === undefined) return null;

  const isAbove = operator === ">" || operator === ">=";
  const isBelow = operator === "<" || operator === "<=";

  if (!isAbove && !isBelow) return null;

  const min = Math.min(threshold, resetThreshold);
  const max = Math.max(threshold, resetThreshold);
  const range = max - min;
  const padding = range * 0.3 || 1;
  const vizMin = min - padding;
  const vizMax = max + padding;
  const vizRange = vizMax - vizMin;

  const thresholdPos = ((threshold - vizMin) / vizRange) * 100;
  const resetPos = ((resetThreshold - vizMin) / vizRange) * 100;

  const isCompact = size === "compact";

  // Zone positions depend on operator direction
  const zones = isAbove
    ? {
        reset: { left: 0, width: resetPos },
        deadband: { left: resetPos, width: thresholdPos - resetPos },
        trigger: { left: thresholdPos, width: 100 - thresholdPos },
      }
    : {
        trigger: { left: 0, width: thresholdPos },
        deadband: { left: thresholdPos, width: resetPos - thresholdPos },
        reset: { left: resetPos, width: 100 - resetPos },
      };

  return (
    <div className={cn("space-y-1", className)}>
      <div className={cn("relative w-full rounded-sm overflow-hidden", isCompact ? "h-6" : "h-10")}>
        {/* Reset zone (green) */}
        <div
          className="absolute top-0 bottom-0 bg-green-500/20 dark:bg-green-500/30"
          style={{ left: `${zones.reset.left}%`, width: `${zones.reset.width}%` }}
        />
        {/* Deadband zone (amber) */}
        <div
          className="absolute top-0 bottom-0 bg-amber-500/25 dark:bg-amber-500/30"
          style={{ left: `${zones.deadband.left}%`, width: `${zones.deadband.width}%` }}
        />
        {/* Trigger zone (red) */}
        <div
          className="absolute top-0 bottom-0 bg-red-500/20 dark:bg-red-500/30"
          style={{ left: `${zones.trigger.left}%`, width: `${zones.trigger.width}%` }}
        />
        {/* Threshold marker */}
        <div
          className={cn("absolute top-0 bottom-0 w-0.5 bg-red-600 dark:bg-red-400")}
          style={{ left: `${thresholdPos}%` }}
        />
        {/* Reset marker */}
        <div
          className={cn("absolute top-0 bottom-0 w-0.5 bg-green-600 dark:bg-green-400")}
          style={{ left: `${resetPos}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-400" />
          <span className={cn("text-muted-foreground", isCompact ? "text-[9px]" : "text-xs")}>
            {threshold}{unit}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-400" />
          <span className={cn("text-muted-foreground", isCompact ? "text-[9px]" : "text-xs")}>
            {resetThreshold}{unit}
          </span>
        </div>
      </div>

      {/* Legend for normal size */}
      {!isCompact && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
          <div className="flex items-center gap-1">
            <div className="h-2 w-3 rounded-sm bg-red-500/20 dark:bg-red-500/30 border border-red-500/40" />
            <span>Trigger</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-3 rounded-sm bg-amber-500/25 dark:bg-amber-500/30 border border-amber-500/40" />
            <span>Deadband</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-3 rounded-sm bg-green-500/20 dark:bg-green-500/30 border border-green-500/40" />
            <span>Reset</span>
          </div>
        </div>
      )}
    </div>
  );
}
