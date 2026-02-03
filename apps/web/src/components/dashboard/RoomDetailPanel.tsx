"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Maximize2, Minimize2 } from "lucide-react";

import { VPDDial } from "./VPDDial";
import { RealTimeIndicator } from "./RealTimeIndicator";
import { SensorMetricCard } from "./SensorMetricCard";
import { SensorChart } from "@/components/charts/SensorChart";
import type { RoomSummary } from "@/hooks/use-dashboard-data";
import type { TimeSeriesPoint, SensorType } from "@/types";

// =============================================================================
// Types
// =============================================================================

/**
 * Extended room summary with historical data for detailed view.
 * This extends the base RoomSummary with additional time series data.
 */
export interface RoomDetailData extends RoomSummary {
  /** Historical temperature data */
  temperatureHistory?: TimeSeriesPoint[];
  /** Historical humidity data */
  humidityHistory?: TimeSeriesPoint[];
  /** Historical VPD data */
  vpdHistory?: TimeSeriesPoint[];
  /** Historical CO2 data */
  co2History?: TimeSeriesPoint[];
}

/**
 * Props for the RoomDetailPanel component.
 */
export interface RoomDetailPanelProps {
  /** Room summary data with controllers and sensors */
  roomSummary: RoomSummary | RoomDetailData;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback to close the panel */
  onClose?: () => void;
  /** Whether the panel is expanded/fullscreen */
  isExpanded?: boolean;
  /** Callback to toggle expanded state */
  onToggleExpand?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Time range options for chart display.
 */
type TimeRange = "1h" | "6h" | "24h" | "7d";

// =============================================================================
// Constants
// =============================================================================

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
];

const DEFAULT_OPTIMAL_RANGES = {
  temperature: [70, 82] as [number, number],
  humidity: [50, 70] as [number, number],
  vpd: [0.8, 1.2] as [number, number],
  co2: [800, 1200] as [number, number],
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Filters time series data to the specified time range.
 */
function filterByTimeRange(
  data: TimeSeriesPoint[],
  range: TimeRange
): TimeSeriesPoint[] {
  const now = new Date();
  let cutoff: Date;

  switch (range) {
    case "1h":
      cutoff = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "6h":
      cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case "24h":
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return data.filter((point) => new Date(point.timestamp) >= cutoff);
}

/**
 * Extracts the latest sensor values from room summary.
 */
function extractLatestValues(roomSummary: RoomSummary): {
  temperature: number | null;
  humidity: number | null;
  vpd: number | null;
  co2: number | null;
  lastUpdate: string | null;
} {
  const { latestSensorData, lastUpdateTimestamp } = roomSummary;

  return {
    temperature: latestSensorData.temperature,
    humidity: latestSensorData.humidity,
    vpd: latestSensorData.vpd,
    co2: null, // CO2 not included in base RoomSummary
    lastUpdate: lastUpdateTimestamp,
  };
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for the detail panel.
 */
function DetailPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>

      {/* VPD Dial + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex justify-center">
          <Skeleton className="w-64 h-64 rounded-full" />
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Chart */}
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * RoomDetailPanel - Expanded view of room environmental data.
 *
 * Displays comprehensive sensor information for a room including:
 * - VPD dial as hero element
 * - Individual sensor metric cards with sparklines
 * - Full time-series chart with multiple sensors
 * - Real-time connection status
 * - Time range selector
 *
 * Features:
 * - Responsive layout (stacks on mobile)
 * - Expandable/fullscreen mode
 * - Time range filtering
 * - Status-colored metrics
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <RoomDetailPanel
 *   roomSummary={selectedRoom}
 *   isLoading={isLoading}
 *   onClose={() => setSelectedRoom(null)}
 *   isExpanded={isExpanded}
 *   onToggleExpand={() => setIsExpanded(!isExpanded)}
 * />
 * ```
 */
export function RoomDetailPanel({
  roomSummary,
  isLoading = false,
  onClose,
  isExpanded = false,
  onToggleExpand,
  className,
}: RoomDetailPanelProps) {
  // State for time range selector
  const [timeRange, setTimeRange] = useState<TimeRange>("6h");

  // Extract latest values
  const latestValues = useMemo(
    () => extractLatestValues(roomSummary),
    [roomSummary]
  );

  // Filter historical data by time range
  // Use extended data if available, otherwise fall back to temperatureTimeSeries
  const filteredData = useMemo(() => {
    const extendedData = roomSummary as RoomDetailData;
    return {
      temperature: filterByTimeRange(
        extendedData.temperatureHistory || roomSummary.temperatureTimeSeries || [],
        timeRange
      ),
      humidity: filterByTimeRange(
        extendedData.humidityHistory || [],
        timeRange
      ),
      vpd: filterByTimeRange(
        extendedData.vpdHistory || [],
        timeRange
      ),
      co2: filterByTimeRange(
        extendedData.co2History || [],
        timeRange
      ),
    };
  }, [roomSummary, timeRange]);

  // Determine which sensors have data
  const availableSensors = useMemo(() => {
    const sensors: SensorType[] = [];
    if (latestValues.temperature !== null) sensors.push("temperature");
    if (latestValues.humidity !== null) sensors.push("humidity");
    if (latestValues.vpd !== null) sensors.push("vpd");
    if (latestValues.co2 !== null) sensors.push("co2");
    return sensors;
  }, [latestValues]);

  // Get optimal ranges from room settings or use defaults
  const optimalRanges = useMemo(() => {
    const settings = roomSummary.room.settings || {};
    return {
      temperature: [
        settings.target_temp_min ?? DEFAULT_OPTIMAL_RANGES.temperature[0],
        settings.target_temp_max ?? DEFAULT_OPTIMAL_RANGES.temperature[1],
      ] as [number, number],
      humidity: [
        settings.target_humidity_min ?? DEFAULT_OPTIMAL_RANGES.humidity[0],
        settings.target_humidity_max ?? DEFAULT_OPTIMAL_RANGES.humidity[1],
      ] as [number, number],
      vpd: [
        settings.target_vpd_min ?? DEFAULT_OPTIMAL_RANGES.vpd[0],
        settings.target_vpd_max ?? DEFAULT_OPTIMAL_RANGES.vpd[1],
      ] as [number, number],
      co2: DEFAULT_OPTIMAL_RANGES.co2,
    };
  }, [roomSummary.room.settings]);

  if (isLoading) {
    return <DetailPanelSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-white dark:bg-gray-900",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {roomSummary.room.name}
          </h2>
          <RealTimeIndicator
            connectionStatus={roomSummary.onlineCount > 0 ? "connected" : "error"}
            lastUpdate={latestValues.lastUpdate}
            isStale={roomSummary.hasStaleData}
            variant="compact"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
          >
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Expand/Collapse Button */}
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-9 w-9"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Close Button */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* VPD Dial + Sensor Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* VPD Dial - Hero Element */}
          <div className="lg:col-span-1 flex items-center justify-center">
            <VPDDial
              currentVPD={latestValues.vpd ?? 0}
              optimalRange={optimalRanges.vpd}
              historicalData={filteredData.vpd}
              isLoading={isLoading}
            />
          </div>

          {/* Sensor Metric Cards */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <SensorMetricCard
              sensorType="temperature"
              value={latestValues.temperature}
              optimalRange={optimalRanges.temperature}
              historicalData={filteredData.temperature}
              showSparkline
              showTrend
              size="lg"
              isStale={roomSummary.hasStaleData}
            />
            <SensorMetricCard
              sensorType="humidity"
              value={latestValues.humidity}
              optimalRange={optimalRanges.humidity}
              historicalData={filteredData.humidity}
              showSparkline
              showTrend
              size="lg"
              isStale={roomSummary.hasStaleData}
            />
            <SensorMetricCard
              sensorType="vpd"
              value={latestValues.vpd}
              optimalRange={optimalRanges.vpd}
              historicalData={filteredData.vpd}
              showSparkline
              showTrend
              size="lg"
              isStale={roomSummary.hasStaleData}
            />
            {latestValues.co2 !== null && (
              <SensorMetricCard
                sensorType="co2"
                value={latestValues.co2}
                optimalRange={optimalRanges.co2}
                historicalData={filteredData.co2}
                showSparkline
                showTrend
                size="lg"
                isStale={roomSummary.hasStaleData}
              />
            )}
          </div>
        </div>

        {/* Full Time-Series Chart */}
        <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium mb-4 text-gray-700 dark:text-gray-200">
            Sensor History
          </h3>
          <SensorChart
            temperatureData={filteredData.temperature}
            humidityData={filteredData.humidity}
            vpdData={filteredData.vpd}
            co2Data={filteredData.co2.length > 0 ? filteredData.co2 : undefined}
            visibleSensors={availableSensors}
            height={isExpanded ? 400 : 280}
            showLegend
            showGrid
            variant="area"
            optimalRanges={optimalRanges}
            timeFormat={timeRange === "7d" ? "long" : "short"}
            isLoading={isLoading}
          />
        </div>

        {/* Controller Info */}
        {roomSummary.controllers.length > 0 && (
          <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-200">
              Connected Controllers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {roomSummary.controllers.map((controller) => (
                <div
                  key={controller.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      controller.status === "online"
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                      {controller.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {controller.brand} {controller.model && `- ${controller.model}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Export skeleton for external use.
 */
export { DetailPanelSkeleton as RoomDetailPanelSkeleton };
