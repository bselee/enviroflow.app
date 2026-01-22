"use client";

import { useState, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { EnvironmentSnapshot } from "@/components/dashboard/EnvironmentSnapshot";
import { IntelligentTimeline } from "@/components/dashboard/IntelligentTimeline";
import { SmartActionCards, SmartActionCardsSkeleton } from "@/components/dashboard/SmartActionCards";
import {
  DemoBanner,
  ConnectCTA,
} from "@/components/dashboard/DemoMode";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { AddRoomDialog } from "@/components/dashboard/AddRoomDialog";
import { SettingsSheet } from "@/components/settings";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn } from "@/lib/utils";
import type { TimeRange } from "@/components/dashboard/IntelligentTimeline";
import type { RoomOption } from "@/components/settings";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default time range for the timeline chart.
 */
const DEFAULT_TIME_RANGE: TimeRange = "24h";

// =============================================================================
// Loading Skeletons
// =============================================================================

/**
 * Skeleton placeholder for the environment snapshot while loading.
 */
function EnvironmentSnapshotSkeleton(): JSX.Element {
  return (
    <div className="w-full rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6 md:p-8 lg:p-10">
      <div className="flex justify-end mb-4 md:mb-2">
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 items-center">
        {/* Temperature skeleton */}
        <div className="flex flex-col items-center justify-center order-2 md:order-1">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-14 w-24 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* VPD Dial skeleton */}
        <div className="flex items-center justify-center order-1 md:order-2">
          <Skeleton className="rounded-full w-[220px] h-[220px]" />
        </div>
        {/* Humidity skeleton */}
        <div className="flex flex-col items-center justify-center order-3">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-14 w-24 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

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
 * The main dashboard view showing:
 * 1. Environment Snapshot - Hero section with VPD dial and current temp/humidity
 * 2. Intelligent Timeline - 24h trend chart with time range selector
 * 3. Smart Action Cards - Contextual alerts, offline controllers, automations
 * 4. Rooms Section - Room cards with configurable view modes:
 *    - Primary+Mini: One large primary card with mini sidebar cards
 *    - Grid: All rooms in equal-sized responsive grid
 *    - Carousel: Swipe-enabled single room view (mobile optimized)
 *    - Split-screen: Two rooms side-by-side for comparison
 *
 * Uses the useDashboardData hook for consolidated data fetching and state management.
 * View mode preference is persisted to localStorage.
 */
export default function DashboardPage(): JSX.Element {
  const {
    // Computed data for components
    roomSummaries,
    rooms,
    environmentSnapshot,
    timelineData,
    alerts,
    automations,
    offlineControllerSummaries,
    nextScheduledEvent,
    // Loading states
    isLoading,
    // Actions
    refetch,
    dismissAlert,
    toggleAutomation,
    // Demo mode
    isDemoMode,
    isTransitioningFromDemo,
  } = useDashboardData();

  // User preferences for dashboard settings
  const { preferences, getRoomPreferences } = useUserPreferences();

  // Dialog state for adding new rooms
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);

  // Timeline state
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);

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
   * Get current environment values for settings preview.
   */
  const currentValues = useMemo(() => ({
    vpd: environmentSnapshot.vpd ?? undefined,
    temperature: environmentSnapshot.temperature ?? undefined,
    humidity: environmentSnapshot.humidity ?? undefined,
  }), [environmentSnapshot]);

  /**
   * Get optimal ranges from user preferences or use defaults.
   * Uses the first room's settings if available, otherwise uses defaults.
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
   * Handles alert dismissal.
   */
  const handleAlertDismiss = useCallback(
    (alertId: string) => {
      dismissAlert(alertId);
    },
    [dismissAlert]
  );

  /**
   * Handles automation toggle (pause/resume).
   */
  const handleAutomationToggle = useCallback(
    (automationId: string) => {
      toggleAutomation(automationId);
    },
    [toggleAutomation]
  );

  /**
   * Handles room creation success - refresh data.
   */
  const handleRoomCreated = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-env-bg">
        {/* Page Header */}
        <PageHeader
          title="Dashboard"
          description="Monitor your grow environment"
          actions={
            <>
              <SettingsSheet
                rooms={roomOptions}
                currentValues={currentValues}
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

        {/* Main Content */}
        <div className="p-6 lg:p-8 space-y-8">
          {/* Demo Mode Banner - Shows status indicator */}
          {!isLoading && (
            <DemoBanner
              isDemoMode={isDemoMode}
              roomCount={rooms.length}
              isTransitioning={isTransitioningFromDemo}
            />
          )}

          {/* Connect CTA - Prominent button when in demo mode */}
          {isDemoMode && !isLoading && (
            <div className="flex justify-center">
              <ConnectCTA />
            </div>
          )}

          {/* Environment Snapshot Section */}
          <div
            className={cn(
              "transition-opacity duration-500",
              isTransitioningFromDemo && "opacity-50"
            )}
          >
            {isLoading ? (
              <EnvironmentSnapshotSkeleton />
            ) : (
              <EnvironmentSnapshot
                vpd={environmentSnapshot.vpd}
                temperature={environmentSnapshot.temperature}
                humidity={environmentSnapshot.humidity}
                temperatureUnit={preferences.temperatureUnit}
                isConnected={environmentSnapshot.isConnected}
                trends={{
                  temperature: environmentSnapshot.trends.temperature
                    ? {
                        delta: environmentSnapshot.trends.temperature.delta,
                        period: environmentSnapshot.trends.temperature.period,
                      }
                    : undefined,
                  humidity: environmentSnapshot.trends.humidity
                    ? {
                        delta: environmentSnapshot.trends.humidity.delta,
                        period: environmentSnapshot.trends.humidity.period,
                      }
                    : undefined,
                  vpd: environmentSnapshot.trends.vpd
                    ? {
                        delta: environmentSnapshot.trends.vpd.delta,
                        period: environmentSnapshot.trends.vpd.period,
                      }
                    : undefined,
                }}
                historicalData={environmentSnapshot.historicalVpd}
                isLoading={false}
              />
            )}
          </div>

          {/* Intelligent Timeline Section */}
          <div
            className={cn(
              "w-full rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 p-6",
              "transition-opacity duration-500",
              isTransitioningFromDemo && "opacity-50"
            )}
          >
            {isLoading ? (
              <TimelineSkeleton />
            ) : (
              <IntelligentTimeline
                data={timelineData}
                focusMetric={preferences.primaryMetric === "co2" ? "vpd" : preferences.primaryMetric}
                timeRange={timeRange}
                onTimeRangeChange={handleTimeRangeChange}
                optimalRanges={optimalRanges}
                isLoading={false}
              />
            )}
          </div>

          {/* Smart Action Cards Section */}
          {isLoading ? (
            <SmartActionCardsSkeleton count={2} />
          ) : (
            <SmartActionCards
              alerts={alerts}
              activeAutomations={automations}
              offlineControllers={offlineControllerSummaries}
              nextScheduledEvent={nextScheduledEvent}
              onAlertDismiss={handleAlertDismiss}
              onAutomationToggle={handleAutomationToggle}
              className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            />
          )}

          {/* Rooms Section with View Mode Selection */}
          <section
            className={cn(
              "transition-opacity duration-500",
              isTransitioningFromDemo && "opacity-50"
            )}
          >
            <DashboardContent
              roomSummaries={roomSummaries}
              isLoading={isLoading}
              onRoomCreated={handleRoomCreated}
            />
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
