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

  // Both /api/sensors/data and /api/sensors/history now accept AC Infinity
  // device IDs (controller_id column) directly — no UUID mapping needed.

  // Determine if we need historical data from Supabase
  // Include 24h/1d since live polling only has ~50 minutes of data
  const needsHistory = ['24h', '1d', '7d', '30d', '60d'].includes(timeRange);
  const historyDays = timeRange === '60d' ? 60 : timeRange === '30d' ? 30 : 10;

  // Historical sensor data from Supabase - pass controller device IDs for filtering
  const {
    data: historicalData,
    loading: historyLoading,
  } = useSensorHistory({
    days: historyDays as 10 | 30 | 60,
    enabled: needsHistory,
    controllerIds: selectedControllerId ? [selectedControllerId] : undefined,
  });

  // New unified sensor data hook - fetches data with server-side aggregation
  // Also fetches device state data for the waveform chart
  const {
    sensorData: unifiedSensorData,
    deviceStateData,
    loading: sensorDataLoading,
  } = useSensorData({
    controllerId: selectedControllerId,
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
   * Merge historical device state data with current live port states.
   * This ensures the waveform chart shows current device states even if
   * no historical state changes are logged in the database.
   *
   * For devices without historical data, we assume they've been in their
   * current state for the entire visible time range (creates flat line).
   */
  const enrichedDeviceStateData = useMemo(() => {
    const now = new Date();
    const nowISO = now.toISOString();

    // Calculate start of time range based on current timeRange setting
    const hoursMap: Record<string, number> = {
      '1h': 1, '6h': 6, '24h': 24, '1d': 24, '7d': 168, '30d': 720, '60d': 1440
    };
    const hours = hoursMap[timeRange] || 24;
    const rangeStart = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const rangeStartISO = rangeStart.toISOString();

    const result: Record<string, Array<{ timestamp: string; state: boolean; speed: number }>> = {};

    // First, copy historical data
    if (deviceStateData) {
      for (const [deviceName, points] of Object.entries(deviceStateData)) {
        result[deviceName] = [...points];
      }
    }

    // Then, inject current live port states from the selected controller
    const selectedSensor = selectedControllerId
      ? liveSensors.find(s => s.id === selectedControllerId)
      : liveSensors[0];

    if (selectedSensor?.ports) {
      for (const port of selectedSensor.ports) {
        const deviceName = port.name || `Port ${port.portId}`;
        const existingPoints = result[deviceName] || [];

        // If no historical data exists, add a point at the START of the range
        // This creates a flat line showing the assumed state for the entire period
        if (existingPoints.length === 0) {
          result[deviceName] = [
            {
              timestamp: rangeStartISO,
              state: port.isOn,
              speed: port.speed,
            },
          ];
        }

        // Add current state as the latest point
        const points = result[deviceName];
        const lastPoint = points[points.length - 1];

        // Only add if state differs OR if we need a closing point
        if (!lastPoint || lastPoint.state !== port.isOn || lastPoint.speed !== port.speed || points.length === 1) {
          result[deviceName].push({
            timestamp: nowISO,
            state: port.isOn,
            speed: port.speed,
          });
        }
      }
    }

    return result;
  }, [deviceStateData, liveSensors, selectedControllerId, timeRange]);

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
   * Generate timeline data by MERGING all available sources.
   *
   * Instead of choosing one source, we merge and deduplicate so the chart
   * always has the maximum number of data points — critical for the chart
   * which needs ≥1 point to render.
   *
   * Sources (all merged, deduped by rounded timestamp):
   * 1. Unified sensor data (from /api/sensors/data with server-side aggregation)
   * 2. Historical data from Supabase (for long ranges)
   * 3. Live polling data (accumulated every 15s from the direct API)
   * 4. Dashboard timeline data (final fallback)
   */
  const effectiveTimelineData = useMemo((): TimeSeriesData[] => {
    const byKey = new Map<string, TimeSeriesData>();

    const addPoint = (p: TimeSeriesData) => {
      // Round to nearest minute for dedup key
      const d = new Date(p.timestamp);
      d.setSeconds(0, 0);
      const key = `${p.controllerId ?? 'all'}|${d.getTime()}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...p, timestamp: d.toISOString() });
      } else {
        // Merge: prefer non-null values
        if (p.temperature != null && existing.temperature == null) existing.temperature = p.temperature;
        if (p.humidity != null && existing.humidity == null) existing.humidity = p.humidity;
        if (p.vpd != null && existing.vpd == null) existing.vpd = p.vpd;
      }
    };

    // 1. Unified sensor data (highest quality — server-aggregated)
    if (unifiedSensorData && unifiedSensorData.length > 0) {
      for (const point of toTimeSeriesData(unifiedSensorData, selectedControllerId ?? undefined)) {
        addPoint(point);
      }
    }

    // 2. Historical data from Supabase (for long ranges)
    if (needsHistory && transformedHistoricalData.length > 0) {
      for (const point of transformedHistoricalData) {
        addPoint(point);
      }
    }

    // 3. Live polling history (accumulated in-memory from direct API)
    if (liveHistory.length > 0) {
      for (const point of liveHistory) {
        addPoint({
          timestamp: point.timestamp,
          temperature: point.temperature,
          humidity: point.humidity,
          vpd: point.vpd,
          controllerId: point.controllerId,
        });
      }
    }

    // 4. Dashboard timeline data (fallback)
    if (byKey.size === 0 && timelineData.length > 0) {
      for (const point of timelineData) {
        addPoint(point);
      }
    }

    // Sort chronologically
    const result = Array.from(byKey.values());
    result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return result;
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
                  deviceStateData={enrichedDeviceStateData}
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
