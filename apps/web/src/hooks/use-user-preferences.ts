"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { ApiResponse } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Temperature unit preference.
 */
export type TemperatureUnit = "F" | "C";

/**
 * Dashboard view mode preference.
 */
export type ViewMode = "primary-mini" | "grid" | "carousel" | "split-screen";

/**
 * Animation quality preference.
 */
export type AnimationQuality = "auto" | "full" | "reduced" | "minimal";

/**
 * Primary metric preference for dashboard display.
 */
export type PrimaryMetric = "vpd" | "temperature" | "humidity" | "co2";

/**
 * Available metrics for timeline display.
 */
export type TimelineMetric = "vpd" | "temperature" | "humidity" | "co2" | "light";

/**
 * Tolerance/threshold configuration for a metric.
 */
export interface MetricTolerance {
  vpd: number;
  temp: number;
  humidity: number;
}

/**
 * Room-specific preferences for optimal ranges and tolerances.
 */
export interface RoomPreferences {
  /** Optimal VPD range [min, max] in kPa */
  optimalVPD: [number, number];
  /** Optimal temperature range [min, max] in Fahrenheit */
  optimalTemp: [number, number];
  /** Optimal humidity range [min, max] as percentage */
  optimalHumidity: [number, number];
  /** Warning tolerance for each metric (triggers yellow status) */
  warningTolerance: MetricTolerance;
  /** Alert threshold for each metric (triggers red status) */
  alertThreshold: MetricTolerance;
}

/**
 * Complete user preferences structure.
 */
export interface UserPreferences {
  /** Temperature display unit */
  temperatureUnit: TemperatureUnit;
  /** Dashboard view mode */
  viewMode: ViewMode;
  /** Animation quality setting */
  animationQuality: AnimationQuality;
  /** Primary metric for dashboard focus */
  primaryMetric: PrimaryMetric;
  /** Metrics visible on the timeline chart */
  timelineMetrics: TimelineMetric[];
  /** Per-room preferences, keyed by room ID */
  roomSettings: Record<string, RoomPreferences>;
}

/**
 * Hook return type with all preference operations and state.
 */
export interface UseUserPreferencesReturn {
  /** Current user preferences */
  preferences: UserPreferences;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Saving state for updates */
  isSaving: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Update a single preference value */
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  /** Update room-specific preferences */
  updateRoomPreferences: (roomId: string, prefs: Partial<RoomPreferences>) => void;
  /** Get preferences for a specific room (with defaults) */
  getRoomPreferences: (roomId: string) => RoomPreferences;
  /** Reset room preferences to defaults */
  resetRoomPreferences: (roomId: string) => void;
  /** Reset all preferences to defaults */
  resetAllPreferences: () => void;
  /** Force save preferences to server */
  savePreferences: () => Promise<ApiResponse<void>>;
  /** Refresh preferences from server */
  refetch: () => Promise<void>;
}

// =============================================================================
// Constants & Defaults
// =============================================================================

/**
 * Local storage key for caching preferences.
 */
const STORAGE_KEY = "enviroflow_user_preferences";

/**
 * Debounce delay in milliseconds for syncing to server.
 */
const SYNC_DEBOUNCE_MS = 1000;

/**
 * Default room preferences values.
 */
export const DEFAULT_ROOM_PREFERENCES: RoomPreferences = {
  optimalVPD: [0.8, 1.2],
  optimalTemp: [70, 85],
  optimalHumidity: [50, 70],
  warningTolerance: {
    vpd: 0.2,
    temp: 2,
    humidity: 5,
  },
  alertThreshold: {
    vpd: 0.3,
    temp: 5,
    humidity: 10,
  },
};

/**
 * Default user preferences values.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  temperatureUnit: "F",
  viewMode: "primary-mini",
  animationQuality: "auto",
  primaryMetric: "vpd",
  timelineMetrics: ["vpd", "temperature", "humidity"],
  roomSettings: {},
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Validates and merges partial preferences with defaults.
 * Ensures all required fields are present with valid values.
 */
function validatePreferences(partial: Partial<UserPreferences>): UserPreferences {
  return {
    temperatureUnit: partial.temperatureUnit ?? DEFAULT_USER_PREFERENCES.temperatureUnit,
    viewMode: partial.viewMode ?? DEFAULT_USER_PREFERENCES.viewMode,
    animationQuality: partial.animationQuality ?? DEFAULT_USER_PREFERENCES.animationQuality,
    primaryMetric: partial.primaryMetric ?? DEFAULT_USER_PREFERENCES.primaryMetric,
    timelineMetrics: partial.timelineMetrics ?? DEFAULT_USER_PREFERENCES.timelineMetrics,
    roomSettings: partial.roomSettings ?? DEFAULT_USER_PREFERENCES.roomSettings,
  };
}

/**
 * Merges room preferences with defaults.
 */
function mergeRoomPreferences(partial: Partial<RoomPreferences>): RoomPreferences {
  return {
    optimalVPD: partial.optimalVPD ?? DEFAULT_ROOM_PREFERENCES.optimalVPD,
    optimalTemp: partial.optimalTemp ?? DEFAULT_ROOM_PREFERENCES.optimalTemp,
    optimalHumidity: partial.optimalHumidity ?? DEFAULT_ROOM_PREFERENCES.optimalHumidity,
    warningTolerance: {
      ...DEFAULT_ROOM_PREFERENCES.warningTolerance,
      ...partial.warningTolerance,
    },
    alertThreshold: {
      ...DEFAULT_ROOM_PREFERENCES.alertThreshold,
      ...partial.alertThreshold,
    },
  };
}

/**
 * Loads preferences from localStorage.
 * Returns null if no cached preferences exist.
 */
function loadFromStorage(): UserPreferences | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<UserPreferences>;
    return validatePreferences(parsed);
  } catch (err) {
    console.warn("Failed to load preferences from localStorage:", err);
    return null;
  }
}

/**
 * Saves preferences to localStorage.
 */
function saveToStorage(preferences: UserPreferences): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.warn("Failed to save preferences to localStorage:", err);
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Custom hook for managing user preferences.
 *
 * Features:
 * - Fetches preferences from Supabase user metadata
 * - Caches in localStorage for offline access
 * - Debounced sync to server on changes
 * - Provides defaults for missing preferences
 *
 * @example
 * ```tsx
 * const { preferences, updatePreference, getRoomPreferences } = useUserPreferences();
 *
 * // Update temperature unit
 * updatePreference("temperatureUnit", "C");
 *
 * // Get room-specific preferences
 * const roomPrefs = getRoomPreferences(roomId);
 * ```
 */
export function useUserPreferences(): UseUserPreferencesReturn {
  // Initialize with cached preferences or defaults
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const cached = loadFromStorage();
    return cached ?? DEFAULT_USER_PREFERENCES;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track pending changes for debounced sync
  const pendingChanges = useRef(false);
  const syncTimeout = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetches preferences from Supabase user metadata.
   */
  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        // Not authenticated - use cached or defaults
        const cached = loadFromStorage();
        if (cached) {
          setPreferences(cached);
        }
        return;
      }

      // Get preferences from user metadata
      const serverPrefs = user.user_metadata?.dashboard_preferences as Partial<UserPreferences> | undefined;

      if (serverPrefs) {
        const validated = validatePreferences(serverPrefs);
        setPreferences(validated);
        saveToStorage(validated);
      } else {
        // No server preferences, use cached or defaults
        const cached = loadFromStorage();
        if (cached) {
          setPreferences(cached);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch preferences";
      setError(message);
      console.error("useUserPreferences fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Saves preferences to Supabase user metadata.
   */
  const syncToServer = useCallback(async (prefsToSync: UserPreferences): Promise<ApiResponse<void>> => {
    try {
      setIsSaving(true);
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          dashboard_preferences: prefsToSync,
        },
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      pendingChanges.current = false;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save preferences";
      setError(message);
      console.error("useUserPreferences sync error:", err);
      return { success: false, error: message };
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Schedules a debounced sync to the server.
   */
  const scheduleSyncToServer = useCallback((newPrefs: UserPreferences) => {
    pendingChanges.current = true;

    if (syncTimeout.current) {
      clearTimeout(syncTimeout.current);
    }

    syncTimeout.current = setTimeout(() => {
      syncToServer(newPrefs);
    }, SYNC_DEBOUNCE_MS);
  }, [syncToServer]);

  /**
   * Updates a single preference value.
   */
  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      saveToStorage(updated);
      scheduleSyncToServer(updated);
      return updated;
    });
  }, [scheduleSyncToServer]);

  /**
   * Updates room-specific preferences.
   */
  const updateRoomPreferences = useCallback((roomId: string, prefs: Partial<RoomPreferences>) => {
    setPreferences((prev) => {
      const existingRoomPrefs = prev.roomSettings[roomId] ?? DEFAULT_ROOM_PREFERENCES;
      const mergedRoomPrefs = mergeRoomPreferences({
        ...existingRoomPrefs,
        ...prefs,
      });

      const updated: UserPreferences = {
        ...prev,
        roomSettings: {
          ...prev.roomSettings,
          [roomId]: mergedRoomPrefs,
        },
      };

      saveToStorage(updated);
      scheduleSyncToServer(updated);
      return updated;
    });
  }, [scheduleSyncToServer]);

  /**
   * Gets preferences for a specific room, with defaults applied.
   */
  const getRoomPreferences = useCallback((roomId: string): RoomPreferences => {
    const roomPrefs = preferences.roomSettings[roomId];
    return roomPrefs ? mergeRoomPreferences(roomPrefs) : DEFAULT_ROOM_PREFERENCES;
  }, [preferences.roomSettings]);

  /**
   * Resets room preferences to defaults.
   */
  const resetRoomPreferences = useCallback((roomId: string) => {
    setPreferences((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [roomId]: _, ...remainingRoomSettings } = prev.roomSettings;

      const updated: UserPreferences = {
        ...prev,
        roomSettings: remainingRoomSettings,
      };

      saveToStorage(updated);
      scheduleSyncToServer(updated);
      return updated;
    });
  }, [scheduleSyncToServer]);

  /**
   * Resets all preferences to defaults.
   */
  const resetAllPreferences = useCallback(() => {
    setPreferences(DEFAULT_USER_PREFERENCES);
    saveToStorage(DEFAULT_USER_PREFERENCES);
    scheduleSyncToServer(DEFAULT_USER_PREFERENCES);
  }, [scheduleSyncToServer]);

  /**
   * Forces an immediate save to the server.
   */
  const savePreferences = useCallback(async (): Promise<ApiResponse<void>> => {
    if (syncTimeout.current) {
      clearTimeout(syncTimeout.current);
      syncTimeout.current = null;
    }
    return syncToServer(preferences);
  }, [preferences, syncToServer]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
      }
    };
  }, []);

  // Memoize return object for stable reference
  return useMemo(() => ({
    preferences,
    isLoading,
    isSaving,
    error,
    updatePreference,
    updateRoomPreferences,
    getRoomPreferences,
    resetRoomPreferences,
    resetAllPreferences,
    savePreferences,
    refetch: fetchPreferences,
  }), [
    preferences,
    isLoading,
    isSaving,
    error,
    updatePreference,
    updateRoomPreferences,
    getRoomPreferences,
    resetRoomPreferences,
    resetAllPreferences,
    savePreferences,
    fetchPreferences,
  ]);
}

// =============================================================================
// Helper Functions for Status Calculation
// =============================================================================

/**
 * Status level for environmental metrics.
 */
export type MetricStatus = "optimal" | "warning" | "alert";

/**
 * Calculates the status level for a VPD value based on room preferences.
 *
 * @param value - Current VPD value in kPa
 * @param roomPrefs - Room preferences with optimal ranges and tolerances
 * @returns Status level: "optimal", "warning", or "alert"
 */
export function calculateVPDStatus(value: number, roomPrefs: RoomPreferences): MetricStatus {
  const [min, max] = roomPrefs.optimalVPD;
  const warning = roomPrefs.warningTolerance.vpd;
  const alert = roomPrefs.alertThreshold.vpd;

  // Within optimal range
  if (value >= min && value <= max) {
    return "optimal";
  }

  // Calculate distance from optimal range
  const distanceFromOptimal = value < min ? min - value : value - max;

  // Beyond alert threshold
  if (distanceFromOptimal >= alert) {
    return "alert";
  }

  // Beyond warning threshold
  if (distanceFromOptimal >= warning) {
    return "warning";
  }

  return "optimal";
}

/**
 * Calculates the status level for a temperature value based on room preferences.
 *
 * @param value - Current temperature value in Fahrenheit
 * @param roomPrefs - Room preferences with optimal ranges and tolerances
 * @returns Status level: "optimal", "warning", or "alert"
 */
export function calculateTempStatus(value: number, roomPrefs: RoomPreferences): MetricStatus {
  const [min, max] = roomPrefs.optimalTemp;
  const warning = roomPrefs.warningTolerance.temp;
  const alert = roomPrefs.alertThreshold.temp;

  if (value >= min && value <= max) {
    return "optimal";
  }

  const distanceFromOptimal = value < min ? min - value : value - max;

  if (distanceFromOptimal >= alert) {
    return "alert";
  }

  if (distanceFromOptimal >= warning) {
    return "warning";
  }

  return "optimal";
}

/**
 * Calculates the status level for a humidity value based on room preferences.
 *
 * @param value - Current humidity value as percentage
 * @param roomPrefs - Room preferences with optimal ranges and tolerances
 * @returns Status level: "optimal", "warning", or "alert"
 */
export function calculateHumidityStatus(value: number, roomPrefs: RoomPreferences): MetricStatus {
  const [min, max] = roomPrefs.optimalHumidity;
  const warning = roomPrefs.warningTolerance.humidity;
  const alert = roomPrefs.alertThreshold.humidity;

  if (value >= min && value <= max) {
    return "optimal";
  }

  const distanceFromOptimal = value < min ? min - value : value - max;

  if (distanceFromOptimal >= alert) {
    return "alert";
  }

  if (distanceFromOptimal >= warning) {
    return "warning";
  }

  return "optimal";
}

/**
 * Gets the CSS color class for a metric status.
 *
 * @param status - The metric status level
 * @returns Tailwind CSS class for the status color
 */
export function getStatusColorClass(status: MetricStatus): string {
  switch (status) {
    case "optimal":
      return "text-success";
    case "warning":
      return "text-warning";
    case "alert":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Gets the CSS background color class for a metric status.
 *
 * @param status - The metric status level
 * @returns Tailwind CSS class for the status background color
 */
export function getStatusBgClass(status: MetricStatus): string {
  switch (status) {
    case "optimal":
      return "bg-success/10";
    case "warning":
      return "bg-warning/10";
    case "alert":
      return "bg-destructive/10";
    default:
      return "bg-muted";
  }
}
