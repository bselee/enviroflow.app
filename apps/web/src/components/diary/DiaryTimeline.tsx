"use client";

import { useMemo, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Plus, Search, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DiaryEntryCard } from "@/components/diary/DiaryEntryCard";
import type { DiaryEntryWithPhotos, DiaryEntryTag } from "@/types";
import { cn } from "@/lib/utils";

interface DiaryTimelineProps {
  entries: DiaryEntryWithPhotos[];
  onNewEntry: () => void;
  onEditEntry: (entry: DiaryEntryWithPhotos) => void;
  onDeleteEntry: (entryId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

const TAG_FILTERS: { value: DiaryEntryTag; label: string; icon: string; activeClass: string }[] = [
  { value: "watering", label: "Watering", icon: "💧", activeClass: "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-400" },
  { value: "feeding", label: "Feeding", icon: "🌱", activeClass: "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400" },
  { value: "training", label: "Training", icon: "✂️", activeClass: "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-400" },
  { value: "issue", label: "Issue", icon: "⚠️", activeClass: "bg-red-500/20 border-red-500 text-red-700 dark:text-red-400" },
  { value: "milestone", label: "Milestone", icon: "🎯", activeClass: "bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-400" },
  { value: "observation", label: "Observation", icon: "👁️", activeClass: "bg-gray-500/20 border-gray-500 text-gray-700 dark:text-gray-400" },
  { value: "harvest", label: "Harvest", icon: "🌾", activeClass: "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400" },
];

/**
 * Timeline layout for diary entries grouped by date.
 * Includes search, tag filtering, and sort controls.
 */
export function DiaryTimeline({
  entries,
  onNewEntry,
  onEditEntry,
  onDeleteEntry,
  loading = false,
  disabled = false,
}: DiaryTimelineProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<DiaryEntryTag[]>([]);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const toggleTag = (tag: DiaryEntryTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
  };

  const hasFilters = searchQuery.trim().length > 0 || selectedTags.length > 0;

  // Filter entries by search query and tags
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((entry) =>
        entry.tags?.some((tag) => selectedTags.includes(tag as DiaryEntryTag))
      );
    }

    // Search filter (title + content text)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((entry) => {
        const titleMatch = entry.title?.toLowerCase().includes(query);
        const contentText = entry.content?.replace(/<[^>]*>/g, "").toLowerCase();
        const contentMatch = contentText?.includes(query);
        return titleMatch || contentMatch;
      });
    }

    return filtered;
  }, [entries, selectedTags, searchQuery]);

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, DiaryEntryWithPhotos[]> = {};

    filteredEntries.forEach((entry) => {
      const date = parseISO(entry.entry_date);
      const dateKey = format(date, "yyyy-MM-dd");

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });

    // Sort each group by time
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => {
        const diff = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
        return sortNewestFirst ? -diff : diff;
      });
    });

    return groups;
  }, [filteredEntries, sortNewestFirst]);

  // Get sorted date keys
  const sortedDates = useMemo(() => {
    return Object.keys(groupedEntries).sort((a, b) =>
      sortNewestFirst ? b.localeCompare(a) : a.localeCompare(b)
    );
  }, [groupedEntries, sortNewestFirst]);

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
      {/* Header with entry count */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Diary Entries
          {entries.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({hasFilters ? `${filteredEntries.length} of ${entries.length}` : entries.length})
            </span>
          )}
        </h3>
        <Button onClick={onNewEntry} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </div>

      {/* Search + Sort toolbar (only show when there are entries) */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortNewestFirst(!sortNewestFirst)}
              className="h-9 gap-1.5 shrink-0"
              title={sortNewestFirst ? "Showing newest first" : "Showing oldest first"}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{sortNewestFirst ? "Newest" : "Oldest"}</span>
            </Button>
          </div>

          {/* Tag filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {TAG_FILTERS.map((tag) => {
              const isActive = selectedTags.includes(tag.value);
              return (
                <Badge
                  key={tag.value}
                  variant="outline"
                  className={cn(
                    "cursor-pointer select-none transition-colors",
                    isActive ? tag.activeClass : "hover:bg-accent"
                  )}
                  onClick={() => toggleTag(tag.value)}
                >
                  <span className="mr-1">{tag.icon}</span>
                  {tag.label}
                </Badge>
              );
            })}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      {sortedDates.length === 0 && !hasFilters ? (
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
      ) : sortedDates.length === 0 && hasFilters ? (
        <div className="text-center py-8 rounded-lg border border-dashed">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-muted-foreground mb-2">No entries match your filters</p>
          <button
            onClick={clearFilters}
            className="text-sm text-primary hover:underline"
          >
            Clear filters
          </button>
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
