"use client";

import { useMemo } from "react";
import { RoomCard, RoomCardSkeleton } from "@/components/dashboard/RoomCard";
import { AddRoomCard } from "@/components/dashboard/AddRoomCard";
import { cn } from "@/lib/utils";
import type { RoomSummary } from "@/hooks/use-dashboard-data";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the GridLayout component.
 */
interface GridLayoutProps {
  /** Room summaries with sensor data and controllers */
  roomSummaries: RoomSummary[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when a room is created */
  onRoomCreated?: () => void;
  /** Optional CSS class name */
  className?: string;
  /** Number of columns on desktop (default: 3) */
  desktopColumns?: 2 | 3 | 4;
  /** Whether to show the "Add Room" card */
  showAddRoomCard?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * GridLayout Component
 *
 * Displays all rooms in an equal-sized responsive grid layout.
 * The grid adapts to screen size:
 * - Mobile: 1 column
 * - Tablet: 2 columns
 * - Desktop: 3 columns (configurable)
 *
 * All cards are uniformly sized for visual consistency.
 *
 * @example
 * ```tsx
 * <GridLayout
 *   roomSummaries={roomSummaries}
 *   isLoading={isLoading}
 *   onRoomCreated={handleRoomCreated}
 * />
 * ```
 */
export function GridLayout({
  roomSummaries,
  isLoading,
  onRoomCreated,
  className,
  desktopColumns = 3,
  showAddRoomCard = true,
}: GridLayoutProps): JSX.Element {
  /**
   * Determine grid column classes based on desktop column setting.
   */
  const gridClasses = useMemo(() => {
    const columnMap = {
      2: "xl:grid-cols-2",
      3: "xl:grid-cols-3",
      4: "xl:grid-cols-4",
    };
    return columnMap[desktopColumns];
  }, [desktopColumns]);

  /**
   * Prepare room data for rendering.
   * Combines room with its controllers for the RoomCard component.
   */
  const roomsForDisplay = useMemo(() => {
    return roomSummaries.map((summary) => ({
      ...summary.room,
      controllers: summary.controllers,
    }));
  }, [roomSummaries]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 gap-6",
          gridClasses,
          className
        )}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <RoomCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (roomSummaries.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-foreground mb-2">No rooms yet</h3>
        <p className="text-muted-foreground mb-4">
          Get started by creating your first grow room.
        </p>
        {showAddRoomCard && <AddRoomCard onRoomCreated={onRoomCreated} />}
      </div>
    );
  }

  // Grid layout
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-6",
        gridClasses,
        className
      )}
    >
      {roomsForDisplay.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
      {showAddRoomCard && <AddRoomCard onRoomCreated={onRoomCreated} />}
    </div>
  );
}

/**
 * Loading skeleton specifically for GridLayout.
 * Shows a grid of skeleton cards.
 */
export function GridLayoutSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6",
        className
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <RoomCardSkeleton key={i} />
      ))}
    </div>
  );
}
