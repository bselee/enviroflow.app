"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Leaf,
  FlaskConical,
  Zap,
  Activity,
  X,
  Gauge,
  CloudRain,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorNodeData, SensorType } from "../types";
import { useControllerCapabilities } from "@/hooks/use-controller-capabilities";

/**
 * SensorNode - Reads sensor data from a controller
 *
 * This node monitors sensor readings from connected controllers and evaluates
 * whether the current value meets the configured threshold condition.
 *
 * Features:
 * - Select controller and sensor type
 * - Configure threshold with comparison operator
 * - Configure reset threshold for hysteresis (prevents rapid toggling)
 * - Shows current sensor value in real-time
 *
 * Visual Design:
 * - Blue border to indicate "data/input" semantics
 * - Sensor-specific icon in header
 * - Real-time value display with conditional coloring
 */

/** Base sensor icon mapping - includes fallback for unknowns */
const SENSOR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  temperature: Thermometer,
  humidity: Droplets,
  vpd: Wind,
  co2: Activity,
  light: Sun,
  soil_moisture: Leaf,
  ph: FlaskConical,
  ec: Zap,
  pressure: Gauge,
  water_level: Droplets,
  wind_speed: Wind,
  pm25: Wind,
  uv: Sun,
  solar_radiation: Sun,
  rain: CloudRain,
};

/**
 * Get icon for any sensor type, with fallback for unknowns
 */
function getSensorIcon(sensorType?: string): React.ComponentType<{ className?: string }> {
  if (!sensorType) return HelpCircle;
  return SENSOR_ICON_MAP[sensorType] || Gauge; // Default to Gauge for unknown types
}

/**
 * Get human-readable label for any sensor type
 */
function getSensorLabel(sensorType?: string): string {
  if (!sensorType) return "Unknown Sensor";

  // Check if we have a predefined label
  const knownLabels: Record<string, string> = {
    temperature: "Temperature",
    humidity: "Humidity",
    vpd: "VPD",
    co2: "CO2",
    light: "Light Intensity",
    soil_moisture: "Soil Moisture",
    ph: "pH",
    ec: "EC",
    pressure: "Pressure",
    water_level: "Water Level",
    wind_speed: "Wind Speed",
    pm25: "PM2.5",
    uv: "UV Index",
    solar_radiation: "Solar Radiation",
    rain: "Rainfall",
  };

  if (knownLabels[sensorType]) {
    return knownLabels[sensorType];
  }

  // Generate label from sensor type string (e.g., "co2_level" -> "Co2 Level")
  return sensorType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get unit for sensor type, use stored unit if available
 */
function getSensorUnit(sensorType?: string, storedUnit?: string): string {
  if (storedUnit) return storedUnit;
  if (!sensorType) return "";

  const knownUnits: Record<string, string> = {
    temperature: "°F",
    humidity: "%",
    vpd: "kPa",
    co2: "ppm",
    light: "PPFD",
    soil_moisture: "%",
    ph: "",
    ec: "mS/cm",
    pressure: "hPa",
    water_level: "%",
    wind_speed: "mph",
    pm25: "µg/m³",
    uv: "",
    solar_radiation: "W/m²",
    rain: "mm",
  };

  return knownUnits[sensorType] || "";
}

/** Operator display symbols */
const OPERATOR_DISPLAY: Record<string, string> = {
  ">": ">",
  "<": "<",
  "=": "=",
  ">=": ">=",
  "<=": "<=",
};

interface SensorNodeProps {
  data: SensorNodeData;
  selected?: boolean;
  id: string;
}

export function SensorNode({ data, selected, id }: SensorNodeProps) {
  const { config, currentValue } = data;
  const sensorType = config.sensorType;

  // Fetch capabilities to validate sensor availability
  const { capabilities } = useControllerCapabilities({
    controllerId: config.controllerId,
  });

  // Check if sensor is still available
  const sensorAvailable = React.useMemo(() => {
    if (!config.controllerId || !capabilities) return { available: true, reason: "" };

    const caps = capabilities instanceof Map
      ? capabilities.get(config.controllerId)
      : (capabilities.controller_id === config.controllerId ? capabilities : null);

    if (!caps) return { available: false, reason: "Controller not found" };
    if (caps.status === 'offline') return { available: false, reason: "Controller offline" };

    // Check if this specific sensor exists
    const sensorExists = caps.sensors.some(
      (s) => s.type === sensorType && (config.port === undefined || s.port === config.port)
    );

    if (!sensorExists) return { available: false, reason: "Sensor not available" };

    return { available: true, reason: "" };
  }, [capabilities, config.controllerId, config.port, sensorType]);

  const SensorIcon = getSensorIcon(sensorType);

  /**
   * Evaluates whether the current sensor value meets the threshold condition.
   * Returns null if not enough data to evaluate, true if condition is met.
   */
  const evaluateCondition = (): boolean | null => {
    if (currentValue === undefined || config.threshold === undefined || !config.operator) {
      return null;
    }

    switch (config.operator) {
      case ">":
        return currentValue > config.threshold;
      case "<":
        return currentValue < config.threshold;
      case "=":
        return currentValue === config.threshold;
      case ">=":
        return currentValue >= config.threshold;
      case "<=":
        return currentValue <= config.threshold;
      default:
        return null;
    }
  };

  const conditionMet = evaluateCondition();

  /**
   * Gets the display color for the current value based on condition state.
   */
  const getValueColor = (): string => {
    if (conditionMet === null) return "text-muted-foreground";
    return conditionMet ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400";
  };

  /**
   * Formats the configuration for display in the node body.
   */
  const getConfigSummary = (): string => {
    if (!sensorType) {
      return "Select sensor type";
    }

    const label = getSensorLabel(sensorType);
    const unit = getSensorUnit(sensorType, config.unit);

    if (!config.operator || config.threshold === undefined) {
      return `${label} - configure threshold`;
    }

    return `${label} ${OPERATOR_DISPLAY[config.operator]} ${config.threshold}${unit}`;
  };

  /**
   * Formats the current value with unit for display.
   */
  const formatCurrentValue = (): string => {
    if (currentValue === undefined) return "--";
    const unit = getSensorUnit(sensorType, config.unit);
    return `${currentValue.toFixed(1)}${unit}`;
  };

  return (
    <div
      className={cn(
        "group min-w-[220px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-blue-500 dark:border-blue-400",
        selected && "ring-2 ring-blue-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-blue-500 !bg-background",
          "dark:!border-blue-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-blue-500/10 px-3 py-2 dark:bg-blue-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white dark:bg-blue-400">
          <SensorIcon className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Sensor"}
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
        {/* Sensor Unavailable Warning */}
        {!sensorAvailable.available && (
          <div className="mb-2 flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              {sensorAvailable.reason}
            </span>
          </div>
        )}

        {/* Controller Info */}
        {config.controllerName && (
          <p className="mb-1 text-xs text-muted-foreground">
            {config.controllerName}
            {config.port !== undefined && ` - Port ${config.port}`}
          </p>
        )}

        {/* Configuration Summary */}
        <p className="mb-2 text-xs font-medium text-foreground">
          {getConfigSummary()}
        </p>

        {/* Current Value Display */}
        <div className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
          <span className="text-xs text-muted-foreground">Current:</span>
          <span className={cn("text-sm font-semibold", getValueColor())}>
            {formatCurrentValue()}
          </span>
        </div>

        {/* Hysteresis Info */}
        {config.resetThreshold !== undefined && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Reset at: {config.resetThreshold}
            {getSensorUnit(sensorType, config.unit)}
          </p>
        )}

        {/* Condition Status Indicator */}
        {conditionMet !== null && (
          <div className="mt-2 flex items-center gap-1.5">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                conditionMet ? "bg-green-500" : "bg-muted-foreground/30"
              )}
            />
            <span className="text-[10px] text-muted-foreground">
              {conditionMet ? "Condition met" : "Condition not met"}
            </span>
          </div>
        )}
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-blue-500 !bg-background",
          "dark:!border-blue-400"
        )}
      />
    </div>
  );
}

SensorNode.displayName = "SensorNode";

export default SensorNode;
