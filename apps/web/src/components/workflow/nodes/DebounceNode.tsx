"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Filter, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebounceNodeData } from "../types";

/**
 * DebounceNode - Prevents rapid workflow triggering
 *
 * This node filters out rapid successive triggers, ensuring the workflow
 * doesn't execute too frequently. Useful for:
 * - Sensor readings that fluctuate near thresholds
 * - Preventing command spam to devices
 * - Rate limiting notification sending
 *
 * Options:
 * - executeOnLead: Fire immediately on first trigger
 * - executeOnTrail: Fire after cooldown period ends
 *
 * Visual Design:
 * - Slate/gray border to indicate "filter" semantics
 * - Filter icon in header
 * - Shows cooldown duration and mode
 */

interface DebounceNodeProps {
  data: DebounceNodeData;
  selected?: boolean;
  id: string;
}

export function DebounceNode({ data, selected, id }: DebounceNodeProps) {
  const { config, lastExecutedAt } = data;
  const cooldown = config.cooldownSeconds || 0;
  const executeOnLead = config.executeOnLead ?? true;
  const executeOnTrail = config.executeOnTrail ?? false;

  /** Get mode description */
  const getModeDescription = (): string => {
    if (executeOnLead && executeOnTrail) {
      return "Leading + Trailing";
    }
    if (executeOnLead) {
      return "Leading edge";
    }
    if (executeOnTrail) {
      return "Trailing edge";
    }
    return "No execution";
  };

  /** Format cooldown for display */
  const formatCooldown = (): string => {
    if (cooldown >= 3600) {
      const hours = Math.floor(cooldown / 3600);
      return `${hours}h cooldown`;
    }
    if (cooldown >= 60) {
      const minutes = Math.floor(cooldown / 60);
      return `${minutes}m cooldown`;
    }
    return `${cooldown}s cooldown`;
  };

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-slate-500 dark:border-slate-400",
        selected && "ring-2 ring-slate-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-slate-500 !bg-background",
          "dark:!border-slate-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-slate-500/10 px-3 py-2 dark:bg-slate-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-white dark:bg-slate-400">
          <Filter className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Debounce"}
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
      <div className="px-3 py-2 space-y-1.5">
        {/* Cooldown Display */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-foreground">
            {cooldown > 0 ? formatCooldown() : "Not configured"}
          </span>
        </div>

        {/* Mode Badge */}
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            {getModeDescription()}
          </span>
        </div>

        {/* Last Execution (if available) */}
        {lastExecutedAt && (
          <p className="text-xs text-muted-foreground">
            Last: {new Date(lastExecutedAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-slate-500 !bg-background",
          "dark:!border-slate-400"
        )}
      />
    </div>
  );
}

DebounceNode.displayName = "DebounceNode";

export default DebounceNode;
