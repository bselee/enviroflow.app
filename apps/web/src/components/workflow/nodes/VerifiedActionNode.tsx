"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VerifiedActionNodeData } from "../types";

/**
 * VerifiedActionNode - Device control with verification and retry
 *
 * This node performs device control actions and verifies the result by reading
 * back the device state. If verification fails, it can retry and optionally rollback.
 *
 * Features:
 * - Send control command to controller port
 * - Verify the action succeeded by reading device state
 * - Configurable timeout and retry count
 * - Optional rollback on failure
 * - Has both input and output handles for workflow chaining
 *
 * Visual Design:
 * - Teal/emerald border to indicate "verified action" semantics
 * - CheckCircle2 icon in header
 * - Shows action details, verification settings, and rollback option
 */

interface VerifiedActionNodeProps {
  data: VerifiedActionNodeData;
  selected?: boolean;
  id: string;
}

export function VerifiedActionNode({ data, selected, id }: VerifiedActionNodeProps) {
  const config = data.config;

  /**
   * Formats the action for display.
   */
  const getActionSummary = (): string => {
    switch (config.action) {
      case "on":
        return "Turn ON";
      case "off":
        return "Turn OFF";
      case "set_level":
        if (config.level !== undefined) {
          return `Set Level: ${config.level}`;
        }
        return "Set Level (not set)";
      default:
        return "Not configured";
    }
  };

  return (
    <div
      className={cn(
        "group min-w-[240px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-teal-500 dark:border-teal-400",
        selected && "ring-2 ring-teal-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-teal-500 !bg-background",
          "dark:!border-teal-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-teal-500/10 px-3 py-2 dark:bg-teal-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white dark:bg-teal-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Verified Action"}
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
        <div className="mb-2 text-xs text-muted-foreground">
          {config.controllerName || "No controller"}
          {config.portName && ` - ${config.portName}`}
          {config.port !== undefined && ` (Port ${config.port})`}
        </div>

        {/* Action Summary Box */}
        <div className="mb-3 rounded-md border border-border bg-muted/50 px-3 py-2">
          <div className="text-sm font-medium text-foreground">
            {getActionSummary()}
          </div>
        </div>

        {/* Verification Settings */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Verify Timeout:</span>
            <span className="font-medium text-foreground">
              {config.verifyTimeout}s
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Max Retries:</span>
            <span className="font-medium text-foreground">
              {config.retryCount}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Rollback on Failure:</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                config.rollbackOnFailure
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {config.rollbackOnFailure ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-teal-500 !bg-background",
          "dark:!border-teal-400"
        )}
      />
    </div>
  );
}

VerifiedActionNode.displayName = "VerifiedActionNode";

export default VerifiedActionNode;
