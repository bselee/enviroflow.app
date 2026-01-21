"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  SensorReading,
  SensorType,
  AggregatedSensorData,
  TimeSeriesPoint,
  SensorReadingsOptions,
} from "@/types";

/**
 * Hook return type.
 */
interface UseSensorReadingsReturn {
  readings: SensorReading[];
  isLoading: boolean;
  error: string | null;
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
export function useSensorReadings(options: SensorReadingsOptions = {}): UseSensorReadingsReturn {
  const {
    controllerIds = [],
    sensorTypes,
    limit = 100,
    timeRangeHours = 24,
  } = options;

  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches sensor readings based on the provided options.
   * Filters by controller IDs and time range for performance.
   */
  const fetchReadings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Calculate time range
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - timeRangeHours);

      let query = supabase
        .from("sensor_readings")
        .select("*")
        .gte("timestamp", startTime.toISOString())
        .order("timestamp", { ascending: false })
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

      setReadings(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sensor readings";
      setError(errorMessage);
      console.error("useSensorReadings fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [controllerIds, sensorTypes, limit, timeRangeHours]);

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
          timestamp: latest.timestamp,
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
        timestamp: r.timestamp,
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
      ...controllerReadings.map(r => new Date(r.timestamp).getTime())
    );
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const now = Date.now();

    return now - latestTimestamp > thresholdMs;
  }, [readings]);

  // Initial fetch on mount or when options change
  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  // Set up real-time subscription for sensor readings changes
  useEffect(() => {
    if (controllerIds.length === 0) {
      return; // No subscription if no controllers specified
    }

    const channel = supabase
      .channel("sensor_readings_changes")
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
            setReadings(prev => [newReading, ...prev].slice(0, limit * controllerIds.length));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [controllerIds, limit]);

  return {
    readings,
    isLoading,
    error,
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
