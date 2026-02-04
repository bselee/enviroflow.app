/**
 * DeleteWorkflowDialog
 * 
 * Confirmation dialog for deleting a workflow.
 * Shows workflow name and warns about permanent deletion.
 */

"use client";

import * as React from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName: string;
  workflowId: string;
  isActive?: boolean;
  onConfirm: (workflowId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteWorkflowDialog({
  open,
  onOpenChange,
  workflowName,
  workflowId,
  isActive = false,
  onConfirm,
  isDeleting = false,
}: DeleteWorkflowDialogProps) {
  const handleConfirm = async () => {
    await onConfirm(workflowId);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Workflow
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">"{workflowName}"</span>?
              </p>
              
              {isActive && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-sm text-warning">
                    This workflow is currently <strong>active</strong> and will stop executing immediately.
                  </p>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. All workflow configuration, execution history, 
                and associated data will be permanently removed.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Workflow"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteWorkflowDialog;
