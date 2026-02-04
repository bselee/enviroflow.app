/**
 * ConflictResolutionModal
 * 
 * Shows side-by-side comparison of conflicting workflows and allows
 * user to resolve by keeping one workflow active and deactivating others.
 */

"use client";

import * as React from "react";
import { AlertTriangle, Play, Pause, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { WorkflowConflictInfo } from "@/hooks/use-workflow-conflicts";

interface ConflictingWorkflow {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  last_executed?: string | null;
  room?: { id: string; name: string } | null;
}

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The primary workflow that has conflicts */
  primaryWorkflow: ConflictingWorkflow;
  /** Conflict info for the primary workflow */
  conflictInfo: WorkflowConflictInfo;
  /** All workflows that conflict with the primary */
  conflictingWorkflows: ConflictingWorkflow[];
  /** Callback when user chooses to keep a workflow active (deactivates others) */
  onResolve: (keepActiveId: string, deactivateIds: string[]) => Promise<void>;
  /** Loading state while resolving */
  isResolving?: boolean;
}

/**
 * Formats a port key (controllerId:port) to a more readable format.
 */
function formatPortKey(key: string): string {
  const [controllerId, port] = key.split(":");
  // Shorten controller ID for display
  const shortId = controllerId.length > 8 
    ? `${controllerId.slice(0, 4)}...${controllerId.slice(-4)}`
    : controllerId;
  return `Port ${port} (${shortId})`;
}

export function ConflictResolutionModal({
  open,
  onOpenChange,
  primaryWorkflow,
  conflictInfo,
  conflictingWorkflows,
  onResolve,
  isResolving = false,
}: ConflictResolutionModalProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState<string | null>(null);

  // All workflows involved in this conflict (primary + conflicting)
  const allWorkflows = React.useMemo(() => {
    return [primaryWorkflow, ...conflictingWorkflows];
  }, [primaryWorkflow, conflictingWorkflows]);

  const handleResolve = async () => {
    if (!selectedWorkflowId) return;
    
    const deactivateIds = allWorkflows
      .filter(w => w.id !== selectedWorkflowId)
      .map(w => w.id);
    
    try {
      await onResolve(selectedWorkflowId, deactivateIds);
      // Only close the modal if resolution succeeded
      onOpenChange(false);
    } catch {
      // Error is handled by the parent (toast notification).
      // Keep the modal open so the user can retry.
    }
  };

  // Reset selection when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedWorkflowId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Resolve Port Conflict
          </DialogTitle>
          <DialogDescription>
            Multiple workflows are targeting the same device port. Only one workflow can control
            a port at a time. Select which workflow should remain active.
          </DialogDescription>
        </DialogHeader>

        {/* Conflicting Ports */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-destructive mb-2">Conflicting Ports:</p>
          <div className="flex flex-wrap gap-2">
            {conflictInfo.conflictingPorts.map((portKey) => (
              <Badge key={portKey} variant="outline" className="text-destructive border-destructive/30">
                {formatPortKey(portKey)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Workflow Comparison */}
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {allWorkflows.map((workflow) => {
              const isSelected = selectedWorkflowId === workflow.id;
              const isPrimary = workflow.id === primaryWorkflow.id;

              return (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  disabled={isResolving}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border-2 transition-all",
                    isSelected
                      ? "border-success bg-success/5"
                      : "border-border hover:border-muted-foreground/50 bg-card",
                    isResolving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{workflow.name}</h4>
                        {isPrimary && (
                          <Badge variant="outline" className="text-xs">
                            Current
                          </Badge>
                        )}
                        {workflow.is_active ? (
                          <Badge className="bg-success/10 text-success text-xs">
                            <Play className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Pause className="h-3 w-3 mr-1" />
                            Paused
                          </Badge>
                        )}
                      </div>
                      
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {workflow.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {workflow.room && (
                          <span>Room: {workflow.room.name}</span>
                        )}
                        {workflow.last_executed && (
                          <span>Last run: {new Date(workflow.last_executed).toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected 
                        ? "border-success bg-success text-success-foreground" 
                        : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Zap className="h-3 w-3" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Resolution Preview */}
        {selectedWorkflowId && (
          <div className="bg-muted/50 rounded-lg p-3 mt-2">
            <p className="text-sm">
              <span className="font-medium">Resolution:</span>{" "}
              <span className="text-success">
                "{allWorkflows.find(w => w.id === selectedWorkflowId)?.name}"
              </span>{" "}
              will remain active.{" "}
              <span className="text-muted-foreground">
                {allWorkflows.length - 1} other workflow{allWorkflows.length > 2 ? "s" : ""} will be paused.
              </span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isResolving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!selectedWorkflowId || isResolving}
            className="gap-2"
          >
            {isResolving ? (
              <>Resolving...</>
            ) : (
              <>
                Resolve Conflict
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConflictResolutionModal;
