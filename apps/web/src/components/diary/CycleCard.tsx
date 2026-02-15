"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Eye, Edit, Archive, Trash2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
import type { DiaryCycleWithCounts } from "@/types";
import { cn } from "@/lib/utils";

interface CycleCardProps {
  cycle: DiaryCycleWithCounts;
  onEdit?: (cycle: DiaryCycleWithCounts) => void;
  onArchive?: (cycleId: string) => void;
  onReactivate?: (cycleId: string) => void;
  onDelete?: (cycleId: string) => void;
}

// Stage emoji icons
const STAGE_ICONS: Record<string, string> = {
  germination: "🌰",
  seedling: "🌱",
  vegetative: "🌿",
  flowering: "🌸",
  harvest: "🌾",
  cure: "🫙",
};

// Status badge variants
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  completed: "secondary",
  archived: "outline",
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  archived: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
};

/**
 * Calculate duration string for a cycle
 */
function getDurationText(startedAt: string, endedAt: string | null, status: string): string {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (status === "active") {
    return `Day ${days}`;
  } else {
    return `${days} days total`;
  }
}

export function CycleCard({ cycle, onEdit, onArchive, onReactivate, onDelete }: CycleCardProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleView = () => {
    router.push(`/diaries/${cycle.id}`);
  };

  const handleEdit = () => {
    onEdit?.(cycle);
  };

  const handleArchive = () => {
    onArchive?.(cycle.id);
  };

  const handleReactivate = () => {
    onReactivate?.(cycle.id);
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    onDelete?.(cycle.id);
    setShowDeleteDialog(false);
  };

  const stageIcon = STAGE_ICONS[cycle.current_stage] || "🌱";
  const statusColor = STATUS_COLORS[cycle.status] || STATUS_COLORS.active;
  const durationText = getDurationText(cycle.started_at, cycle.ended_at, cycle.status);

  return (
    <>
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={handleView}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{cycle.name}</h3>
              {cycle.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {cycle.description}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(); }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {cycle.status !== "archived" && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(); }}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}
                {(cycle.status === "completed" || cycle.status === "archived") && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReactivate(); }}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reactivate
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Status and Stage */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("border", statusColor)}>
              {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span>{stageIcon}</span>
              <span>{cycle.current_stage.charAt(0).toUpperCase() + cycle.current_stage.slice(1)}</span>
            </Badge>
          </div>

          {/* Duration */}
          <div className="text-sm text-muted-foreground">
            {durationText}
          </div>

          {/* Room */}
          {cycle.room && (
            <div className="text-sm">
              <span className="text-muted-foreground">Room: </span>
              <span className="font-medium">{cycle.room.name}</span>
            </div>
          )}

          {/* Counts */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
            <div>
              <span className="font-medium text-foreground">{cycle.entry_count || 0}</span> entries
            </div>
            <div>
              <span className="font-medium text-foreground">{cycle.photo_count || 0}</span> photos
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete diary cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{cycle.name}&quot; and all associated diary entries and photos.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
