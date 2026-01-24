"use client";

import * as React from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { VPDDial } from "@/components/dashboard/VPDDial";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TimeSeriesPoint } from "@/types";

// =============================================================================
// Types
// =============================================================================

/**
 * Trend data for a single metric.
 * Represents the change in value over a specific time period.
 */
interface MetricTrend {
  /** The change in value (positive = increase, negative = decrease) */
  delta: number;
  /** Human-readable period string (e.g., "1h", "30m", "2h") */
  period: string;
}

/**
 * Props for the EnvironmentSnapshot component.
 * This is the hero section of the dashboard displaying the primary environmental metrics.
 */
export interface EnvironmentSnapshotProps {
  /** Current VPD value in kPa. Null if unavailable. */
  vpd: number | null;
  /** Current temperature value. Null if unavailable. */
  temperature: number | null;
  /** Current humidity percentage. Null if unavailable. */
  humidity: number | null;
  /** Current CO2 level in ppm. Optional, for future expansion. */
  co2?: number | null;
  /** Temperature display unit. Defaults to 'F'. */
  temperatureUnit?: "F" | "C";
  /** Historical VPD data for the dial's 24h background trend. */
  historicalData?: TimeSeriesPoint[];
  /** Trend data for each metric showing recent changes. */
  trends?: {
    temperature?: MetricTrend;
    humidity?: MetricTrend;
    vpd?: MetricTrend;
  };
  /** Whether the data source (controllers) are currently connected. */
  isConnected?: boolean;
  /** Whether data is currently being fetched. Shows skeletons when true. */
  isLoading?: boolean;
  /** Callback fired when the VPD dial is tapped/clicked. */
  onVPDTap?: () => void;
  /** Additional CSS classes for the container. */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Thresholds for determining if a metric change is significant.
 * Changes below these thresholds are displayed as neutral.
 */
const SIGNIFICANT_CHANGE_THRESHOLDS = {
  temperature: 0.5, // 0.5 degrees
  humidity: 1.0, // 1%
  vpd: 0.05, // 0.05 kPa
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Determines if a trend delta represents a significant change.
 *
 * @param delta - The change value
 * @param threshold - Minimum absolute value to consider significant
 * @returns Whether the change exceeds the threshold
 */
function isSignificantChange(delta: number, threshold: number): boolean {
  return Math.abs(delta) >= threshold;
}

/**
 * Formats a delta value for display with appropriate sign and precision.
 *
 * @param delta - The change value
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted string with sign (e.g., "+2", "-0.5")
 */
function formatDelta(delta: number, decimals: number = 0): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(decimals)}`;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for the entire EnvironmentSnapshot component.
 * Maintains the same layout structure for smooth loading transitions.
 */
function EnvironmentSnapshotSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full rounded-xl bg-card/50 backdrop-blur-sm border border-border/50",
        "p-6 md:p-8 lg:p-10",
        className
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 items-center">
        {/* Temperature skeleton */}
        <div className="flex flex-col items-center justify-center order-2 md:order-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-16 w-28 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* VPD Dial skeleton */}
        <div className="flex items-center justify-center order-1 md:order-2">
          <Skeleton
            className="rounded-full"
            style={{ width: 220, height: 220 }}
          />
        </div>

        {/* Humidity skeleton */}
        <div className="flex flex-col items-center justify-center order-3">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-16 w-24 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Connection status indicator component.
 * Shows online/offline state with appropriate styling.
 */
function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              "transition-colors duration-200",
              isConnected
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isConnected
                  ? "bg-success animate-pulse-slow"
                  : "bg-destructive"
              )}
              aria-hidden="true"
            />
            {isConnected ? "Online" : "Offline"}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isConnected
              ? "Controllers are connected and reporting data"
              : "No active connection to controllers"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Trend indicator component showing direction and magnitude of change.
 * Displays an arrow with the delta value and time period.
 */
function TrendIndicator({
  delta,
  period,
  type,
  unit = "",
}: {
  delta: number;
  period: string;
  type: "temperature" | "humidity" | "vpd";
  unit?: string;
}) {
  const threshold = SIGNIFICANT_CHANGE_THRESHOLDS[type];
  const significant = isSignificantChange(delta, threshold);
  const isIncrease = delta > 0;
  const isDecrease = delta < 0;

  // Determine display properties based on direction and significance
  const displayProps = useMemo(() => {
    if (!significant) {
      return {
        arrow: "",
        colorClass: "text-muted-foreground",
        label: "stable",
      };
    }

    if (isIncrease) {
      return {
        arrow: "\u2191", // Unicode up arrow
        colorClass: "text-success",
        label: "increasing",
      };
    }

    return {
      arrow: "\u2193", // Unicode down arrow
      colorClass: "text-destructive",
      label: "decreasing",
    };
  }, [significant, isIncrease]);

  // Format delta based on metric type
  const formattedDelta = useMemo(() => {
    if (!significant) {
      return `~0${unit}`;
    }
    const decimals = type === "vpd" ? 2 : type === "temperature" ? 0 : 0;
    return `${formatDelta(delta, decimals)}${unit}`;
  }, [delta, type, unit, significant]);

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-context transition-colors duration-200",
        displayProps.colorClass
      )}
      aria-label={`${displayProps.label}, ${Math.abs(delta)} ${unit} over ${period}`}
    >
      {displayProps.arrow && (
        <span className="font-semibold" aria-hidden="true">
          {displayProps.arrow}
        </span>
      )}
      <span className="tabular-nums">{formattedDelta}</span>
      <span className="text-muted-foreground">{period}</span>
    </div>
  );
}

/**
 * Single metric display card showing the value with optional trend.
 * Used for temperature and humidity displays flanking the VPD dial.
 */
function MetricCard({
  label,
  value,
  unit,
  trend,
  trendType,
  trendUnit,
  isUnavailable = false,
  className,
}: {
  label: string;
  value: number | null;
  unit: string;
  trend?: MetricTrend;
  trendType: "temperature" | "humidity" | "vpd";
  trendUnit?: string;
  isUnavailable?: boolean;
  className?: string;
}) {
  const hasValue = value !== null && !isUnavailable;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "py-4 md:py-0",
        className
      )}
    >
      {/* Label */}
      <span className="text-supporting text-muted-foreground uppercase tracking-wide mb-2">
        {label}
      </span>

      {/* Value */}
      <div className="min-h-[64px] flex items-center justify-center">
        {hasValue ? (
          <div className="flex items-baseline gap-0.5">
            <AnimatedNumber
              value={value}
              decimals={trendType === "temperature" ? 0 : 0}
              duration={600}
              className="text-metric text-foreground"
            />
            <span className="text-supporting text-muted-foreground ml-1">
              {unit}
            </span>
          </div>
        ) : (
          <span className="text-metric text-muted-foreground/30 tracking-wider font-light">
            --
          </span>
        )}
      </div>

      {/* Trend indicator */}
      <div className="min-h-[24px] mt-1">
        {hasValue && trend ? (
          <TrendIndicator
            delta={trend.delta}
            period={trend.period}
            type={trendType}
            unit={trendUnit}
          />
        ) : hasValue ? (
          <div className="flex items-center gap-1.5 text-context text-muted-foreground/40">
            <span className="inline-block w-3 h-[2px] bg-muted-foreground/30 rounded-full" aria-hidden="true" />
            <span className="text-xs">Collecting...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * EnvironmentSnapshot - Hero dashboard component displaying primary environmental metrics.
 *
 * This component occupies the top ~40% of the dashboard and provides an at-a-glance
 * view of the current environmental conditions. It features:
 *
 * - Central VPD dial with status indication and historical trend
 * - Temperature reading on the left with trend indicator
 * - Humidity reading on the right with trend indicator
 * - Connection status indicator
 * - Animated value transitions
 * - Responsive layout (stacks on mobile)
 *
 * Layout:
 * ```
 * +---------------------------------------+
 * |                                       |
 * |    TEMP          VPD           HUM    |
 * |    76 F         1.2kPa          58%   |
 * |   +2  1h       [DIAL]        -3%  2h  |
 * |                                       |
 * +---------------------------------------+
 * ```
 *
 * @example
 * ```tsx
 * <EnvironmentSnapshot
 *   vpd={1.05}
 *   temperature={76}
 *   humidity={58}
 *   temperatureUnit="F"
 *   isConnected={true}
 *   trends={{
 *     temperature: { delta: 2, period: "1h" },
 *     humidity: { delta: -3, period: "2h" },
 *   }}
 *   onVPDTap={() => setShowVPDDetails(true)}
 * />
 * ```
 */
export function EnvironmentSnapshot({
  vpd,
  temperature,
  humidity,
  temperatureUnit = "F",
  historicalData,
  trends,
  isConnected = true,
  isLoading = false,
  onVPDTap,
  className,
}: EnvironmentSnapshotProps): React.ReactElement {
  // Memoize the temperature unit suffix
  const tempUnit = useMemo(() => {
    return temperatureUnit === "C" ? "\u00B0C" : "\u00B0F";
  }, [temperatureUnit]);

  // Memoize the temperature trend unit (just the degree symbol)
  const tempTrendUnit = useMemo(() => {
    return "\u00B0";
  }, []);

  // Show skeleton during loading
  if (isLoading) {
    return <EnvironmentSnapshotSkeleton className={className} />;
  }

  return (
    <div
      className={cn(
        "w-full rounded-xl bg-card/50 backdrop-blur-sm border border-border/50",
        "p-6 md:p-8 lg:p-10",
        "transition-all duration-300",
        !isConnected && "border-destructive/30",
        className
      )}
    >
      {/* Connection Status - positioned at top right */}
      <div className="flex justify-end mb-4 md:mb-2">
        <ConnectionStatus isConnected={isConnected} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 items-center">
        {/* Temperature - Left side on desktop, second on mobile */}
        <MetricCard
          label="Temp"
          value={temperature}
          unit={tempUnit}
          trend={trends?.temperature}
          trendType="temperature"
          trendUnit={tempTrendUnit}
          isUnavailable={!isConnected}
          className="order-2 md:order-1"
        />

        {/* VPD Dial - Center on all screen sizes, first on mobile */}
        <div className="flex items-center justify-center order-1 md:order-2">
          {vpd !== null ? (
            <VPDDial
              currentVPD={vpd}
              historicalData={historicalData}
              onTap={onVPDTap}
              className="w-full max-w-[280px]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-[280px] h-[280px] relative">
              {/* Pulsing ring indicator */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={cn(
                    "w-32 h-32 rounded-full border-2 border-dashed",
                    isConnected
                      ? "border-muted-foreground/20 animate-pulse"
                      : "border-muted-foreground/10"
                  )}
                  aria-hidden="true"
                />
              </div>

              {/* Content */}
              <div className="text-metric text-muted-foreground/30 tracking-wider font-light">
                --
              </div>
              <div className="text-supporting text-muted-foreground/60 mt-2">
                kPa
              </div>
              <div className={cn(
                "text-context mt-4 text-sm",
                isConnected
                  ? "text-muted-foreground/60"
                  : "text-muted-foreground/40"
              )}>
                {isConnected ? "Connecting..." : "Offline"}
              </div>
            </div>
          )}
        </div>

        {/* Humidity - Right side on desktop, third on mobile */}
        <MetricCard
          label="Humidity"
          value={humidity}
          unit="%"
          trend={trends?.humidity}
          trendType="humidity"
          trendUnit="%"
          isUnavailable={!isConnected}
          className="order-3"
        />
      </div>

      {/* Optional VPD Trend (shown below dial on larger screens if available) */}
      {trends?.vpd && vpd !== null && (
        <div className="hidden md:flex justify-center mt-4">
          <TrendIndicator
            delta={trends.vpd.delta}
            period={trends.vpd.period}
            type="vpd"
            unit=" kPa"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Re-export the skeleton component for external use.
 * Useful when parent components need to show loading state before
 * the EnvironmentSnapshot data is available.
 */
export { EnvironmentSnapshotSkeleton };

/**
 * Re-export types for consumers.
 */
export type { MetricTrend };
