"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortConditionNodeData } from "../types";

/**
 * PortConditionNode - Port state condition for workflows
 *
 * This node checks the current state of a controller port and routes execution
 * to different paths based on the condition (e.g., is port on/off, level above/below threshold).
 *
 * Features:
 * - Check port on/off state
 * - Check port level against threshold
 * - Check port mode
 * - Two output handles: "true" path and "false" path
 *
 * Visual Design:
 * - Amber border to indicate "decision/branch" semantics (like ConditionNode)
 * - Zap icon in header
 * - Clear labeling of true/false output paths
 */

interface PortConditionNodeProps {
  data: PortConditionNodeData;
  selected?: boolean;
  id: string;
}

export function PortConditionNode({ data, selected, id }: PortConditionNodeProps) {
  const { config } = data;

  /**
   * Formats the condition for human-readable display.
   */
  const getConditionSummary = (): string => {
    switch (config.condition) {
      case "is_on":
        return "Port is ON";
      case "is_off":
        return "Port is OFF";
      case "level_equals":
        return config.targetLevel !== undefined
          ? `Level = ${config.targetLevel}`
          : "Level equals (not set)";
      case "level_above":
        return config.targetLevel !== undefined
          ? `Level > ${config.targetLevel}`
          : "Level above (not set)";
      case "level_below":
        return config.targetLevel !== undefined
          ? `Level < ${config.targetLevel}`
          : "Level below (not set)";
      case "mode_equals":
        return config.targetMode
          ? `Mode = ${config.targetMode}`
          : "Mode equals (not set)";
      default:
        return "Not configured";
    }
  };

  return (
    <div
      className={cn(
        "group min-w-[220px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-amber-500 dark:border-amber-400",
        selected && "ring-2 ring-amber-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-amber-500 !bg-background",
          "dark:!border-amber-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-amber-500/10 px-3 py-2 dark:bg-amber-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white dark:bg-amber-400">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Port Condition"}
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
      <div className="px-3 py-3">
        {/* Controller & Port Info */}
        <div className="mb-3 text-xs text-muted-foreground">
          {config.controllerName || "No controller"}
          {config.portName && ` - ${config.portName}`}
          {config.port !== undefined && ` (Port ${config.port})`}
        </div>

        {/* Condition Summary Box */}
        <div className="mb-3 rounded-md border border-border bg-muted/50 px-3 py-2">
          <div className="text-sm font-medium text-foreground">
            {getConditionSummary()}
          </div>
        </div>

        {/* Output Path Labels */}
        <div className="flex flex-col gap-2">
          {/* True Path */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              True
            </span>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>

          {/* False Path */}
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              False
            </span>
            <div className="h-2 w-2 rounded-full bg-red-500" />
          </div>
        </div>
      </div>

      {/* True Output Handle - positioned on the right side, upper */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: "50%", transform: "translateY(-12px)" }}
        className={cn(
          "!h-3 !w-3 !border-2 !border-green-500 !bg-background",
          "dark:!border-green-400"
        )}
      />

      {/* False Output Handle - positioned on the right side, lower */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: "50%", transform: "translateY(12px)" }}
        className={cn(
          "!h-3 !w-3 !border-2 !border-red-500 !bg-background",
          "dark:!border-red-400"
        )}
      />
    </div>
  );
}

PortConditionNode.displayName = "PortConditionNode";

export default PortConditionNode;
