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

// =============================================================================
// Global Channel Manager (prevents ChannelRateLimitReached errors)
// =============================================================================

/**
 * Global registry to track active channels and prevent duplicates.
 * Uses reference counting to share channels across components.
 */
interface ChannelEntry {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
  subscribers: Set<(reading: SensorReading) => void>;
}

const channelRegistry = new Map<string, ChannelEntry>();

/**
 * Generate a stable channel name from controller IDs.
 * Sorting ensures same controllers always produce same name.
 */
function getChannelName(controllerIds: string[]): string {
  if (controllerIds.length === 0) return 'sensor_readings_empty';
  const sorted = [...controllerIds].sort();
  // Use a hash-like approach: first 8 chars of each ID joined
  const hash = sorted.map(id => id.slice(0, 8)).join('_');
  return `sensor_readings_${hash}`;
}

/**
 * Get or create a shared channel for the given controller IDs.
 */
function getOrCreateChannel(
  controllerIds: string[],
  onNewReading: (reading: SensorReading) => void,
  onStatusChange: (status: ConnectionStatus) => void,
  onError: () => void
): { channelName: string; cleanup: () => void } {
  const channelName = getChannelName(controllerIds);

  let entry = channelRegistry.get(channelName);

  if (entry) {
    // Reuse existing channel
    entry.refCount++;
    entry.subscribers.add(onNewReading);
    onStatusChange('connected'); // Already connected
    return {
      channelName,
      cleanup: () => {
        entry!.subscribers.delete(onNewReading);
        entry!.refCount--;
        if (entry!.refCount <= 0) {
          supabase.removeChannel(entry!.channel);
          channelRegistry.delete(channelName);
        }
      }
    };
  }

  // Create new channel
  const subscribers = new Set<(reading: SensorReading) => void>();
  subscribers.add(onNewReading);

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "sensor_readings",
      },
      (payload) => {
        const newReading = payload.new as SensorReading;
        // Broadcast to all subscribers
        const currentEntry = channelRegistry.get(channelName);
        if (currentEntry) {
          currentEntry.subscribers.forEach(cb => cb(newReading));
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        onStatusChange('connected');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.warn(`[SensorReadings] Channel ${channelName} error:`, err);
        onError();
      }
    });

  entry = { channel, refCount: 1, subscribers };
  channelRegistry.set(channelName, entry);

  return {
    channelName,
    cleanup: () => {
      entry!.subscribers.delete(onNewReading);
      entry!.refCount--;
      if (entry!.refCount <= 0) {
        supabase.removeChannel(entry!.channel);
        channelRegistry.delete(channelName);
      }
    }
  };
}

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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  // Debounce refs for batching realtime updates
  const pendingReadingsRef = useRef<SensorReading[]>([]);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetches sensor readings via API endpoint.
   * Uses server-side proxy to avoid browser QUIC protocol errors.
   */
  const fetchReadings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Skip fetch if no controller IDs
      if (controllerIds.length === 0) {
        setReadings([]);
        return;
      }

      // Build API URL with query params
      const params = new URLSearchParams();
      params.set('controllerIds', controllerIds.join(','));
      params.set('timeRangeHours', timeRangeHours.toString());
      params.set('limit', limit.toString());

      if (dateRange) {
        params.set('from', dateRange.from.toISOString());
        params.set('to', dateRange.to.toISOString());
      }

      // Get auth token for API request
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        // Not authenticated - return empty readings instead of crashing
        setReadings([]);
        setIsLoading(false);
        return;
      }

      // Fetch via API endpoint (avoids browser QUIC issues)
      const response = await fetch(`/api/sensor-readings?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // Debug: Log query results
      console.log('[useSensorReadings] API result:', {
        controllerIds,
        rowCount: result.readings?.length || 0,
        timeRange: result.timeRange,
      });

      // Filter by sensor types client-side if specified
      let readings = result.readings || [];
      if (sensorTypes && sensorTypes.length > 0) {
        readings = readings.filter((r: SensorReading) => sensorTypes.includes(r.sensor_type as SensorType));
      }

      setReadings(readings as SensorReading[]);
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
  // Note: We use a stable string dependency instead of fetchReadings directly
  // because fetchReadings changes when controllerIds array reference changes
  useEffect(() => {
    fetchReadings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerIds.join(','), sensorTypes?.join(','), limit, timeRangeHours, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()]);

  /**
   * Start fallback polling when WebSocket fails.
   */
  const startPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    setConnectionStatus('polling');

    pollingIntervalRef.current = setInterval(async () => {
      try {
        await fetchReadings();
      } catch (err) {
        console.error('[SensorReadings] Polling fetch error:', err);
      }
    }, POLLING_INTERVAL_MS);
  }, [fetchReadings]);

  /**
   * Handle incoming realtime reading with debouncing.
   */
  const handleNewReading = useCallback((newReading: SensorReading) => {
    // Only add if it's for one of our controllers
    if (!controllerIds.includes(newReading.controller_id)) return;

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
        setReadings(prev => [...newReadings, ...prev].slice(0, limit * Math.max(controllerIds.length, 1)));
      }
    }, REALTIME_DEBOUNCE_MS);
  }, [controllerIds, limit]);

  // Set up real-time subscription for sensor readings changes
  useEffect(() => {
    // Reset mounted ref on each effect run (important for remount scenarios)
    mountedRef.current = true;

    // Skip realtime if disabled (reduces WebSocket connections)
    if (!enableRealtime) {
      setConnectionStatus('polling'); // Mark as polling mode (no WebSocket)
      return;
    }

    if (controllerIds.length === 0) {
      setConnectionStatus('connected'); // No subscription needed
      return;
    }

    // Use shared channel manager to prevent ChannelRateLimitReached
    const { cleanup } = getOrCreateChannel(
      controllerIds,
      handleNewReading,
      setConnectionStatus,
      () => {
        // On error, fall back to polling
        reconnectAttempts.current++;
        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionStatus('error');
          startPollingFallback();
        }
      }
    );

    cleanupRef.current = cleanup;

    return () => {
      // Mark as unmounted to prevent state updates after cleanup
      mountedRef.current = false;
      // Cleanup channel subscription
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      // Cleanup polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      // Clear pending readings
      pendingReadingsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerIds.join(','), enableRealtime]); // Use joined string for stable dependency

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
