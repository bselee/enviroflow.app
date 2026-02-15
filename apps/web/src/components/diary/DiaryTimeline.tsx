"use client";

import { useMemo } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import type { DiaryEntryWithPhotos } from "@/types";

interface DiaryTimelineProps {
  entries: DiaryEntryWithPhotos[];
  onNewEntry: () => void;
  onEditEntry: (entry: DiaryEntryWithPhotos) => void;
  onDeleteEntry: (entryId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Timeline layout for diary entries grouped by date.
 * Shows entries with date headers and a vertical timeline line.
 */
export function DiaryTimeline({
  entries,
  onNewEntry,
  onEditEntry,
  onDeleteEntry,
  loading = false,
  disabled = false,
}: DiaryTimelineProps) {
  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, DiaryEntryWithPhotos[]> = {};

    entries.forEach((entry) => {
      const date = parseISO(entry.entry_date);
      const dateKey = format(date, "yyyy-MM-dd");

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });

    // Sort each group by time (most recent first)
    Object.keys(groups).forEach((key) => {
      groups[key].sort(
        (a, b) =>
          new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );
    });

    return groups;
  }, [entries]);

  // Get sorted date keys (most recent first)
  const sortedDates = useMemo(() => {
    return Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));
  }, [groupedEntries]);

  const getDateLabel = (dateString: string): string => {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return "Today";
    }
    if (isYesterday(date)) {
      return "Yesterday";
    }
    return format(date, "MMMM d, yyyy");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* New Entry Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Diary Entries</h3>
        <Button onClick={onNewEntry} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </div>

      {/* Timeline */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <div className="text-6xl mb-4">📔</div>
          <h4 className="text-lg font-semibold mb-2">No diary entries yet</h4>
          <p className="text-muted-foreground mb-4">
            Start documenting your diary cycle by adding your first entry.
          </p>
          <Button onClick={onNewEntry} disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Entry
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((dateKey, dateIndex) => {
            const dateEntries = groupedEntries[dateKey];
            const dateLabel = getDateLabel(dateKey);

            return (
              <div key={dateKey} className="relative">
                {/* Date header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="sticky top-20 z-10 bg-background px-3 py-1 rounded-full border text-sm font-medium">
                    {dateLabel}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Entries for this date */}
                <div className="space-y-4 relative pl-4">
                  {/* Timeline line */}
                  {dateIndex < sortedDates.length - 1 && (
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                  )}

                  {dateEntries.map((entry, entryIndex) => (
                    <div key={entry.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-4 top-4 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />

                      {/* Entry card */}
                      <DiaryEntryCard
                        entry={entry}
                        onEdit={onEditEntry}
                        onDelete={onDeleteEntry}
                        disabled={disabled}
                      />

                      {/* Connecting line to next entry */}
                      {entryIndex < dateEntries.length - 1 && (
                        <div className="absolute -left-4 top-6 bottom-0 w-px bg-border" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
