"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { LiveSensorResponse, LiveSensor } from "@/types";

// =============================================================================
// Types
// =============================================================================

export interface UseLiveSensorsOptions {
  /** Auto-refresh interval in seconds (default: 15) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  /** Whether to fetch data on mount (default: true) */
  fetchOnMount?: boolean;
  /** Max number of historical points to keep (default: 100) */
  maxHistoryPoints?: number;
}

/** A single historical data point */
export interface HistoryPoint {
  timestamp: string;
  temperature: number;
  humidity: number;
  vpd: number;
  /** Controller ID this reading belongs to (absent for legacy averaged points) */
  controllerId?: string;
}

export interface UseLiveSensorsResult {
  /** Array of live sensor data */
  sensors: LiveSensor[];
  /** Loading state (true during initial fetch) */
  loading: boolean;
  /** Refreshing state (true during background refresh) */
  refreshing: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Timestamp of last successful fetch */
  lastUpdate: Date | null;
  /** Number of sensors returned */
  count: number;
  /** Response time in milliseconds */
  responseTimeMs: number | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Computed averages across all sensors */
  averages: {
    temperature: number | null;
    humidity: number | null;
    vpd: number | null;
  };
  /** Historical data points accumulated over time */
  history: HistoryPoint[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook to fetch live sensor data from AC Infinity devices via Direct API.
 * 
 * This hook implements the Direct API Polling pattern described in ARCHITECTURE.md.
 * It fetches data directly from /api/sensors/live which calls the AC Infinity cloud API.
 * 
 * @example
 * ```tsx
 * const { sensors, loading, error, averages } = useLiveSensors({
 *   refreshInterval: 15,
 *   autoRefresh: true,
 * });
 * ```
 */
export function useLiveSensors(options: UseLiveSensorsOptions = {}): UseLiveSensorsResult {
  const {
    refreshInterval = 15,
    autoRefresh = true,
    fetchOnMount = true,
    maxHistoryPoints = 100,
  } = options;

  const [data, setData] = useState<LiveSensorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const isMountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch sensor data from API.
   */
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isMountedRef.current) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/sensors/live");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: LiveSensorResponse = await response.json();

      if (!isMountedRef.current) return;

      setData(result)

      // Add per-controller history points for chart filtering
      if (result.sensors && result.sensors.length > 0) {
        const now = new Date().toISOString();
        const newPoints: HistoryPoint[] = result.sensors.map((s) => ({
          timestamp: now,
          temperature: s.temperature ?? 0,
          humidity: s.humidity ?? 0,
          vpd: s.vpd ?? 0,
          controllerId: s.id,
        }));

        setHistory((prev) => {
          const updated = [...prev, ...newPoints];
          // Keep only the last maxHistoryPoints per controller
          const maxTotal = maxHistoryPoints * result.sensors.length;
          if (updated.length > maxTotal) {
            return updated.slice(-maxTotal);
          }
          return updated;
        });
      }
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sensors";
      setError(errorMessage);
      console.error("[useLiveSensors] Fetch error:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  /**
   * Manual refresh function.
   */
  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  /**
   * Setup auto-refresh interval.
   */
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchData(true);
      }, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchData]);

  /**
   * Initial fetch on mount.
   */
  useEffect(() => {
    isMountedRef.current = true;

    if (fetchOnMount) {
      fetchData(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData, fetchOnMount]);

  /**
   * Compute averages across all sensors.
   */
  const averages = {
    temperature: data?.sensors && data.sensors.length > 0
      ? data.sensors.reduce((sum, s) => sum + (s.temperature ?? 0), 0) / data.sensors.length
      : null,
    humidity: data?.sensors && data.sensors.length > 0
      ? data.sensors.reduce((sum, s) => sum + (s.humidity ?? 0), 0) / data.sensors.length
      : null,
    vpd: data?.sensors && data.sensors.length > 0
      ? data.sensors.reduce((sum, s) => sum + (s.vpd ?? 0), 0) / data.sensors.length
      : null,
  };

  return {
    sensors: data?.sensors ?? [],
    loading,
    refreshing,
    error,
    lastUpdate,
    count: data?.count ?? 0,
    responseTimeMs: data?.responseTimeMs ?? null,
    refresh,
    averages,
    history,
  };
}
