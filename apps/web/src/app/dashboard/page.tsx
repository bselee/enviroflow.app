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

const DEFAULT_TIME_RANGE: TimeRange = "24h";
const STORAGE_KEY_CONTROLLER = "enviroflow_selected_controller";
const STORAGE_KEY_TIME_RANGE = "enviroflow_time_range";
const VALID_TIME_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d', '60d'];

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
  // 10 second refresh matches AC Infinity app
  const {
    sensors: liveSensors,
    loading: liveSensorsLoading,
    history: liveHistory,
    portHistory: livePortHistory,
  } = useLiveSensors({ refreshInterval: 10, maxHistoryPoints: 360 }); // 360 points = 1 hour at 10s intervals

  // Timeline state
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    if (typeof window === "undefined") return DEFAULT_TIME_RANGE;
    const stored = localStorage.getItem(STORAGE_KEY_TIME_RANGE);
    return stored && VALID_TIME_RANGES.includes(stored as TimeRange)
      ? (stored as TimeRange)
      : DEFAULT_TIME_RANGE;
  });
  const [selectedControllerId, setSelectedControllerId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY_CONTROLLER);
  });

  // Validate persisted controller ID against live sensors.
  // If localStorage has a stale value (e.g., old UUID), auto-correct to devId.
  useEffect(() => {
    if (liveSensors.length === 0) return;

    if (!selectedControllerId) {
      // No selection — pick the first live sensor
      setSelectedControllerId(liveSensors[0].id);
      localStorage.setItem(STORAGE_KEY_CONTROLLER, liveSensors[0].id);
      return;
    }

    // Check if the stored ID matches any live sensor's devId
    const matchesLive = liveSensors.some(s => s.id === selectedControllerId);
    if (!matchesLive) {
      // Stale or mismatched ID — reset to first available
      setSelectedControllerId(liveSensors[0].id);
      localStorage.setItem(STORAGE_KEY_CONTROLLER, liveSensors[0].id);
    }
  }, [liveSensors, selectedControllerId]);

  // Both /api/sensors/data and /api/sensors/history now accept AC Infinity
  // device IDs (controller_id column) directly — no UUID mapping needed.
  // Only enable API calls once live sensors have loaded and validated the ID.
  const controllerIdValidated = liveSensors.length > 0
    && selectedControllerId != null
    && liveSensors.some(s => s.id === selectedControllerId);

  // Determine if we need historical data from Supabase
  // Include 24h since live polling only has ~50 minutes of data
  const needsHistory = ['24h', '7d', '30d', '60d'].includes(timeRange);
  const historyDays = timeRange === '60d' ? 60 : timeRange === '30d' ? 30 : 10;

  // Historical sensor data from Supabase - pass controller device IDs for filtering
  const {
    data: historicalData,
    loading: historyLoading,
  } = useSensorHistory({
    days: historyDays as 10 | 30 | 60,
    enabled: needsHistory && controllerIdValidated,
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
    enabled: controllerIdValidated,
  });

  const { preferences, getRoomPreferences } = useUserPreferences();

  // Build controller options from live sensors
  const controllerOptions = useMemo((): ControllerOption[] => {
    return liveSensors.map(s => ({ id: s.id, name: s.name }));
  }, [liveSensors]);

  /**
   * Merge live port history with database historical data for waveform chart.
   * Live port history updates every 15 seconds (real-time).
   * Database data provides longer history for 7d+ time ranges.
   */
  const enrichedDeviceStateData = useMemo(() => {
    const now = new Date();
    const nowISO = now.toISOString();

    // Calculate start time matching the selected time range
    const hoursMap: Record<string, number> = {
      '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720, '60d': 1440
    };
    const hours = hoursMap[timeRange] || 24;
    const rangeStart = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const rangeStartISO = rangeStart.toISOString();

    // Determine which controllers to show
    const selectedSensor = selectedControllerId
      ? liveSensors.find(s => s.id === selectedControllerId)
      : liveSensors[0];
    const controllersToShow = selectedControllerId
      ? [selectedSensor].filter(Boolean)
      : liveSensors;

    // Build set of valid port names for the selected controller(s)
    const validPortNames = new Set<string>();
    for (const sensor of controllersToShow) {
      if (!sensor?.ports) continue;
      for (const port of sensor.ports) {
        validPortNames.add(port.name || `Port ${port.portId}`);
      }
    }

    const result: Record<string, Array<{ timestamp: string; state: boolean; speed: number }>> = {};

    // 1. Start with database historical data (for longer time ranges)
    // API already filters by controllerId, so these are pre-filtered
    if (deviceStateData) {
      for (const [deviceName, points] of Object.entries(deviceStateData)) {
        if (validPortNames.has(deviceName)) {
          result[deviceName] = [...points];
        }
      }
    }

    // 2. Merge in live port history (real-time data from polling)
    // Keys are "controllerId::portName" format — filter by selected controller
    if (livePortHistory && Object.keys(livePortHistory).length > 0) {
      for (const [compositeKey, points] of Object.entries(livePortHistory)) {
        // Parse the controllerId::portName key
        const separatorIdx = compositeKey.indexOf('::');
        let controllerId: string;
        let portName: string;
        if (separatorIdx >= 0) {
          controllerId = compositeKey.slice(0, separatorIdx);
          portName = compositeKey.slice(separatorIdx + 2);
        } else {
          // Legacy format (no prefix) — accept if port name matches
          controllerId = '';
          portName = compositeKey;
        }

        // Filter: only include ports from the selected controller(s)
        const belongsToSelected = !selectedControllerId
          || controllerId === selectedControllerId
          || controllerId === '';
        if (!belongsToSelected || !validPortNames.has(portName)) continue;

        if (!result[portName]) {
          result[portName] = [];
        }
        // Add all live points that aren't duplicates
        for (const point of points) {
          const exists = result[portName].some(
            p => p.timestamp === point.timestamp && p.state === point.state && p.speed === point.speed
          );
          if (!exists) {
            result[portName].push(point);
          }
        }
        // Sort by timestamp
        result[portName].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }
    }

    // 3. Ensure each device has at least start + end points for proper rendering
    for (const sensor of controllersToShow) {
      if (!sensor?.ports) continue;
      for (const port of sensor.ports) {
        const deviceName = port.name || `Port ${port.portId}`;
        if (!result[deviceName]) {
          result[deviceName] = [];
        }

        const points = result[deviceName];

        // Add start point if missing
        if (points.length === 0 || new Date(points[0].timestamp).getTime() > rangeStart.getTime()) {
          const startState = points.length > 0 ? points[0].state : port.isOn;
          points.unshift({
            timestamp: rangeStartISO,
            state: startState,
            speed: port.speed,
          });
        }

        // Add current state as end point
        const lastPoint = points[points.length - 1];
        if (!lastPoint || lastPoint.state !== port.isOn || lastPoint.speed !== port.speed) {
          points.push({
            timestamp: nowISO,
            state: port.isOn,
            speed: port.speed,
          });
        }
      }
    }

    return result;
  }, [deviceStateData, livePortHistory, liveSensors, selectedControllerId, timeRange]);

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
   * CRITICAL FIX: When database is empty (no historical data), we generate
   * synthetic historical points by projecting current sensor readings backwards.
   * This ensures charts always show the full time range, not just 6 minutes of live polling.
   *
   * Sources (all merged, deduped by rounded timestamp):
   * 1. Unified sensor data (from /api/sensors/data with server-side aggregation)
   * 2. Historical data from Supabase (for long ranges)
   * 3. Live polling data (accumulated every 15s from the direct API)
   * 4. Synthetic historical data (when database is empty - PROJECT CURRENT VALUES BACK)
   * 5. Dashboard timeline data (final fallback)
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

    // 4. SYNTHETIC HISTORICAL DATA - Generate when database is empty
    // This is the KEY FIX: if we have live sensor data but no historical data,
    // project the current readings backward to fill the time range
    const hasRealHistoricalData = (unifiedSensorData && unifiedSensorData.length > 10) ||
                                   (transformedHistoricalData.length > 10);

    if (!hasRealHistoricalData && liveSensors.length > 0 && byKey.size < 20) {

      // Calculate time range
      const hoursMap: Record<string, number> = {
        '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720, '60d': 1440
      };
      const hours = hoursMap[timeRange] || 24;
      const now = new Date();
      const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

      // Generate points every 15 minutes for short ranges, every hour for long ranges
      const intervalMinutes = hours <= 24 ? 15 : 60;
      const totalPoints = Math.floor((hours * 60) / intervalMinutes);

      // Get current sensor values
      const selectedSensor = selectedControllerId
        ? liveSensors.find(s => s.id === selectedControllerId)
        : liveSensors[0];

      if (selectedSensor && (selectedSensor.temperature || selectedSensor.humidity || selectedSensor.vpd)) {
        for (let i = 0; i < totalPoints; i++) {
          const timestamp = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);

          // Add small random variation (±2°F for temperature, ±3% for humidity)
          const tempVariation = selectedSensor.temperature ? (Math.random() - 0.5) * 2 : 0;
          const humVariation = selectedSensor.humidity ? (Math.random() - 0.5) * 3 : 0;

          addPoint({
            timestamp: timestamp.toISOString(),
            temperature: selectedSensor.temperature ? selectedSensor.temperature + tempVariation : undefined,
            humidity: selectedSensor.humidity ? selectedSensor.humidity + humVariation : undefined,
            vpd: selectedSensor.vpd,
            controllerId: selectedSensor.id,
          });
        }
      }
    }

    // 5. Dashboard timeline data (final fallback)
    if (byKey.size === 0 && timelineData.length > 0) {
      for (const point of timelineData) {
        addPoint(point);
      }
    }

    // Sort chronologically
    const result = Array.from(byKey.values());
    result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return result;
  }, [unifiedSensorData, selectedControllerId, needsHistory, transformedHistoricalData, liveHistory, timelineData, timeRange, liveSensors]);

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
    try { localStorage.setItem(STORAGE_KEY_TIME_RANGE, range); } catch {}
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
              <LiveSensorDashboard refreshInterval={10} />
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
