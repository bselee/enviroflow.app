"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { IntelligentTimeline, type TimeSeriesData } from "@/components/dashboard/IntelligentTimeline";
import type { ControllerOption, TimeRange } from "@/components/dashboard/IntelligentTimeline";
import { LiveSensorDashboard } from "@/components/LiveSensorDashboard";
import { ConnectCTA } from "@/components/dashboard/DemoMode";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLiveSensors } from "@/hooks/use-live-sensors";
import { useSensorHistory } from "@/hooks/use-sensor-history";
import { useSensorData, toTimeSeriesData } from "@/hooks/use-sensor-data";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TIME_RANGE: TimeRange = "1d";
const STORAGE_KEY_CONTROLLER = "enviroflow_selected_controller";

// =============================================================================
// Loading Skeletons
// =============================================================================

function TimelineSkeleton(): JSX.Element {
  return (
    <div className="w-full rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Dashboard Page Component
 *
 * AC Infinity-inspired environmental monitoring dashboard:
 * 1. LiveSensorDashboard - Controller cards with Temp/Humidity/VPD in AC Infinity style
 * 2. IntelligentTimeline - Sensor trend graphs with time range selector
 */
export default function DashboardPage(): JSX.Element {
  const {
    rooms,
    controllers,
    timelineData,
    isLoading,
    isDemoMode,
    isTransitioningFromDemo,
  } = useDashboardData();

  // Live sensor data from Direct API (bypasses Supabase)
  const {
    sensors: liveSensors,
    loading: liveSensorsLoading,
    history: liveHistory,
  } = useLiveSensors({ refreshInterval: 15, maxHistoryPoints: 200 });

  // Timeline state
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const [selectedControllerId, setSelectedControllerId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_CONTROLLER);
  });

  // Auto-select first controller when sensors load and no persisted choice exists
  useEffect(() => {
    if (selectedControllerId) return;
    if (liveSensors.length > 0) {
      setSelectedControllerId(liveSensors[0].id);
      localStorage.setItem(STORAGE_KEY_CONTROLLER, liveSensors[0].id);
    }
  }, [liveSensors, selectedControllerId]);

  // Build controller ID mapping: AC Infinity device ID → Supabase UUID
  // This is needed because liveSensors use AC Infinity device IDs, but
  // the sensors/data API expects Supabase controller UUIDs
  const controllerIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const controller of controllers) {
      // controller.controller_id is the AC Infinity device ID
      // controller.id is the Supabase UUID
      if (controller.controller_id && controller.id) {
        map.set(controller.controller_id, controller.id);
      }
    }
    return map;
  }, [controllers]);

  // Convert selected AC Infinity ID to Supabase UUID for API calls
  const selectedSupabaseId = useMemo(() => {
    if (!selectedControllerId) return null;
    // Check if selectedControllerId is already a Supabase UUID (36 chars with dashes)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedControllerId);
    if (isUUID) return selectedControllerId;
    // Otherwise, look up the mapping
    return controllerIdMap.get(selectedControllerId) ?? null;
  }, [selectedControllerId, controllerIdMap]);

  // Determine if we need historical data from Supabase
  // Include 24h/1d since live polling only has ~50 minutes of data
  const needsHistory = ['24h', '1d', '7d', '30d', '60d'].includes(timeRange);
  const historyDays = timeRange === '60d' ? 60 : timeRange === '30d' ? 30 : 10;

  // Historical sensor data from Supabase - pass controllerIds for filtering
  // Uses Supabase UUID (selectedSupabaseId), not AC Infinity device ID
  const {
    data: historicalData,
    loading: historyLoading,
  } = useSensorHistory({
    days: historyDays as 10 | 30 | 60,
    enabled: needsHistory,
    controllerIds: selectedSupabaseId ? [selectedSupabaseId] : undefined,
  });

  // New unified sensor data hook - fetches data with server-side aggregation
  // Also fetches device state data for the waveform chart
  // Uses Supabase UUID (selectedSupabaseId), not AC Infinity device ID
  const {
    sensorData: unifiedSensorData,
    deviceStateData,
    loading: sensorDataLoading,
  } = useSensorData({
    controllerId: selectedSupabaseId,
    timeRange,
    includeDeviceState: true,
    enabled: true,
  });

  const { preferences, getRoomPreferences } = useUserPreferences();

  // Build controller options from live sensors
  const controllerOptions = useMemo((): ControllerOption[] => {
    return liveSensors.map(s => ({ id: s.id, name: s.name }));
  }, [liveSensors]);

  /**
   * Convert historical data to timeline format.
   * Groups by (controller_id + timestamp) so per-controller data is preserved.
   */
  const transformedHistoricalData = useMemo((): TimeSeriesData[] => {
    if (!historicalData || historicalData.length === 0) return [];

    // Group by controller_id + bucket_start so each controller keeps its own data points
    const byKey = new Map<string, TimeSeriesData>();

    for (const reading of historicalData) {
      const key = `${reading.controller_id}|${reading.bucket_start}`;

      if (!byKey.has(key)) {
        byKey.set(key, {
          timestamp: reading.bucket_start,
          controllerId: reading.controller_id,
        });
      }

      const point = byKey.get(key)!;

      switch (reading.sensor_type) {
        case 'temperature':
          point.temperature = reading.avg_value;
          break;
        case 'humidity':
          point.humidity = reading.avg_value;
          break;
        case 'vpd':
          point.vpd = reading.avg_value;
          break;
      }
    }

    const result = Array.from(byKey.values());
    result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return result;
  }, [historicalData]);

  /**
   * Generate timeline data from the appropriate source.
   * Priority:
   * 1. Unified sensor data (from useSensorData hook - handles all time ranges with proper aggregation)
   * 2. Historical data from Supabase (fallback for long ranges)
   * 3. Live polling data (for short ranges when unified data is loading)
   * 4. Dashboard timeline data (final fallback)
   */
  const effectiveTimelineData = useMemo((): TimeSeriesData[] => {
    // Prefer unified sensor data when available (properly aggregated for time range)
    if (unifiedSensorData && unifiedSensorData.length > 0) {
      return toTimeSeriesData(unifiedSensorData, selectedControllerId ?? undefined);
    }

    // For long ranges, use historical data from Supabase
    if (needsHistory && transformedHistoricalData.length > 0) {
      return transformedHistoricalData;
    }

    // For short ranges, use accumulated live history (now per-controller)
    if (liveHistory.length > 0) {
      return liveHistory.map(point => ({
        timestamp: point.timestamp,
        temperature: point.temperature,
        humidity: point.humidity,
        vpd: point.vpd,
        controllerId: point.controllerId,
      }));
    }

    // If we have database timeline data from dashboard hook, use it
    if (timelineData.length > 0) {
      return timelineData;
    }

    return [];
  }, [unifiedSensorData, selectedControllerId, needsHistory, transformedHistoricalData, liveHistory, timelineData]);

  const optimalRanges = useMemo(() => {
    if (rooms.length > 0) {
      const firstRoomPrefs = getRoomPreferences(rooms[0].id);
      return {
        vpd: firstRoomPrefs.optimalVPD,
        temperature: firstRoomPrefs.optimalTemp,
        humidity: firstRoomPrefs.optimalHumidity,
      };
    }
    return {
      vpd: [0.8, 1.2] as [number, number],
      temperature: [70, 85] as [number, number],
      humidity: [50, 70] as [number, number],
    };
  }, [rooms, getRoomPreferences]);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, []);

  const handleControllerChange = useCallback((controllerId: string | null) => {
    setSelectedControllerId(controllerId);
    if (controllerId) {
      localStorage.setItem(STORAGE_KEY_CONTROLLER, controllerId);
    } else {
      localStorage.removeItem(STORAGE_KEY_CONTROLLER);
    }
  }, []);

  return (
    <AppLayout>
      <OnboardingTour />

      <div className="min-h-screen bg-background">
        <ErrorBoundary componentName="Dashboard" showRetry>
          <div className="p-6 lg:p-8 space-y-6">
            {isDemoMode && !isLoading && (
              <div className="flex justify-center">
                <ConnectCTA />
              </div>
            )}

            {/* AC Infinity-style Live Sensor Cards */}
            {!isDemoMode && (
              <LiveSensorDashboard refreshInterval={15} />
            )}

            <div
              className={cn(
                "w-full rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6",
                "transition-opacity duration-500",
                isTransitioningFromDemo && "opacity-50"
              )}
            >
              {isLoading && liveSensorsLoading ? (
                <TimelineSkeleton />
              ) : (
                <IntelligentTimeline
                  data={effectiveTimelineData}
                  liveSensors={liveSensors}
                  controllers={controllerOptions}
                  selectedControllerId={selectedControllerId ?? undefined}
                  onControllerChange={handleControllerChange}
                  focusMetric={preferences.primaryMetric === "co2" ? "vpd" : preferences.primaryMetric}
                  timeRange={timeRange}
                  onTimeRangeChange={handleTimeRangeChange}
                  optimalRanges={optimalRanges}
                  isLoading={needsHistory && historyLoading}
                  deviceStateData={deviceStateData}
                  isSensorDataLoading={sensorDataLoading}
                />
              )}
            </div>
          </div>
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
