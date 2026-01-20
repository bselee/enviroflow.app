"use client";
import { Plus } from "lucide-react";

interface AddRoomCardProps {
  onClick?: () => void;
}

export function AddRoomCard({ onClick }: AddRoomCardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-xl border-2 border-dashed border-border p-6 flex flex-col items-center justify-center min-h-[320px] hover:border-primary hover:bg-primary/5 transition-colors group"
    >
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <span className="mt-3 text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
        Add Room
      </span>
    </button>
  );
}
