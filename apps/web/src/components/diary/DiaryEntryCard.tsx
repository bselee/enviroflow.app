"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { TagBadges } from "@/components/diary/TagSelector";
import { SensorSnapshotCard } from "@/components/diary/SensorSnapshotCard";
import type { DiaryEntryWithPhotos } from "@/types";

interface DiaryEntryCardProps {
  entry: DiaryEntryWithPhotos;
  onEdit?: (entry: DiaryEntryWithPhotos) => void;
  onDelete?: (entryId: string) => void;
  disabled?: boolean;
}

/**
 * Card component for displaying a single diary entry in the timeline.
 * Shows rich text content, tags, sensor snapshot, and photo thumbnails.
 */
export function DiaryEntryCard({
  entry,
  onEdit,
  onDelete,
  disabled = false,
}: DiaryEntryCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const entryDate = parseISO(entry.entry_date);
  const time = format(entryDate, "h:mm a");
  const photos = entry.photos || [];
  const maxVisiblePhotos = 4;
  const extraPhotos = photos.length - maxVisiblePhotos;

  return (
    <>
      <Card className="relative">
        <CardContent className="pt-4 pb-4">
          {/* Header row: title/time + actions */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              {entry.title && (
                <h4 className="font-semibold text-sm truncate">{entry.title}</h4>
              )}
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>

            {!disabled && (onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                    <span className="sr-only">Entry actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(entry)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Content (rendered HTML from Tiptap) */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none mb-3 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: entry.content }}
          />

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="mb-3">
              <TagBadges tags={entry.tags} />
            </div>
          )}

          {/* Sensor snapshot */}
          {entry.sensor_snapshot && (
            <div className="mb-3">
              <SensorSnapshotCard snapshot={entry.sensor_snapshot} />
            </div>
          )}

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t">
              {photos.slice(0, maxVisiblePhotos).map((photo) => (
                <div
                  key={photo.id}
                  className="h-12 w-12 rounded-md bg-muted overflow-hidden flex-shrink-0"
                >
                  {photo.thumbnail_path ? (
                    <img
                      src={photo.thumbnail_path}
                      alt={photo.filename || "Photo"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-lg">
                      📷
                    </div>
                  )}
                </div>
              ))}
              {extraPhotos > 0 && (
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                  +{extraPhotos}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete diary entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this entry
              {photos.length > 0 ? ` and ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.(entry.id);
                setShowDeleteDialog(false);
              }}
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
