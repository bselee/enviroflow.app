"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { IntelligentTimeline, type TimeSeriesData } from "@/components/dashboard/IntelligentTimeline";
import { ConnectCTA } from "@/components/dashboard/DemoMode";
import { LiveSensorDashboard } from "@/components/LiveSensorDashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { AddRoomDialog } from "@/components/dashboard/AddRoomDialog";
import { SettingsSheet } from "@/components/settings";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useLiveSensors } from "@/hooks/use-live-sensors";
import { useSensorHistory, type AggregatedReading } from "@/hooks/use-sensor-history";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { TimeRange } from "@/components/dashboard/IntelligentTimeline";
import type { RoomOption } from "@/components/settings";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default time range for the timeline chart.
 */
const DEFAULT_TIME_RANGE: TimeRange = "1d";

// =============================================================================
// Loading Skeletons
// =============================================================================

/**
 * Skeleton placeholder for the timeline while loading.
 */
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
    // Computed data for components
    rooms,
    timelineData,
    // Loading states
    isLoading,
    // Actions
    refetch,
    // Demo mode
    isDemoMode,
    isTransitioningFromDemo,
  } = useDashboardData();

  // Live sensor data from Direct API (bypasses Supabase)
  const {
    sensors: liveSensors,
    averages: liveAverages,
    loading: liveSensorsLoading,
    history: liveHistory,
  } = useLiveSensors({ refreshInterval: 15, maxHistoryPoints: 200 });

  // Timeline state
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);

  // Determine if we need historical data from Supabase
  const needsHistory = ['7d', '30d', '60d'].includes(timeRange);
  const historyDays = timeRange === '60d' ? 60 : timeRange === '30d' ? 30 : 10;

  // Historical sensor data from Supabase (only fetches when needed)
  const {
    data: historicalData,
    loading: historyLoading,
  } = useSensorHistory({
    days: historyDays as 10 | 30 | 60,
    enabled: needsHistory,
  });

  // User preferences for dashboard settings
  const { preferences, getRoomPreferences } = useUserPreferences();

  // Dialog state for adding new rooms
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);

  /**
   * Convert historical data from Supabase to timeline format.
   * Groups by timestamp and combines temperature, humidity, vpd.
   */
  const transformedHistoricalData = useMemo((): TimeSeriesData[] => {
    if (!historicalData || historicalData.length === 0) return [];

    // Group by bucket_start timestamp
    const byTimestamp = new Map<string, TimeSeriesData>();

    for (const reading of historicalData) {
      const timestamp = reading.bucket_start;
      
      if (!byTimestamp.has(timestamp)) {
        byTimestamp.set(timestamp, {
          timestamp,
          controllerId: reading.controller_id,
        });
      }

      const point = byTimestamp.get(timestamp)!;
      
      // Map sensor_type to property
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

    // Convert to array and sort by timestamp
    const result = Array.from(byTimestamp.values());
    result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return result;
  }, [historicalData]);

  /**
   * Generate timeline data from the appropriate source.
   * - Short ranges (1h-24h): Use live polling data
   * - Long ranges (7d-60d): Use Supabase historical data
   */
  const effectiveTimelineData = useMemo((): TimeSeriesData[] => {
    // For long ranges, use historical data from Supabase
    if (needsHistory && transformedHistoricalData.length > 0) {
      return transformedHistoricalData;
    }
    
    // For short ranges, use accumulated live history
    if (liveHistory.length > 0) {
      return liveHistory.map(point => ({
        timestamp: point.timestamp,
        temperature: point.temperature,
        humidity: point.humidity,
        vpd: point.vpd,
      }));
    }
    
    // If we have database timeline data from dashboard hook, use it
    if (timelineData.length > 0) {
      return timelineData;
    }
    
    // Fallback: create a single point from current averages
    if (liveSensors.length > 0 && liveAverages.temperature !== null) {
      const now = new Date().toISOString();
      return [{
        timestamp: now,
        temperature: liveAverages.temperature,
        humidity: liveAverages.humidity ?? undefined,
        vpd: liveAverages.vpd ?? undefined,
      }];
    }
    
    return [];
  }, [needsHistory, transformedHistoricalData, liveHistory, timelineData, liveSensors, liveAverages]);

  /**
   * Transform rooms into the format expected by SettingsSheet.
   */
  const roomOptions: RoomOption[] = useMemo(() => {
    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
    }));
  }, [rooms]);

  /**
   * Get optimal ranges from user preferences or use defaults.
   */
  const optimalRanges = useMemo(() => {
    if (rooms.length > 0) {
      const firstRoomPrefs = getRoomPreferences(rooms[0].id);
      return {
        vpd: firstRoomPrefs.optimalVPD,
        temperature: firstRoomPrefs.optimalTemp,
        humidity: firstRoomPrefs.optimalHumidity,
      };
    }
    // Default ranges
    return {
      vpd: [0.8, 1.2] as [number, number],
      temperature: [70, 85] as [number, number],
      humidity: [50, 70] as [number, number],
    };
  }, [rooms, getRoomPreferences]);

  /**
   * Handles time range change for the timeline.
   */
  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, []);

  /**
   * Handles room creation success - refresh data.
   */
  const handleRoomCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <AppLayout>
      {/* Onboarding Tour */}
      <OnboardingTour />

      <div className="min-h-screen bg-env-bg">
        {/* Page Header */}
        <PageHeader
          title="Dashboard"
          description="Monitor your grow environment"
          actions={
            <>
              <SettingsSheet
                rooms={roomOptions}
                currentValues={{}}
              />
              <Button onClick={() => setIsAddRoomOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Room
              </Button>
              <AddRoomDialog
                open={isAddRoomOpen}
                onOpenChange={setIsAddRoomOpen}
                onRoomCreated={handleRoomCreated}
              />
            </>
          }
        />

        {/* Main Content - Simplified HA-Style Layout */}
        <ErrorBoundary componentName="Dashboard" showRetry>
          <div className="p-6 lg:p-8 space-y-6">
            {/* Connect CTA - Prominent button when in demo mode */}
            {isDemoMode && !isLoading && (
              <div className="flex justify-center">
                <ConnectCTA />
              </div>
            )}

            {/* Section 1: Live Sensor Dashboard - Controller cards with Temp/Humidity/VPD */}
            <LiveSensorDashboard />

            {/* Section 2: Intelligent Timeline - Sensor trend graphs */}
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
