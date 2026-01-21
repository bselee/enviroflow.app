"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Zap,
  Fan,
  Lightbulb,
  Flame,
  Snowflake,
  Droplets,
  Wind,
  PlugZap,
  Pipette,
  X,
  Power,
  Gauge,
  Thermometer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ActionNodeData,
  DeviceType,
  ActionVariant,
} from "../types";
import {
  DEVICE_TYPE_LABELS,
  ACTION_VARIANT_LABELS,
} from "../types";

/**
 * ActionNode - Device control node for workflows
 *
 * This node allows users to control devices connected to their controllers.
 * Configuration options:
 * - Select controller and device/port
 * - Select action type: Set Speed (0-100%), On/Off, Set Temperature
 * - Shows current device state when available
 *
 * Visual Design:
 * - Red/orange border to indicate "action" semantics
 * - Lightning bolt icon in header
 * - Has both input and output handles for chaining
 */

/** Icons for different device types */
const DEVICE_ICONS: Record<DeviceType, React.ComponentType<{ className?: string }>> = {
  fan: Fan,
  light: Lightbulb,
  heater: Flame,
  cooler: Snowflake,
  humidifier: Droplets,
  dehumidifier: Wind,
  outlet: PlugZap,
  pump: Pipette,
  valve: Pipette,
};

/** Icons for different action variants */
const ACTION_ICONS: Record<ActionVariant, React.ComponentType<{ className?: string }>> = {
  set_speed: Gauge,
  on_off: Power,
  set_level: Gauge,
  set_temperature: Thermometer,
};

interface ActionNodeProps {
  data: ActionNodeData;
  selected?: boolean;
  id: string;
}

export function ActionNode({ data, selected, id }: ActionNodeProps) {
  const config = data.config;
  const DeviceIcon = config.deviceType ? DEVICE_ICONS[config.deviceType] : Zap;
  const ActionIcon = config.action ? ACTION_ICONS[config.action] : Power;

  /**
   * Formats the action configuration for display in the node body.
   * Shows relevant details based on action type.
   */
  const getConfigSummary = (): string => {
    if (!config.action) {
      return "Not configured";
    }

    switch (config.action) {
      case "set_speed":
        if (config.value !== undefined) {
          return `Set speed to ${config.value}%`;
        }
        return "Set speed (not set)";

      case "set_level":
        if (config.value !== undefined) {
          return `Set level to ${config.value}%`;
        }
        return "Set level (not set)";

      case "on_off":
        return config.turnOn ? "Turn ON" : "Turn OFF";

      case "set_temperature":
        if (config.temperature !== undefined) {
          return `Set to ${config.temperature}°F`;
        }
        return "Set temperature (not set)";

      default:
        return "Unknown action";
    }
  };

  /**
   * Renders the current device state badge if available.
   */
  const renderCurrentState = (): React.ReactNode => {
    if (!data.currentState) {
      return null;
    }

    const { isOn, level } = data.currentState;

    return (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Current:
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            isOn
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isOn ? "ON" : "OFF"}
          {level !== undefined && ` (${level}%)`}
        </span>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "min-w-[200px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-orange-500 dark:border-orange-400",
        selected && "ring-2 ring-orange-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-orange-500 !bg-background",
          "dark:!border-orange-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-orange-500/10 px-3 py-2 dark:bg-orange-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white dark:bg-orange-400">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Action"}
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
        {/* Controller & Device Info */}
        {config.controllerName && (
          <div className="mb-2 text-xs text-muted-foreground">
            {config.controllerName}
            {config.port !== undefined && ` - Port ${config.port}`}
          </div>
        )}

        {/* Device Type & Action Badge */}
        <div className="mb-2 flex items-center gap-2">
          <DeviceIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {config.deviceType ? DEVICE_TYPE_LABELS[config.deviceType] : "Select Device"}
          </span>
          {config.action && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {ACTION_VARIANT_LABELS[config.action]}
              </span>
            </>
          )}
        </div>

        {/* Configuration Summary */}
        <p className="text-xs text-muted-foreground">{getConfigSummary()}</p>

        {/* Current State */}
        {renderCurrentState()}
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-orange-500 !bg-background",
          "dark:!border-orange-400"
        )}
      />
    </div>
  );
}

ActionNode.displayName = "ActionNode";

export default ActionNode;
