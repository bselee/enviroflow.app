"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TimeSeriesPoint } from "@/types";
import {
  getVPDStatusColor,
  getStatusLevel,
  STATUS_COLORS as STATUS_COLOR_CONFIG,
  type StatusLevel,
} from "@/lib/status-colors";
import {
  useAnimationTierContext,
  usePulseEnabled,
  type AnimationTier,
} from "@/hooks/use-animation-tier";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the VPDDial component.
 * This is the hero dashboard component showing current VPD as a radial gauge.
 */
export interface VPDDialProps {
  /** Current VPD value in kPa */
  currentVPD: number;
  /** Historical data for 24h background trend (optional) */
  historicalData?: TimeSeriesPoint[];
  /** Optimal VPD range [min, max] in kPa. Defaults to [0.8, 1.2] */
  optimalRange?: [number, number];
  /** Display unit for VPD value */
  unit?: "kPa" | "mbar";
  /** Callback fired when the dial is tapped/clicked */
  onTap?: () => void;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Warning tolerance percentage (0-1). Default: 0.15 */
  warningTolerance?: number;
  /** Alert threshold percentage (0-1). Default: 0.30 */
  alertThreshold?: number;
}

/**
 * Status levels for VPD ranges determining visual appearance.
 * @deprecated Use StatusLevel from @/lib/status-colors instead
 */
type VPDStatus = StatusLevel;

/**
 * Color configuration for each status level.
 */
interface StatusColors {
  gradient: [string, string];
  glow: string;
  text: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Gauge diameter in pixels */
const DIAL_SIZE = 280;

/** Stroke width of the progress arc */
const STROKE_WIDTH = 24;

/** Minimum VPD value on the gauge scale */
const MIN_VPD = 0.4;

/** Maximum VPD value on the gauge scale */
const MAX_VPD = 2.0;

/** Animation duration for value transitions in milliseconds (full tier) */
const ANIMATION_DURATION_FULL = 800;

/** Animation duration for simplified tier */
const ANIMATION_DURATION_SIMPLIFIED = 400;

/** Animation duration for minimal tier (instant) */
const ANIMATION_DURATION_MINIMAL = 0;

/** Default optimal VPD range [min, max] in kPa */
const DEFAULT_OPTIMAL_RANGE: [number, number] = [0.8, 1.2];

/** Default warning tolerance */
const DEFAULT_WARNING_TOLERANCE = 0.15;

/** Default alert threshold */
const DEFAULT_ALERT_THRESHOLD = 0.30;

/**
 * Color configurations for each status.
 * Uses the centralized STATUS_COLOR_CONFIG from status-colors.ts
 */
const STATUS_COLORS: Record<VPDStatus, StatusColors> = {
  optimal: {
    gradient: [STATUS_COLOR_CONFIG.optimal.hex, "#059669"],
    glow: STATUS_COLOR_CONFIG.optimal.glowRgba,
    text: STATUS_COLOR_CONFIG.optimal.textClass,
  },
  warning: {
    gradient: [STATUS_COLOR_CONFIG.warning.hex, "#d97706"],
    glow: STATUS_COLOR_CONFIG.warning.glowRgba,
    text: STATUS_COLOR_CONFIG.warning.textClass,
  },
  alert: {
    gradient: [STATUS_COLOR_CONFIG.alert.hex, "#dc2626"],
    glow: STATUS_COLOR_CONFIG.alert.glowRgba,
    text: STATUS_COLOR_CONFIG.alert.textClass,
  },
};

/** Track background color (subtle white with transparency) */
const TRACK_COLOR = "rgba(255, 255, 255, 0.1)";

/** Historical data track color (even more subtle) */
const HISTORICAL_TRACK_COLOR = "rgba(255, 255, 255, 0.05)";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clamps a number to a specified range.
 *
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converts a VPD value to a percentage of the gauge range.
 *
 * @param vpd - VPD value in kPa
 * @returns Percentage (0-1) representing position on the gauge
 */
function vpdToPercent(vpd: number): number {
  const clamped = clamp(vpd, MIN_VPD, MAX_VPD);
  return (clamped - MIN_VPD) / (MAX_VPD - MIN_VPD);
}

/**
 * Determines the status level based on VPD value and optimal range.
 * Now uses the centralized getStatusLevel function from status-colors.ts.
 *
 * @param vpd - Current VPD value
 * @param optimalRange - [min, max] optimal range
 * @param warningTolerance - Warning tolerance percentage (default: 0.15)
 * @returns Status level: 'optimal', 'warning', or 'alert'
 */
function getVPDStatus(
  vpd: number,
  optimalRange: [number, number],
  warningTolerance: number = DEFAULT_WARNING_TOLERANCE
): VPDStatus {
  return getStatusLevel(vpd, optimalRange[0], optimalRange[1], warningTolerance);
}

/**
 * Formats a VPD value for display with appropriate precision.
 *
 * @param vpd - VPD value in kPa
 * @param unit - Display unit
 * @returns Formatted string with unit
 */
function formatVPD(vpd: number, unit: "kPa" | "mbar"): string {
  if (unit === "mbar") {
    // 1 kPa = 10 mbar
    return `${(vpd * 10).toFixed(1)} mbar`;
  }
  return `${vpd.toFixed(2)} kPa`;
}

/**
 * Generates an SVG arc path for the gauge.
 * Uses a circular arc that starts from the bottom-left and sweeps clockwise.
 *
 * @param percent - Percentage of the arc to draw (0-1)
 * @param radius - Radius of the arc
 * @param strokeWidth - Width of the stroke
 * @returns SVG path data string
 */
function generateArcPath(
  percent: number,
  radius: number,
  strokeWidth: number
): string {
  const innerRadius = radius - strokeWidth / 2;
  const center = radius;

  // Arc spans 270 degrees (from 135 to 405 degrees, or -225 to 45)
  // This creates a gap at the bottom
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle; // 270 degrees

  // Calculate the sweep angle based on percentage
  const sweepAngle = totalAngle * clamp(percent, 0, 1);
  const currentEndAngle = startAngle + sweepAngle;

  // Convert to radians
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (currentEndAngle * Math.PI) / 180;

  // Calculate start and end points
  const x1 = center + innerRadius * Math.cos(startRad);
  const y1 = center + innerRadius * Math.sin(startRad);
  const x2 = center + innerRadius * Math.cos(endRad);
  const y2 = center + innerRadius * Math.sin(endRad);

  // Determine if we need the large arc flag (for arcs > 180 degrees)
  const largeArcFlag = sweepAngle > 180 ? 1 : 0;

  // Generate the arc path
  // M = moveto, A = arc (rx ry x-axis-rotation large-arc-flag sweep-flag x y)
  return `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
}

/**
 * Generates the full track path (270 degree arc background).
 *
 * @param radius - Radius of the arc
 * @param strokeWidth - Width of the stroke
 * @returns SVG path data string for the full track
 */
function generateTrackPath(radius: number, strokeWidth: number): string {
  return generateArcPath(1, radius, strokeWidth);
}

// =============================================================================
// Custom Hook for Animated Value (Animation Tier Aware)
// =============================================================================

/**
 * Gets animation duration based on current animation tier.
 *
 * @param tier - Current animation tier
 * @returns Animation duration in milliseconds
 */
function getAnimationDuration(tier: AnimationTier): number {
  switch (tier) {
    case "full":
      return ANIMATION_DURATION_FULL;
    case "simplified":
      return ANIMATION_DURATION_SIMPLIFIED;
    case "minimal":
      return ANIMATION_DURATION_MINIMAL;
    default:
      return ANIMATION_DURATION_SIMPLIFIED;
  }
}

/**
 * Hook that animates a numeric value with easing.
 * Now animation-tier aware - adjusts duration and easing based on performance tier.
 *
 * @param targetValue - The target value to animate to
 * @param duration - Animation duration in milliseconds (optional, auto-detected from tier)
 * @returns Current animated value
 */
function useAnimatedValue(targetValue: number, duration?: number): number {
  const { tier } = useAnimationTierContext();
  const effectiveDuration = duration ?? getAnimationDuration(tier);

  const [currentValue, setCurrentValue] = useState(targetValue);
  const animationRef = useRef<number | null>(null);
  const startValueRef = useRef(targetValue);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // If minimal tier or zero duration, skip animation
    if (tier === "minimal" || effectiveDuration === 0) {
      setCurrentValue(targetValue);
      return;
    }

    startValueRef.current = currentValue;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / effectiveDuration, 1);

      // Use simpler easing for simplified tier
      let eased: number;
      if (tier === "full") {
        // Ease-out cubic for smooth deceleration
        eased = 1 - Math.pow(1 - progress, 3);
      } else {
        // Simple ease-out for simplified tier
        eased = 1 - Math.pow(1 - progress, 2);
      }

      const newValue =
        startValueRef.current + (targetValue - startValueRef.current) * eased;
      setCurrentValue(newValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetValue, effectiveDuration, tier]);

  return currentValue;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for the VPD dial.
 */
function VPDDialSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{ width: DIAL_SIZE, height: DIAL_SIZE }}
    >
      <Skeleton className="rounded-full" style={{ width: 200, height: 200 }} />
    </div>
  );
}

/**
 * SVG gradient definitions for the progress arc.
 */
function GradientDefs({
  status,
  id,
}: {
  status: VPDStatus;
  id: string;
}): React.ReactElement {
  const colors = STATUS_COLORS[status];

  return (
    <defs>
      {/* Main gradient for the progress arc */}
      <linearGradient id={`vpd-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={colors.gradient[0]} />
        <stop offset="100%" stopColor={colors.gradient[1]} />
      </linearGradient>

      {/* Glow filter for the progress arc */}
      <filter
        id={`vpd-glow-${id}`}
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Drop shadow for depth */}
      <filter id={`vpd-shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow
          dx="0"
          dy="2"
          stdDeviation="3"
          floodColor="rgba(0,0,0,0.3)"
        />
      </filter>
    </defs>
  );
}

/**
 * Renders the historical data as a subtle background pattern on the gauge.
 * This creates a visual representation of 24h VPD trends.
 */
function HistoricalBackground({
  data,
  radius,
  strokeWidth,
}: {
  data: TimeSeriesPoint[];
  radius: number;
  strokeWidth: number;
}): React.ReactElement | null {
  if (data.length < 2) {
    return null;
  }

  // Sample historical data to create segments
  // We'll take the min and max values to show the range
  const values = data.map((point) => point.value);
  const minVPD = Math.min(...values);
  const maxVPD = Math.max(...values);

  const minPercent = vpdToPercent(minVPD);
  const maxPercent = vpdToPercent(maxVPD);

  // Only render if there's meaningful variation
  if (maxPercent - minPercent < 0.02) {
    return null;
  }

  const innerRadius = radius - strokeWidth / 2;
  const center = radius;

  // Arc parameters (matching main gauge)
  const startAngle = 135;
  const totalAngle = 270;

  // Calculate the arc segment for the historical range
  const rangeStartAngle = startAngle + totalAngle * minPercent;
  const rangeEndAngle = startAngle + totalAngle * maxPercent;

  const startRad = (rangeStartAngle * Math.PI) / 180;
  const endRad = (rangeEndAngle * Math.PI) / 180;

  const x1 = center + innerRadius * Math.cos(startRad);
  const y1 = center + innerRadius * Math.sin(startRad);
  const x2 = center + innerRadius * Math.cos(endRad);
  const y2 = center + innerRadius * Math.sin(endRad);

  const sweepAngle = rangeEndAngle - rangeStartAngle;
  const largeArcFlag = sweepAngle > 180 ? 1 : 0;

  const path = `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

  return (
    <path
      d={path}
      fill="none"
      stroke={HISTORICAL_TRACK_COLOR}
      strokeWidth={strokeWidth + 8}
      strokeLinecap="round"
      opacity={0.6}
    />
  );
}

/**
 * Detailed breakdown tooltip content showing VPD analysis.
 */
function VPDBreakdownContent({
  vpd,
  optimalRange,
  unit,
  historicalData,
  warningTolerance = DEFAULT_WARNING_TOLERANCE,
}: {
  vpd: number;
  optimalRange: [number, number];
  unit: "kPa" | "mbar";
  historicalData?: TimeSeriesPoint[];
  warningTolerance?: number;
}): React.ReactElement {
  const status = getVPDStatus(vpd, optimalRange, warningTolerance);
  const statusColor = getVPDStatusColor(vpd, optimalRange);
  const [optMin, optMax] = optimalRange;

  // Calculate historical stats if available
  const historicalStats = useMemo(() => {
    if (!historicalData || historicalData.length < 2) {
      return null;
    }

    const values = historicalData.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    return { min, max, avg };
  }, [historicalData]);

  const statusLabels: Record<VPDStatus, string> = {
    optimal: "Optimal Range",
    warning: "Near Optimal",
    alert: "Outside Optimal",
  };

  return (
    <div className="space-y-3 p-1">
      <div className="text-center">
        <div className="text-lg font-semibold">{formatVPD(vpd, unit)}</div>
        <div
          className={cn(
            "text-xs font-medium",
            statusColor.textClass
          )}
        >
          {statusLabels[status]}
        </div>
        {/* Show deviation from optimal */}
        {statusColor.deviationDirection !== "none" && (
          <div className="text-xs text-muted-foreground mt-1">
            {statusColor.deviationDirection === "high" ? "+" : "-"}
            {statusColor.deviation.toFixed(2)} {unit} from optimal
          </div>
        )}
      </div>

      <div className="border-t border-border pt-2 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Target Range:</span>
          <span className="font-medium">
            {formatVPD(optMin, unit).replace(` ${unit}`, "")} -{" "}
            {formatVPD(optMax, unit)}
          </span>
        </div>

        {historicalStats && (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">24h Avg:</span>
              <span className="font-medium">
                {formatVPD(historicalStats.avg, unit)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">24h Range:</span>
              <span className="font-medium">
                {formatVPD(historicalStats.min, unit).replace(` ${unit}`, "")} -{" "}
                {formatVPD(historicalStats.max, unit)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground text-center pt-1 border-t border-border">
        {status === "optimal" && "Plants are in ideal VPD conditions"}
        {status === "warning" && "Adjust temperature or humidity slightly"}
        {status === "alert" && "Environmental adjustment recommended"}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * VPDDial - Hero radial gauge component for displaying Vapor Pressure Deficit.
 *
 * This component displays the current VPD value as an animated radial gauge
 * with color-coded status indication. The gauge shifts from green (optimal)
 * to amber (warning) to red (alert) based on how the current value compares
 * to the optimal range.
 *
 * Features:
 * - Smooth animated transitions between values (animation-tier aware)
 * - Dynamic color gradient based on VPD status with smooth interpolation
 * - Subtle glow effect matching status color (full tier only)
 * - Optional 24h historical data shown as background range
 * - Click/tap for detailed breakdown tooltip
 * - Responsive sizing for mobile
 * - Respects user's reduced motion preferences
 *
 * @example
 * ```tsx
 * <VPDDial
 *   currentVPD={1.05}
 *   optimalRange={[0.8, 1.2]}
 *   historicalData={sensorData}
 *   onTap={() => setShowDetails(true)}
 * />
 * ```
 */
export function VPDDial({
  currentVPD,
  historicalData,
  optimalRange = DEFAULT_OPTIMAL_RANGE,
  unit = "kPa",
  onTap,
  isLoading = false,
  className,
  warningTolerance = DEFAULT_WARNING_TOLERANCE,
  alertThreshold = DEFAULT_ALERT_THRESHOLD,
}: VPDDialProps): React.ReactElement {
  // Animation tier context for performance-aware rendering
  const { tier } = useAnimationTierContext();
  const isPulseEnabled = usePulseEnabled();

  // Generate unique ID for SVG gradients to avoid conflicts with multiple instances
  const instanceId = useRef(
    `vpd-${Math.random().toString(36).substring(2, 9)}`
  ).current;

  // Animate the VPD value for smooth transitions (tier-aware)
  const animatedVPD = useAnimatedValue(currentVPD);

  // Get dynamic status color with gradient interpolation
  const statusColorResult = useMemo(
    () =>
      getVPDStatusColor(currentVPD, optimalRange),
    [currentVPD, optimalRange]
  );

  // Calculate derived values
  const percent = vpdToPercent(animatedVPD);
  const status = getVPDStatus(currentVPD, optimalRange, warningTolerance);
  const colors = STATUS_COLORS[status];

  // Use interpolated color for smoother transitions
  const dynamicGlowColor = isPulseEnabled ? statusColorResult.glowColor : "transparent";

  // Calculate SVG dimensions
  const radius = DIAL_SIZE / 2;

  // Handle click/tap interaction
  const handleInteraction = useCallback(() => {
    onTap?.();
  }, [onTap]);

  // Handle keyboard interaction for accessibility
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onTap?.();
      }
    },
    [onTap]
  );

  if (isLoading) {
    return <VPDDialSkeleton className={className} />;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative inline-flex items-center justify-center cursor-pointer",
              "transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "rounded-full",
              className
            )}
            style={{
              width: DIAL_SIZE,
              height: DIAL_SIZE,
              maxWidth: "100%",
              aspectRatio: "1 / 1",
            }}
            onClick={handleInteraction}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`VPD: ${formatVPD(currentVPD, unit)}, ${status} status`}
          >
            {/* SVG Gauge - glow effect only in full tier */}
            <svg
              viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
              className="w-full h-full"
              style={{
                filter: isPulseEnabled
                  ? `drop-shadow(0 0 12px ${dynamicGlowColor})`
                  : "none",
              }}
            >
              <GradientDefs status={status} id={instanceId} />

              {/* Background track (full arc) */}
              <path
                d={generateTrackPath(radius, STROKE_WIDTH)}
                fill="none"
                stroke={TRACK_COLOR}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
              />

              {/* Historical range indicator (if data available) */}
              {historicalData && (
                <HistoricalBackground
                  data={historicalData}
                  radius={radius}
                  strokeWidth={STROKE_WIDTH}
                />
              )}

              {/* Progress arc - glow filter only in full tier */}
              <path
                d={generateArcPath(percent, radius, STROKE_WIDTH)}
                fill="none"
                stroke={`url(#vpd-gradient-${instanceId})`}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                filter={isPulseEnabled ? `url(#vpd-glow-${instanceId})` : undefined}
                style={{
                  transition: tier !== "minimal" ? "stroke 0.3s ease" : "none",
                }}
              />

              {/* Tick marks for reference */}
              {[0.4, 0.8, 1.2, 1.6, 2.0].map((tickVPD) => {
                const tickPercent = vpdToPercent(tickVPD);
                const angle = 135 + 270 * tickPercent;
                const angleRad = (angle * Math.PI) / 180;
                const tickInnerRadius = radius - STROKE_WIDTH - 8;
                const tickOuterRadius = radius - STROKE_WIDTH - 4;
                const x1 = radius + tickInnerRadius * Math.cos(angleRad);
                const y1 = radius + tickInnerRadius * Math.sin(angleRad);
                const x2 = radius + tickOuterRadius * Math.cos(angleRad);
                const y2 = radius + tickOuterRadius * Math.sin(angleRad);

                return (
                  <line
                    key={tickVPD}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* Center content - VPD value and label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight",
                  tier !== "minimal" && "transition-colors duration-300",
                  statusColorResult.textClass
                )}
                style={{
                  // Use interpolated color for smoother gradient between statuses
                  color: tier === "full" ? statusColorResult.hexColor : undefined,
                }}
              >
                {animatedVPD.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
                {unit}
              </span>
              <span
                className={cn(
                  "text-xs font-medium mt-2 px-2 py-0.5 rounded-full",
                  status === "optimal" && "bg-emerald-500/10 text-emerald-500",
                  status === "warning" && "bg-amber-500/10 text-amber-500",
                  status === "alert" && "bg-red-500/10 text-red-500"
                )}
              >
                {status === "optimal" && "Optimal"}
                {status === "warning" && "Warning"}
                {status === "alert" && "Alert"}
              </span>
            </div>
          </div>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="w-56">
          <VPDBreakdownContent
            vpd={currentVPD}
            optimalRange={optimalRange}
            unit={unit}
            historicalData={historicalData}
            warningTolerance={warningTolerance}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Re-export the skeleton component for external use
 */
export { VPDDialSkeleton };
