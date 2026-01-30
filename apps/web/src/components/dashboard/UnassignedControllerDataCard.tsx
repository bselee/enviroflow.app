"use client";

import { useState } from "react";
import { Thermometer, Droplets, Wind, Wifi, WifiOff, Clock, TrendingUp, TrendingDown, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnassignedControllerSummary } from "@/hooks/use-dashboard-data";

// =============================================================================
// Types
// =============================================================================

interface UnassignedControllerDataCardProps {
  /** Summary data for the unassigned controller */
  summary: UnassignedControllerSummary;
  /** Callback when data is refreshed */
  onRefresh?: () => void;
  /** Optional CSS class name */
  className?: string;
}

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Displays a single metric with optional trend indicator.
 */
function MetricDisplay({
  label,
  value,
  unit,
  trend,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: number | null;
  unit: string;
  trend?: { delta: number; period: string };
  icon: React.ElementType;
  iconColor: string;
}): JSX.Element {
  const hasValue = value !== null;
  const trendUp = trend && trend.delta > 0;
  const trendDown = trend && trend.delta < 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div className={cn("p-2 rounded-lg", iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold">
            {hasValue ? value.toFixed(1) : "--"}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
          {trend && (
            <span
              className={cn(
                "flex items-center text-xs ml-2",
                trendUp && "text-red-500",
                trendDown && "text-blue-500",
                !trendUp && !trendDown && "text-muted-foreground"
              )}
            >
              {trendUp && <TrendingUp className="h-3 w-3 mr-0.5" />}
              {trendDown && <TrendingDown className="h-3 w-3 mr-0.5" />}
              {trend.delta > 0 ? "+" : ""}
              {trend.delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

/**
 * UnassignedControllerDataCard Component
 *
 * Displays sensor data for controllers that are not assigned to any room.
 * Shows temperature, humidity, VPD readings with trend indicators.
 *
 * @example
 * ```tsx
 * <UnassignedControllerDataCard
 *   summary={unassignedControllerSummary}
 * />
 * ```
 */
export function UnassignedControllerDataCard({
  summary,
  onRefresh,
  className,
}: UnassignedControllerDataCardProps): JSX.Element {
  const { controller, isOnline, latestSensorData, trends, hasStaleData, lastUpdateTimestamp } = summary;
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const StatusIcon = isOnline ? Wifi : WifiOff;

  // Format last update time
  const lastUpdateText = lastUpdateTimestamp
    ? new Date(lastUpdateTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "No data";

  const hasSensorData = latestSensorData.temperature !== null ||
                        latestSensorData.humidity !== null ||
                        latestSensorData.vpd !== null;

  // Manual refresh - polls the controller for new data
  const handleRefresh = async () => {
    if (isPolling) return;

    setIsPolling(true);
    setPollError(null);

    try {
      const response = await fetch(`/api/controllers/${controller.id}/sensors`);
      const data = await response.json();

      if (!response.ok) {
        setPollError(data.error || "Failed to fetch sensors");
      } else {
        // Trigger parent refresh to get updated data
        onRefresh?.();
      }
    } catch {
      setPollError("Network error");
    } finally {
      setIsPolling(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-5 transition-all hover:shadow-md",
        hasStaleData && hasSensorData && "border-amber-200 dark:border-amber-900",
        !hasStaleData && hasSensorData && "border-border",
        !hasSensorData && "border-dashed border-muted-foreground/30",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{controller.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {controller.brand.toUpperCase()} {controller.model && `• ${controller.model}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              "h-4 w-4",
              isOnline ? "text-green-500" : "text-gray-400"
            )}
          />
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              isOnline
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Sensor Data */}
      {hasSensorData ? (
        <div className="space-y-2">
          <MetricDisplay
            label="Temperature"
            value={latestSensorData.temperature}
            unit="°F"
            trend={trends.temperature}
            icon={Thermometer}
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          />
          <MetricDisplay
            label="Humidity"
            value={latestSensorData.humidity}
            unit="%"
            trend={trends.humidity}
            icon={Droplets}
            iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <MetricDisplay
            label="VPD"
            value={latestSensorData.vpd}
            unit="kPa"
            trend={trends.vpd}
            icon={Wind}
            iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">No sensor data available</p>
          {pollError && (
            <p className="text-xs text-red-500 mt-1">{pollError}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleRefresh}
            disabled={isPolling}
          >
            {isPolling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Fetch Data
              </>
            )}
          </Button>
        </div>
      )}

      {/* Footer */}
      {hasSensorData && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Updated {lastUpdateText}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasStaleData && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Stale
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={handleRefresh}
              disabled={isPolling}
            >
              {isPolling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton loader for UnassignedControllerDataCard
 */
export function UnassignedControllerDataCardSkeleton(): JSX.Element {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-muted/50 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
