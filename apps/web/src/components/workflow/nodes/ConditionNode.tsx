"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConditionNodeData } from "../types";

/**
 * ConditionNode - Logical branching node for workflows
 *
 * This node combines multiple inputs using AND/OR logic and routes execution
 * to different paths based on the result.
 *
 * Features:
 * - AND/OR logic between multiple inputs
 * - Two output handles: "true" path and "false" path
 * - Visual indicator for logic type
 *
 * Visual Design:
 * - Yellow/amber border to indicate "decision/branch" semantics
 * - GitBranch icon in header
 * - Clear labeling of true/false output paths
 */

interface ConditionNodeProps {
  data: ConditionNodeData;
  selected?: boolean;
  id: string;
}

export function ConditionNode({ data, selected, id }: ConditionNodeProps) {
  const { config } = data;
  const logicType = config.logicType;

  return (
    <div
      className={cn(
        "group min-w-[180px] rounded-lg border-2 bg-card shadow-md transition-all",
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
          <GitBranch className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Condition"}
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
        {/* Logic Type Badge */}
        <div className="mb-3 flex items-center justify-center">
          <div
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold",
              logicType === "AND"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
            )}
          >
            {logicType}
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

ConditionNode.displayName = "ConditionNode";

export default ConditionNode;
