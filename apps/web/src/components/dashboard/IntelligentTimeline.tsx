"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { format, parseISO, isValid, subHours } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Thermometer, Droplet, Activity } from "lucide-react";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Time series data point for the chart.
 * Each point represents sensor readings at a specific timestamp.
 */
export interface TimeSeriesData {
  /** ISO 8601 timestamp string */
  timestamp: string;
  /** VPD reading in kPa (optional) */
  vpd?: number;
  /** Temperature reading in Fahrenheit (optional) */
  temperature?: number;
  /** Humidity reading as percentage (optional) */
  humidity?: number;
}

/**
 * Automation event marker to display on the chart.
 */
export interface AutomationEvent {
  /** ISO 8601 timestamp string */
  timestamp: string;
  /** Name of the automation/workflow */
  name: string;
  /** Action description */
  action: string;
}

/**
 * Time range options for the chart display.
 */
export type TimeRange = "1h" | "6h" | "24h";

/**
 * Metric types that can be displayed.
 */
export type FocusMetric = "vpd" | "temperature" | "humidity";

/**
 * Optimal range configuration for a single metric.
 * Tuple of [min, max] values.
 */
export type OptimalRange = [number, number];

/**
 * Configuration for all optimal ranges.
 */
export interface OptimalRanges {
  vpd?: OptimalRange;
  temperature?: OptimalRange;
  humidity?: OptimalRange;
}

/**
 * Props for the IntelligentTimeline component.
 */
export interface IntelligentTimelineProps {
  /** Time series data to display */
  data: TimeSeriesData[];
  /** Optional automation events to display as markers */
  automationEvents?: AutomationEvent[];
  /** Which metric to highlight/focus on */
  focusMetric?: FocusMetric;
  /** Currently selected time range */
  timeRange?: TimeRange;
  /** Callback when time range is changed */
  onTimeRangeChange?: (range: TimeRange) => void;
  /** Callback when a data point is tapped/clicked */
  onPointTap?: (data: TimeSeriesData) => void;
  /** Optimal ranges for shading the "good zone" */
  optimalRanges?: OptimalRanges;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Additional CSS class names */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Chart height in pixels as specified in design spec */
const CHART_HEIGHT = 200;

/** Animation duration in milliseconds */
const ANIMATION_DURATION = 600;

/** Default optimal ranges if not provided */
const DEFAULT_OPTIMAL_RANGES: OptimalRanges = {
  vpd: [0.8, 1.2],
  temperature: [70, 85],
  humidity: [50, 70],
};

/** Color configuration for each metric */
const METRIC_COLORS: Record<FocusMetric, { stroke: string; fill: string; label: string }> = {
  vpd: {
    stroke: "hsl(var(--primary))",
    fill: "hsl(var(--primary))",
    label: "VPD",
  },
  temperature: {
    stroke: "hsl(var(--destructive))",
    fill: "hsl(var(--destructive))",
    label: "Temperature",
  },
  humidity: {
    stroke: "hsl(var(--info))",
    fill: "hsl(var(--info))",
    label: "Humidity",
  },
};

/** Time range display labels */
const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1h": "1H",
  "6h": "6H",
  "24h": "24H",
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Filters data points to only include those within the specified time range.
 *
 * @param data - Array of time series data points
 * @param range - Time range to filter by
 * @returns Filtered array of data points
 */
function filterDataByTimeRange(data: TimeSeriesData[], range: TimeRange): TimeSeriesData[] {
  const now = new Date();
  const hoursMap: Record<TimeRange, number> = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
  };
  const cutoff = subHours(now, hoursMap[range]);

  return data.filter((point) => {
    const timestamp = parseISO(point.timestamp);
    return isValid(timestamp) && timestamp >= cutoff;
  });
}

/**
 * Formats a timestamp for display on the X axis.
 *
 * @param timestamp - ISO 8601 timestamp string
 * @param range - Current time range (affects format)
 * @returns Formatted time string
 */
function formatTimeLabel(timestamp: string, range: TimeRange): string {
  const date = parseISO(timestamp);
  if (!isValid(date)) return "";

  // For 24h view, show hours; for shorter ranges, show hours:minutes
  if (range === "24h") {
    return format(date, "ha"); // e.g., "2PM"
  }
  return format(date, "h:mm"); // e.g., "2:30"
}

/**
 * Calculates the Y axis domain with padding for better visualization.
 *
 * @param data - Array of numeric values
 * @param optimalRange - Optional range to include in domain calculation
 * @returns Tuple of [min, max] for Y axis
 */
function calculateYDomain(
  data: number[],
  optimalRange?: OptimalRange
): [number, number] {
  if (data.length === 0) {
    // Use optimal range as fallback if available
    if (optimalRange) {
      const padding = (optimalRange[1] - optimalRange[0]) * 0.2;
      return [optimalRange[0] - padding, optimalRange[1] + padding];
    }
    return [0, 100];
  }

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);

  // Include optimal range in domain calculation if provided
  const rangeMin = optimalRange ? Math.min(minValue, optimalRange[0]) : minValue;
  const rangeMax = optimalRange ? Math.max(maxValue, optimalRange[1]) : maxValue;

  const range = rangeMax - rangeMin;
  const padding = range * 0.15; // 15% padding for visual breathing room

  return [
    Math.max(0, rangeMin - padding),
    rangeMax + padding,
  ];
}

/**
 * Gets the unit suffix for a metric type.
 *
 * @param metric - The metric type
 * @returns Unit string for display
 */
function getMetricUnit(metric: FocusMetric): string {
  switch (metric) {
    case "temperature":
      return "°F";
    case "humidity":
      return "%";
    case "vpd":
      return " kPa";
    default:
      return "";
  }
}

/**
 * Gets the icon component for a metric type.
 *
 * @param metric - The metric type
 * @returns Lucide icon component
 */
function getMetricIcon(metric: FocusMetric): React.ReactNode {
  switch (metric) {
    case "temperature":
      return <Thermometer className="w-3.5 h-3.5" />;
    case "humidity":
      return <Droplet className="w-3.5 h-3.5" />;
    case "vpd":
      return <Activity className="w-3.5 h-3.5" />;
    default:
      return null;
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for the IntelligentTimeline.
 * Displays an animated placeholder while data is loading.
 */
function TimelineSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      {/* Time range selector skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-8 w-32" />
      </div>
      {/* Chart area skeleton */}
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        <Skeleton className="absolute inset-0" />
        {/* Fake chart lines for visual hint */}
        <div className="absolute inset-4 flex flex-col justify-between opacity-30">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-px w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component when no data is available.
 * Designed to feel like an onboarding experience rather than an error.
 */
function EmptyState(): JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center bg-gradient-to-b from-muted/10 to-muted/30 rounded-lg border border-dashed border-border"
      style={{ height: CHART_HEIGHT }}
    >
      <div className="relative">
        {/* Pulsing ping effect around the icon */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-primary/20 opacity-75" />
        </span>
        {/* Main icon */}
        <Activity className="w-8 h-8 text-muted-foreground mb-2 relative" />
      </div>
      <p className="text-sm font-medium text-foreground/80 mt-4">Waiting for sensor data</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Your timeline will populate as sensors report readings
      </p>
    </div>
  );
}

/**
 * Custom tooltip component for the chart.
 * Displays all available metrics at the hovered timestamp.
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
  data: TimeSeriesData[];
  onPointTap?: (data: TimeSeriesData) => void;
}

function CustomTooltip({
  active,
  payload,
  label,
  data,
  onPointTap,
}: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }

  // Find the full data point for this timestamp
  const dataPoint = data.find((d) => d.timestamp === label);
  const formattedTime = label ? format(parseISO(label), "MMM d, h:mm a") : "";

  // Handle click on tooltip (for mobile tap behavior)
  const handleClick = (): void => {
    if (onPointTap && dataPoint) {
      onPointTap(dataPoint);
    }
  };

  return (
    <div
      className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 min-w-[160px] cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        {formattedTime}
      </p>
      <div className="space-y-1.5">
        {dataPoint?.temperature != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Thermometer className="w-3 h-3" style={{ color: METRIC_COLORS.temperature.stroke }} />
              Temperature
            </span>
            <span className="text-sm font-medium">{dataPoint.temperature.toFixed(1)}°F</span>
          </div>
        )}
        {dataPoint?.humidity != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Droplet className="w-3 h-3" style={{ color: METRIC_COLORS.humidity.stroke }} />
              Humidity
            </span>
            <span className="text-sm font-medium">{dataPoint.humidity.toFixed(1)}%</span>
          </div>
        )}
        {dataPoint?.vpd != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="w-3 h-3" style={{ color: METRIC_COLORS.vpd.stroke }} />
              VPD
            </span>
            <span className="text-sm font-medium">{dataPoint.vpd.toFixed(2)} kPa</span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * IntelligentTimeline displays sensor data over time with smooth curves,
 * optimal zone shading, and interactive tooltips.
 *
 * This component is designed for the EnviroFlow dashboard to visualize
 * environmental sensor readings (temperature, humidity, VPD) over
 * configurable time ranges (1h, 6h, 24h).
 *
 * @example
 * ```tsx
 * const sensorData = [
 *   { timestamp: "2026-01-22T10:00:00Z", temperature: 75, humidity: 60, vpd: 1.0 },
 *   { timestamp: "2026-01-22T11:00:00Z", temperature: 76, humidity: 58, vpd: 1.1 },
 * ];
 *
 * return (
 *   <IntelligentTimeline
 *     data={sensorData}
 *     focusMetric="vpd"
 *     timeRange="24h"
 *     onTimeRangeChange={(range) => console.log('New range:', range)}
 *     optimalRanges={{
 *       vpd: [0.8, 1.2],
 *       temperature: [70, 85],
 *       humidity: [50, 70],
 *     }}
 *   />
 * );
 * ```
 */
export function IntelligentTimeline({
  data,
  automationEvents = [],
  focusMetric = "vpd",
  timeRange: controlledTimeRange,
  onTimeRangeChange,
  onPointTap,
  optimalRanges = DEFAULT_OPTIMAL_RANGES,
  isLoading = false,
  className,
}: IntelligentTimelineProps): JSX.Element {
  // Internal state for time range when not controlled
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>("24h");

  // Use controlled value if provided, otherwise use internal state
  const timeRange = controlledTimeRange ?? internalTimeRange;

  /**
   * Handles time range selection changes.
   * Calls external handler if provided, otherwise updates internal state.
   */
  const handleTimeRangeChange = useCallback(
    (value: string): void => {
      const range = value as TimeRange;
      if (onTimeRangeChange) {
        onTimeRangeChange(range);
      } else {
        setInternalTimeRange(range);
      }
    },
    [onTimeRangeChange]
  );

  // Filter data based on selected time range
  const filteredData = useMemo(
    () => filterDataByTimeRange(data, timeRange),
    [data, timeRange]
  );

  // Sort data by timestamp for proper chart rendering
  const sortedData = useMemo(
    () =>
      [...filteredData].sort(
        (a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime()
      ),
    [filteredData]
  );

  // Calculate Y axis domain based on data and optimal range
  const yDomain = useMemo(() => {
    const values = sortedData
      .map((d) => d[focusMetric])
      .filter((v): v is number => v != null);
    return calculateYDomain(values, optimalRanges[focusMetric]);
  }, [sortedData, focusMetric, optimalRanges]);

  // Get the current optimal range for the focused metric
  const currentOptimalRange = optimalRanges[focusMetric];

  // Filter automation events within the time range
  const filteredEvents = useMemo(() => {
    const cutoff = subHours(new Date(), timeRange === "1h" ? 1 : timeRange === "6h" ? 6 : 24);
    return automationEvents.filter((event) => {
      const timestamp = parseISO(event.timestamp);
      return isValid(timestamp) && timestamp >= cutoff;
    });
  }, [automationEvents, timeRange]);

  // Get metric configuration
  const metricConfig = METRIC_COLORS[focusMetric];

  // Generate unique gradient ID to avoid conflicts with multiple instances
  const gradientId = useMemo(
    () => `timeline-gradient-${focusMetric}-${Math.random().toString(36).slice(2, 9)}`,
    [focusMetric]
  );
  const optimalGradientId = useMemo(
    () => `optimal-gradient-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  // Render loading state
  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <TimelineSkeleton />
      </div>
    );
  }

  // Render empty state
  if (sortedData.length === 0) {
    return (
      <div className={cn("w-full space-y-4", className)}>
        {/* Time range selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getMetricIcon(focusMetric)}
            <span className="font-medium">{metricConfig.label}</span>
          </div>
          <Tabs value={timeRange} onValueChange={handleTimeRangeChange}>
            <TabsList className="h-8">
              {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
                <TabsTrigger
                  key={range}
                  value={range}
                  className="text-xs px-3 h-6"
                >
                  {TIME_RANGE_LABELS[range]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Header with metric label and time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {getMetricIcon(focusMetric)}
          <span className="font-medium">{metricConfig.label}</span>
          {currentOptimalRange && (
            <span className="text-xs opacity-70">
              (Optimal: {currentOptimalRange[0]}-{currentOptimalRange[1]}
              {getMetricUnit(focusMetric)})
            </span>
          )}
        </div>
        <Tabs value={timeRange} onValueChange={handleTimeRangeChange}>
          <TabsList className="h-8">
            {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
              <TabsTrigger
                key={range}
                value={range}
                className="text-xs px-3 h-6"
              >
                {TIME_RANGE_LABELS[range]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Chart container */}
      <div
        className="w-full relative"
        style={{ height: CHART_HEIGHT }}
        role="img"
        aria-label={`${metricConfig.label} sensor data chart for the last ${timeRange}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={sortedData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onClick={(e) => {
              // Handle click on chart area for mobile tap support
              if (e && e.activePayload && e.activePayload.length > 0 && onPointTap) {
                const clickedData = sortedData.find(
                  (d) => d.timestamp === e.activeLabel
                );
                if (clickedData) {
                  onPointTap(clickedData);
                }
              }
            }}
          >
            {/* Gradient definitions */}
            <defs>
              {/* Main line gradient fill */}
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metricConfig.fill} stopOpacity={0.3} />
                <stop offset="95%" stopColor={metricConfig.fill} stopOpacity={0.02} />
              </linearGradient>
              {/* Optimal zone gradient */}
              <linearGradient id={optimalGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            {/* Subtle grid lines */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.5}
              vertical={false}
            />

            {/* X Axis - Time */}
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value: string) => formatTimeLabel(value, timeRange)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            {/* Y Axis - Metric values */}
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(value: number) => {
                // Format based on metric type
                if (focusMetric === "vpd") {
                  return value.toFixed(1);
                }
                return Math.round(value).toString();
              }}
            />

            {/* Optimal zone shading */}
            {currentOptimalRange && (
              <ReferenceArea
                y1={currentOptimalRange[0]}
                y2={currentOptimalRange[1]}
                fill={`url(#${optimalGradientId})`}
                fillOpacity={1}
                stroke="hsl(var(--success))"
                strokeOpacity={0.3}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}

            {/* Automation event markers */}
            {filteredEvents.map((event) => (
              <ReferenceLine
                key={`event-${event.timestamp}-${event.name}`}
                x={event.timestamp}
                stroke="hsl(var(--warning))"
                strokeWidth={2}
                strokeDasharray="4 2"
                label={{
                  value: event.name,
                  position: "top",
                  fontSize: 10,
                  fill: "hsl(var(--warning))",
                }}
              />
            ))}

            {/* Custom tooltip */}
            <Tooltip
              content={
                <CustomTooltip
                  data={sortedData}
                  onPointTap={onPointTap}
                />
              }
              cursor={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            {/* Main data area with smooth curve */}
            <Area
              type="monotone"
              dataKey={focusMetric}
              stroke={metricConfig.stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={true}
              animationDuration={ANIMATION_DURATION}
              animationEasing="ease-out"
              dot={false}
              activeDot={{
                r: 5,
                stroke: metricConfig.stroke,
                strokeWidth: 2,
                fill: "hsl(var(--background))",
              }}
              connectNulls={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / Data summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded-full"
              style={{ backgroundColor: metricConfig.stroke }}
            />
            <span>Current</span>
          </div>
          {currentOptimalRange && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-success/20 border border-success/30" />
              <span>Optimal Zone</span>
            </div>
          )}
        </div>
        {/* Only show reading count when there are more than 10 readings */}
        {sortedData.length > 10 && (
          <span>
            {sortedData.length} reading{sortedData.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Default export for easier importing.
 */
export default IntelligentTimeline;
