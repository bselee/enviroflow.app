"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
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
  AlertTriangle,
  HelpCircle,
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
import { useControllerCapabilities } from "@/hooks/use-controller-capabilities";

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

/** Base device icon mapping - includes fallback for unknowns */
const DEVICE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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

/**
 * Get icon for any device type, with fallback for unknowns
 */
function getDeviceIcon(deviceType?: string): React.ComponentType<{ className?: string }> {
  if (!deviceType) return HelpCircle;
  return DEVICE_ICON_MAP[deviceType] || PlugZap; // Default to PlugZap for unknown types
}

/**
 * Get human-readable label for any device type
 */
function getDeviceLabel(deviceType?: string): string {
  if (!deviceType) return "Unknown Device";

  // Check if we have a predefined label
  if (deviceType in DEVICE_TYPE_LABELS) {
    return DEVICE_TYPE_LABELS[deviceType as DeviceType];
  }

  // Generate label from device type string (e.g., "water_pump" -> "Water Pump")
  return deviceType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

  // Fetch capabilities to validate device availability
  const { capabilities } = useControllerCapabilities({
    controllerId: config.controllerId,
  });

  // Check if device is still available
  const deviceAvailable = React.useMemo(() => {
    if (!config.controllerId || !capabilities) return { available: true, reason: "", supportsDimming: false };

    const caps = capabilities instanceof Map
      ? capabilities.get(config.controllerId)
      : (capabilities.controller_id === config.controllerId ? capabilities : null);

    if (!caps) return { available: false, reason: "Controller not found", supportsDimming: false };
    if (caps.status === 'offline') return { available: false, reason: "Controller offline", supportsDimming: false };

    // Check if this specific device/port exists
    const device = caps.devices.find((d) => d.port === config.port);

    if (!device) return { available: false, reason: "Device not available", supportsDimming: false };
    if (!device.isOnline) return { available: false, reason: "Device offline", supportsDimming: false };

    return { available: true, reason: "", supportsDimming: device.supportsDimming };
  }, [capabilities, config.controllerId, config.port]);

  const DeviceIcon = getDeviceIcon(config.deviceType);
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
        {/* Device Unavailable Warning */}
        {!deviceAvailable.available && (
          <div className="mb-2 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              {deviceAvailable.reason}
            </span>
          </div>
        )}

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
            {getDeviceLabel(config.deviceType)}
            {deviceAvailable.supportsDimming && (
              <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-400">(Dimming)</span>
            )}
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
