"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MetricCard, MetricCardSkeleton } from "./MetricCard";
import { cn } from "@/lib/utils";
import {
  calculateAnalytics,
  filterByDateRange,
  getPreviousPeriod,
  getDateRangePreset,
  type AnalyticsSummary,
} from "@/lib/analytics-utils";
import type { SensorReading, RoomSettings, DateRangeValue } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays } from "lucide-react";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Props for the AnalyticsSummaryCards component.
 */
export interface AnalyticsSummaryCardsProps {
  /** All sensor readings (will be filtered by selected period) */
  readings: SensorReading[];
  /** Optional room settings for compliance calculation */
  roomSettings?: RoomSettings;
  /** Default date range preset */
  defaultPeriod?: string;
  /** Whether the component is loading */
  isLoading?: boolean;
  /** Whether to enable navigation on card click */
  enableNavigation?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
] as const;

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for analytics cards grid.
 */
function AnalyticsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Empty state when no data is available.
 */
function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 backdrop-blur-sm p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <CalendarDays className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No data available</p>
        <p className="text-xs text-muted-foreground">
          Check sensor status or adjust the time period
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * AnalyticsSummaryCards - Dashboard section showing key environmental metrics.
 *
 * Displays 5 metric cards:
 * 1. Average Temperature
 * 2. Average Humidity
 * 3. VPD Range
 * 4. Average CO2
 * 5. Compliance Percentage
 *
 * Features:
 * - Period selector (Today, 7d, 30d, 90d)
 * - Trend indicators comparing to previous period
 * - Clickable cards for navigation to detailed views
 * - Real-time updates via props
 * - Empty state when no data
 * - Responsive grid layout
 *
 * @example
 * ```tsx
 * <AnalyticsSummaryCards
 *   readings={sensorReadings}
 *   roomSettings={room.settings}
 *   defaultPeriod="7d"
 *   enableNavigation
 * />
 * ```
 */
export function AnalyticsSummaryCards({
  readings,
  roomSettings,
  defaultPeriod = "7d",
  isLoading = false,
  enableNavigation = true,
  className,
}: AnalyticsSummaryCardsProps) {
  const router = useRouter();

  // Selected period state
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  // Calculate date ranges
  const period = useMemo(
    () => getDateRangePreset(selectedPeriod),
    [selectedPeriod]
  );

  const previousPeriod = useMemo(() => getPreviousPeriod(period), [period]);

  // Filter readings for current and previous periods
  const currentReadings = useMemo(
    () => filterByDateRange(readings, period),
    [readings, period]
  );

  const previousReadings = useMemo(
    () => filterByDateRange(readings, previousPeriod),
    [readings, previousPeriod]
  );

  // Calculate analytics
  const analytics: AnalyticsSummary | null = useMemo(() => {
    if (currentReadings.length === 0) return null;

    return calculateAnalytics({
      readings: currentReadings,
      period,
      targetRanges: roomSettings,
      previousReadings,
    });
  }, [currentReadings, previousReadings, period, roomSettings]);

  // Navigation handlers
  const handleTemperatureClick = useCallback(() => {
    if (enableNavigation) {
      router.push("/sensors?type=temperature");
    }
  }, [enableNavigation, router]);

  const handleHumidityClick = useCallback(() => {
    if (enableNavigation) {
      router.push("/sensors?type=humidity");
    }
  }, [enableNavigation, router]);

  const handleVpdClick = useCallback(() => {
    if (enableNavigation) {
      router.push("/sensors?type=vpd");
    }
  }, [enableNavigation, router]);

  const handleCo2Click = useCallback(() => {
    if (enableNavigation) {
      router.push("/sensors?type=co2");
    }
  }, [enableNavigation, router]);

  const handleComplianceClick = useCallback(() => {
    if (enableNavigation) {
      router.push("/analytics");
    }
  }, [enableNavigation, router]);

  // Period label for display
  const periodLabel = PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)
    ?.label || "Last 7 Days";

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">This Period Analytics</h2>
          <div className="w-[150px]">
            <div className="h-9 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        <AnalyticsCardsSkeleton />
      </div>
    );
  }

  // Show empty state if no analytics data
  if (!analytics) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">This Period Analytics</h2>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">This Period Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comparing to previous {periodLabel.toLowerCase()}
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Temperature */}
        <MetricCard
          title="Avg Temperature"
          value={analytics.temperature?.avg ?? null}
          unit="°F"
          trend={analytics.temperature?.trend}
          subtitle={
            analytics.temperature
              ? `${analytics.temperature.min}-${analytics.temperature.max}°F`
              : undefined
          }
          onClick={enableNavigation ? handleTemperatureClick : undefined}
        />

        {/* Humidity */}
        <MetricCard
          title="Avg Humidity"
          value={analytics.humidity?.avg ?? null}
          unit="%"
          trend={analytics.humidity?.trend}
          subtitle={
            analytics.humidity
              ? `${analytics.humidity.min}-${analytics.humidity.max}%`
              : undefined
          }
          onClick={enableNavigation ? handleHumidityClick : undefined}
        />

        {/* VPD */}
        <MetricCard
          title="VPD Range"
          value={analytics.vpd?.avg ?? null}
          unit="kPa"
          trend={analytics.vpd?.trend}
          subtitle={
            analytics.vpd
              ? `${analytics.vpd.min}-${analytics.vpd.max} kPa`
              : undefined
          }
          decimals={2}
          onClick={enableNavigation ? handleVpdClick : undefined}
        />

        {/* CO2 */}
        <MetricCard
          title="Avg CO2"
          value={analytics.co2?.avg ?? null}
          unit="ppm"
          trend={analytics.co2?.trend}
          subtitle={
            analytics.co2
              ? `${analytics.co2.min}-${analytics.co2.max} ppm`
              : undefined
          }
          decimals={0}
          onClick={enableNavigation ? handleCo2Click : undefined}
        />

        {/* Compliance */}
        <MetricCard
          title="Compliance"
          value={analytics.compliance.percentage}
          unit="%"
          trend={analytics.compliance.trend}
          subtitle="Within targets"
          decimals={0}
          onClick={enableNavigation ? handleComplianceClick : undefined}
        />
      </div>
    </div>
  );
}
