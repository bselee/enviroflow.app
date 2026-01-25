"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeSeriesPoint, SensorType } from "@/types";
import { getStatusColor } from "@/lib/status-colors";

// =============================================================================
// Types
// =============================================================================

/**
 * Sensor configuration for chart display.
 */
interface SensorConfig {
  key: SensorType;
  label: string;
  unit: string;
  color: string;
  gradientId: string;
  optimalRange?: [number, number];
}

/**
 * Data point for multi-sensor chart.
 */
interface ChartDataPoint {
  timestamp: string;
  time: string;
  temperature?: number;
  humidity?: number;
  vpd?: number;
  co2?: number;
  light?: number;
}

/**
 * Tooltip payload type for Recharts.
 */
type TooltipPayload = Array<{
  name: string;
  value: number;
  color: string;
  dataKey: string;
}>;

/**
 * Props for the SensorChart component.
 */
export interface SensorChartProps {
  /** Temperature time series data */
  temperatureData?: TimeSeriesPoint[];
  /** Humidity time series data */
  humidityData?: TimeSeriesPoint[];
  /** VPD time series data */
  vpdData?: TimeSeriesPoint[];
  /** CO2 time series data */
  co2Data?: TimeSeriesPoint[];
  /** Which sensors to display */
  visibleSensors?: SensorType[];
  /** Chart height in pixels */
  height?: number;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** Whether to show the grid */
  showGrid?: boolean;
  /** Whether to use area chart (filled) or line chart */
  variant?: "area" | "line";
  /** Optimal ranges for status coloring */
  optimalRanges?: {
    temperature?: [number, number];
    humidity?: [number, number];
    vpd?: [number, number];
    co2?: [number, number];
  };
  /** Time format for X-axis */
  timeFormat?: "short" | "medium" | "long";
  /** Whether the chart is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SENSOR_CONFIGS: Record<SensorType, SensorConfig> = {
  temperature: {
    key: "temperature",
    label: "Temperature",
    unit: "F",
    color: "#ef4444", // Red
    gradientId: "tempGradient",
    optimalRange: [70, 82],
  },
  humidity: {
    key: "humidity",
    label: "Humidity",
    unit: "%",
    color: "#3b82f6", // Blue
    gradientId: "humidityGradient",
    optimalRange: [50, 70],
  },
  vpd: {
    key: "vpd",
    label: "VPD",
    unit: "kPa",
    color: "#10b981", // Green
    gradientId: "vpdGradient",
    optimalRange: [0.8, 1.2],
  },
  co2: {
    key: "co2",
    label: "CO2",
    unit: "ppm",
    color: "#f59e0b", // Amber
    gradientId: "co2Gradient",
    optimalRange: [800, 1200],
  },
  light: {
    key: "light",
    label: "Light",
    unit: "lux",
    color: "#eab308", // Yellow
    gradientId: "lightGradient",
  },
  ph: {
    key: "ph",
    label: "pH",
    unit: "",
    color: "#8b5cf6", // Purple
    gradientId: "phGradient",
  },
  ec: {
    key: "ec",
    label: "EC",
    unit: "mS/cm",
    color: "#06b6d4", // Cyan
    gradientId: "ecGradient",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formats a timestamp for display on the X-axis.
 */
function formatTime(timestamp: string, formatType: "short" | "medium" | "long"): string {
  try {
    const date = parseISO(timestamp);
    switch (formatType) {
      case "short":
        return format(date, "HH:mm");
      case "medium":
        return format(date, "HH:mm:ss");
      case "long":
        return format(date, "MMM d, HH:mm");
      default:
        return format(date, "HH:mm");
    }
  } catch {
    return timestamp;
  }
}

/**
 * Merges multiple time series into a single dataset for the chart.
 */
function mergeTimeSeries(
  temperatureData?: TimeSeriesPoint[],
  humidityData?: TimeSeriesPoint[],
  vpdData?: TimeSeriesPoint[],
  co2Data?: TimeSeriesPoint[],
  timeFormat: "short" | "medium" | "long" = "short"
): ChartDataPoint[] {
  // Collect all unique timestamps
  const timestampMap = new Map<string, ChartDataPoint>();

  const addData = (data: TimeSeriesPoint[] | undefined, key: keyof ChartDataPoint) => {
    if (!data) return;
    for (const point of data) {
      const existing = timestampMap.get(point.timestamp) || {
        timestamp: point.timestamp,
        time: formatTime(point.timestamp, timeFormat),
      };
      (existing as unknown as Record<string, unknown>)[key] = point.value;
      timestampMap.set(point.timestamp, existing);
    }
  };

  addData(temperatureData, "temperature");
  addData(humidityData, "humidity");
  addData(vpdData, "vpd");
  addData(co2Data, "co2");

  // Sort by timestamp
  return Array.from(timestampMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Custom tooltip for the sensor chart.
 */
function ChartTooltip({
  active,
  payload,
  label,
  isDark,
  optimalRanges,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  isDark: boolean;
  optimalRanges?: SensorChartProps["optimalRanges"];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-lg",
        isDark
          ? "bg-gray-800/95 border-gray-700 text-white"
          : "bg-white/95 border-gray-200 text-gray-900"
      )}
    >
      <p
        className={cn(
          "text-xs font-medium mb-2",
          isDark ? "text-gray-400" : "text-gray-500"
        )}
      >
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const config = DEFAULT_SENSOR_CONFIGS[entry.dataKey as SensorType];
          const optimalRange = optimalRanges?.[entry.dataKey as keyof typeof optimalRanges];

          // Calculate status color if optimal range is defined
          let statusIndicator = null;
          if (optimalRange && entry.value != null) {
            const statusResult = getStatusColor({
              value: entry.value,
              optimalMin: optimalRange[0],
              optimalMax: optimalRange[1],
            });
            statusIndicator = (
              <span
                className="inline-block w-2 h-2 rounded-full ml-1"
                style={{ backgroundColor: statusResult.hexColor }}
              />
            );
          }

          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}>
                  {config?.label || entry.name}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-semibold">
                  {typeof entry.value === "number"
                    ? entry.value.toFixed(entry.dataKey === "vpd" ? 2 : 1)
                    : entry.value}
                  {config?.unit && (
                    <span className={cn("ml-0.5 text-xs", isDark ? "text-gray-400" : "text-gray-500")}>
                      {config.unit}
                    </span>
                  )}
                </span>
                {statusIndicator}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the chart.
 */
function ChartSkeleton({ height, className }: { height: number; className?: string }) {
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <Skeleton className="absolute inset-0 rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading chart data...</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SensorChart - Time series visualization for environmental sensor data.
 *
 * Displays temperature, humidity, VPD, and optionally CO2 data over time.
 * Supports both area charts (filled) and line charts. Includes status-colored
 * tooltips and optimal range indicators.
 *
 * Features:
 * - Multi-sensor overlay on single chart
 * - Smooth gradient fills for area variant
 * - Status-colored tooltip values
 * - Responsive sizing
 * - Dark mode support
 * - Loading skeleton
 *
 * @example
 * ```tsx
 * <SensorChart
 *   temperatureData={tempSeries}
 *   humidityData={humiditySeries}
 *   vpdData={vpdSeries}
 *   visibleSensors={["temperature", "humidity", "vpd"]}
 *   height={300}
 *   showLegend
 *   variant="area"
 *   optimalRanges={{
 *     temperature: [70, 82],
 *     humidity: [50, 70],
 *     vpd: [0.8, 1.2],
 *   }}
 * />
 * ```
 */
export function SensorChart({
  temperatureData,
  humidityData,
  vpdData,
  co2Data,
  visibleSensors = ["temperature", "humidity", "vpd"],
  height = 300,
  showLegend = true,
  showGrid = true,
  variant = "area",
  optimalRanges,
  timeFormat = "short",
  isLoading = false,
  className,
}: SensorChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Merge all time series into a single dataset
  const chartData = useMemo(
    () => mergeTimeSeries(temperatureData, humidityData, vpdData, co2Data, timeFormat),
    [temperatureData, humidityData, vpdData, co2Data, timeFormat]
  );

  // Filter sensor configs based on visible sensors
  const activeSensors = useMemo(
    () => visibleSensors.map((key) => DEFAULT_SENSOR_CONFIGS[key]).filter(Boolean),
    [visibleSensors]
  );

  if (isLoading) {
    return <ChartSkeleton height={height} className={className} />;
  }

  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border",
          isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200",
          className
        )}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No sensor data available</p>
      </div>
    );
  }

  // Axis styling based on theme
  const axisStyle = {
    fontSize: 11,
    fill: isDark ? "#9ca3af" : "#6b7280",
  };

  const gridStyle = {
    stroke: isDark ? "#374151" : "#e5e7eb",
    strokeDasharray: "3 3",
  };

  // Common chart props
  const chartProps = {
    data: chartData,
    margin: { top: 10, right: 10, left: 0, bottom: 0 },
  };

  const renderChart = () => {
    if (variant === "line") {
      return (
        <LineChart {...chartProps}>
          {showGrid && <CartesianGrid {...gridStyle} vertical={false} />}
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisStyle}
            width={40}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                payload={payload as TooltipPayload}
                label={label}
                isDark={isDark}
                optimalRanges={optimalRanges}
              />
            )}
          />
          {showLegend && (
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: 12,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            />
          )}
          {activeSensors.map((sensor) => (
            <Line
              key={sensor.key}
              type="monotone"
              dataKey={sensor.key}
              name={sensor.label}
              stroke={sensor.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      );
    }

    return (
      <AreaChart {...chartProps}>
        <defs>
          {activeSensors.map((sensor) => (
            <linearGradient
              key={sensor.gradientId}
              id={sensor.gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={sensor.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={sensor.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        {showGrid && <CartesianGrid {...gridStyle} vertical={false} />}
        <XAxis
          dataKey="time"
          tickLine={false}
          axisLine={false}
          tick={axisStyle}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={axisStyle}
          width={40}
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as TooltipPayload}
              label={label}
              isDark={isDark}
              optimalRanges={optimalRanges}
            />
          )}
        />
        {showLegend && (
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: 12,
              color: isDark ? "#9ca3af" : "#6b7280",
            }}
          />
        )}
        {activeSensors.map((sensor) => (
          <Area
            key={sensor.key}
            type="monotone"
            dataKey={sensor.key}
            name={sensor.label}
            stroke={sensor.color}
            strokeWidth={2}
            fill={`url(#${sensor.gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </AreaChart>
    );
  };

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Export skeleton for external use.
 */
export { ChartSkeleton as SensorChartSkeleton };
