"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { IntelligentTimeline, type TimeSeriesData } from "@/components/dashboard/IntelligentTimeline";
import type { ControllerOption, TimeRange } from "@/components/dashboard/IntelligentTimeline";
import { ConnectCTA } from "@/components/dashboard/DemoMode";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLiveSensors } from "@/hooks/use-live-sensors";
import { useSensorHistory } from "@/hooks/use-sensor-history";
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
 * Simplified Home Assistant-inspired layout:
 * 1. LiveSensorDashboard - Controller cards with Temp/Humidity/VPD
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

  // Determine if we need historical data from Supabase
  const needsHistory = ['7d', '30d', '60d'].includes(timeRange);
  const historyDays = timeRange === '60d' ? 60 : timeRange === '30d' ? 30 : 10;

  // Historical sensor data from Supabase - pass controllerIds for filtering
  const {
    data: historicalData,
    loading: historyLoading,
  } = useSensorHistory({
    days: historyDays as 10 | 30 | 60,
    enabled: needsHistory,
    controllerIds: selectedControllerId ? [selectedControllerId] : undefined,
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
   * - Short ranges (1h-24h): Use live polling data (per-controller)
   * - Long ranges (7d-60d): Use Supabase historical data
   */
  const effectiveTimelineData = useMemo((): TimeSeriesData[] => {
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
  }, [needsHistory, transformedHistoricalData, liveHistory, timelineData]);

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
                />
              )}
            </div>
          </div>
        </ErrorBoundary>
      </div>
    </AppLayout>
  );
}
