"use client";

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Variable, ArrowRight, ArrowLeft, Plus, Minus, X, Globe, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VariableNodeData, VariableOperation, VariableScope } from "../types";

/**
 * VariableNode - Store and retrieve values during workflow execution
 *
 * This node allows workflows to:
 * - Store values for later use (set)
 * - Retrieve previously stored values (get)
 * - Increment/decrement numeric values
 *
 * Variables can be scoped to:
 * - workflow: Only accessible within the same workflow execution
 * - global: Shared across all workflow executions (persisted to database)
 *
 * Visual Design:
 * - Purple border to indicate "data" semantics
 * - Variable icon in header
 * - Shows variable name, scope, and operation
 */

/** Icons for different operations */
const OPERATION_ICONS: Record<VariableOperation, React.ComponentType<{ className?: string }>> = {
  set: ArrowRight,
  get: ArrowLeft,
  increment: Plus,
  decrement: Minus,
};

/** Icons for different scopes */
const SCOPE_ICONS: Record<VariableScope, React.ComponentType<{ className?: string }>> = {
  workflow: FileCode,
  global: Globe,
};

/** Labels for operations */
const OPERATION_LABELS: Record<VariableOperation, string> = {
  set: "Set",
  get: "Get",
  increment: "Increment",
  decrement: "Decrement",
};

/** Labels for scopes */
const SCOPE_LABELS: Record<VariableScope, string> = {
  workflow: "Workflow",
  global: "Global",
};

interface VariableNodeProps {
  data: VariableNodeData;
  selected?: boolean;
  id: string;
}

export function VariableNode({ data, selected, id }: VariableNodeProps) {
  const { config, currentValue } = data;
  const name = config.name || "unnamed";
  const scope = config.scope || "workflow";
  const operation = config.operation || "set";
  const OperationIcon = OPERATION_ICONS[operation];
  const ScopeIcon = SCOPE_ICONS[scope];

  /** Get display value based on operation */
  const getDisplayValue = (): string => {
    switch (operation) {
      case "set":
        if (config.value !== undefined) {
          return `= ${config.value}`;
        }
        return "= (not set)";
      case "get":
        if (currentValue !== undefined) {
          return `→ ${currentValue}`;
        }
        return "→ (empty)";
      case "increment":
      case "decrement":
        const op = operation === "increment" ? "+" : "-";
        const amount = config.amount || 1;
        return `${op} ${amount}`;
      default:
        return "";
    }
  };

  return (
    <div
      className={cn(
        "min-w-[200px] rounded-lg border-2 bg-card shadow-md transition-all",
        "border-violet-500 dark:border-violet-400",
        selected && "ring-2 ring-violet-500/50 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Input Handle - positioned on the left side */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className={cn(
          "!h-3 !w-3 !border-2 !border-violet-500 !bg-background",
          "dark:!border-violet-400"
        )}
      />

      {/* Node Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-violet-500/10 px-3 py-2 dark:bg-violet-400/10">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-white dark:bg-violet-400">
          <Variable className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {data.label || "Variable"}
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
      <div className="px-3 py-2 space-y-2">
        {/* Variable Name and Scope */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
              {scope === "global" ? `global.${name}` : `workflow.${name}`}
            </code>
          </div>
          <div className="flex items-center gap-1" title={`${SCOPE_LABELS[scope]} scope`}>
            <ScopeIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>

        {/* Operation and Value */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium",
            operation === "set" && "bg-green-500/10 text-green-700 dark:text-green-400",
            operation === "get" && "bg-blue-500/10 text-blue-700 dark:text-blue-400",
            operation === "increment" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
            operation === "decrement" && "bg-rose-500/10 text-rose-700 dark:text-rose-400"
          )}>
            <OperationIcon className="h-3 w-3" />
            <span>{OPERATION_LABELS[operation]}</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {getDisplayValue()}
          </span>
        </div>
      </div>

      {/* Output Handle - positioned on the right side */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className={cn(
          "!h-3 !w-3 !border-2 !border-violet-500 !bg-background",
          "dark:!border-violet-400"
        )}
      />
    </div>
  );
}

VariableNode.displayName = "VariableNode";

export default VariableNode;
