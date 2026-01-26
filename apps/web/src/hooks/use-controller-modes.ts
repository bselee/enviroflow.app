/**
 * useControllerModes Hook
 *
 * Custom hook for fetching current mode configurations for a controller's ports.
 * Used by workflow builder to show current state and for verification.
 *
 * @example
 * ```tsx
 * const { modes, loading, error, refetch } = useControllerModes({
 *   controllerId: 'abc-123',
 *   port: 1, // optional: filter to specific port
 *   enabled: true
 * });
 * ```
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Auto mode configuration for temperature/humidity/VPD triggers.
 */
export interface AutoModeConfig {
  /** High temperature trigger (Fahrenheit) */
  tempHighTrigger: number | null;
  /** Low temperature trigger (Fahrenheit) */
  tempLowTrigger: number | null;
  /** High humidity trigger (percentage) */
  humidityHighTrigger: number | null;
  /** Low humidity trigger (percentage) */
  humidityLowTrigger: number | null;
  /** High VPD trigger (kPa) */
  vpdHighTrigger: number | null;
  /** Low VPD trigger (kPa) */
  vpdLowTrigger: number | null;
  /** Device behavior (cooling, heating, humidify, dehumidify) */
  deviceBehavior: string | null;
  /** Maximum device level (0-10) */
  maxLevel: number | null;
  /** Minimum device level (0-10) */
  minLevel: number | null;
  /** Whether transition is enabled */
  transitionEnabled: boolean;
  /** Transition speed */
  transitionSpeed: number | null;
  /** Whether buffer is enabled */
  bufferEnabled: boolean;
  /** Buffer value */
  bufferValue: number | null;
}

/**
 * VPD mode configuration (similar to Auto, but VPD-focused).
 */
export interface VpdModeConfig extends AutoModeConfig {
  /** Leaf temperature offset for VPD calculation */
  leafTempOffset: number | null;
}

/**
 * Timer mode configuration.
 */
export interface TimerModeConfig {
  /** Timer type (on or off) */
  timerType: string | null;
  /** Timer duration in seconds */
  timerDuration: number | null;
}

/**
 * Cycle mode configuration.
 */
export interface CycleModeConfig {
  /** On duration in seconds */
  cycleOnDuration: number | null;
  /** Off duration in seconds */
  cycleOffDuration: number | null;
}

/**
 * Schedule mode configuration.
 */
export interface ScheduleModeConfig {
  /** Start time (HH:MM:SS) */
  scheduleStartTime: string | null;
  /** End time (HH:MM:SS) */
  scheduleEndTime: string | null;
  /** Days bitmask (bit 0 = Sunday) */
  scheduleDays: number | null;
}

/**
 * Port mode configuration.
 * Represents the current mode and its settings for a specific port.
 */
export interface PortModeConfig {
  /** Unique identifier for the mode record */
  id: string;
  /** Port number this mode applies to */
  port_number: number;
  /** Mode ID (0=OFF, 1=ON, 2=AUTO, 3=TIMER, 4=CYCLE, 5=SCHEDULE, 6=VPD) */
  mode_id: number;
  /** Mode name (OFF, ON, AUTO, TIMER, CYCLE, SCHEDULE, VPD) */
  mode_name: string | null;
  /** Whether this mode is currently active */
  is_active: boolean;
  /** Auto mode configuration (mode_id 2) */
  autoConfig?: AutoModeConfig;
  /** VPD mode configuration (mode_id 6) */
  vpdConfig?: VpdModeConfig;
  /** Timer mode configuration (mode_id 3) */
  timerConfig?: TimerModeConfig;
  /** Cycle mode configuration (mode_id 4) */
  cycleConfig?: CycleModeConfig;
  /** Schedule mode configuration (mode_id 5) */
  scheduleConfig?: ScheduleModeConfig;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Raw mode data from database (flattened column structure).
 */
interface RawModeData {
  id: string;
  controller_id: string;
  port_number: number;
  mode_id: number;
  mode_name: string | null;
  is_active: boolean;
  temp_trigger_high: number | null;
  temp_trigger_low: number | null;
  humidity_trigger_high: number | null;
  humidity_trigger_low: number | null;
  vpd_trigger_high: number | null;
  vpd_trigger_low: number | null;
  device_behavior: string | null;
  max_level: number | null;
  min_level: number | null;
  transition_enabled: boolean;
  transition_speed: number | null;
  buffer_enabled: boolean;
  buffer_value: number | null;
  timer_type: string | null;
  timer_duration: number | null;
  cycle_on_duration: number | null;
  cycle_off_duration: number | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  schedule_days: number | null;
  leaf_temp_offset: number | null;
  updated_at?: string;
}

/**
 * Configuration options for the useControllerModes hook.
 */
export interface UseControllerModesOptions {
  /** Controller ID to fetch modes for. If undefined, returns empty array. */
  controllerId?: string;
  /** Optional port number filter to get modes for a specific port */
  port?: number;
  /** Whether to enable data fetching. Defaults to true. */
  enabled?: boolean;
}

/**
 * Return type for the useControllerModes hook.
 */
export interface UseControllerModesReturn {
  /** Array of mode configurations for the controller/port */
  modes: PortModeConfig[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message from last operation, or null */
  error: string | null;
  /** Manually trigger a data refresh */
  refetch: () => Promise<void>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transforms raw database mode data into typed PortModeConfig.
 * Organizes mode-specific fields into typed configuration objects.
 */
function transformModeData(raw: RawModeData): PortModeConfig {
  const base: PortModeConfig = {
    id: raw.id,
    port_number: raw.port_number,
    mode_id: raw.mode_id,
    mode_name: raw.mode_name,
    is_active: raw.is_active,
    updated_at: raw.updated_at,
  };

  // Add mode-specific configurations based on mode_id
  switch (raw.mode_id) {
    case 2: // AUTO mode
      base.autoConfig = {
        tempHighTrigger: raw.temp_trigger_high,
        tempLowTrigger: raw.temp_trigger_low,
        humidityHighTrigger: raw.humidity_trigger_high,
        humidityLowTrigger: raw.humidity_trigger_low,
        vpdHighTrigger: raw.vpd_trigger_high,
        vpdLowTrigger: raw.vpd_trigger_low,
        deviceBehavior: raw.device_behavior,
        maxLevel: raw.max_level,
        minLevel: raw.min_level,
        transitionEnabled: raw.transition_enabled,
        transitionSpeed: raw.transition_speed,
        bufferEnabled: raw.buffer_enabled,
        bufferValue: raw.buffer_value,
      };
      break;

    case 6: // VPD mode
      base.vpdConfig = {
        tempHighTrigger: raw.temp_trigger_high,
        tempLowTrigger: raw.temp_trigger_low,
        humidityHighTrigger: raw.humidity_trigger_high,
        humidityLowTrigger: raw.humidity_trigger_low,
        vpdHighTrigger: raw.vpd_trigger_high,
        vpdLowTrigger: raw.vpd_trigger_low,
        deviceBehavior: raw.device_behavior,
        maxLevel: raw.max_level,
        minLevel: raw.min_level,
        transitionEnabled: raw.transition_enabled,
        transitionSpeed: raw.transition_speed,
        bufferEnabled: raw.buffer_enabled,
        bufferValue: raw.buffer_value,
        leafTempOffset: raw.leaf_temp_offset,
      };
      break;

    case 3: // TIMER mode
      base.timerConfig = {
        timerType: raw.timer_type,
        timerDuration: raw.timer_duration,
      };
      break;

    case 4: // CYCLE mode
      base.cycleConfig = {
        cycleOnDuration: raw.cycle_on_duration,
        cycleOffDuration: raw.cycle_off_duration,
      };
      break;

    case 5: // SCHEDULE mode
      base.scheduleConfig = {
        scheduleStartTime: raw.schedule_start_time,
        scheduleEndTime: raw.schedule_end_time,
        scheduleDays: raw.schedule_days,
      };
      break;

    // Modes 0 (OFF) and 1 (ON) don't need additional config
  }

  return base;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Fetches mode configurations for a controller's ports with real-time updates.
 *
 * Features:
 * - Returns empty array if no controllerId provided
 * - Optional port filter to get modes for a specific port
 * - Can be disabled via enabled option
 * - Sets up real-time subscription for live updates
 * - Provides refetch function for manual refresh
 * - Transforms flat DB columns into typed configuration objects
 * - Handles loading and error states
 * - Prevents state updates after unmount
 *
 * @param options - Configuration options
 * @returns Mode configurations, loading state, error state, and refetch function
 */
export function useControllerModes(
  options: UseControllerModesOptions = {}
): UseControllerModesReturn {
  const { controllerId, port, enabled = true } = options;

  // State
  const [modes, setModes] = useState<PortModeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);

  /**
   * Fetch modes for the specified controller (and optionally port).
   */
  const fetchModes = useCallback(async () => {
    // Don't fetch if disabled or no controllerId provided
    if (!enabled || !controllerId) {
      if (isMounted.current) {
        setModes([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    try {
      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      // Build query with controller filter
      let query = supabase
        .from("controller_modes")
        .select("*")
        .eq("controller_id", controllerId);

      // Add port filter if specified
      if (port !== undefined) {
        query = query.eq("port_number", port);
      }

      // Order by port number and mode_id
      query = query.order("port_number", { ascending: true }).order("mode_id", { ascending: true });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (isMounted.current) {
        // Transform raw data into typed configurations
        const transformedModes = (data as RawModeData[])?.map(transformModeData) || [];
        setModes(transformedModes);
      }
    } catch (err) {
      console.error("[useControllerModes] Error fetching modes:", err);
      if (isMounted.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch controller modes"
        );
        setModes([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [controllerId, port, enabled]);

  /**
   * Public refetch function for manual refresh.
   */
  const refetch = useCallback(async () => {
    await fetchModes();
  }, [fetchModes]);

  // Initial fetch on mount or when dependencies change
  useEffect(() => {
    isMounted.current = true;
    fetchModes();

    return () => {
      isMounted.current = false;
    };
  }, [fetchModes]);

  // Set up real-time subscription for mode changes
  useEffect(() => {
    // Don't subscribe if disabled or no controllerId
    if (!enabled || !controllerId) {
      return;
    }

    const channel = supabase
      .channel(`controller_modes_${controllerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controller_modes",
          filter: `controller_id=eq.${controllerId}`,
        },
        () => {
          // Refresh on any change (INSERT, UPDATE, DELETE)
          fetchModes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [controllerId, enabled, fetchModes]);

  return {
    modes,
    loading,
    error,
    refetch,
  };
}
