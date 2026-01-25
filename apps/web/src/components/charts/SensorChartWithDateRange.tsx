"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { SensorChart, SensorChartSkeleton } from "./SensorChart";
import type { DateRangeValue, DateRangePreset } from "@/types";
import { useSensorReadings } from "@/hooks/use-sensor-readings";
import { useDateRange } from "@/hooks/use-date-range";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorType } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Props for the SensorChartWithDateRange component.
 */
export interface SensorChartWithDateRangeProps {
  /** Controller IDs to fetch sensor data for */
  controllerIds: string[];
  /** Title for the chart card */
  title?: string;
  /** Description for the chart card */
  description?: string;
  /** Which sensors to display on the chart */
  visibleSensors?: SensorType[];
  /** Chart height in pixels */
  height?: number;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** Chart variant (area or line) */
  variant?: "area" | "line";
  /** Optimal ranges for status coloring */
  optimalRanges?: {
    temperature?: [number, number];
    humidity?: [number, number];
    vpd?: [number, number];
    co2?: [number, number];
  };
  /** Default date range preset */
  defaultPreset?: DateRangePreset;
  /** Whether to show export button */
  showExport?: boolean;
  /** Callback when export is clicked */
  onExport?: (range: DateRangeValue) => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SensorChartWithDateRange - Enhanced sensor chart with date range selection.
 *
 * Features:
 * - Integrated date range picker with presets (Today, 7d, 30d, 90d, YTD)
 * - Custom date range selection with calendar popup
 * - URL parameter persistence for shareable reports
 * - Automatic data refetch on range change
 * - Loading skeleton during fetch
 * - Refresh button to manually reload data
 * - Optional export button
 * - Mobile-responsive layout
 *
 * @example
 * ```tsx
 * <SensorChartWithDateRange
 *   controllerIds={["controller-1"]}
 *   title="Grow Room A - Temperature & Humidity"
 *   description="Historical sensor data with customizable time range"
 *   visibleSensors={["temperature", "humidity", "vpd"]}
 *   defaultPreset="7d"
 *   showExport
 *   onExport={(range) => {
 *     console.log("Export data from", range.from, "to", range.to);
 *   }}
 * />
 * ```
 */
export function SensorChartWithDateRange({
  controllerIds,
  title = "Sensor Data",
  description,
  visibleSensors = ["temperature", "humidity", "vpd"],
  height = 300,
  showLegend = true,
  variant = "area",
  optimalRanges,
  defaultPreset = "7d",
  showExport = false,
  onExport,
  className,
}: SensorChartWithDateRangeProps): JSX.Element {
  // Date range state with URL persistence
  const { range, setRange } = useDateRange({
    defaultPreset,
    persistInUrl: true,
    urlParamKey: "sensorRange",
  });

  // Fetch sensor readings with the selected date range
  const {
    isLoading,
    error,
    refetch,
    getTimeSeries,
  } = useSensorReadings({
    controllerIds,
    sensorTypes: visibleSensors,
    dateRange: range,
    limit: 1000, // Increase limit for longer date ranges
  });

  // Track refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Handles manual refresh.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  /**
   * Handles export click.
   */
  const handleExport = useCallback(() => {
    onExport?.(range);
  }, [onExport, range]);

  /**
   * Extract time series data for each sensor type.
   */
  const { temperatureData, humidityData, vpdData, co2Data } = useMemo(() => {
    // Use the first controller's data (if multiple controllers, combine them)
    const controllerId = controllerIds[0];

    return {
      temperatureData: visibleSensors.includes("temperature")
        ? getTimeSeries(controllerId, "temperature")
        : undefined,
      humidityData: visibleSensors.includes("humidity")
        ? getTimeSeries(controllerId, "humidity")
        : undefined,
      vpdData: visibleSensors.includes("vpd")
        ? getTimeSeries(controllerId, "vpd")
        : undefined,
      co2Data: visibleSensors.includes("co2")
        ? getTimeSeries(controllerId, "co2")
        : undefined,
    };
  }, [controllerIds, visibleSensors, getTimeSeries]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex flex-col gap-4">
          {/* Title and Description */}
          <div className="flex-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>

          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
            {/* Date Range Picker */}
            <DateRangePicker
              value={range}
              onChange={setRange}
              showPresets
              className="w-full sm:w-auto"
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || isRefreshing}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw
                  className={cn("h-4 w-4 mr-2", (isLoading || isRefreshing) && "animate-spin")}
                />
                Refresh
              </Button>

              {showExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isLoading || readings.length === 0}
                  className="flex-1 sm:flex-none"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-6" style={{ height }}>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-destructive">Failed to load sensor data</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!error && isLoading && <SensorChartSkeleton height={height} />}

        {/* Chart */}
        {!error && !isLoading && (
          <SensorChart
            temperatureData={temperatureData}
            humidityData={humidityData}
            vpdData={vpdData}
            co2Data={co2Data}
            visibleSensors={visibleSensors}
            height={height}
            showLegend={showLegend}
            variant={variant}
            optimalRanges={optimalRanges}
            timeFormat={range.preset === "today" ? "short" : "long"}
            isLoading={false}
          />
        )}

        {/* Data Summary */}
        {!error && !isLoading && (temperatureData || humidityData || vpdData || co2Data) && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Showing data from{" "}
              {range.from.toLocaleDateString()} to {range.to.toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version of SensorChartWithDateRange without the card wrapper.
 * Useful for embedding in existing layouts.
 */
export function SensorChartWithDateRangeCompact({
  controllerIds,
  visibleSensors = ["temperature", "humidity", "vpd"],
  height = 300,
  showLegend = true,
  variant = "area",
  optimalRanges,
  defaultPreset = "7d",
  className,
}: Omit<SensorChartWithDateRangeProps, "title" | "description" | "showExport" | "onExport">): JSX.Element {
  const { range, setRange } = useDateRange({
    defaultPreset,
    persistInUrl: true,
    urlParamKey: "sensorRange",
  });

  const { isLoading, error, refetch, getTimeSeries } = useSensorReadings({
    controllerIds,
    sensorTypes: visibleSensors,
    dateRange: range,
    limit: 1000,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  const { temperatureData, humidityData, vpdData, co2Data } = useMemo(() => {
    const controllerId = controllerIds[0];
    return {
      temperatureData: visibleSensors.includes("temperature")
        ? getTimeSeries(controllerId, "temperature")
        : undefined,
      humidityData: visibleSensors.includes("humidity")
        ? getTimeSeries(controllerId, "humidity")
        : undefined,
      vpdData: visibleSensors.includes("vpd")
        ? getTimeSeries(controllerId, "vpd")
        : undefined,
      co2Data: visibleSensors.includes("co2")
        ? getTimeSeries(controllerId, "co2")
        : undefined,
    };
  }, [controllerIds, visibleSensors, getTimeSeries]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
        <DateRangePicker value={range} onChange={setRange} showPresets className="w-full sm:w-auto" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", (isLoading || isRefreshing) && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Chart */}
      {error && (
        <div className="flex items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-6" style={{ height }}>
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-destructive">Failed to load sensor data</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {!error && isLoading && <SensorChartSkeleton height={height} />}

      {!error && !isLoading && (
        <SensorChart
          temperatureData={temperatureData}
          humidityData={humidityData}
          vpdData={vpdData}
          co2Data={co2Data}
          visibleSensors={visibleSensors}
          height={height}
          showLegend={showLegend}
          variant={variant}
          optimalRanges={optimalRanges}
          timeFormat={range.preset === "today" ? "short" : "long"}
          isLoading={false}
        />
      )}
    </div>
  );
}
