"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Sun, Sunrise, Sunset, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DimmerNodeData } from "../types";
import { DIMMER_CURVE_LABELS } from "../types";

/**
 * DimmerNode - Light schedule node with sunrise/sunset simulation
 *
 * This node configures light schedules for grow lights with optional
 * sunrise/sunset ramp periods.
 *
 * Configuration:
 * - Controller and port selection
 * - ON time (when lights reach max) / OFF time (when lights start dimming)
 * - Min/Max levels (0-100%)
 * - Sunrise minutes (ramp up before ON time)
 * - Sunset minutes (ramp down after OFF time)
 * - Transition curve
 *
 * Timeline example (onTime=06:00, offTime=22:00, sunrise=30min, sunset=30min):
 * - 05:30 - Sunrise begins (ramp from min)
 * - 06:00 - Fully ON (max level)
 * - 22:00 - Sunset begins (ramp from max)
 * - 22:30 - Fully OFF (min level)
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
 */
function calculateCurrentLevel(
  onTime: string | undefined,
  offTime: string | undefined,
  minLevel: number | undefined,
  maxLevel: number | undefined,
  sunriseMinutes: number = 0,
  sunsetMinutes: number = 0
): number | null {
  if (!onTime || !offTime || minLevel === undefined || maxLevel === undefined) {
    return null;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [onHours, onMins] = onTime.split(":").map(Number);
  const [offHours, offMins] = offTime.split(":").map(Number);

  const onTimeMinutes = onHours * 60 + onMins;
  const offTimeMinutes = offHours * 60 + offMins;
  const sunriseStart = onTimeMinutes - sunriseMinutes;
  const sunsetEnd = offTimeMinutes + sunsetMinutes;

  // Before sunrise: min level
  if (currentMinutes < sunriseStart) {
    return minLevel;
  }

  // During sunrise ramp
  if (currentMinutes < onTimeMinutes && sunriseMinutes > 0) {
    const progress = (currentMinutes - sunriseStart) / sunriseMinutes;
    return Math.round(minLevel + (maxLevel - minLevel) * progress);
  }

  // During day (fully on)
  if (currentMinutes >= onTimeMinutes && currentMinutes < offTimeMinutes) {
    return maxLevel;
  }

  // During sunset ramp
  if (currentMinutes < sunsetEnd && sunsetMinutes > 0) {
    const progress = (currentMinutes - offTimeMinutes) / sunsetMinutes;
    return Math.round(maxLevel - (maxLevel - minLevel) * progress);
  }

  // After sunset: min level
  return minLevel;
}

export function DimmerNode({ data, selected, id }: DimmerNodeProps) {
  const config = data.config;

  // Calculate current level for display (updates on render)
  const calculatedLevel = React.useMemo(() => {
    return calculateCurrentLevel(
      config.onTime,
      config.offTime,
      config.minLevel,
      config.maxLevel,
      config.sunriseMinutes,
      config.sunsetMinutes
    );
  }, [config.onTime, config.offTime, config.minLevel, config.maxLevel, config.sunriseMinutes, config.sunsetMinutes]);

  // Use the runtime-provided level if available, otherwise use calculated
  const displayLevel = data.currentLevel ?? calculatedLevel;

  /**
   * Formats the schedule for display in the node body.
   */
  const getScheduleSummary = (): React.ReactNode => {
    if (!config.onTime || !config.offTime) {
      return "Not configured";
    }

    return (
      <div className="space-y-1.5">
        {/* ON/OFF Schedule */}
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-[#ffd740]" />
          <span className="font-mono">{config.onTime}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono">{config.offTime}</span>
        </div>

        {/* Sunrise/Sunset ramps if configured */}
        {(config.sunriseMinutes || config.sunsetMinutes) && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {config.sunriseMinutes ? (
              <span className="flex items-center gap-1">
                <Sunrise className="h-3 w-3 text-amber-500" />
                {config.sunriseMinutes}m
              </span>
            ) : null}
            {config.sunsetMinutes ? (
              <span className="flex items-center gap-1">
                <Sunset className="h-3 w-3 text-orange-500" />
                {config.sunsetMinutes}m
              </span>
            ) : null}
          </div>
        )}
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
    return `${config.minLevel}% → ${config.maxLevel}%`;
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
        "group min-w-[220px] rounded-lg border-2 bg-card shadow-md transition-all",
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
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
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
