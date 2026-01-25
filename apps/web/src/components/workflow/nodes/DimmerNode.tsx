"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Sun, Sunrise, Sunset, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DimmerNodeData } from "../types";
import { DIMMER_CURVE_LABELS } from "../types";

/**
 * DimmerNode - Light dimming schedule node for workflows
 *
 * This node configures sunrise/sunset light dimming schedules for grow lights.
 * Configuration options:
 * - Controller and port selection
 * - Sunrise time (HH:MM)
 * - Sunset time (HH:MM)
 * - Min level (0-100%)
 * - Max level (0-100%)
 * - Transition curve (linear, sigmoid, exponential, logarithmic)
 *
 * Visual Design:
 * - Yellow border to indicate "light/dimmer" semantics
 * - Sun icon in header
 * - Shows current calculated level when available
 */

interface DimmerNodeProps {
  data: DimmerNodeData;
  selected?: boolean;
  id: string;
}

/**
 * Calculates the current light level based on the schedule.
 * This is a simplified calculation for display purposes.
 * The actual calculation happens in the workflow executor.
 *
 * @param sunriseTime - Sunrise time in HH:MM format
 * @param sunsetTime - Sunset time in HH:MM format
 * @param minLevel - Minimum light level (0-100)
 * @param maxLevel - Maximum light level (0-100)
 * @returns Current calculated level percentage
 */
function calculateCurrentLevel(
  sunriseTime: string | undefined,
  sunsetTime: string | undefined,
  minLevel: number | undefined,
  maxLevel: number | undefined
): number | null {
  if (!sunriseTime || !sunsetTime || minLevel === undefined || maxLevel === undefined) {
    return null;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [sunriseHours, sunriseMinutes] = sunriseTime.split(":").map(Number);
  const [sunsetHours, sunsetMinutes] = sunsetTime.split(":").map(Number);

  const sunriseTime_ = sunriseHours * 60 + sunriseMinutes;
  const sunsetTime_ = sunsetHours * 60 + sunsetMinutes;

  // Before sunrise or after sunset: use min level
  if (currentMinutes < sunriseTime_ || currentMinutes >= sunsetTime_) {
    return minLevel;
  }

  // During the day: interpolate between sunrise and sunset
  // Simplified linear interpolation for display
  const dayDuration = sunsetTime_ - sunriseTime_;
  const midDay = sunriseTime_ + dayDuration / 2;

  if (currentMinutes < midDay) {
    // Morning: ramping up
    const progress = (currentMinutes - sunriseTime_) / (dayDuration / 2);
    return Math.round(minLevel + (maxLevel - minLevel) * progress);
  } else {
    // Afternoon: ramping down
    const progress = (currentMinutes - midDay) / (dayDuration / 2);
    return Math.round(maxLevel - (maxLevel - minLevel) * progress);
  }
}

export function DimmerNode({ data, selected, id }: DimmerNodeProps) {
  const config = data.config;

  // Calculate current level for display (updates on render)
  const calculatedLevel = React.useMemo(() => {
    return calculateCurrentLevel(
      config.sunriseTime,
      config.sunsetTime,
      config.minLevel,
      config.maxLevel
    );
  }, [config.sunriseTime, config.sunsetTime, config.minLevel, config.maxLevel]);

  // Use the runtime-provided level if available, otherwise use calculated
  const displayLevel = data.currentLevel ?? calculatedLevel;

  /**
   * Formats the schedule for display in the node body.
   */
  const getScheduleSummary = (): React.ReactNode => {
    if (!config.sunriseTime || !config.sunsetTime) {
      return "Not configured";
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sunrise className="h-3.5 w-3.5 text-amber-500" />
          <span>{config.sunriseTime}</span>
          <span className="text-muted-foreground/50">-</span>
          <Sunset className="h-3.5 w-3.5 text-orange-500" />
          <span>{config.sunsetTime}</span>
        </div>
      </div>
    );
  };

  /**
   * Renders the level range display.
   */
  const getLevelRange = (): string => {
    if (config.minLevel === undefined || config.maxLevel === undefined) {
      return "Levels not set";
    }
    return `${config.minLevel}% - ${config.maxLevel}%`;
  };

  /**
   * Renders the current level indicator.
   */
  const renderCurrentLevel = (): React.ReactNode => {
    if (displayLevel === null) {
      return null;
    }

    // Calculate color intensity based on level
    const intensity = displayLevel / 100;
    const _bgOpacity = Math.round(10 + intensity * 20);

    return (
      <div className="mt-2 flex items-center justify-between rounded-md bg-yellow-500/10 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Sun
            className="h-4 w-4"
            style={{
              color: `hsl(45, ${80 + intensity * 20}%, ${40 + intensity * 15}%)`,
            }}
          />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Current Level
          </span>
        </div>
        <span
          className="text-sm font-semibold"
          style={{
            color: `hsl(45, 90%, ${35 + intensity * 15}%)`,
          }}
        >
          {displayLevel}%
        </span>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-yellow-500 dark:border-yellow-400",
        selected && "ring-2 ring-yellow-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-yellow-500 !bg-background",
          "dark:!border-yellow-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-yellow-500/10 px-3 py-2 dark:bg-yellow-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-white dark:bg-yellow-400">
          <Sun className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Dimmer Schedule"}
        </span>
        {/* Delete button visible on hover */}
        <button
          className="hidden h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:flex group-hover:opacity-100"
          aria-label="Delete node"
          data-delete-node={id}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Node Body */}
      <div className="px-3 py-2">
        {/* Controller Info */}
        {config.controllerName && (
          <div className="mb-2 text-xs text-muted-foreground">
            {config.controllerName}
            {config.port !== undefined && ` - Port ${config.port}`}
          </div>
        )}

        {/* Schedule Times */}
        <div className="mb-2 text-xs">{getScheduleSummary()}</div>

        {/* Level Range */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Range:</span>
          <span className="font-medium">{getLevelRange()}</span>
        </div>

        {/* Curve Type */}
        {config.curve && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Curve:</span>
            <span className="font-medium">{DIMMER_CURVE_LABELS[config.curve]}</span>
          </div>
        )}

        {/* Current Level */}
        {renderCurrentLevel()}
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-yellow-500 !bg-background",
          "dark:!border-yellow-400"
        )}
      />
    </div>
  );
}

DimmerNode.displayName = "DimmerNode";

export default DimmerNode;
