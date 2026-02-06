"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Play, Clock, Thermometer, MousePointer, X, Radio, Sun, SunDim } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriggerNodeData, TriggerType } from "../types";

/**
 * TriggerNode - Entry point node for workflows
 *
 * This node serves as the starting point of any workflow and can be configured
 * to trigger based on:
 * - Schedule: Cron expression or simple time picker
 * - Sensor Threshold: When a sensor reading crosses a threshold
 * - Manual: User-initiated trigger
 * - MQTT: When a message on an MQTT topic matches conditions
 *
 * Visual Design:
 * - Green border to indicate "start" semantics
 * - Play icon in header
 * - Only has output handle (no inputs - it's the entry point)
 */

/** Icons for different trigger types */
const TRIGGER_ICONS: Record<TriggerType, React.ComponentType<{ className?: string }>> = {
  schedule: Clock,
  sensor_threshold: Thermometer,
  manual: MousePointer,
  mqtt: Radio,
  lights_on: Sun,
  lights_off: SunDim,
};

/** Labels for trigger types */
const TRIGGER_LABELS: Record<TriggerType, string> = {
  schedule: "Schedule",
  sensor_threshold: "Sensor Threshold",
  manual: "Manual Trigger",
  mqtt: "MQTT Trigger",
  lights_on: "Lights On",
  lights_off: "Lights Off",
};

interface TriggerNodeProps {
  data: TriggerNodeData;
  selected?: boolean;
  id: string;
}

export function TriggerNode({ data, selected, id }: TriggerNodeProps) {
  const triggerType = data.config.triggerType;
  const TriggerIcon = TRIGGER_ICONS[triggerType];

  /**
   * Formats the trigger configuration for display in the node body.
   * Shows relevant details based on trigger type.
   */
  const getConfigSummary = (): string => {
    switch (data.config.triggerType) {
      case "schedule": {
        const config = data.config;
        if (config.cronExpression) {
          return `Cron: ${config.cronExpression}`;
        }
        if (config.simpleTime) {
          const days = config.daysOfWeek;
          if (days && days.length > 0 && days.length < 7) {
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const dayLabels = days.map((d) => dayNames[d]).join(", ");
            return `${config.simpleTime} on ${dayLabels}`;
          }
          return `Daily at ${config.simpleTime}`;
        }
        return "Not configured";
      }
      case "sensor_threshold": {
        const config = data.config;
        if (config.sensorType && config.operator && config.threshold !== undefined) {
          return `${config.sensorType} ${config.operator} ${config.threshold}`;
        }
        return "Not configured";
      }
      case "mqtt": {
        const config = data.config;
        if (config.topic) {
          const topicDisplay = config.topic.length > 25 
            ? config.topic.substring(0, 22) + "..." 
            : config.topic;
          if (config.jsonPath && config.operator && config.threshold !== undefined) {
            return `${topicDisplay} → ${config.jsonPath} ${config.operator} ${config.threshold}`;
          }
          return `Topic: ${topicDisplay}`;
        }
        return "Not configured";
      }
      case "manual":
        return "Click to run";
      case "lights_on": {
        const config = data.config;
        if (config.controllerName && config.port !== undefined) {
          return `When ${config.portName || `Port ${config.port}`} turns ON`;
        }
        if (config.controllerName) {
          return `When light on ${config.controllerName} turns ON`;
        }
        return "When light turns ON";
      }
      case "lights_off": {
        const config = data.config;
        if (config.controllerName && config.port !== undefined) {
          return `When ${config.portName || `Port ${config.port}`} turns OFF`;
        }
        if (config.controllerName) {
          return `When light on ${config.controllerName} turns OFF`;
        }
        return "When light turns OFF";
      }
      default:
        return "Unknown trigger";
    }
  };

  return (
    <div
      className={cn(
        "group min-w-[200px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-green-500 dark:border-green-400",
        selected && "ring-2 ring-green-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-green-500/10 px-3 py-2 dark:bg-green-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white dark:bg-green-400">
          <Play className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Trigger"}
        </span>
        {/* Delete button visible on hover (handled via CSS) */}
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
        {/* Trigger Type Badge */}
        <div className="mb-2 flex items-center gap-2">
          <TriggerIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {TRIGGER_LABELS[triggerType]}
          </span>
        </div>

        {/* Configuration Summary */}
        <p className="text-xs text-muted-foreground">{getConfigSummary()}</p>
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-green-500 !bg-background",
          "dark:!border-green-400"
        )}
      />
    </div>
  );
}

TriggerNode.displayName = "TriggerNode";

export default TriggerNode;
