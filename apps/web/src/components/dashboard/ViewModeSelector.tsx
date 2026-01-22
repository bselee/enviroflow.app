"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Columns, GalleryHorizontalEnd, SplitSquareHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

/**
 * Available view modes for the dashboard.
 * - primary-mini: Large primary card with mini cards for other rooms
 * - grid: Equal-sized cards in responsive grid
 * - carousel: Swipe-enabled single room view
 * - split-screen: Two rooms side-by-side for comparison
 */
export type ViewMode = "primary-mini" | "grid" | "carousel" | "split-screen";

/**
 * Props for the ViewModeSelector component.
 */
interface ViewModeSelectorProps {
  /** Currently selected view mode */
  currentMode: ViewMode;
  /** Callback when view mode changes */
  onChange: (mode: ViewMode) => void;
  /** Optional additional class names */
  className?: string;
  /** Whether to show labels alongside icons */
  showLabels?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const LOCAL_STORAGE_KEY = "enviroflow-dashboard-view-mode";
const DEFAULT_VIEW_MODE: ViewMode = "primary-mini";

/**
 * View mode configuration with icons and labels.
 */
const VIEW_MODE_CONFIG: Record<ViewMode, { icon: typeof LayoutGrid; label: string; description: string }> = {
  "primary-mini": {
    icon: Columns,
    label: "Primary",
    description: "One large card with mini cards for other rooms",
  },
  grid: {
    icon: LayoutGrid,
    label: "Grid",
    description: "All rooms in equal-sized grid",
  },
  carousel: {
    icon: GalleryHorizontalEnd,
    label: "Carousel",
    description: "Swipe through rooms one at a time",
  },
  "split-screen": {
    icon: SplitSquareHorizontal,
    label: "Compare",
    description: "Compare two rooms side-by-side",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Retrieves the stored view mode preference from localStorage.
 * Returns the default mode if no preference is stored or on SSR.
 *
 * @returns The stored view mode or default
 */
export function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return DEFAULT_VIEW_MODE;
  }

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored && isValidViewMode(stored)) {
      return stored as ViewMode;
    }
  } catch (error) {
    // localStorage may be unavailable in some contexts
    console.warn("Failed to read view mode from localStorage:", error);
  }

  return DEFAULT_VIEW_MODE;
}

/**
 * Persists the view mode preference to localStorage.
 *
 * @param mode - The view mode to store
 */
export function setStoredViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, mode);
  } catch (error) {
    console.warn("Failed to save view mode to localStorage:", error);
  }
}

/**
 * Type guard to validate if a string is a valid ViewMode.
 *
 * @param value - String to validate
 * @returns True if the value is a valid ViewMode
 */
function isValidViewMode(value: string): value is ViewMode {
  return ["primary-mini", "grid", "carousel", "split-screen"].includes(value);
}

// =============================================================================
// Component
// =============================================================================

/**
 * ViewModeSelector Component
 *
 * A segmented control component for selecting dashboard view modes.
 * Provides visual feedback for the selected mode and persists preferences
 * to localStorage for consistent user experience across sessions.
 *
 * Features:
 * - Four view mode options with icons and labels
 * - Smooth transition animations on selection change
 * - Tooltips with mode descriptions
 * - Keyboard accessible (arrow keys, enter/space)
 * - Persists selection to localStorage
 *
 * @example
 * ```tsx
 * const [viewMode, setViewMode] = useState<ViewMode>("primary-mini");
 *
 * return (
 *   <ViewModeSelector
 *     currentMode={viewMode}
 *     onChange={setViewMode}
 *   />
 * );
 * ```
 */
export function ViewModeSelector({
  currentMode,
  onChange,
  className,
  showLabels = false,
}: ViewModeSelectorProps): JSX.Element {
  /**
   * Handles mode change, updating both state and localStorage.
   */
  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      if (mode !== currentMode) {
        setStoredViewMode(mode);
        onChange(mode);
      }
    },
    [currentMode, onChange]
  );

  /**
   * Handles keyboard navigation within the selector.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      const modes: ViewMode[] = ["primary-mini", "grid", "carousel", "split-screen"];

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % modes.length;
        handleModeChange(modes[nextIndex]);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + modes.length) % modes.length;
        handleModeChange(modes[prevIndex]);
      }
    },
    [handleModeChange]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "inline-flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/50",
          className
        )}
        role="radiogroup"
        aria-label="Dashboard view mode"
      >
        {(Object.entries(VIEW_MODE_CONFIG) as [ViewMode, typeof VIEW_MODE_CONFIG[ViewMode]][]).map(
          ([mode, config], index) => {
            const Icon = config.icon;
            const isSelected = currentMode === mode;

            return (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <button
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={config.label}
                    onClick={() => handleModeChange(mode)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
                      "transition-all duration-200 ease-out",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isSelected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {showLabels && <span>{config.label}</span>}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          }
        )}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// Hook: useViewMode
// =============================================================================

/**
 * Custom hook for managing dashboard view mode state.
 *
 * Handles initialization from localStorage, state management,
 * and automatic persistence of changes.
 *
 * @param initialMode - Optional initial mode (defaults to stored or "primary-mini")
 * @returns Tuple of [currentMode, setMode]
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const [viewMode, setViewMode] = useViewMode();
 *
 *   return (
 *     <ViewModeSelector currentMode={viewMode} onChange={setViewMode} />
 *   );
 * }
 * ```
 */
export function useViewMode(initialMode?: ViewMode): [ViewMode, (mode: ViewMode) => void] {
  // Use provided initial mode or load from storage
  // Note: We use a function initializer to avoid hydration mismatch
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (initialMode) return initialMode;
    // On SSR, return default; client will hydrate from localStorage
    if (typeof window === "undefined") return DEFAULT_VIEW_MODE;
    return getStoredViewMode();
  });

  // Sync with localStorage on mount (handles SSR hydration)
  useEffect(() => {
    if (!initialMode) {
      const storedMode = getStoredViewMode();
      if (storedMode !== mode) {
        setModeState(storedMode);
      }
    }
  }, [initialMode, mode]);

  /**
   * Sets the view mode and persists to localStorage.
   */
  const setMode = useCallback((newMode: ViewMode) => {
    setStoredViewMode(newMode);
    setModeState(newMode);
  }, []);

  return [mode, setMode];
}
