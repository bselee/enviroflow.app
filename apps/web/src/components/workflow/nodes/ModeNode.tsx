"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModeNodeData, DeviceModeType } from "../types";
import { MODE_LABELS } from "../types";

/**
 * ModeNode - Device mode programming node for workflows
 *
 * This node allows users to configure device operation modes for AC Infinity
 * controllers. Supports advanced modes like Auto, VPD, Timer, Cycle, and Schedule.
 *
 * Features:
 * - Select controller and port
 * - Configure device mode (Off, On, Auto, VPD, Timer, Cycle, Schedule)
 * - Mode-specific configuration (triggers, levels, timing)
 * - Priority setting for multi-port workflows
 *
 * Visual Design:
 * - Cyan border to indicate "mode programming" semantics
 * - Cog/Settings icon in header
 * - Has both input and output handles for chaining
 * - Shows mode-specific configuration summary
 */

interface ModeNodeProps {
  data: ModeNodeData;
  selected?: boolean;
  id: string;
}

export function ModeNode({ data, selected, id }: ModeNodeProps) {
  const config = data.config;

  /**
   * Formats the mode configuration for display in the node body.
   * Shows relevant details based on mode type.
   */
  const getConfigSummary = (): string => {
    if (!config.mode) {
      return "Not configured";
    }

    switch (config.mode) {
      case "off":
        return "Device will be turned off";

      case "on":
        return "Device will be turned on";

      case "auto": {
        if (!config.autoConfig) {
          return "Auto mode (not configured)";
        }
        const ac = config.autoConfig;
        const parts: string[] = [];

        if (ac.tempHighEnabled || ac.tempLowEnabled) {
          const tempRange = [];
          if (ac.tempLowEnabled) tempRange.push(`${ac.tempLowTrigger}°F`);
          if (ac.tempHighEnabled) tempRange.push(`${ac.tempHighTrigger}°F`);
          parts.push(`Temp: ${tempRange.join("-")}`);
        }

        if (ac.humidityHighEnabled || ac.humidityLowEnabled) {
          const humRange = [];
          if (ac.humidityLowEnabled) humRange.push(`${ac.humidityLowTrigger}%`);
          if (ac.humidityHighEnabled) humRange.push(`${ac.humidityHighEnabled}%`);
          parts.push(`Humidity: ${humRange.join("-")}`);
        }

        parts.push(`Levels: ${ac.levelLow}-${ac.levelHigh}`);
        if (ac.transition) parts.push("Transition: ON");

        return parts.join(" | ");
      }

      case "vpd": {
        if (!config.vpdConfig) {
          return "VPD mode (not configured)";
        }
        const vc = config.vpdConfig;
        const parts: string[] = [];

        const vpdRange = [];
        if (vc.vpdLowEnabled) vpdRange.push(`${vc.vpdLowTrigger}`);
        if (vc.vpdHighEnabled) vpdRange.push(`${vc.vpdHighTrigger}`);
        parts.push(`VPD: ${vpdRange.join("-")} kPa`);

        parts.push(`Levels: ${vc.levelLow}-${vc.levelHigh}`);
        if (vc.transition) parts.push("Transition: ON");

        return parts.join(" | ");
      }

      case "timer": {
        if (!config.timerConfig) {
          return "Timer mode (not configured)";
        }
        const tc = config.timerConfig;
        return `On: ${tc.durationOn}s | Off: ${tc.durationOff}s | Level: ${tc.level}`;
      }

      case "cycle": {
        if (!config.cycleConfig) {
          return "Cycle mode (not configured)";
        }
        const cc = config.cycleConfig;
        return `On: ${cc.durationOn}s | Off: ${cc.durationOff}s | Level: ${cc.level}`;
      }

      case "schedule": {
        if (!config.scheduleConfig || !config.scheduleConfig.schedules.length) {
          return "Schedule mode (not configured)";
        }
        const schedCount = config.scheduleConfig.schedules.length;
        return `${schedCount} schedule${schedCount !== 1 ? "s" : ""} configured`;
      }

      default:
        return "Unknown mode";
    }
  };

  return (
    <div
      className={cn(
        "group min-w-[280px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-cyan-500 dark:border-cyan-400",
        selected && "ring-2 ring-cyan-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-cyan-500 !bg-background",
          "dark:!border-cyan-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-cyan-500/10 px-3 py-2 dark:bg-cyan-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-white dark:bg-cyan-400">
          <Settings className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Program Mode"}
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
        {/* Controller & Port Info */}
        {config.controllerName && (
          <div className="mb-2 text-xs text-muted-foreground">
            {config.controllerName}
            {config.port !== undefined && ` - Port ${config.port}`}
            {config.portName && ` (${config.portName})`}
          </div>
        )}

        {/* Mode Type Badge */}
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-400">
            {config.mode ? MODE_LABELS[config.mode].toUpperCase() : "NO MODE"} MODE
          </span>
          {config.priority !== undefined && (
            <span className="text-xs text-muted-foreground">
              Priority: {config.priority}
            </span>
          )}
        </div>

        {/* Configuration Summary */}
        <div className="rounded bg-muted/50 px-2 py-2">
          <p className="text-xs leading-relaxed text-foreground">
            {getConfigSummary()}
          </p>
        </div>
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-cyan-500 !bg-background",
          "dark:!border-cyan-400"
        )}
      />
    </div>
  );
}

ModeNode.displayName = "ModeNode";

export default ModeNode;
