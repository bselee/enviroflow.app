"use client";

import { useMemo } from "react";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { TimeSeriesPoint } from "@/types";
import { getStatusColor } from "@/lib/status-colors";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the MiniSparkline component.
 */
export interface MiniSparklineProps {
  /** Time series data points */
  data: TimeSeriesPoint[];
  /** Chart height in pixels (default: 32) */
  height?: number;
  /** Chart width - use "100%" for responsive (default) */
  width?: number | string;
  /** Primary color for the line/area */
  color?: string;
  /** Whether to show as area chart (filled) or line chart */
  variant?: "area" | "line";
  /** Whether to show trend indicator arrow */
  showTrend?: boolean;
  /** Stroke width for the line (default: 1.5) */
  strokeWidth?: number;
  /** Gradient opacity at top (default: 0.3) */
  gradientOpacityTop?: number;
  /** Gradient opacity at bottom (default: 0) */
  gradientOpacityBottom?: number;
  /** Optimal range for status-based coloring [min, max] */
  optimalRange?: [number, number];
  /** Whether animation is enabled (default: false for performance) */
  animated?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Trend direction based on data comparison.
 */
type TrendDirection = "up" | "down" | "stable";

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_HEIGHT = 32;
const DEFAULT_STROKE_WIDTH = 1.5;
const DEFAULT_GRADIENT_TOP = 0.3;
const DEFAULT_GRADIENT_BOTTOM = 0;

// Trend calculation: compare last 20% of data points to first 20%
const TREND_SAMPLE_PERCENT = 0.2;
// Minimum change percentage to show a trend (e.g., 1% = 0.01)
const TREND_THRESHOLD = 0.01;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculates the trend direction from time series data.
 * Compares the average of the last N points to the first N points.
 */
function calculateTrend(data: TimeSeriesPoint[]): TrendDirection {
  if (data.length < 4) {
    return "stable";
  }

  const sampleSize = Math.max(2, Math.floor(data.length * TREND_SAMPLE_PERCENT));
  const firstPoints = data.slice(0, sampleSize);
  const lastPoints = data.slice(-sampleSize);

  const firstAvg = firstPoints.reduce((sum, p) => sum + p.value, 0) / firstPoints.length;
  const lastAvg = lastPoints.reduce((sum, p) => sum + p.value, 0) / lastPoints.length;

  // Avoid division by zero
  if (firstAvg === 0) {
    return lastAvg > 0 ? "up" : "stable";
  }

  const changePercent = (lastAvg - firstAvg) / Math.abs(firstAvg);

  if (changePercent > TREND_THRESHOLD) {
    return "up";
  }
  if (changePercent < -TREND_THRESHOLD) {
    return "down";
  }
  return "stable";
}

/**
 * Determines the latest value's status color based on optimal range.
 */
function getLatestStatusColor(
  data: TimeSeriesPoint[],
  optimalRange: [number, number]
): string {
  if (data.length === 0) {
    return "#6b7280"; // Gray default
  }

  const latestValue = data[data.length - 1].value;
  const result = getStatusColor({
    value: latestValue,
    optimalMin: optimalRange[0],
    optimalMax: optimalRange[1],
  });

  return result.hexColor;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Trend indicator arrow component.
 */
function TrendIndicator({
  direction,
  color,
  className,
}: {
  direction: TrendDirection;
  color: string;
  className?: string;
}) {
  if (direction === "stable") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-muted-foreground"
        >
          <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }

  const isUp = direction === "up";

  return (
    <span
      className={cn("inline-flex items-center transition-colors", className)}
      style={{ color }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        style={{
          transform: isUp ? "rotate(0deg)" : "rotate(180deg)",
        }}
      >
        <path
          d="M6 2L10 7H2L6 2Z"
          fill="currentColor"
        />
        <line x1="6" y1="7" x2="6" y2="10" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * MiniSparkline - Compact inline chart for showing data trends.
 *
 * A lightweight sparkline component optimized for inline display in cards,
 * tables, and other compact UI elements. Shows trend direction and supports
 * status-based coloring.
 *
 * Features:
 * - Ultra-compact design (default 32px height)
 * - Optional trend indicator arrow
 * - Status-based coloring from optimal range
 * - Area or line variants
 * - Responsive width support
 * - Animation disabled by default for performance
 *
 * @example
 * ```tsx
 * // Basic sparkline
 * <MiniSparkline data={temperatureData} color="#ef4444" />
 *
 * // With trend indicator and status coloring
 * <MiniSparkline
 *   data={vpdData}
 *   showTrend
 *   optimalRange={[0.8, 1.2]}
 * />
 *
 * // Line variant with custom height
 * <MiniSparkline
 *   data={humidityData}
 *   variant="line"
 *   height={48}
 *   color="#3b82f6"
 * />
 * ```
 */
export function MiniSparkline({
  data,
  height = DEFAULT_HEIGHT,
  width = "100%",
  color,
  variant = "area",
  showTrend = false,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  gradientOpacityTop = DEFAULT_GRADIENT_TOP,
  gradientOpacityBottom = DEFAULT_GRADIENT_BOTTOM,
  optimalRange,
  animated = false,
  className,
}: MiniSparklineProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Generate a unique ID for the gradient
  const gradientId = useMemo(
    () => `sparkline-gradient-${Math.random().toString(36).substring(2, 9)}`,
    []
  );

  // Determine the effective color
  const effectiveColor = useMemo(() => {
    if (optimalRange && data.length > 0) {
      return getLatestStatusColor(data, optimalRange);
    }
    return color || (isDark ? "#60a5fa" : "#3b82f6");
  }, [color, optimalRange, data, isDark]);

  // Calculate trend direction
  const trend = useMemo(() => {
    if (!showTrend) return "stable";
    return calculateTrend(data);
  }, [data, showTrend]);

  // Prepare chart data (ensure it's sorted by timestamp)
  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    return [...data].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [data]);

  // Empty state
  if (chartData.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          className
        )}
        style={{ height, width }}
      >
        {chartData.length === 0 ? "No data" : "--"}
      </div>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 2, right: 2, left: 2, bottom: 2 },
    };

    if (variant === "line") {
      return (
        <LineChart {...commonProps}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={effectiveColor}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={animated}
          />
        </LineChart>
      );
    }

    return (
      <AreaChart {...commonProps}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={effectiveColor} stopOpacity={gradientOpacityTop} />
            <stop offset="100%" stopColor={effectiveColor} stopOpacity={gradientOpacityBottom} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={effectiveColor}
          strokeWidth={strokeWidth}
          fill={`url(#${gradientId})`}
          isAnimationActive={animated}
        />
      </AreaChart>
    );
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div style={{ height, width: showTrend ? "calc(100% - 16px)" : width }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
      {showTrend && (
        <TrendIndicator
          direction={trend}
          color={
            trend === "up"
              ? isDark
                ? "#4ade80"
                : "#22c55e"
              : trend === "down"
              ? isDark
                ? "#f87171"
                : "#ef4444"
              : isDark
              ? "#9ca3af"
              : "#6b7280"
          }
        />
      )}
    </div>
  );
}

/**
 * Export trend calculation for external use.
 */
export { calculateTrend, type TrendDirection };
