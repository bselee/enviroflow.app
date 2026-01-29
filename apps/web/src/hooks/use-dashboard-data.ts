"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { calculateVPD } from "@/lib/vpd-utils";
import type {
  Room,
  RoomWithControllers,
  Controller,
  SensorReading,
  TimeSeriesPoint,
  ControllerPort,
} from "@/types";
import type { TimeSeriesData } from "@/components/dashboard/IntelligentTimeline";
import type {
  Alert,
  Automation,
  ControllerSummary,
  ScheduledEvent,
} from "@/components/dashboard/SmartActionCards";
import { useDemoDataUpdater } from "@/lib/demo-data";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Configuration options for the dashboard data hook.
 */
export interface DashboardDataOptions {
  /** Interval in milliseconds for automatic data refresh. Default: 60000 (60s) */
  refreshInterval?: number;
  /** Time range in hours for sensor data queries. Default: 24 (was 6) */
  sensorTimeRangeHours?: number;
}

/**
 * Trend information showing change over a time period.
 * Used for displaying delta indicators (e.g., "+2.5 from 1h ago").
 */
export interface TrendData {
  /** Change in value (positive = increase, negative = decrease) */
  delta: number;
  /** Human-readable period description (e.g., "1h ago") */
  period: string;
}

/**
 * Aggregated sensor data for the latest readings.
 * Null values indicate no data available for that sensor type.
 */
export interface LatestSensorData {
  temperature: number | null;
  humidity: number | null;
  vpd: number | null;
}

/**
 * Summary data for a single room, including controllers and sensor aggregations.
 * This is the primary data structure used by dashboard room cards.
 */
export interface RoomSummary {
  /** The room entity */
  room: Room;
  /** Controllers assigned to this room */
  controllers: Controller[];
  /** Count of online controllers in the room */
  onlineCount: number;
  /** Count of offline controllers in the room */
  offlineCount: number;
  /** Latest sensor readings aggregated across all controllers */
  latestSensorData: LatestSensorData;
  /** Trend data comparing current values to ~1 hour ago */
  trends: {
    temperature?: TrendData;
    humidity?: TrendData;
    vpd?: TrendData;
  };
  /** True if the most recent sensor data is older than 5 minutes */
  hasStaleData: boolean;
  /** ISO timestamp of the most recent sensor reading, or null if none */
  lastUpdateTimestamp: string | null;
  /** Temperature time series for charting (sorted ascending by timestamp) */
  temperatureTimeSeries: TimeSeriesPoint[];
}

/**
 * Summary data for a single unassigned controller with sensor data.
 * Similar to RoomSummary but for individual controllers not in a room.
 */
export interface UnassignedControllerSummary {
  /** The controller entity */
  controller: Controller;
  /** Whether the controller is online */
  isOnline: boolean;
  /** Latest sensor readings from this controller */
  latestSensorData: LatestSensorData;
  /** Trend data comparing current values to ~1 hour ago */
  trends: {
    temperature?: TrendData;
    humidity?: TrendData;
    vpd?: TrendData;
  };
  /** True if the most recent sensor data is older than 5 minutes */
  hasStaleData: boolean;
  /** ISO timestamp of the most recent sensor reading, or null if none */
  lastUpdateTimestamp: string | null;
  /** Temperature time series for charting (sorted ascending by timestamp) */
  temperatureTimeSeries: TimeSeriesPoint[];
}

/**
 * Aggregate metrics across all rooms and controllers.
 * Displayed in the dashboard header section.
 */
export interface DashboardMetrics {
  /** Total number of controllers across all rooms */
  totalControllers: number;
  /** Number of controllers currently online */
  onlineControllers: number;
  /** Number of controllers currently offline */
  offlineControllers: number;
  /** Percentage of controllers online (0-100) */
  controllerUptime: number;
  /** Total number of rooms */
  totalRooms: number;
  /** Average temperature across all rooms, or null if no data */
  averageTemperature: number | null;
  /** Average humidity across all rooms, or null if no data */
  averageHumidity: number | null;
  /** Average VPD across all rooms, or null if no data */
  averageVPD: number | null;
}

/**
 * Environment snapshot data for the dashboard hero section.
 */
export interface EnvironmentSnapshotData {
  /** Current VPD in kPa */
  vpd: number | null;
  /** Current temperature in Fahrenheit */
  temperature: number | null;
  /** Current humidity percentage */
  humidity: number | null;
  /** Whether at least one controller is connected */
  isConnected: boolean;
  /** Trend data for temperature, humidity, and VPD */
  trends: {
    temperature?: TrendData;
    humidity?: TrendData;
    vpd?: TrendData;
  };
  /** Historical VPD data for the dial background (24h) */
  historicalVpd: TimeSeriesPoint[];
}

/**
 * Return type for the useDashboardData hook.
 */
export interface UseDashboardDataReturn {
  /** All rooms (raw data from database or demo data) */
  rooms: Room[];
  /** All controllers (raw data from database or demo data) */
  controllers: Controller[];
  /** Computed room summaries with sensor data and trends */
  roomSummaries: RoomSummary[];
  /** Aggregate dashboard metrics */
  metrics: DashboardMetrics;
  /** Controllers that are currently offline */
  offlineControllers: Controller[];
  /** Controllers that are not assigned to any room */
  unassignedControllers: Controller[];
  /** Summaries for unassigned controllers with sensor data */
  unassignedControllerSummaries: UnassignedControllerSummary[];
  /** True during initial data fetch */
  isLoading: boolean;
  /** True during background refresh */
  isRefreshing: boolean;
  /** Error message from the last failed operation, or null */
  error: string | null;
  /** Manually trigger a data refresh */
  refetch: () => Promise<void>;
  /** Get the summary for a specific room by ID */
  getRoomSummary: (roomId: string) => RoomSummary | undefined;

  // New properties for updated dashboard components
  /** Aggregated environment data for the EnvironmentSnapshot component */
  environmentSnapshot: EnvironmentSnapshotData;
  /** Time series data for the IntelligentTimeline component (24h) */
  timelineData: TimeSeriesData[];
  /** Alerts for the SmartActionCards component */
  alerts: Alert[];
  /** Active automations for the SmartActionCards component */
  automations: Automation[];
  /** Offline controller summaries for SmartActionCards */
  offlineControllerSummaries: ControllerSummary[];
  /** Next scheduled event (dimmer schedules, etc.) */
  nextScheduledEvent: ScheduledEvent | undefined;
  /** Dismiss an alert by ID */
  dismissAlert: (alertId: string) => void;
  /** Toggle automation active state */
  toggleAutomation: (automationId: string) => Promise<void>;

  // Demo mode properties
  /** True when displaying demo data (no real controllers connected) */
  isDemoMode: boolean;
  /** True when transitioning from demo to real mode */
  isTransitioningFromDemo: boolean;

  // Raw sensor readings for analytics
  /** All sensor readings (filtered by time range) */
  sensorReadings: SensorReading[];

  // Controller ports data
  /** All controller ports (for device display) */
  controllerPorts: ControllerPort[];
  /** Get ports for a specific controller by ID */
  getPortsForController: (controllerId: string) => ControllerPort[];
}

// =============================================================================
// Helper Functions
// =============================================================================

// VPD calculation is now imported from vpd-utils.ts for consistency

/**
 * Gets the latest reading for a specific sensor type from a list of readings.
 * Assumes readings are already sorted by timestamp descending.
 *
 * @param readings - Array of sensor readings
 * @param sensorType - Type of sensor to filter for
 * @returns The latest reading value, or null if none found
 */
function getLatestReading(
  readings: SensorReading[],
  sensorType: string
): number | null {
  const reading = readings.find((r) => r.sensor_type === sensorType);
  return reading?.value ?? null;
}

/**
 * Gets a reading value from approximately 1 hour ago for trend calculation.
 * Looks for readings within a 15-minute window around the 1-hour mark.
 *
 * @param readings - Array of sensor readings sorted by timestamp descending
 * @param sensorType - Type of sensor to filter for
 * @returns The reading value from ~1h ago, or null if not found
 */
function getReadingFromOneHourAgo(
  readings: SensorReading[],
  sensorType: string
): number | null {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const windowStart = oneHourAgo - 15 * 60 * 1000; // 15 min before
  const windowEnd = oneHourAgo + 15 * 60 * 1000; // 15 min after

  const reading = readings.find((r) => {
    if (r.sensor_type !== sensorType) return false;
    const timestamp = new Date(r.recorded_at).getTime();
    return timestamp >= windowStart && timestamp <= windowEnd;
  });

  return reading?.value ?? null;
}

/**
 * Calculates trend data by comparing current value to value from 1 hour ago.
 *
 * @param currentValue - Current sensor value
 * @param pastValue - Value from 1 hour ago
 * @returns TrendData object with delta and period, or undefined if trend cannot be calculated
 */
function calculateTrend(
  currentValue: number | null,
  pastValue: number | null
): TrendData | undefined {
  if (currentValue === null || pastValue === null) {
    return undefined;
  }
  return {
    delta: Math.round((currentValue - pastValue) * 100) / 100,
    period: "1h ago",
  };
}

/**
 * Checks if sensor data is stale (older than threshold).
 *
 * @param latestTimestamp - ISO timestamp of the latest reading
 * @param thresholdMinutes - Number of minutes after which data is considered stale. Default: 5
 * @returns True if data is stale or no timestamp provided
 */
function isDataStale(
  latestTimestamp: string | null,
  thresholdMinutes: number = 5
): boolean {
  if (!latestTimestamp) return true;
  const readingTime = new Date(latestTimestamp).getTime();
  const thresholdMs = thresholdMinutes * 60 * 1000;
  return Date.now() - readingTime > thresholdMs;
}

/**
 * Calculates the average of an array of numbers, ignoring null values.
 *
 * @param values - Array of numbers that may include nulls
 * @returns The average, or null if no valid values
 */
function calculateAverage(values: (number | null)[]): number | null {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;
  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / validValues.length) * 100) / 100;
}

/**
 * Converts sensor readings to TimeSeriesData format for the IntelligentTimeline.
 *
 * @param readings - Array of sensor readings
 * @returns Array of TimeSeriesData points grouped by timestamp
 */
function convertToTimeSeriesData(readings: SensorReading[]): TimeSeriesData[] {
  // Group readings by timestamp (rounded to nearest minute for better grouping)
  const byTimestamp = new Map<string, Partial<TimeSeriesData>>();

  for (const reading of readings) {
    // Round timestamp to nearest minute for grouping
    const date = new Date(reading.recorded_at);
    date.setSeconds(0, 0);
    const roundedTimestamp = date.toISOString();

    const existing = byTimestamp.get(roundedTimestamp) || {
      timestamp: roundedTimestamp,
    };

    switch (reading.sensor_type) {
      case "temperature":
        existing.temperature = reading.value;
        break;
      case "humidity":
        existing.humidity = reading.value;
        break;
      case "vpd":
        existing.vpd = reading.value;
        break;
    }

    byTimestamp.set(roundedTimestamp, existing);
  }

  // Convert to array and sort ascending
  return Array.from(byTimestamp.values())
    .filter((d): d is TimeSeriesData => d.timestamp !== undefined)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

/**
 * Generates alerts based on environmental conditions and controller status.
 *
 * @param metrics - Dashboard metrics
 * @param roomSummaries - Room summaries with sensor data
 * @returns Array of alerts sorted by severity
 */
function generateAlerts(
  metrics: DashboardMetrics,
  roomSummaries: RoomSummary[]
): Alert[] {
  const alerts: Alert[] = [];

  // Check for high VPD across rooms
  for (const summary of roomSummaries) {
    const vpd = summary.latestSensorData.vpd;
    if (vpd !== null && vpd > 1.5) {
      alerts.push({
        id: `vpd-high-${summary.room.id}`,
        severity: "warning",
        title: `VPD High in ${summary.room.name}`,
        message: `VPD is ${vpd} kPa. Consider increasing humidity or decreasing temperature.`,
        timestamp: new Date().toISOString(),
        actionable: true,
      });
    } else if (vpd !== null && vpd < 0.4) {
      alerts.push({
        id: `vpd-low-${summary.room.id}`,
        severity: "warning",
        title: `VPD Low in ${summary.room.name}`,
        message: `VPD is ${vpd} kPa. Consider decreasing humidity or increasing temperature.`,
        timestamp: new Date().toISOString(),
        actionable: true,
      });
    }
  }

  // Check for temperature extremes
  for (const summary of roomSummaries) {
    const temp = summary.latestSensorData.temperature;
    if (temp !== null && temp > 90) {
      alerts.push({
        id: `temp-critical-${summary.room.id}`,
        severity: "critical",
        title: `Temperature Critical in ${summary.room.name}`,
        message: `Temperature is ${temp}°F. Immediate attention required.`,
        timestamp: new Date().toISOString(),
        actionable: true,
      });
    } else if (temp !== null && temp < 60) {
      alerts.push({
        id: `temp-low-${summary.room.id}`,
        severity: "warning",
        title: `Temperature Low in ${summary.room.name}`,
        message: `Temperature is ${temp}°F. Consider increasing heat.`,
        timestamp: new Date().toISOString(),
        actionable: true,
      });
    }
  }

  // Check for stale data
  const roomsWithStaleData = roomSummaries.filter(
    (s) => s.hasStaleData && s.controllers.length > 0
  );
  if (roomsWithStaleData.length > 0) {
    alerts.push({
      id: "stale-data",
      severity: "info",
      title: "Data May Be Outdated",
      message: `${roomsWithStaleData.length} room(s) have not reported recent data.`,
      timestamp: new Date().toISOString(),
      actionable: false,
    });
  }

  // All controllers offline alert
  if (metrics.totalControllers > 0 && metrics.onlineControllers === 0) {
    alerts.push({
      id: "all-offline",
      severity: "critical",
      title: "All Controllers Offline",
      message: "No controllers are reporting data. Check network and power connections.",
      timestamp: new Date().toISOString(),
      actionable: true,
    });
  }

  // Sort by severity (critical first, then warning, then info)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Consolidated dashboard data hook that fetches and aggregates all data needed
 * for the main dashboard view.
 *
 * This hook efficiently fetches rooms, controllers, and sensor readings in parallel,
 * then computes derived data (room summaries, metrics, trends) using memoization.
 * It also sets up real-time subscriptions for live updates.
 *
 * @param options - Configuration options for refresh interval and time range
 * @returns Dashboard data, computed summaries, loading states, and utilities
 *
 * @example
 * ```tsx
 * const {
 *   roomSummaries,
 *   metrics,
 *   offlineControllers,
 *   isLoading,
 *   refetch
 * } = useDashboardData({ refreshInterval: 30000 });
 *
 * // Display room cards with pre-computed data
 * roomSummaries.map(summary => (
 *   <RoomCard
 *     key={summary.room.id}
 *     room={summary.room}
 *     temperature={summary.latestSensorData.temperature}
 *     trend={summary.trends.temperature}
 *   />
 * ));
 * ```
 */
/**
 * Partial workflow data fetched for dashboard display.
 * Only includes fields needed for automation status cards.
 */
interface DashboardWorkflow {
  id: string;
  name: string;
  is_active: boolean;
  last_run: string | null;
  room_id: string | null;
  last_error: string | null;
}

export function useDashboardData(
  options: DashboardDataOptions = {}
): UseDashboardDataReturn {
  const {
    refreshInterval = 10000, // Reduced from 60s to 10s for faster real-time updates
    sensorTimeRangeHours = 24, // Changed default to 24h for timeline
  } = options;

  // Raw data state
  const [roomsWithControllers, setRoomsWithControllers] = useState<RoomWithControllers[]>([]);
  const [unassignedControllersData, setUnassignedControllersData] = useState<Controller[]>([]);
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  const [workflows, setWorkflows] = useState<DashboardWorkflow[]>([]);
  const [controllerPorts, setControllerPorts] = useState<ControllerPort[]>([]);

  // Loading and error state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alert dismissal tracking
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);

  // Track refresh interval ID for cleanup
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce ref for realtime refetch (prevents excessive API calls)
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Demo mode transition state
  const [isTransitioningFromDemo, setIsTransitioningFromDemo] = useState(false);
  const previousControllersCountRef = useRef<number | null>(null);

  /**
   * Fetches all dashboard data in parallel.
   * Uses Promise.all to minimize total fetch time.
   */
  const fetchDashboardData = useCallback(async (isBackgroundRefresh = false) => {
    try {
      if (!isMounted.current) return;

      if (isBackgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Check auth session before fetching
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      if (authError) {
        console.error("[Dashboard] Auth error:", authError.message);
        setError(`Authentication error: ${authError.message}`);
        return;
      }

      if (!session?.user) {
        // Don't set error - demo mode will handle this gracefully
        // Clear any existing data so demo mode activates
        if (isMounted.current) {
          setRoomsWithControllers([]);
          setUnassignedControllersData([]);
          setSensorReadings([]);
          setWorkflows([]);
          setControllerPorts([]);
        }
        return;
      }

      // Calculate time range for sensor readings query
      // Use a generous time range (7 days) to ensure we get data even if polling has stopped
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 7); // 7 days instead of just sensorTimeRangeHours

      // Use a fixed reasonable limit for sensor readings to avoid sequential query
      // 2000 readings is enough for ~10 controllers with 24h of data at 3-min intervals
      const sensorReadingLimit = 2000;

      // Fetch all data in parallel for faster initial load
      const [roomsResult, unassignedResult, sensorsResult, workflowsResult, portsResult] = await Promise.all([
        // Fetch rooms with controllers using Supabase relations
        supabase
          .from("rooms")
          .select(`
            *,
            controllers (
              id,
              user_id,
              brand,
              controller_id,
              name,
              status,
              last_seen,
              room_id,
              model,
              firmware_version,
              capabilities,
              last_error
            )
          `)
          .order("created_at", { ascending: false }),

        // Fetch controllers not assigned to any room
        supabase
          .from("controllers")
          .select("*")
          .is("room_id", null)
          .order("created_at", { ascending: false }),

        // Fetch sensor readings for the time range
        supabase
          .from("sensor_readings")
          .select("*")
          .gte("recorded_at", startTime.toISOString())
          .order("recorded_at", { ascending: false })
          .limit(sensorReadingLimit),

        // Fetch active workflows for automations display
        supabase
          .from("workflows")
          .select("id, name, is_active, last_run, room_id, last_error")
          .order("updated_at", { ascending: false })
          .limit(20),

        // Fetch controller ports for device display
        supabase
          .from("controller_ports")
          .select("*")
          .order("port_number", { ascending: true }),
      ]);

      // Handle errors from either query
      if (roomsResult.error) {
        throw new Error(`Failed to fetch rooms: ${roomsResult.error.message}`);
      }
      if (unassignedResult.error) {
        throw new Error(`Failed to fetch unassigned controllers: ${unassignedResult.error.message}`);
      }
      if (sensorsResult.error) {
        throw new Error(`Failed to fetch sensor readings: ${sensorsResult.error.message}`);
      }
      // Workflows are non-critical, don't throw on error
      if (workflowsResult.error) {
        // Silently handle workflow errors - they're non-critical
      }
      // Controller ports are non-critical, don't throw on error
      if (portsResult.error) {
        console.warn("[Dashboard] Failed to fetch controller ports:", portsResult.error.message);
      }

      // If sensor readings are empty but we have controllers, try to fetch cached readings
      // This provides a fallback when polling is failing but old data exists
      let finalSensorReadings = sensorsResult.data || [];

      if (finalSensorReadings.length === 0) {
        const allControllers = [
          ...(roomsResult.data?.flatMap((r: RoomWithControllers) => r.controllers || []) || []),
          ...(unassignedResult.data || [])
        ];

        if (allControllers.length > 0) {
          // Fetch most recent readings for each controller, regardless of date
          const controllerIds = allControllers.map((c: Controller) => c.id);
          const { data: cachedReadings } = await supabase
            .from("sensor_readings")
            .select("*")
            .in("controller_id", controllerIds)
            .order("recorded_at", { ascending: false })
            .limit(sensorReadingLimit);

          if (cachedReadings && cachedReadings.length > 0) {
            finalSensorReadings = cachedReadings;
          }
        }
      }

      if (isMounted.current) {
        const rooms = roomsResult.data || [];
        const unassigned = unassignedResult.data || [];

        setRoomsWithControllers(rooms);
        setUnassignedControllersData(unassigned);

        // Timestamp-based merge: preserve realtime readings that are newer than fetched data
        // This fixes the race condition where initial fetch could overwrite realtime data
        setSensorReadings((prevReadings) => {
          if (prevReadings.length === 0) {
            // No existing readings - just use fetched data
            return finalSensorReadings;
          }

          // Find the oldest timestamp in the fetched data
          const oldestFetchedTimestamp = finalSensorReadings.length > 0
            ? Math.min(...finalSensorReadings.map(r => new Date(r.recorded_at).getTime()))
            : Date.now();

          // Preserve existing readings that are newer than the oldest fetched reading
          // These came from realtime subscriptions and shouldn't be overwritten
          const preservedRealtimeReadings = prevReadings.filter(r =>
            new Date(r.recorded_at).getTime() > oldestFetchedTimestamp
          );

          // Merge: realtime readings first (newer), then fetched readings
          const merged = new Map<string, SensorReading>();

          // Add preserved realtime readings first (they take priority)
          for (const reading of preservedRealtimeReadings) {
            const key = `${reading.controller_id}_${reading.sensor_type}_${reading.recorded_at}`;
            merged.set(key, reading);
          }

          // Add fetched readings (skip duplicates)
          for (const reading of finalSensorReadings) {
            const key = `${reading.controller_id}_${reading.sensor_type}_${reading.recorded_at}`;
            if (!merged.has(key)) {
              merged.set(key, reading);
            }
          }

          // Sort by recorded_at descending and limit
          return Array.from(merged.values())
            .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
            .slice(0, 2000); // Match realtime limit
        });

        setWorkflows(workflowsResult.data || []);
        setControllerPorts((portsResult.data as ControllerPort[]) || []);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch dashboard data";
      console.error("useDashboardData fetch error:", err);
      if (isMounted.current) {
        setError(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [sensorTimeRangeHours]);

  /**
   * Public refetch function for manual refresh triggers.
   */
  const refetch = useCallback(async () => {
    await fetchDashboardData(true);
  }, [fetchDashboardData]);

  /**
   * Debounced refetch for realtime events.
   * Prevents excessive API calls when multiple changes happen quickly.
   */
  const debouncedRealtimeRefetch = useCallback(() => {
    if (realtimeDebounceRef.current) {
      clearTimeout(realtimeDebounceRef.current);
    }
    realtimeDebounceRef.current = setTimeout(() => {
      if (isMounted.current) {
        fetchDashboardData(true);
      }
      realtimeDebounceRef.current = null;
    }, 500); // 500ms debounce
  }, [fetchDashboardData]);

  // ==========================================================================
  // Derived Data (Memoized)
  // ==========================================================================

  /**
   * Extract flat list of rooms from rooms with controllers.
   */
  const rooms = useMemo((): Room[] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return roomsWithControllers.map(({ controllers: _controllers, ...room }) => room);
  }, [roomsWithControllers]);

  /**
   * Extract flat list of all controllers across all rooms.
   */
  const controllers = useMemo((): Controller[] => {
    return roomsWithControllers.flatMap((room) => room.controllers || []);
  }, [roomsWithControllers]);

  /**
   * Filter controllers that are currently offline.
   * Offline includes 'offline' and 'error' statuses.
   */
  const offlineControllers = useMemo((): Controller[] => {
    return controllers.filter((c) => c.status !== 'online' && c.status !== 'initializing');
  }, [controllers]);

  /**
   * Controllers not assigned to any room.
   * These are controllers with room_id = null.
   */
  const unassignedControllers = useMemo((): Controller[] => {
    return unassignedControllersData;
  }, [unassignedControllersData]);

  // ==========================================================================
  // Demo Mode Logic
  // ==========================================================================

  /**
   * Determine if we should show demo mode.
   * Demo mode is active when:
   * - Initial loading is complete (not isLoading)
   * - No real controllers are registered (neither assigned nor unassigned)
   */
  const shouldShowDemoMode = useMemo(() => {
    // Don't show demo during initial load
    if (isLoading) return false;
    // Show demo only when no controllers exist (check both assigned and unassigned)
    return controllers.length === 0 && unassignedControllers.length === 0;
  }, [isLoading, controllers.length, unassignedControllers.length]);

  /**
   * Use the demo data updater hook.
   * This provides auto-updating demo data every 3 seconds when enabled.
   */
  const demoData = useDemoDataUpdater(shouldShowDemoMode);

  /**
   * Handle transition from demo mode to real mode.
   * Triggers a smooth 500ms fade-out when first real controller connects.
   */
  useEffect(() => {
    // Include both assigned and unassigned controllers
    const currentCount = controllers.length + unassignedControllers.length;
    const previousCount = previousControllersCountRef.current;

    // Detect transition: had 0 controllers (demo mode), now have 1+
    if (previousCount === 0 && currentCount > 0) {
      setIsTransitioningFromDemo(true);
      // Clear transition state after animation completes
      const timer = setTimeout(() => {
        setIsTransitioningFromDemo(false);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Update ref for next comparison
    previousControllersCountRef.current = currentCount;
  }, [controllers.length, unassignedControllers.length]);

  /**
   * Compute room summaries with aggregated sensor data and trends.
   * This is the main computed data structure used by dashboard components.
   */
  const roomSummaries = useMemo((): RoomSummary[] => {
    return roomsWithControllers.map((roomWithControllers) => {
      const { controllers: roomControllers = [], ...room } = roomWithControllers;

      // Get controller IDs for this room
      const controllerIds = roomControllers.map((c) => c.id);

      // Filter sensor readings for controllers in this room
      const roomReadings = sensorReadings.filter((r) =>
        r.controller_id && controllerIds.includes(r.controller_id)
      );

      // Calculate online/offline counts
      const onlineCount = roomControllers.filter((c) => c.status === 'online').length;
      const offlineCount = roomControllers.length - onlineCount;

      // Get latest sensor values across all controllers in the room
      const latestTemp = getLatestReading(roomReadings, "temperature");
      const latestHumidity = getLatestReading(roomReadings, "humidity");

      // Calculate VPD from temperature and humidity if both available
      // DO NOT fall back to stored VPD to maintain consistency
      let latestVPD: number | null = null;
      if (latestTemp !== null && latestHumidity !== null) {
        latestVPD = calculateVPD(latestTemp, latestHumidity);
      }

      // Calculate trends by comparing to values from ~1 hour ago
      const pastTemp = getReadingFromOneHourAgo(roomReadings, "temperature");
      const pastHumidity = getReadingFromOneHourAgo(roomReadings, "humidity");
      const pastVPD = getReadingFromOneHourAgo(roomReadings, "vpd");

      // Determine last update timestamp and staleness
      const latestReadingTimestamp = roomReadings.length > 0
        ? roomReadings[0].recorded_at
        : null;

      // Build temperature time series for charting
      const temperatureTimeSeries: TimeSeriesPoint[] = roomReadings
        .filter((r) => r.sensor_type === "temperature")
        .map((r) => ({
          timestamp: r.recorded_at,
          value: r.value,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        room,
        controllers: roomControllers,
        onlineCount,
        offlineCount,
        latestSensorData: {
          temperature: latestTemp,
          humidity: latestHumidity,
          vpd: latestVPD,
        },
        trends: {
          temperature: calculateTrend(latestTemp, pastTemp),
          humidity: calculateTrend(latestHumidity, pastHumidity),
          vpd: calculateTrend(latestVPD, pastVPD),
        },
        hasStaleData: isDataStale(latestReadingTimestamp),
        lastUpdateTimestamp: latestReadingTimestamp,
        temperatureTimeSeries,
      };
    });
  }, [roomsWithControllers, sensorReadings]);

  /**
   * Compute summaries for unassigned controllers with sensor data.
   * This allows displaying sensor data for controllers not yet assigned to rooms.
   */
  const unassignedControllerSummaries = useMemo((): UnassignedControllerSummary[] => {
    return unassignedControllersData.map((controller) => {
      // Filter sensor readings for this specific controller
      const controllerReadings = sensorReadings.filter(
        (r) => r.controller_id === controller.id
      );

      // Get latest sensor values
      const latestTemp = getLatestReading(controllerReadings, "temperature");
      const latestHumidity = getLatestReading(controllerReadings, "humidity");

      // Calculate VPD from temperature and humidity if both available
      let latestVPD: number | null = null;
      if (latestTemp !== null && latestHumidity !== null) {
        latestVPD = calculateVPD(latestTemp, latestHumidity);
      }

      // Calculate trends by comparing to values from ~1 hour ago
      const pastTemp = getReadingFromOneHourAgo(controllerReadings, "temperature");
      const pastHumidity = getReadingFromOneHourAgo(controllerReadings, "humidity");
      const pastVPD = getReadingFromOneHourAgo(controllerReadings, "vpd");

      // Determine last update timestamp and staleness
      const latestReadingTimestamp = controllerReadings.length > 0
        ? controllerReadings[0].recorded_at
        : null;

      // Build temperature time series for charting
      const temperatureTimeSeries: TimeSeriesPoint[] = controllerReadings
        .filter((r) => r.sensor_type === "temperature")
        .map((r) => ({
          timestamp: r.recorded_at,
          value: r.value,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        controller,
        isOnline: controller.status === 'online',
        latestSensorData: {
          temperature: latestTemp,
          humidity: latestHumidity,
          vpd: latestVPD,
        },
        trends: {
          temperature: calculateTrend(latestTemp, pastTemp),
          humidity: calculateTrend(latestHumidity, pastHumidity),
          vpd: calculateTrend(latestVPD, pastVPD),
        },
        hasStaleData: isDataStale(latestReadingTimestamp),
        lastUpdateTimestamp: latestReadingTimestamp,
        temperatureTimeSeries,
      };
    });
  }, [unassignedControllersData, sensorReadings]);

  /**
   * Compute aggregate dashboard metrics across all rooms and controllers.
   * IMPORTANT: Include both assigned AND unassigned controllers in the count AND averages.
   */
  const metrics = useMemo((): DashboardMetrics => {
    // Combine controllers from rooms AND unassigned controllers
    const allControllers = [...controllers, ...unassignedControllers];
    const totalControllers = allControllers.length;
    const onlineControllers = allControllers.filter((c) => c.status === 'online').length;
    const offlineCount = totalControllers - onlineControllers;

    // Calculate uptime percentage, handle division by zero
    const controllerUptime = totalControllers > 0
      ? Math.round((onlineControllers / totalControllers) * 100)
      : 0;

    // Calculate average sensor values across ALL controllers (rooms + unassigned)
    // Include data from room summaries
    const roomTemperatures = roomSummaries.map((s) => s.latestSensorData.temperature);
    const roomHumidities = roomSummaries.map((s) => s.latestSensorData.humidity);
    const roomVpds = roomSummaries.map((s) => s.latestSensorData.vpd);

    // Include data from unassigned controllers
    const unassignedTemperatures = unassignedControllerSummaries.map((s) => s.latestSensorData.temperature);
    const unassignedHumidities = unassignedControllerSummaries.map((s) => s.latestSensorData.humidity);
    const unassignedVpds = unassignedControllerSummaries.map((s) => s.latestSensorData.vpd);

    // Combine all sensor data for averaging
    const temperatures = [...roomTemperatures, ...unassignedTemperatures];
    const humidities = [...roomHumidities, ...unassignedHumidities];
    const vpds = [...roomVpds, ...unassignedVpds];

    return {
      totalControllers,
      onlineControllers,
      offlineControllers: offlineCount,
      controllerUptime,
      totalRooms: rooms.length,
      averageTemperature: calculateAverage(temperatures),
      averageHumidity: calculateAverage(humidities),
      averageVPD: calculateAverage(vpds),
    };
  }, [controllers, unassignedControllers, rooms.length, roomSummaries, unassignedControllerSummaries]);

  /**
   * Utility function to get a specific room's summary by ID.
   */
  const _getRoomSummary = useCallback(
    (roomId: string): RoomSummary | undefined => {
      return roomSummaries.find((s) => s.room.id === roomId);
    },
    [roomSummaries]
  );

  /**
   * Get ports for a specific controller by ID.
   * Memoized to avoid unnecessary recomputations.
   */
  const getPortsForController = useCallback(
    (controllerId: string): ControllerPort[] => {
      return controllerPorts.filter((p) => p.controller_id === controllerId);
    },
    [controllerPorts]
  );

  // ==========================================================================
  // Effects
  // ==========================================================================

  /**
   * Initial data fetch on mount.
   */
  useEffect(() => {
    isMounted.current = true;
    fetchDashboardData(false);

    return () => {
      isMounted.current = false;
    };
  }, [fetchDashboardData]);

  /**
   * Set up periodic refresh interval.
   */
  useEffect(() => {
    // Clear any existing interval first to prevent duplicates
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchDashboardData(true);
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [refreshInterval, fetchDashboardData]);

  /**
   * Set up real-time subscriptions for rooms, controllers, and sensor_readings.
   * Uses a single channel with multiple table subscriptions for efficiency.
   * Only subscribes if there's an authenticated session to prevent unauthorized access.
   */
  useEffect(() => {
    // Track if we've successfully set up subscriptions
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Validate session before setting up realtime subscriptions
    const setupSubscriptions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return;
      }

      channel = supabase.channel("dashboard_changes")
      // Subscribe to room changes (INSERT, UPDATE, DELETE)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
        },
        () => {
          // Debounced refetch to prevent excessive API calls
          debouncedRealtimeRefetch();
        }
      )
      // Subscribe to controller changes
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controllers",
        },
        () => {
          debouncedRealtimeRefetch();
        }
      )
      // Subscribe to controller port changes
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controller_ports",
        },
        () => {
          debouncedRealtimeRefetch();
        }
      )
      // Subscribe to new sensor readings (INSERT only for performance)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sensor_readings",
        },
        (payload) => {
          // Optimistically add new reading to state with deduplication
          const newReading = payload.new as SensorReading;
          if (isMounted.current) {
            setSensorReadings((prev) => {
              const deduplicated = new Map<string, SensorReading>();

              // Add new reading first
              const key = `${newReading.controller_id}_${newReading.sensor_type}_${newReading.recorded_at}`;
              deduplicated.set(key, newReading);

              // Add existing readings (skip duplicates)
              for (const reading of prev) {
                const k = `${reading.controller_id}_${reading.sensor_type}_${reading.recorded_at}`;
                if (!deduplicated.has(k)) {
                  deduplicated.set(k, reading);
                }
              }

              // Sort by recorded_at descending and limit
              // Match the initial fetch limit of 2000 for consistency
              return Array.from(deduplicated.values())
                .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
                .slice(0, 2000);
            });
          }
        }
      )
      // Subscribe to controller port changes (INSERT, UPDATE, DELETE)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "controller_ports",
        },
        (payload) => {
          // Handle port changes optimistically
          if (isMounted.current) {
            if (payload.eventType === "INSERT") {
              const newPort = payload.new as ControllerPort;
              setControllerPorts((prev) => {
                // Check for duplicates
                if (prev.some((p) => p.id === newPort.id)) {
                  return prev;
                }
                return [...prev, newPort].sort((a, b) => a.port_number - b.port_number);
              });
            } else if (payload.eventType === "UPDATE") {
              const updatedPort = payload.new as ControllerPort;
              setControllerPorts((prev) =>
                prev.map((p) => (p.id === updatedPort.id ? updatedPort : p))
              );
            } else if (payload.eventType === "DELETE") {
              const deletedPort = payload.old as ControllerPort;
              setControllerPorts((prev) =>
                prev.filter((p) => p.id !== deletedPort.id)
              );
            }
          }
        }
      )
      .subscribe();
    };

    // Start async subscription setup
    setupSubscriptions();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
    };
  }, [debouncedRealtimeRefetch]);

  // ==========================================================================
  // New Computed Values for Dashboard Components
  // ==========================================================================

  /**
   * Aggregated environment snapshot data for the EnvironmentSnapshot component.
   * Averages data across all rooms for a global view.
   */
  const environmentSnapshot = useMemo((): EnvironmentSnapshotData => {
    const isConnected = metrics.onlineControllers > 0;

    // Build historical VPD data from sensor readings
    // Group by 5-minute intervals and calculate VPD for each
    const intervalMs = 5 * 60 * 1000;
    const tempByInterval = new Map<number, number[]>();
    const humByInterval = new Map<number, number[]>();

    for (const reading of sensorReadings) {
      const time = Math.floor(new Date(reading.recorded_at).getTime() / intervalMs) * intervalMs;
      if (reading.sensor_type === "temperature") {
        const arr = tempByInterval.get(time) || [];
        arr.push(reading.value);
        tempByInterval.set(time, arr);
      } else if (reading.sensor_type === "humidity") {
        const arr = humByInterval.get(time) || [];
        arr.push(reading.value);
        humByInterval.set(time, arr);
      }
    }

    const historicalVpd: TimeSeriesPoint[] = [];
    for (const [time, temps] of tempByInterval) {
      const hums = humByInterval.get(time);
      if (hums && hums.length > 0) {
        const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
        const avgHum = hums.reduce((a, b) => a + b, 0) / hums.length;
        const vpd = calculateVPD(avgTemp, avgHum);
        if (vpd !== null) {
          historicalVpd.push({
            timestamp: new Date(time).toISOString(),
            value: vpd,
          });
        }
      }
    }

    // Sort by timestamp ascending
    historicalVpd.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate aggregated trends across all rooms
    const tempTrends = roomSummaries
      .map((s) => s.trends.temperature)
      .filter((t): t is TrendData => t !== undefined);
    const humTrends = roomSummaries
      .map((s) => s.trends.humidity)
      .filter((t): t is TrendData => t !== undefined);
    const vpdTrends = roomSummaries
      .map((s) => s.trends.vpd)
      .filter((t): t is TrendData => t !== undefined);

    const avgTempTrend = tempTrends.length > 0
      ? {
          delta: Math.round((tempTrends.reduce((acc, t) => acc + t.delta, 0) / tempTrends.length) * 10) / 10,
          period: "1h",
        }
      : undefined;

    const avgHumTrend = humTrends.length > 0
      ? {
          delta: Math.round((humTrends.reduce((acc, t) => acc + t.delta, 0) / humTrends.length) * 10) / 10,
          period: "1h",
        }
      : undefined;

    const avgVpdTrend = vpdTrends.length > 0
      ? {
          delta: Math.round((vpdTrends.reduce((acc, t) => acc + t.delta, 0) / vpdTrends.length) * 100) / 100,
          period: "1h",
        }
      : undefined;

    return {
      vpd: metrics.averageVPD,
      temperature: metrics.averageTemperature,
      humidity: metrics.averageHumidity,
      isConnected,
      trends: {
        temperature: avgTempTrend,
        humidity: avgHumTrend,
        vpd: avgVpdTrend,
      },
      historicalVpd,
    };
  }, [metrics, roomSummaries, sensorReadings]);

  /**
   * Time series data for the IntelligentTimeline component.
   */
  const timelineData = useMemo((): TimeSeriesData[] => {
    return convertToTimeSeriesData(sensorReadings);
  }, [sensorReadings]);

  /**
   * Alerts generated from environmental conditions.
   * Filtered to exclude dismissed alerts.
   */
  const alerts = useMemo((): Alert[] => {
    const allAlerts = generateAlerts(metrics, roomSummaries);
    return allAlerts.filter((a) => !dismissedAlerts.has(a.id));
  }, [metrics, roomSummaries, dismissedAlerts]);

  /**
   * Automation data from workflows.
   */
  const automations = useMemo((): Automation[] => {
    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      status: w.last_error ? "error" : w.is_active ? "active" : "paused",
      lastRun: w.last_run || undefined,
      roomName: rooms.find((r) => r.id === w.room_id)?.name,
    }));
  }, [workflows, rooms]);

  /**
   * Offline controller summaries for SmartActionCards.
   */
  const offlineControllerSummaries = useMemo((): ControllerSummary[] => {
    return offlineControllers.map((c) => ({
      id: c.id,
      name: c.name,
      lastSeen: c.last_seen || new Date().toISOString(),
    }));
  }, [offlineControllers]);

  /**
   * Dismiss an alert by ID.
   */
  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId));
  }, []);

  /**
   * Toggle automation (workflow) active state.
   */
  const toggleAutomation = useCallback(async (automationId: string) => {
    try {
      const workflow = workflows.find((w) => w.id === automationId);
      if (!workflow) return;

      const newStatus = !workflow.is_active;

      const { error: updateError } = await supabase
        .from("workflows")
        .update({ is_active: newStatus })
        .eq("id", automationId);

      if (updateError) {
        console.error("Failed to toggle automation:", updateError.message);
        return;
      }

      // Optimistic update
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === automationId ? { ...w, is_active: newStatus } : w
        )
      );
    } catch (err) {
      console.error("Error toggling automation:", err);
    }
  }, [workflows]);

  // Next scheduled event would come from dimmer_schedules table
  // For now, return undefined (can be enhanced later)
  const nextScheduledEvent: ScheduledEvent | undefined = undefined;

  // ==========================================================================
  // Demo Mode Data Merging
  // ==========================================================================

  /**
   * Final room summaries - uses demo data when in demo mode.
   */
  const finalRoomSummaries = useMemo((): RoomSummary[] => {
    if (shouldShowDemoMode) {
      return demoData.roomSummaries;
    }
    return roomSummaries;
  }, [shouldShowDemoMode, demoData.roomSummaries, roomSummaries]);

  /**
   * Final rooms - uses demo data when in demo mode.
   */
  const finalRooms = useMemo((): Room[] => {
    if (shouldShowDemoMode) {
      return demoData.rooms;
    }
    return rooms;
  }, [shouldShowDemoMode, demoData.rooms, rooms]);

  /**
   * Final controllers - uses demo data when in demo mode.
   */
  const finalControllers = useMemo((): Controller[] => {
    if (shouldShowDemoMode) {
      return demoData.controllers;
    }
    return controllers;
  }, [shouldShowDemoMode, demoData.controllers, controllers]);

  /**
   * Final environment snapshot - uses demo data when in demo mode.
   */
  const finalEnvironmentSnapshot = useMemo((): EnvironmentSnapshotData => {
    if (shouldShowDemoMode) {
      return {
        vpd: demoData.averageVPD,
        temperature: demoData.averageTemperature,
        humidity: demoData.averageHumidity,
        isConnected: true, // Demo shows as "connected" for display purposes
        trends: demoData.trends,
        historicalVpd: demoData.historicalVpd,
      };
    }
    return environmentSnapshot;
  }, [shouldShowDemoMode, demoData, environmentSnapshot]);

  /**
   * Final timeline data - uses demo data when in demo mode.
   */
  const finalTimelineData = useMemo((): TimeSeriesData[] => {
    if (shouldShowDemoMode) {
      return demoData.timelineData;
    }
    return timelineData;
  }, [shouldShowDemoMode, demoData.timelineData, timelineData]);

  /**
   * Final metrics - uses demo data when in demo mode.
   */
  const finalMetrics = useMemo((): DashboardMetrics => {
    if (shouldShowDemoMode) {
      return {
        totalControllers: demoData.controllers.length,
        onlineControllers: demoData.controllers.length,
        offlineControllers: 0,
        controllerUptime: 100,
        totalRooms: demoData.rooms.length,
        averageTemperature: demoData.averageTemperature,
        averageHumidity: demoData.averageHumidity,
        averageVPD: demoData.averageVPD,
      };
    }
    return metrics;
  }, [shouldShowDemoMode, demoData, metrics]);

  /**
   * Get room summary by ID - searches demo data when in demo mode.
   */
  const finalGetRoomSummary = useCallback(
    (roomId: string): RoomSummary | undefined => {
      if (shouldShowDemoMode) {
        return demoData.roomSummaries.find((s) => s.room.id === roomId);
      }
      return roomSummaries.find((s) => s.room.id === roomId);
    },
    [shouldShowDemoMode, demoData.roomSummaries, roomSummaries]
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // Core data (uses demo data when in demo mode)
    rooms: finalRooms,
    controllers: finalControllers,
    roomSummaries: finalRoomSummaries,
    metrics: finalMetrics,
    offlineControllers: shouldShowDemoMode ? [] : offlineControllers,
    unassignedControllers: shouldShowDemoMode ? [] : unassignedControllers,
    unassignedControllerSummaries: shouldShowDemoMode ? [] : unassignedControllerSummaries,
    isLoading,
    isRefreshing,
    error,
    refetch,
    getRoomSummary: finalGetRoomSummary,

    // Dashboard components data (uses demo data when in demo mode)
    environmentSnapshot: finalEnvironmentSnapshot,
    timelineData: finalTimelineData,
    alerts: shouldShowDemoMode ? [] : alerts, // No alerts in demo mode
    automations: shouldShowDemoMode ? [] : automations, // No automations in demo mode
    offlineControllerSummaries: shouldShowDemoMode ? [] : offlineControllerSummaries,
    nextScheduledEvent,
    dismissAlert,
    toggleAutomation,

    // Demo mode state
    isDemoMode: shouldShowDemoMode,
    isTransitioningFromDemo,

    // Raw sensor readings
    sensorReadings: shouldShowDemoMode ? [] : sensorReadings,

    // Controller ports data
    controllerPorts: shouldShowDemoMode ? [] : controllerPorts,
    getPortsForController,
  };
}

/**
 * Export VPD calculation utility for use in other components.
 * This allows consistent VPD calculation across the application.
 *
 * @param temperatureCelsius - Temperature in Celsius
 * @param humidityPercent - Relative humidity as percentage (0-100)
 * @returns VPD in kPa
 */
export { calculateVPD };
