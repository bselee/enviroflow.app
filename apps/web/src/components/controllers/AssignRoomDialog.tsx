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
  controller: ControllerWithRoom | null;
  rooms: RoomBasic[];
  onAssign: (controllerId: string, roomId: string | null) => Promise<{ success: boolean; error?: string }>;
}

export function AssignRoomDialog({
  open,
  onOpenChange,
  controller,
  rooms,
  onAssign,
}: AssignRoomDialogProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens with a new controller
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && controller) {
      setSelectedRoomId(controller.room?.id || null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!controller) return;

    setIsSubmitting(true);
    setError(null);

    const result = await onAssign(controller.id, selectedRoomId);

    setIsSubmitting(false);

    if (result.success) {
      onOpenChange(false);
    } else {
      setError(result.error || "Failed to update room assignment");
    }
  };

  const handleRemoveFromRoom = async () => {
    if (!controller) return;

    setIsSubmitting(true);
    setError(null);

    const result = await onAssign(controller.id, null);

    setIsSubmitting(false);

    if (result.success) {
      onOpenChange(false);
    } else {
      setError(result.error || "Failed to remove from room");
    }
  };

  if (!controller) return null;

  const currentRoomId = controller.room?.id;
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
            Assign &quot;{controller.name}&quot; to a room for better organization
            and grouped monitoring.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Current room info */}
          {controller.room && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Currently in:</p>
                <p className="text-sm text-muted-foreground">{controller.room.name}</p>
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
            disabled={isSubmitting || !hasChanged || (selectedRoomId === null && !controller.room)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
