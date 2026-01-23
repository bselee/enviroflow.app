/**
 * DeleteControllerDialog Component
 *
 * Confirmation dialog for deleting a controller.
 * Features:
 * - Warning about associated workflows that will be affected
 * - Confirmation before deletion
 * - Loading state during deletion
 * - Success toast notification
 *
 * @example
 * ```tsx
 * <DeleteControllerDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   controller={selectedController}
 *   onDelete={deleteController}
 *   onGetAssociatedWorkflows={getAssociatedWorkflows}
 * />
 * ```
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, AlertTriangle, Trash2, Workflow } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ControllerWithRoom } from "@/types";

/**
 * Props for DeleteControllerDialog
 */
interface DeleteControllerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Controller to delete */
  controller: ControllerWithRoom | null;
  /** Delete controller callback */
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Get associated workflows callback */
  onGetAssociatedWorkflows: (
    controllerId: string
  ) => Promise<{ success: boolean; data?: { count: number; names: string[] }; error?: string }>;
  /** Success callback (for showing toast) */
  onSuccess?: () => void;
}

/**
 * Brand display names
 */
const BRAND_NAMES: Record<string, string> = {
  ac_infinity: "AC Infinity",
  inkbird: "Inkbird",
  csv_upload: "CSV Upload",
  govee: "Govee",
  mqtt: "MQTT",
  custom: "Custom",
};

/**
 * DeleteControllerDialog - Main component
 */
export function DeleteControllerDialog({
  open,
  onOpenChange,
  controller,
  onDelete,
  onGetAssociatedWorkflows,
  onSuccess,
}: DeleteControllerDialogProps) {
  // State for associated workflows
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [associatedWorkflows, setAssociatedWorkflows] = useState<{
    count: number;
    names: string[];
  } | null>(null);

  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Fetch associated workflows when dialog opens
   */
  useEffect(() => {
    const fetchWorkflows = async () => {
      if (!controller || !open) return;

      setLoadingWorkflows(true);
      setAssociatedWorkflows(null);
      setDeleteError(null);

      try {
        const result = await onGetAssociatedWorkflows(controller.id);
        if (result.success && result.data) {
          setAssociatedWorkflows(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch associated workflows:", err);
      } finally {
        setLoadingWorkflows(false);
      }
    };

    fetchWorkflows();
  }, [controller, open, onGetAssociatedWorkflows]);

  /**
   * Handle delete confirmation
   */
  const handleDelete = useCallback(async () => {
    if (!controller) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await onDelete(controller.id);

      if (result.success) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        setDeleteError(result.error || "Failed to delete controller");
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  }, [controller, onDelete, onOpenChange, onSuccess]);

  if (!controller) return null;

  const hasWorkflows = associatedWorkflows && associatedWorkflows.count > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete Controller
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">{controller.name}</span>?
                This action cannot be undone.
              </p>

              {/* Controller Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    controller.status === 'online' ? "bg-success/10" : "bg-muted"
                  )}
                >
                  <Trash2
                    className={cn(
                      "w-5 h-5",
                      controller.status === 'online' ? "text-success" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{controller.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {BRAND_NAMES[controller.brand] || controller.brand}
                    </Badge>
                    {controller.room?.name && (
                      <Badge variant="outline" className="text-xs">
                        {controller.room.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Associated Workflows Warning */}
              {loadingWorkflows && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Checking for associated workflows...
                  </span>
                </div>
              )}

              {hasWorkflows && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Workflow className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        This controller is used in {associatedWorkflows.count} workflow
                        {associatedWorkflows.count !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Deleting this controller will affect the following workflows:
                      </p>
                      <ul className="space-y-1">
                        {associatedWorkflows.names.slice(0, 5).map((name, i) => (
                          <li
                            key={i}
                            className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2"
                          >
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                            {name}
                          </li>
                        ))}
                        {associatedWorkflows.names.length > 5 && (
                          <li className="text-sm text-amber-600 dark:text-amber-400 italic">
                            ...and {associatedWorkflows.names.length - 5} more
                          </li>
                        )}
                      </ul>
                      <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
                        These workflows will no longer be able to read from or control this
                        device.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* What will be deleted */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">This will permanently delete:</p>
                <ul className="space-y-1 ml-4">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                    Controller configuration and credentials
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                    All sensor readings from this controller
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                    Activity log entries for this controller
                  </li>
                </ul>
              </div>

              {/* Error Message */}
              {deleteError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm">{deleteError}</span>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || loadingWorkflows}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Controller
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
