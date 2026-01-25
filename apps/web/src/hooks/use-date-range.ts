"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import {
  addDays,
  startOfDay,
  endOfDay,
  startOfYear,
  parseISO,
  isValid,
} from "date-fns";
import type { DateRangePreset, DateRangeValue } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Return type for the useDateRange hook.
 */
export interface UseDateRangeReturn {
  /** Current date range value */
  range: DateRangeValue;
  /** Set a preset date range */
  setPreset: (preset: DateRangePreset) => void;
  /** Set a custom date range */
  setCustomRange: (from: Date, to: Date) => void;
  /** Set the full date range value */
  setRange: (range: DateRangeValue) => void;
  /** Reset to default preset */
  reset: () => void;
  /** Current preset (if any) */
  currentPreset: DateRangePreset;
  /** Check if using a preset */
  isPreset: boolean;
  /** Check if using custom range */
  isCustom: boolean;
}

/**
 * Options for the useDateRange hook.
 */
export interface UseDateRangeOptions {
  /** Default preset to use (default: "7d") */
  defaultPreset?: DateRangePreset;
  /** Whether to persist in URL params (default: true) */
  persistInUrl?: boolean;
  /** URL param key (default: "range") */
  urlParamKey?: string;
  /** Callback when range changes */
  onChange?: (range: DateRangeValue) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculates the date range for a given preset.
 */
function calculateRangeFromPreset(preset: DateRangePreset): DateRangeValue {
  const now = new Date();

  switch (preset) {
    case "today":
      return {
        from: startOfDay(now),
        to: endOfDay(now),
        preset: "today",
      };

    case "7d":
      return {
        from: startOfDay(addDays(now, -6)),
        to: endOfDay(now),
        preset: "7d",
      };

    case "30d":
      return {
        from: startOfDay(addDays(now, -29)),
        to: endOfDay(now),
        preset: "30d",
      };

    case "90d":
      return {
        from: startOfDay(addDays(now, -89)),
        to: endOfDay(now),
        preset: "90d",
      };

    case "ytd":
      return {
        from: startOfYear(now),
        to: endOfDay(now),
        preset: "ytd",
      };

    case "custom":
      // Default to last 7 days for custom
      return {
        from: startOfDay(addDays(now, -6)),
        to: endOfDay(now),
        preset: "custom",
      };

    default:
      // Fallback to 7d
      return {
        from: startOfDay(addDays(now, -6)),
        to: endOfDay(now),
        preset: "7d",
      };
  }
}

/**
 * Parses date range from URL params.
 * Supports both preset format ("7d") and custom format ("2024-01-01,2024-01-31").
 */
function parseRangeFromUrl(paramValue: string | null): DateRangeValue | null {
  if (!paramValue) return null;

  // Check if it's a preset
  const presets: DateRangePreset[] = ["today", "7d", "30d", "90d", "ytd"];
  if (presets.includes(paramValue as DateRangePreset)) {
    return calculateRangeFromPreset(paramValue as DateRangePreset);
  }

  // Try to parse as custom range (format: "YYYY-MM-DD,YYYY-MM-DD")
  const parts = paramValue.split(",");
  if (parts.length === 2) {
    const from = parseISO(parts[0]);
    const to = parseISO(parts[1]);

    if (isValid(from) && isValid(to)) {
      return {
        from: startOfDay(from),
        to: endOfDay(to),
        preset: "custom",
      };
    }
  }

  return null;
}

/**
 * Serializes date range to URL param format.
 */
function serializeRangeToUrl(range: DateRangeValue): string {
  if (range.preset && range.preset !== "custom") {
    return range.preset;
  }

  // Custom range: serialize as "YYYY-MM-DD,YYYY-MM-DD"
  const fromStr = range.from.toISOString().split("T")[0];
  const toStr = range.to.toISOString().split("T")[0];
  return `${fromStr},${toStr}`;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Custom hook for managing date range state with URL persistence.
 *
 * Features:
 * - Preset date ranges (Today, Last 7/30/90 days, YTD)
 * - Custom date range selection
 * - URL parameter persistence for shareable links
 * - Automatic URL sync without page reload
 *
 * @param options - Configuration options
 * @returns Date range state and control functions
 *
 * @example
 * ```tsx
 * const { range, setPreset, setCustomRange } = useDateRange({
 *   defaultPreset: "30d",
 *   persistInUrl: true,
 *   onChange: (range) => {
 *     console.log("Range changed:", range);
 *   }
 * });
 *
 * // Use preset
 * setPreset("7d");
 *
 * // Use custom range
 * setCustomRange(new Date("2024-01-01"), new Date("2024-01-31"));
 * ```
 */
export function useDateRange(options: UseDateRangeOptions = {}): UseDateRangeReturn {
  const {
    defaultPreset = "7d",
    persistInUrl = true,
    urlParamKey = "range",
    onChange,
  } = options;

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize range from URL or default preset
  const initialRange = useMemo(() => {
    if (persistInUrl) {
      const urlRange = parseRangeFromUrl(searchParams.get(urlParamKey));
      if (urlRange) return urlRange;
    }
    return calculateRangeFromPreset(defaultPreset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const [range, setRangeState] = useState<DateRangeValue>(initialRange);

  /**
   * Updates URL params with new range.
   */
  const updateUrlParams = useCallback(
    (newRange: DateRangeValue) => {
      if (!persistInUrl) return;

      const params = new URLSearchParams(searchParams);
      params.set(urlParamKey, serializeRangeToUrl(newRange));

      // Use router.replace to avoid adding to history
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [persistInUrl, searchParams, pathname, router, urlParamKey]
  );

  /**
   * Sets a preset date range.
   */
  const setPreset = useCallback(
    (preset: DateRangePreset) => {
      const newRange = calculateRangeFromPreset(preset);
      setRangeState(newRange);
      updateUrlParams(newRange);
      onChange?.(newRange);
    },
    [updateUrlParams, onChange]
  );

  /**
   * Sets a custom date range.
   */
  const setCustomRange = useCallback(
    (from: Date, to: Date) => {
      const newRange: DateRangeValue = {
        from: startOfDay(from),
        to: endOfDay(to),
        preset: "custom",
      };
      setRangeState(newRange);
      updateUrlParams(newRange);
      onChange?.(newRange);
    },
    [updateUrlParams, onChange]
  );

  /**
   * Sets the full date range value.
   */
  const setRange = useCallback(
    (newRange: DateRangeValue) => {
      setRangeState(newRange);
      updateUrlParams(newRange);
      onChange?.(newRange);
    },
    [updateUrlParams, onChange]
  );

  /**
   * Resets to default preset.
   */
  const reset = useCallback(() => {
    setPreset(defaultPreset);
  }, [setPreset, defaultPreset]);

  // Sync with URL changes (e.g., browser back/forward)
  useEffect(() => {
    if (!persistInUrl) return;

    const urlRange = parseRangeFromUrl(searchParams.get(urlParamKey));
    if (urlRange) {
      // Only update if different from current range
      const currentUrlValue = serializeRangeToUrl(range);
      const newUrlValue = searchParams.get(urlParamKey);

      if (currentUrlValue !== newUrlValue) {
        setRangeState(urlRange);
        onChange?.(urlRange);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, persistInUrl, urlParamKey]);

  return {
    range,
    setPreset,
    setCustomRange,
    setRange,
    reset,
    currentPreset: range.preset || "custom",
    isPreset: Boolean(range.preset && range.preset !== "custom"),
    isCustom: range.preset === "custom",
  };
}

/**
 * Hook variant that returns time range in hours (for backward compatibility).
 * Converts the date range to hours for use with existing APIs.
 */
export function useDateRangeAsHours(options: UseDateRangeOptions = {}) {
  const dateRange = useDateRange(options);

  const timeRangeHours = useMemo(() => {
    const diffMs = dateRange.range.to.getTime() - dateRange.range.from.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60));
  }, [dateRange.range]);

  return {
    ...dateRange,
    timeRangeHours,
  };
}
