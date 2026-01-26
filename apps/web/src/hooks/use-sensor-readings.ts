"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type {
  SensorReading,
  SensorType,
  AggregatedSensorData,
  TimeSeriesPoint,
  SensorReadingsOptions,
} from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Connection status for realtime subscriptions.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'polling' | 'error';

/**
 * Hook return type.
 */
interface UseSensorReadingsReturn {
  readings: SensorReading[];
  isLoading: boolean;
  error: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  refetch: () => Promise<void>;
  /** Get aggregated latest readings for a controller */
  getLatestForController: (controllerId: string) => AggregatedSensorData;
  /** Get time series data for charting */
  getTimeSeries: (
    controllerId: string,
    sensorType: SensorType
  ) => TimeSeriesPoint[];
  /** Check if readings are stale (older than threshold) */
  isStale: (controllerId: string, thresholdMinutes?: number) => boolean;
}

/**
 * Extended configuration options for sensor readings hook.
 * Includes option to disable realtime subscriptions for performance.
 */
interface SensorReadingsOptionsExtended extends SensorReadingsOptions {
  /**
   * Enable realtime subscriptions for live updates.
   * Set to false to reduce WebSocket connections when using multiple instances.
   * Default: true
   */
  enableRealtime?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_RECONNECT_ATTEMPTS = 5;
const POLLING_INTERVAL_MS = 30000; // 30 seconds fallback polling
const REALTIME_DEBOUNCE_MS = 500; // Debounce realtime updates to prevent rapid re-renders

/**
 * Custom hook for managing sensor readings with Supabase.
 *
 * Fetches sensor data from the database and provides utilities for
 * aggregating and transforming the data for display and charting.
 *
 * @param options - Configuration options for fetching readings
 *
 * @example
 * ```tsx
 * const { readings, getLatestForController, isLoading } = useSensorReadings({
 *   controllerIds: ["controller-1", "controller-2"],
 *   timeRangeHours: 6,
 * });
 *
 * const latest = getLatestForController("controller-1");
 * console.log(latest.temperature?.value); // 72.5
 * ```
 */
export function useSensorReadings(options: SensorReadingsOptionsExtended = {}): UseSensorReadingsReturn {
  const {
    controllerIds = [],
    sensorTypes,
    limit = 100,
    timeRangeHours = 24,
    dateRange,
    enableRealtime = true, // Default to true for backward compatibility
  } = options;

  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  // Refs for managing reconnection
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  // Debounce refs for batching realtime updates
  const pendingReadingsRef = useRef<SensorReading[]>([]);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate exponential backoff delay.
   */
  const getBackoffDelay = useCallback(() => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
    return Math.min(1000 * Math.pow(2, reconnectAttempts.current), 16000);
  }, []);

  /**
   * Fetches sensor readings based on the provided options.
   * Filters by controller IDs and time range for performance.
   */
  const fetchReadings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate time range - use dateRange if provided, otherwise fall back to timeRangeHours
      let startTime: Date;
      let endTime: Date;

      if (dateRange) {
        startTime = dateRange.from;
        endTime = dateRange.to;
      } else {
        endTime = new Date();
        startTime = new Date();
        startTime.setHours(startTime.getHours() - timeRangeHours);
      }

      let query = supabase
        .from("sensor_readings")
        .select("*")
        .gte("recorded_at", startTime.toISOString())
        .lte("recorded_at", endTime.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(limit * Math.max(controllerIds.length, 1));

      // Filter by controller IDs if provided
      if (controllerIds.length > 0) {
        query = query.in("controller_id", controllerIds);
      }

      // Filter by sensor types if provided
      if (sensorTypes && sensorTypes.length > 0) {
        query = query.in("sensor_type", sensorTypes);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // The database uses `recorded_at` and the interface now matches this
      setReadings((data || []) as SensorReading[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sensor readings";
      setError(errorMessage);
      console.error("useSensorReadings fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [controllerIds, sensorTypes, limit, timeRangeHours, dateRange]);

  /**
   * Gets the latest reading for each sensor type for a specific controller.
   * Memoized to prevent unnecessary recalculations.
   */
  const getLatestForController = useCallback((controllerId: string): AggregatedSensorData => {
    const controllerReadings = readings.filter(r => r.controller_id === controllerId);

    const result: AggregatedSensorData = {
      temperature: null,
      humidity: null,
      vpd: null,
      co2: null,
      light: null,
      ph: null,
      ec: null,
    };

    // Get the most recent reading for each sensor type
    const sensorTypeKeys: Array<keyof AggregatedSensorData> = [
      "temperature", "humidity", "vpd", "co2", "light", "ph", "ec"
    ];

    for (const sensorType of sensorTypeKeys) {
      const typeReadings = controllerReadings.filter(r => r.sensor_type === sensorType);
      if (typeReadings.length > 0) {
        // Already sorted by timestamp DESC, so first is latest
        const latest = typeReadings[0];
        result[sensorType] = {
          value: latest.value,
          unit: latest.unit,
          timestamp: latest.recorded_at,
        };
      }
    }

    return result;
  }, [readings]);

  /**
   * Gets time series data for charting a specific sensor type.
   * Returns data points sorted by timestamp ascending for proper chart rendering.
   */
  const getTimeSeries = useCallback((
    controllerId: string,
    sensorType: SensorType
  ): TimeSeriesPoint[] => {
    return readings
      .filter(r => r.controller_id === controllerId && r.sensor_type === sensorType)
      .map(r => ({
        timestamp: r.recorded_at,
        value: r.value,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [readings]);

  /**
   * Checks if readings for a controller are stale.
   * Default threshold is 5 minutes.
   */
  const isStale = useCallback((controllerId: string, thresholdMinutes = 5): boolean => {
    const controllerReadings = readings.filter(r => r.controller_id === controllerId);

    if (controllerReadings.length === 0) {
      return true; // No readings means stale
    }

    const latestTimestamp = Math.max(
      ...controllerReadings.map(r => new Date(r.recorded_at).getTime())
    );
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const now = Date.now();

    return now - latestTimestamp > thresholdMs;
  }, [readings]);

  // Initial fetch on mount or when options change
  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  /**
   * Start fallback polling when WebSocket fails.
   */
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    setConnectionStatus('polling');
    console.info('[SensorReadings] WebSocket failed, falling back to polling');

    pollingIntervalRef.current = setInterval(async () => {
      try {
        await fetchReadings();
      } catch (err) {
        console.error('[SensorReadings] Polling fetch error:', err);
      }
    }, POLLING_INTERVAL_MS);
  }, [fetchReadings]);

  /**
   * Stop fallback polling.
   */
  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Set up realtime subscription with reconnection logic.
   */
  const setupSubscription = useCallback(() => {
    if (controllerIds.length === 0) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    setConnectionStatus(reconnectAttempts.current > 0 ? 'reconnecting' : 'connecting');

    const channel = supabase
      .channel(`sensor_readings_${Date.now()}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
        },
        (payload) => {
          // Only add if it's for one of our controllers
          const newReading = payload.new as SensorReading;
          if (controllerIds.includes(newReading.controller_id)) {
            // Batch updates with debouncing to prevent rapid re-renders (shaking)
            pendingReadingsRef.current.push(newReading);

            // Clear existing debounce timeout
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
            }

            // Flush pending readings after debounce period
            debounceTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && pendingReadingsRef.current.length > 0) {
                const newReadings = [...pendingReadingsRef.current];
                pendingReadingsRef.current = [];
                setReadings(prev => [...newReadings, ...prev].slice(0, limit * controllerIds.length));
              }
            }, REALTIME_DEBOUNCE_MS);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          reconnectAttempts.current = 0;
          stopPollingFallback();
          console.info('[SensorReadings] Realtime connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('[SensorReadings] Channel closed or error:', err);
          reconnectAttempts.current++;

          if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionStatus('error');
            startPollingFallback();
          } else {
            setConnectionStatus('reconnecting');
            const delay = getBackoffDelay();
            console.info(`[SensorReadings] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && controllerIds.length > 0) {
                setupSubscription();
              }
            }, delay);
          }
        }
      });

    channelRef.current = channel;
  }, [controllerIds, limit, getBackoffDelay, startPollingFallback, stopPollingFallback]);

  // Set up real-time subscription for sensor readings changes
  useEffect(() => {
    // Reset mounted ref on each effect run (important for remount scenarios)
    mountedRef.current = true;

    // Skip realtime if disabled (reduces WebSocket connections)
    if (!enableRealtime) {
      setConnectionStatus('connected'); // Mark as connected but using polling/manual refresh
      return;
    }

    if (controllerIds.length === 0) {
      setConnectionStatus('connected'); // No subscription needed
      return;
    }

    setupSubscription();

    return () => {
      // Mark as unmounted to prevent state updates after cleanup
      mountedRef.current = false;
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      // Clear pending readings
      pendingReadingsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerIds, enableRealtime]); // ✅ FIX: Remove setupSubscription from deps to prevent re-subscription

  return {
    readings,
    isLoading,
    error,
    connectionStatus,
    refetch: fetchReadings,
    getLatestForController,
    getTimeSeries,
    isStale,
  };
}

/**
 * Hook for fetching sensor readings for all controllers in a room.
 * Convenience wrapper around useSensorReadings.
 */
export function useRoomSensorReadings(
  controllerIds: string[],
  timeRangeHours = 6
): UseSensorReadingsReturn {
  return useSensorReadings({
    controllerIds,
    timeRangeHours,
    limit: 50, // Less data per controller for room overview
  });
}
