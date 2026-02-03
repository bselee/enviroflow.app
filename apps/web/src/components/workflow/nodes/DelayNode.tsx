"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DelayNodeData, DelayTimeUnit } from "../types";

/**
 * DelayNode - Pauses workflow execution for a specified duration
 *
 * This node introduces a time delay between actions in the workflow.
 * It uses a state machine approach where:
 * - When hit, saves resume_after timestamp to DB
 * - Cron job checks for paused workflows and resumes when time is reached
 *
 * Visual Design:
 * - Yellow/amber border to indicate "pause" semantics
 * - Timer icon in header
 * - Shows duration in human-readable format
 */

/** Format duration for display */
function formatDuration(duration: number, unit: DelayTimeUnit): string {
  const unitLabels: Record<DelayTimeUnit, { singular: string; plural: string }> = {
    seconds: { singular: "second", plural: "seconds" },
    minutes: { singular: "minute", plural: "minutes" },
    hours: { singular: "hour", plural: "hours" },
  };
  const label = duration === 1 ? unitLabels[unit].singular : unitLabels[unit].plural;
  return `${duration} ${label}`;
}

interface DelayNodeProps {
  data: DelayNodeData;
  selected?: boolean;
  id: string;
}

export function DelayNode({ data, selected, id }: DelayNodeProps) {
  const { config } = data;
  const duration = config.duration || 0;
  const unit = config.unit || "seconds";

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-card shadow-md transition-all",
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
          <Timer className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Delay"}
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
        {/* Duration Display */}
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          <span className="text-sm font-medium text-foreground">
            {duration > 0 ? formatDuration(duration, unit) : "Not configured"}
          </span>
        </div>

        {/* Description */}
        <p className="mt-1 text-xs text-muted-foreground">
          Pause execution before continuing
        </p>
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-amber-500 !bg-background",
          "dark:!border-amber-400"
        )}
      />
    </div>
  );
}

DelayNode.displayName = "DelayNode";

export default DelayNode;
