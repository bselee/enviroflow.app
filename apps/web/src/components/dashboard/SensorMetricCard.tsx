"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Thermometer,
  Droplet,
  Activity,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { MiniSparkline } from "@/components/charts/MiniSparkline";
import {
  getStatusColor,
  getTemperatureStatusColor,
  getHumidityStatusColor,
  getVPDStatusColor,
  getCO2StatusColor,
  type StatusColorResult,
} from "@/lib/status-colors";
import type { SensorType, TimeSeriesPoint } from "@/types";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the SensorMetricCard component.
 */
export interface SensorMetricCardProps {
  /** Sensor type for icon and formatting */
  sensorType: SensorType;
  /** Current sensor value */
  value: number | null;
  /** Unit of measurement */
  unit?: string;
  /** Optional label override (default: derived from sensorType) */
  label?: string;
  /** Historical data for sparkline (optional) */
  historicalData?: TimeSeriesPoint[];
  /** Optimal range for status coloring [min, max] */
  optimalRange?: [number, number];
  /** Whether to show the mini sparkline */
  showSparkline?: boolean;
  /** Whether to show the trend indicator */
  showTrend?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether the card is loading */
  isLoading?: boolean;
  /** Whether the data is stale */
  isStale?: boolean;
  /** Click handler for the card */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Configuration for sensor display.
 */
interface SensorDisplayConfig {
  label: string;
  icon: LucideIcon;
  unit: string;
  decimals: number;
  defaultOptimalRange: [number, number];
  getStatusColor: (value: number, range: [number, number]) => StatusColorResult;
}

// =============================================================================
// Constants
// =============================================================================

const SENSOR_CONFIGS: Record<SensorType, SensorDisplayConfig> = {
  temperature: {
    label: "Temperature",
    icon: Thermometer,
    unit: "F",
    decimals: 1,
    defaultOptimalRange: [70, 82],
    getStatusColor: (value, range) => getTemperatureStatusColor(value, "F", range),
  },
  humidity: {
    label: "Humidity",
    icon: Droplet,
    unit: "%",
    decimals: 1,
    defaultOptimalRange: [50, 70],
    getStatusColor: (value, range) => getHumidityStatusColor(value, range),
  },
  vpd: {
    label: "VPD",
    icon: Activity,
    unit: "kPa",
    decimals: 2,
    defaultOptimalRange: [0.8, 1.2],
    getStatusColor: (value, range) => getVPDStatusColor(value, range),
  },
  co2: {
    label: "CO2",
    icon: Wind,
    unit: "ppm",
    decimals: 0,
    defaultOptimalRange: [800, 1200],
    getStatusColor: (value, range) => getCO2StatusColor(value, range),
  },
  light: {
    label: "Light",
    icon: Activity, // Could use Sun icon
    unit: "lux",
    decimals: 0,
    defaultOptimalRange: [20000, 60000],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  ph: {
    label: "pH",
    icon: Droplet,
    unit: "",
    decimals: 1,
    defaultOptimalRange: [5.8, 6.5],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  ec: {
    label: "EC",
    icon: Activity,
    unit: "mS/cm",
    decimals: 2,
    defaultOptimalRange: [1.2, 2.4],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  soil_moisture: {
    label: "Soil Moisture",
    icon: Droplet,
    unit: "%",
    decimals: 1,
    defaultOptimalRange: [40, 60],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  pressure: {
    label: "Pressure",
    icon: Activity,
    unit: "hPa",
    decimals: 1,
    defaultOptimalRange: [1000, 1030],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  water_level: {
    label: "Water Level",
    icon: Droplet,
    unit: "%",
    decimals: 0,
    defaultOptimalRange: [20, 80],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  wind_speed: {
    label: "Wind Speed",
    icon: Wind,
    unit: "mph",
    decimals: 1,
    defaultOptimalRange: [0, 15],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  pm25: {
    label: "PM2.5",
    icon: Wind,
    unit: "µg/m³",
    decimals: 0,
    defaultOptimalRange: [0, 35],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  uv: {
    label: "UV Index",
    icon: Activity,
    unit: "",
    decimals: 1,
    defaultOptimalRange: [0, 6],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  solar_radiation: {
    label: "Solar Radiation",
    icon: Activity,
    unit: "W/m²",
    decimals: 0,
    defaultOptimalRange: [0, 1000],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
  rain: {
    label: "Rainfall",
    icon: Droplet,
    unit: "mm",
    decimals: 1,
    defaultOptimalRange: [0, 10],
    getStatusColor: (value, range) =>
      getStatusColor({ value, optimalMin: range[0], optimalMax: range[1] }),
  },
};

// Size-based styling
const SIZE_STYLES = {
  sm: {
    container: "p-2 gap-1.5",
    icon: "w-3.5 h-3.5",
    iconContainer: "w-6 h-6",
    value: "text-lg",
    unit: "text-xs",
    label: "text-xs",
    sparklineHeight: 20,
  },
  md: {
    container: "p-3 gap-2",
    icon: "w-4 h-4",
    iconContainer: "w-8 h-8",
    value: "text-xl",
    unit: "text-sm",
    label: "text-sm",
    sparklineHeight: 28,
  },
  lg: {
    container: "p-4 gap-3",
    icon: "w-5 h-5",
    iconContainer: "w-10 h-10",
    value: "text-2xl",
    unit: "text-base",
    label: "text-base",
    sparklineHeight: 36,
  },
};

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for the metric card.
 */
function MetricCardSkeleton({
  size = "md",
  className,
}: {
  size?: SensorMetricCardProps["size"];
  className?: string;
}) {
  const styles = SIZE_STYLES[size || "md"];

  return (
    <div className={cn("rounded-lg border bg-card", styles.container, className)}>
      <div className="flex items-center gap-2">
        <Skeleton className={cn("rounded-lg", styles.iconContainer)} />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-baseline gap-1">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-4 w-6" />
      </div>
      <Skeleton className="h-6 w-full" />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SensorMetricCard - Compact sensor reading display with status and trend.
 *
 * Displays a single sensor metric with:
 * - Status-colored icon based on optimal range
 * - Current value with unit
 * - Optional mini sparkline showing trend
 * - Tooltip with detailed status information
 *
 * Features:
 * - Automatic status color calculation
 * - Multiple size variants (sm, md, lg)
 * - Sparkline with trend indicator
 * - Stale data indication
 * - Click interaction support
 * - Full dark mode support
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SensorMetricCard
 *   sensorType="temperature"
 *   value={78.5}
 *   optimalRange={[70, 82]}
 * />
 *
 * // With sparkline and trend
 * <SensorMetricCard
 *   sensorType="vpd"
 *   value={1.05}
 *   historicalData={vpdTimeSeries}
 *   showSparkline
 *   showTrend
 *   optimalRange={[0.8, 1.2]}
 *   size="lg"
 * />
 * ```
 */
export function SensorMetricCard({
  sensorType,
  value,
  unit,
  label,
  historicalData,
  optimalRange,
  showSparkline = false,
  showTrend = false,
  size = "md",
  isLoading = false,
  isStale = false,
  onClick,
  className,
}: SensorMetricCardProps) {
  const config = SENSOR_CONFIGS[sensorType];
  const styles = SIZE_STYLES[size];
  const Icon = config.icon;

  // Calculate status color
  const statusResult = useMemo(() => {
    if (value === null || value === undefined) return null;
    const range = optimalRange || config.defaultOptimalRange;
    return config.getStatusColor(value, range);
  }, [value, optimalRange, config]);

  // Format value for display
  const formattedValue = useMemo(() => {
    if (value === null || value === undefined) return "--";
    return value.toFixed(config.decimals);
  }, [value, config.decimals]);

  // Determine effective unit
  const effectiveUnit = unit || config.unit;
  const effectiveLabel = label || config.label;

  if (isLoading) {
    return <MetricCardSkeleton size={size} className={className} />;
  }

  const isClickable = !!onClick;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "rounded-lg border transition-all bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700",
              isClickable && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600",
              isStale && "opacity-60",
              styles.container,
              className
            )}
            onClick={onClick}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onClick?.();
                    }
                  }
                : undefined
            }
          >
            {/* Header: Icon + Label */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg transition-colors",
                  styles.iconContainer,
                  statusResult
                    ? `${statusResult.bgClass}/20`
                    : "bg-gray-100 dark:bg-gray-700"
                )}
              >
                <Icon
                  className={cn(
                    styles.icon,
                    statusResult?.textClass || "text-muted-foreground"
                  )}
                />
              </div>
              <span
                className={cn(
                  "font-medium text-gray-600 dark:text-gray-300",
                  styles.label
                )}
              >
                {effectiveLabel}
              </span>
              {isStale && (
                <span className="ml-auto text-xs text-amber-500">Stale</span>
              )}
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "font-bold tabular-nums",
                  styles.value,
                  statusResult?.textClass || "text-gray-900 dark:text-white"
                )}
              >
                {formattedValue}
              </span>
              {effectiveUnit && (
                <span
                  className={cn(
                    "text-gray-500 dark:text-gray-400",
                    styles.unit
                  )}
                >
                  {effectiveUnit}
                </span>
              )}
            </div>

            {/* Sparkline (optional) */}
            {showSparkline && historicalData && historicalData.length > 0 && (
              <div className="mt-1">
                <MiniSparkline
                  data={historicalData}
                  height={styles.sparklineHeight}
                  color={statusResult?.hexColor}
                  optimalRange={optimalRange || config.defaultOptimalRange}
                  showTrend={showTrend}
                  variant="area"
                />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            {/* Current Value */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{effectiveLabel}</span>
              <span className="font-semibold">
                {formattedValue} {effectiveUnit}
              </span>
            </div>

            {/* Status */}
            {statusResult && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <span
                  className={cn("font-medium capitalize", statusResult.textClass)}
                >
                  {statusResult.status}
                </span>
              </div>
            )}

            {/* Optimal Range */}
            {(optimalRange || config.defaultOptimalRange) && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Optimal Range</span>
                <span>
                  {(optimalRange || config.defaultOptimalRange)[0]}
                  {" - "}
                  {(optimalRange || config.defaultOptimalRange)[1]}{" "}
                  {effectiveUnit}
                </span>
              </div>
            )}

            {/* Deviation */}
            {statusResult && statusResult.deviationDirection !== "none" && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Deviation</span>
                <span className={statusResult.textClass}>
                  {statusResult.deviationDirection === "high" ? "+" : "-"}
                  {statusResult.deviation.toFixed(config.decimals)} {effectiveUnit}
                </span>
              </div>
            )}

            {/* Stale Warning */}
            {isStale && (
              <p className="text-xs text-amber-500 pt-1 border-t border-border">
                Data is older than 5 minutes
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Export skeleton for external use.
 */
export { MetricCardSkeleton as SensorMetricCardSkeleton };
