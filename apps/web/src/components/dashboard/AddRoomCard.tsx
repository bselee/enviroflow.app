"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddRoomDialog } from "./AddRoomDialog";

interface AddRoomCardProps {
  /** Optional callback when a room is successfully created */
  onRoomCreated?: () => void;
}

/**
 * Card component that triggers the Add Room dialog.
 *
 * Styled as a dashed border card with a + icon to indicate
 * an action to add a new room. Clicking opens the AddRoomDialog.
 *
 * @example
 * ```tsx
 * <div className="grid grid-cols-3 gap-4">
 *   {rooms.map(room => <RoomCard key={room.id} room={room} />)}
 *   <AddRoomCard onRoomCreated={() => console.log("New room!")} />
 * </div>
 * ```
 */
export function AddRoomCard({ onRoomCreated }: AddRoomCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="bg-card rounded-xl border-2 border-dashed border-border p-6 flex flex-col items-center justify-center min-h-[320px] hover:border-primary hover:bg-primary/5 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        aria-label="Add new room"
      >
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <span className="mt-3 text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
          Add Room
        </span>
      </button>

      <AddRoomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onRoomCreated={onRoomCreated}
      />
    </>
  );
}
