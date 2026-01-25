/**
 * AssignRoomDialog Component
 *
 * Dialog for assigning or changing a controller's room assignment.
 * Supports assigning to a room or removing from a room.
 */
"use client";

import { useState } from "react";
import { Loader2, Home, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ControllerWithRoom, RoomBasic } from "@/types";

interface AssignRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controller?: ControllerWithRoom | null;
  controllers?: ControllerWithRoom[];
  rooms: RoomBasic[];
  onAssign: (controllerId: string, roomId: string | null) => Promise<{ success: boolean; error?: string }>;
  /** Bulk mode: assign multiple controllers to the same room */
  isBulkMode?: boolean;
}

export function AssignRoomDialog({
  open,
  onOpenChange,
  controller,
  controllers = [],
  rooms,
  onAssign,
  isBulkMode = false,
}: AssignRoomDialogProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine which controllers we're working with
  const targetControllers = isBulkMode ? controllers : (controller ? [controller] : []);
  const isSingleMode = targetControllers.length === 1;

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      if (isSingleMode && targetControllers[0]) {
        setSelectedRoomId(targetControllers[0].room?.id || null);
      } else {
        setSelectedRoomId(null);
      }
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (targetControllers.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Assign room to all selected controllers
      const results = await Promise.all(
        targetControllers.map((ctrl) => onAssign(ctrl.id, selectedRoomId))
      );

      const failedResults = results.filter((r) => !r.success);

      if (failedResults.length > 0) {
        setError(
          `Failed to update ${failedResults.length} of ${targetControllers.length} controllers`
        );
      } else {
        onOpenChange(false);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFromRoom = async () => {
    if (targetControllers.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const results = await Promise.all(
        targetControllers.map((ctrl) => onAssign(ctrl.id, null))
      );

      const failedResults = results.filter((r) => !r.success);

      if (failedResults.length > 0) {
        setError(
          `Failed to remove ${failedResults.length} of ${targetControllers.length} controllers from their rooms`
        );
      } else {
        onOpenChange(false);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (targetControllers.length === 0) return null;

  const currentRoomId = isSingleMode ? targetControllers[0].room?.id : null;
  const hasChanged = selectedRoomId !== currentRoomId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="w-5 h-5" />
            Assign to Room
          </DialogTitle>
          <DialogDescription>
            {isBulkMode ? (
              <>
                Assign {targetControllers.length} controller{targetControllers.length > 1 ? "s" : ""} to a room for better organization
                and grouped monitoring.
              </>
            ) : (
              <>
                Assign &quot;{targetControllers[0].name}&quot; to a room for better organization
                and grouped monitoring.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Bulk mode: Show list of controllers */}
          {isBulkMode && targetControllers.length > 1 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">
                {targetControllers.length} controllers selected:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                {targetControllers.map((ctrl) => (
                  <li key={ctrl.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {ctrl.name}
                    {ctrl.room && (
                      <span className="text-xs">
                        (currently in {ctrl.room.name})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Single mode: Current room info */}
          {isSingleMode && targetControllers[0].room && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Currently in:</p>
                <p className="text-sm text-muted-foreground">{targetControllers[0].room.name}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFromRoom}
                disabled={isSubmitting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {/* Room selection */}
          <div className="space-y-2">
            <Label htmlFor="room">Select Room</Label>
            <Select
              value={selectedRoomId || "none"}
              onValueChange={(value) =>
                setSelectedRoomId(value === "none" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No room</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* No rooms available message */}
          {rooms.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No rooms available. Create a room first to assign controllers.
            </p>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !hasChanged || (selectedRoomId === null && isSingleMode && !targetControllers[0].room)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isBulkMode ? "Assigning..." : "Saving..."}
              </>
            ) : (
              isBulkMode ? `Assign ${targetControllers.length} Controllers` : "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
