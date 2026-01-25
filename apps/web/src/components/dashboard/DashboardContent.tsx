"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ViewModeSelector, useViewMode, type ViewMode } from "./ViewModeSelector";
import { PrimaryMiniLayout } from "./layouts/PrimaryMiniLayout";
import { GridLayout } from "./layouts/GridLayout";
import { CarouselLayout } from "./layouts/CarouselLayout";
import { SplitScreenLayout } from "./layouts/SplitScreenLayout";
import type { RoomSummary } from "@/hooks/use-dashboard-data";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the DashboardContent component.
 */
interface DashboardContentProps {
  /** Room summaries with sensor data and controllers */
  roomSummaries: RoomSummary[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when a room is created */
  onRoomCreated?: () => void;
  /** Optional initial view mode (overrides stored preference) */
  initialViewMode?: ViewMode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Layout state persisted across view mode switches.
 */
interface LayoutState {
  /** Primary room ID for primary-mini layout */
  primaryRoomId: string | null;
  /** Current carousel index */
  carouselIndex: number;
  /** Left room ID for split-screen layout */
  splitLeftRoomId: string | null;
  /** Right room ID for split-screen layout */
  splitRightRoomId: string | null;
  /** Whether split-screen timelines are synced */
  splitTimelinesSynced: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const TRANSITION_DURATION = 300; // ms
const LOCAL_STORAGE_LAYOUT_STATE_KEY = "enviroflow-dashboard-layout-state";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Loads persisted layout state from localStorage.
 */
function loadLayoutState(): LayoutState {
  const defaultState: LayoutState = {
    primaryRoomId: null,
    carouselIndex: 0,
    splitLeftRoomId: null,
    splitRightRoomId: null,
    splitTimelinesSynced: true,
  };

  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_LAYOUT_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultState, ...parsed };
    }
  } catch (error) {
    console.warn("Failed to load layout state from localStorage:", error);
  }

  return defaultState;
}

/**
 * Persists layout state to localStorage.
 */
function saveLayoutState(state: LayoutState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_LAYOUT_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to save layout state to localStorage:", error);
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * DashboardContent Component
 *
 * A wrapper component that renders the appropriate layout based on the selected
 * view mode. Handles smooth transitions between modes and maintains state
 * (selected rooms, carousel position, etc.) across mode switches.
 *
 * Features:
 * - Smooth 300ms morph animations between layouts
 * - Maintains room selection when switching modes
 * - Persists layout state to localStorage
 * - Automatically selects appropriate rooms when data changes
 * - Responsive behavior with mobile-optimized carousel default
 *
 * @example
 * ```tsx
 * const { roomSummaries, isLoading } = useDashboardData();
 *
 * return (
 *   <DashboardContent
 *     roomSummaries={roomSummaries}
 *     isLoading={isLoading}
 *     onRoomCreated={handleRefresh}
 *   />
 * );
 * ```
 */
export function DashboardContent({
  roomSummaries,
  isLoading,
  onRoomCreated,
  initialViewMode,
  className,
}: DashboardContentProps): JSX.Element {
  // View mode state with localStorage persistence
  // Note: useViewMode handles its own localStorage sync
  const [viewMode, setViewMode] = useViewMode(initialViewMode);

  // Layout state for maintaining selections across mode switches
  const [layoutState, setLayoutState] = useState<LayoutState>(loadLayoutState);

  // Track if we're in a transition
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Previous view mode for transition animation
  const prevViewModeRef = useRef<ViewMode>(viewMode);

  /**
   * Initialize room selections when data loads.
   */
  useEffect(() => {
    if (roomSummaries.length > 0 && !layoutState.primaryRoomId) {
      setLayoutState((prev) => {
        const newState = {
          ...prev,
          primaryRoomId: roomSummaries[0].room.id,
          splitLeftRoomId: roomSummaries[0].room.id,
          splitRightRoomId: roomSummaries.length > 1 ? roomSummaries[1].room.id : null,
        };
        saveLayoutState(newState);
        return newState;
      });
    }
  }, [roomSummaries, layoutState.primaryRoomId]);

  /**
   * Handle view mode change with transition animation.
   */
  const handleViewModeChange = useCallback(
    (newMode: ViewMode) => {
      if (newMode === viewMode) return;

      // Start transition
      setIsTransitioning(true);

      // Clear any existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      // Change mode after a brief fade-out
      transitionTimeoutRef.current = setTimeout(() => {
        prevViewModeRef.current = viewMode;
        setViewMode(newMode);

        // End transition after animation completes
        transitionTimeoutRef.current = setTimeout(() => {
          setIsTransitioning(false);
        }, TRANSITION_DURATION / 2);
      }, TRANSITION_DURATION / 2);
    },
    [viewMode, setViewMode]
  );

  /**
   * Update layout state and persist to storage.
   */
  const updateLayoutState = useCallback((updates: Partial<LayoutState>) => {
    setLayoutState((prev) => {
      const newState = { ...prev, ...updates };
      saveLayoutState(newState);
      return newState;
    });
  }, []);

  /**
   * Handlers for individual layout components.
   */
  const handlePrimaryRoomChange = useCallback(
    (roomId: string) => {
      updateLayoutState({ primaryRoomId: roomId });
    },
    [updateLayoutState]
  );

  const handleCarouselIndexChange = useCallback(
    (index: number) => {
      updateLayoutState({ carouselIndex: index });
      // Also update primary room to keep in sync
      if (roomSummaries[index]) {
        updateLayoutState({
          carouselIndex: index,
          primaryRoomId: roomSummaries[index].room.id,
        });
      }
    },
    [updateLayoutState, roomSummaries]
  );

  const handleSplitLeftRoomChange = useCallback(
    (roomId: string) => {
      updateLayoutState({ splitLeftRoomId: roomId });
    },
    [updateLayoutState]
  );

  const handleSplitRightRoomChange = useCallback(
    (roomId: string) => {
      updateLayoutState({ splitRightRoomId: roomId });
    },
    [updateLayoutState]
  );

  const handleSplitSyncToggle = useCallback(
    (synced: boolean) => {
      updateLayoutState({ splitTimelinesSynced: synced });
    },
    [updateLayoutState]
  );

  /**
   * Cleanup timeout on unmount.
   */
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Determine the carousel index based on the primary room.
   */
  const currentCarouselIndex = useMemo(() => {
    if (layoutState.primaryRoomId && roomSummaries.length > 0) {
      const index = roomSummaries.findIndex(
        (s) => s.room.id === layoutState.primaryRoomId
      );
      return index >= 0 ? index : 0;
    }
    return layoutState.carouselIndex;
  }, [layoutState.primaryRoomId, layoutState.carouselIndex, roomSummaries]);

  /**
   * Render the appropriate layout based on view mode.
   */
  const renderLayout = (): JSX.Element => {
    switch (viewMode) {
      case "primary-mini":
        return (
          <PrimaryMiniLayout
            roomSummaries={roomSummaries}
            primaryRoomId={layoutState.primaryRoomId}
            onPrimaryRoomChange={handlePrimaryRoomChange}
            isLoading={isLoading}
            onRoomCreated={onRoomCreated}
          />
        );

      case "grid":
        return (
          <GridLayout
            roomSummaries={roomSummaries}
            isLoading={isLoading}
            onRoomCreated={onRoomCreated}
          />
        );

      case "carousel":
        return (
          <CarouselLayout
            roomSummaries={roomSummaries}
            currentIndex={currentCarouselIndex}
            onIndexChange={handleCarouselIndexChange}
            isLoading={isLoading}
            onRoomCreated={onRoomCreated}
          />
        );

      case "split-screen":
        return (
          <SplitScreenLayout
            roomSummaries={roomSummaries}
            leftRoomId={layoutState.splitLeftRoomId}
            rightRoomId={layoutState.splitRightRoomId}
            onLeftRoomChange={handleSplitLeftRoomChange}
            onRightRoomChange={handleSplitRightRoomChange}
            isLoading={isLoading}
            syncTimelines={layoutState.splitTimelinesSynced}
            onSyncToggle={handleSplitSyncToggle}
          />
        );

      default:
        // Fallback to grid
        return (
          <GridLayout
            roomSummaries={roomSummaries}
            isLoading={isLoading}
            onRoomCreated={onRoomCreated}
          />
        );
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* View Mode Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Rooms</h2>
        <ViewModeSelector
          currentMode={viewMode}
          onChange={handleViewModeChange}
        />
      </div>

      {/* Layout Container with Transition */}
      <div
        className={cn(
          "transition-all ease-out",
          isTransitioning
            ? "opacity-0 transform scale-98"
            : "opacity-100 transform scale-100"
        )}
        style={{ transitionDuration: `${TRANSITION_DURATION / 2}ms` }}
      >
        {renderLayout()}
      </div>
    </div>
  );
}

/**
 * Export all layout components for direct use if needed.
 */
export { ViewModeSelector, useViewMode } from "./ViewModeSelector";
export { PrimaryMiniLayout } from "./layouts/PrimaryMiniLayout";
export { GridLayout, GridLayoutSkeleton } from "./layouts/GridLayout";
export { CarouselLayout } from "./layouts/CarouselLayout";
export { SplitScreenLayout } from "./layouts/SplitScreenLayout";
export type { ViewMode } from "./ViewModeSelector";
