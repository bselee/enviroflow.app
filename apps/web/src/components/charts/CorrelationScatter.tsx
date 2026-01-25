"use client";

import { useMemo } from "react";
import {
  Scatter,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  prepareCorrelationData,
  prepareCorrelationFromTimeSeries,
  calculateCorrelation,
  getHourColor,
  correlationToCSV,
  generateCorrelationInsights,
  type CorrelationPoint,
  type CorrelationResult,
  type CorrelationInsight,
} from "@/lib/statistics";
import type { SensorReading, TimeSeriesPoint } from "@/types";

// =============================================================================
// Types
// =============================================================================

export interface CorrelationScatterProps {
  /** X-axis sensor readings */
  xReadings?: SensorReading[];
  /** Y-axis sensor readings */
  yReadings?: SensorReading[];
  /** X-axis time series data */
  xTimeSeries?: TimeSeriesPoint[];
  /** Y-axis time series data */
  yTimeSeries?: TimeSeriesPoint[];
  /** X-axis label */
  xLabel: string;
  /** Y-axis label */
  yLabel: string;
  /** X-axis unit */
  xUnit: string;
  /** Y-axis unit */
  yUnit: string;
  /** Minimum data points required for correlation (default: 50) */
  minDataPoints?: number;
  /** Chart height in pixels */
  height?: number;
  /** Whether the chart is loading */
  isLoading?: boolean;
  /** Show insights below chart */
  showInsights?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Download CSV data
 */
function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format correlation coefficient for display
 */
function formatCoefficient(value: number): string {
  return value.toFixed(3);
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Custom tooltip for scatter plot
 */
function ScatterTooltip({
  active,
  payload,
  xLabel,
  yLabel,
  xUnit,
  yUnit,
  isDark,
}: {
  active?: boolean;
  payload?: Array<{
    payload: CorrelationPoint;
  }>;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  isDark: boolean;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 shadow-lg",
        isDark ? "bg-gray-800/95 border-gray-700 text-white" : "bg-white/95 border-gray-200 text-gray-900"
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}>{xLabel}</span>
          <span className="text-sm font-semibold">
            {point.x.toFixed(1)}
            <span className={cn("ml-0.5 text-xs", isDark ? "text-gray-400" : "text-gray-500")}>
              {xUnit}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}>{yLabel}</span>
          <span className="text-sm font-semibold">
            {point.y.toFixed(1)}
            <span className={cn("ml-0.5 text-xs", isDark ? "text-gray-400" : "text-gray-500")}>
              {yUnit}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-gray-600">
          <span className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Hour</span>
          <span className="text-xs font-medium">{point.hour}:00</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Correlation statistics display
 */
function CorrelationStats({
  correlation,
  xLabel: _xLabel,
  yLabel: _yLabel,
  isDark,
}: {
  correlation: CorrelationResult;
  xLabel: string;
  yLabel: string;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-lg border",
        isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
      )}
    >
      <div>
        <div className={cn("text-xs font-medium mb-1", isDark ? "text-gray-400" : "text-gray-600")}>
          Correlation
        </div>
        <div className="text-lg font-semibold">{formatCoefficient(correlation.coefficient)}</div>
      </div>
      <div>
        <div className={cn("text-xs font-medium mb-1", isDark ? "text-gray-400" : "text-gray-600")}>
          R-Squared
        </div>
        <div className="text-lg font-semibold">{formatCoefficient(correlation.rSquared)}</div>
      </div>
      <div>
        <div className={cn("text-xs font-medium mb-1", isDark ? "text-gray-400" : "text-gray-600")}>
          Strength
        </div>
        <div className="text-sm font-medium capitalize">{correlation.strength}</div>
      </div>
      <div>
        <div className={cn("text-xs font-medium mb-1", isDark ? "text-gray-400" : "text-gray-600")}>
          Direction
        </div>
        <div className="text-sm font-medium capitalize">{correlation.direction}</div>
      </div>
    </div>
  );
}

/**
 * Insight alerts
 */
function InsightAlerts({ insights }: { insights: CorrelationInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      {insights.map((insight, idx) => (
        <Alert
          key={idx}
          variant={insight.severity === "warning" ? "destructive" : "default"}
          className={cn(
            insight.severity === "success" && "border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
          )}
        >
          <Info className="h-4 w-4" />
          <AlertDescription>{insight.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

/**
 * Loading skeleton
 */
function ScatterSkeleton({ height, className }: { height: number; className?: string }) {
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <Skeleton className="absolute inset-0 rounded-lg" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Analyzing correlation...</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * CorrelationScatter - Scatter plot with regression line for sensor correlation analysis.
 *
 * Visualizes the relationship between two sensor types with:
 * - Scatter plot points colored by hour of day
 * - Linear regression line
 * - Correlation coefficient (R²)
 * - Statistical insights
 * - CSV export
 *
 * Requires minimum 50 data points for valid correlation analysis.
 *
 * Features:
 * - Color-coded points by time of day
 * - Regression line with equation
 * - Correlation statistics
 * - Automated insights
 * - CSV export with coefficients
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <CorrelationScatter
 *   xTimeSeries={temperatureData}
 *   yTimeSeries={humidityData}
 *   xLabel="Temperature"
 *   yLabel="Humidity"
 *   xUnit="°F"
 *   yUnit="%"
 *   showInsights
 * />
 * ```
 */
export function CorrelationScatter({
  xReadings,
  yReadings,
  xTimeSeries,
  yTimeSeries,
  xLabel,
  yLabel,
  xUnit,
  yUnit,
  minDataPoints = 50,
  height = 400,
  isLoading = false,
  showInsights = true,
  className,
}: CorrelationScatterProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Prepare correlation data
  const points = useMemo(() => {
    if (xReadings && yReadings) {
      return prepareCorrelationData(xReadings, yReadings);
    } else if (xTimeSeries && yTimeSeries) {
      return prepareCorrelationFromTimeSeries(xTimeSeries, yTimeSeries);
    }
    return [];
  }, [xReadings, yReadings, xTimeSeries, yTimeSeries]);

  // Calculate correlation statistics
  const correlation = useMemo(() => {
    if (points.length < 2) {
      return {
        coefficient: 0,
        rSquared: 0,
        slope: 0,
        intercept: 0,
        count: 0,
        strength: "very weak" as const,
        direction: "none" as const,
      };
    }

    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    return calculateCorrelation(xValues, yValues);
  }, [points]);

  // Generate insights
  const insights = useMemo(() => {
    if (points.length < minDataPoints) return [];
    return generateCorrelationInsights(correlation, xLabel, yLabel);
  }, [correlation, xLabel, yLabel, points.length, minDataPoints]);

  // Calculate regression line points
  const regressionLine = useMemo(() => {
    if (points.length < 2) return [];

    const xValues = points.map((p) => p.x);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);

    return [
      { x: minX, y: correlation.slope * minX + correlation.intercept },
      { x: maxX, y: correlation.slope * maxX + correlation.intercept },
    ];
  }, [points, correlation]);

  // Handle CSV export
  const handleExport = () => {
    const csv = correlationToCSV(points, xLabel, yLabel, correlation);
    const filename = `correlation-${xLabel}-${yLabel}-${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(csv, filename);
  };

  if (isLoading) {
    return <ScatterSkeleton height={height} className={className} />;
  }

  // Insufficient data
  if (points.length < minDataPoints) {
    return (
      <div className={cn("space-y-4", className)}>
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border p-8",
            isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
          )}
          style={{ height }}
        >
          <Info className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-center mb-1">Insufficient Data for Correlation Analysis</p>
          <p className="text-xs text-muted-foreground text-center">
            {points.length} of {minDataPoints} minimum readings collected.
            <br />
            Continue collecting data to enable correlation analysis.
          </p>
        </div>
      </div>
    );
  }

  // No matching data points
  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border",
          isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200",
          className
        )}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No matching data points for correlation</p>
      </div>
    );
  }

  // Axis styling
  const axisStyle = {
    fontSize: 11,
    fill: isDark ? "#9ca3af" : "#6b7280",
  };

  const gridStyle = {
    stroke: isDark ? "#374151" : "#e5e7eb",
    strokeDasharray: "3 3",
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">
          {xLabel} vs {yLabel} Correlation
        </h3>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Statistics */}
      <CorrelationStats correlation={correlation} xLabel={xLabel} yLabel={yLabel} isDark={isDark} />

      {/* Scatter plot */}
      <div
        className={cn(
          "border rounded-lg p-4",
          isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
        )}
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              unit={xUnit}
              tickLine={false}
              axisLine={false}
              tick={axisStyle}
              label={{
                value: `${xLabel} (${xUnit})`,
                position: "insideBottom",
                offset: -5,
                style: { fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              unit={yUnit}
              tickLine={false}
              axisLine={false}
              tick={axisStyle}
              label={{
                value: `${yLabel} (${yUnit})`,
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: isDark ? "#9ca3af" : "#6b7280" },
              }}
            />
            <Tooltip
              content={({ active, payload }) => (
                <ScatterTooltip
                  active={active}
                  payload={payload as Array<{ payload: CorrelationPoint }>}
                  xLabel={xLabel}
                  yLabel={yLabel}
                  xUnit={xUnit}
                  yUnit={yUnit}
                  isDark={isDark}
                />
              )}
            />

            {/* Regression line */}
            {regressionLine.length > 0 && (
              <ReferenceLine
                segment={regressionLine}
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                  value: `y = ${correlation.slope.toFixed(2)}x + ${correlation.intercept.toFixed(2)}`,
                  position: "top",
                  fill: isDark ? "#10b981" : "#059669",
                  fontSize: 11,
                }}
              />
            )}

            {/* Data points colored by hour */}
            <Scatter
              name="Readings"
              data={points}
              fill="#3b82f6"
              shape={(props: any) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: CorrelationPoint };
                const color = getHourColor(payload.hour);
                return <circle cx={cx} cy={cy} r={4} fill={color} stroke={isDark ? "#1f2937" : "#ffffff"} strokeWidth={1} />;
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Color legend for hours */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getHourColor(0) }} />
          <span className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Midnight</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getHourColor(6) }} />
          <span className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Dawn</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getHourColor(12) }} />
          <span className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Noon</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getHourColor(18) }} />
          <span className={cn(isDark ? "text-gray-400" : "text-gray-600")}>Evening</span>
        </div>
      </div>

      {/* Insights */}
      {showInsights && <InsightAlerts insights={insights} />}

      {/* Data info */}
      <div className="text-xs text-muted-foreground text-center">
        Based on {points.length} matching data points
      </div>
    </div>
  );
}
