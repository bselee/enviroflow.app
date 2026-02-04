/**
 * ManualTriggerButton
 * 
 * "Run Now" button that manually triggers a workflow execution.
 * Shows execution progress and result feedback.
 */

"use client";

import * as React from "react";
import { Play, Loader2, CheckCircle2, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

type ExecutionStatus = "idle" | "running" | "success" | "error";

interface ExecutionResult {
  success: boolean;
  nodesExecuted?: number;
  actionsTriggered?: number;
  error?: string;
  skippedReason?: string;
  dryRun?: boolean;
}

interface ManualTriggerButtonProps {
  workflowId: string;
  workflowName: string;
  /** Whether the workflow is active (should warn if not) */
  isActive?: boolean;
  /** Compact mode for inline use */
  compact?: boolean;
  /** Called after execution completes */
  onExecutionComplete?: (result: ExecutionResult) => void;
  className?: string;
}

export function ManualTriggerButton({
  workflowId,
  workflowName,
  isActive = true,
  compact = false,
  onExecutionComplete,
  className,
}: ManualTriggerButtonProps) {
  const [status, setStatus] = React.useState<ExecutionStatus>("idle");
  const [result, setResult] = React.useState<ExecutionResult | null>(null);
  const supabase = createClient();

  // Auto-reset to idle after showing result
  React.useEffect(() => {
    if (status === "success" || status === "error") {
      const timer = setTimeout(() => {
        setStatus("idle");
        setResult(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleTrigger = async () => {
    if (status === "running") return;

    setStatus("running");
    setResult(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/workflows/${workflowId}/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const executionResult: ExecutionResult = {
        success: data.success ?? true,
        nodesExecuted: data.nodesExecuted,
        actionsTriggered: data.actionsTriggered,
        skippedReason: data.skippedReason,
        dryRun: data.dryRun,
      };

      setResult(executionResult);
      setStatus(executionResult.success ? "success" : "error");
      onExecutionComplete?.(executionResult);
    } catch (err) {
      const errorResult: ExecutionResult = {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
      setResult(errorResult);
      setStatus("error");
      onExecutionComplete?.(errorResult);
    }
  };

  const getIcon = () => {
    switch (status) {
      case "running":
        return <Loader2 className={cn("animate-spin", compact ? "h-4 w-4" : "h-4 w-4")} />;
      case "success":
        return <CheckCircle2 className={cn("text-success", compact ? "h-4 w-4" : "h-4 w-4")} />;
      case "error":
        return <XCircle className={cn("text-destructive", compact ? "h-4 w-4" : "h-4 w-4")} />;
      default:
        return <Zap className={compact ? "h-4 w-4" : "h-4 w-4"} />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case "running":
        return "Running...";
      case "success":
        if (result?.actionsTriggered) {
          return `Dry run: ${result.actionsTriggered} action${result.actionsTriggered > 1 ? "s" : ""} would trigger`;
        }
        if (result?.skippedReason) {
          return "Skipped";
        }
        return "Dry run completed";
      case "error":
        return "Failed";
      default:
        return "Run Now";
    }
  };

  const getTooltipContent = () => {
    if (!isActive && status === "idle") {
      return (
        <div className="max-w-[200px]">
          <p className="font-medium">Workflow is paused</p>
          <p className="text-xs text-muted-foreground">
            Running a dry-run will simulate the workflow without sending device commands or affecting its paused state.
          </p>
        </div>
      );
    }

    if (status === "success" && result?.skippedReason) {
      return (
        <div className="max-w-[200px]">
          <p className="font-medium">Execution skipped</p>
          <p className="text-xs text-muted-foreground">{result.skippedReason}</p>
        </div>
      );
    }

    if (status === "error" && result?.error) {
      return (
        <div className="max-w-[200px]">
          <p className="font-medium text-destructive">Execution failed</p>
          <p className="text-xs text-muted-foreground">{result.error}</p>
        </div>
      );
    }

    return `Dry-run "${workflowName}" (no device commands sent)`;
  };

  const button = (
    <Button
      variant={status === "error" ? "destructive" : status === "success" ? "outline" : "secondary"}
      size={compact ? "sm" : "default"}
      onClick={handleTrigger}
      disabled={status === "running"}
      className={cn(
        "gap-2 transition-all",
        status === "success" && "border-success/50 text-success",
        className
      )}
    >
      {getIcon()}
      {!compact && <span>{getLabel()}</span>}
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{getTooltipContent()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ManualTriggerButton;
