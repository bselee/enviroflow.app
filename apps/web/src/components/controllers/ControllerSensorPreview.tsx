"use client";

/**
 * ControllerSensorPreview Component
 *
 * Displays a compact preview of sensor data for a controller including:
 * - Current temperature, humidity, and VPD values
 * - A mini sparkline chart showing 24-hour trends
 * - Built-in sensor indicator
 *
 * Inspired by AC Infinity's elegant data visualization.
 */

import { useMemo } from "react";
import { Thermometer, Droplets, Gauge, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSensorReadings } from "@/hooks/use-sensor-readings";
import type { AggregatedSensorData, TimeSeriesPoint } from "@/types";

interface ControllerSensorPreviewProps {
  controllerId: string;
  className?: string;
  compact?: boolean;
}

/**
 * Mini sparkline chart component for showing 24-hour trends
 */
function MiniSparkline({
  data,
  color = "currentColor",
  height = 24,
  width = 80,
}: {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-xs"
        style={{ width, height }}
      >
        <Activity className="w-3 h-3 opacity-50" />
      </div>
    );
  }

  // Extract values and compute bounds
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Build SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / range) * height * 0.8 - height * 0.1;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
}

/**
 * Single sensor value display with trend indicator
 */
function SensorValue({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  color,
  isBuiltIn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  unit: string;
  trend?: "up" | "down" | "stable";
  color: string;
  isBuiltIn?: boolean;
}) {
  if (value === null) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5 opacity-50" />
        <span className="text-xs">--</span>
      </div>
    );
  }

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("w-3.5 h-3.5", color)} />
      <span className="text-sm font-medium tabular-nums">
        {value.toFixed(1)}
        <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </span>
      {trend && (
        <TrendIcon className={cn(
          "w-3 h-3",
          trend === "up" ? "text-orange-500" : trend === "down" ? "text-blue-500" : "text-muted-foreground"
        )} />
      )}
      {isBuiltIn && (
        <span className="text-[10px] bg-primary/10 text-primary px-1 py-0.5 rounded">
          Built-in
        </span>
      )}
    </div>
  );
}

/**
 * Calculate trend direction based on recent data
 */
function calculateTrend(data: TimeSeriesPoint[]): "up" | "down" | "stable" {
  if (data.length < 4) return "stable";

  // Compare average of last 4 readings vs previous 4
  const recent = data.slice(-4);
  const previous = data.slice(-8, -4);

  if (previous.length < 2) return "stable";

  const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
  const previousAvg = previous.reduce((sum, d) => sum + d.value, 0) / previous.length;

  const diff = recentAvg - previousAvg;
  const threshold = Math.abs(previousAvg) * 0.02; // 2% change threshold

  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "stable";
}

export function ControllerSensorPreview({
  controllerId,
  className,
  compact = false
}: ControllerSensorPreviewProps) {
  // Fetch sensor readings for this controller
  const { readings, isLoading, getLatestForController, getTimeSeries, connectionStatus } = useSensorReadings({
    controllerIds: [controllerId],
    timeRangeHours: 24,
    limit: 200,
  });

  // Get latest aggregated data
  const latestData = useMemo((): AggregatedSensorData => {
    return getLatestForController(controllerId);
  }, [getLatestForController, controllerId]);

  // Get time series for sparklines
  const tempSeries = useMemo(() => getTimeSeries(controllerId, "temperature"), [getTimeSeries, controllerId]);
  const humiditySeries = useMemo(() => getTimeSeries(controllerId, "humidity"), [getTimeSeries, controllerId]);
  const vpdSeries = useMemo(() => getTimeSeries(controllerId, "vpd"), [getTimeSeries, controllerId]);

  // Calculate trends
  const tempTrend = useMemo(() => calculateTrend(tempSeries), [tempSeries]);
  const humidityTrend = useMemo(() => calculateTrend(humiditySeries), [humiditySeries]);
  const vpdTrend = useMemo(() => calculateTrend(vpdSeries), [vpdSeries]);

  // Check if we have any data
  const hasData = latestData.temperature || latestData.humidity || latestData.vpd;

  if (isLoading) {
    return (
      <div className={cn("animate-pulse bg-muted rounded-md h-16", className)} />
    );
  }

  if (!hasData) {
    return (
      <div className={cn(
        "flex items-center justify-center text-muted-foreground text-xs py-3 border rounded-md border-dashed",
        className
      )}>
        <Activity className="w-3.5 h-3.5 mr-1.5 opacity-50" />
        No sensor data yet
      </div>
    );
  }

  if (compact) {
    // Compact inline view
    return (
      <div className={cn("flex items-center gap-4 text-sm", className)}>
        {latestData.temperature && (
          <SensorValue
            icon={Thermometer}
            label="Temp"
            value={latestData.temperature.value}
            unit={latestData.temperature.unit}
            trend={tempTrend}
            color="text-red-500"
          />
        )}
        {latestData.humidity && (
          <SensorValue
            icon={Droplets}
            label="Humidity"
            value={latestData.humidity.value}
            unit={latestData.humidity.unit}
            trend={humidityTrend}
            color="text-blue-500"
          />
        )}
        {latestData.vpd && (
          <SensorValue
            icon={Gauge}
            label="VPD"
            value={latestData.vpd.value}
            unit={latestData.vpd.unit}
            trend={vpdTrend}
            color="text-green-500"
          />
        )}
      </div>
    );
  }

  // Full view with sparklines
  return (
    <div className={cn("space-y-3", className)}>
      {/* Live sensor values with trends */}
      <div className="grid grid-cols-3 gap-3">
        {/* Temperature */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Thermometer className="w-3 h-3 text-red-500" />
            <span>Temperature</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {latestData.temperature?.value?.toFixed(1) ?? "--"}
            </span>
            <span className="text-xs text-muted-foreground">
              {latestData.temperature?.unit ?? "°F"}
            </span>
            {tempTrend !== "stable" && (
              tempTrend === "up"
                ? <TrendingUp className="w-3 h-3 text-orange-500" />
                : <TrendingDown className="w-3 h-3 text-blue-500" />
            )}
          </div>
          <MiniSparkline data={tempSeries} color="rgb(239, 68, 68)" height={20} width={70} />
        </div>

        {/* Humidity */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Droplets className="w-3 h-3 text-blue-500" />
            <span>Humidity</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {latestData.humidity?.value?.toFixed(1) ?? "--"}
            </span>
            <span className="text-xs text-muted-foreground">
              {latestData.humidity?.unit ?? "%"}
            </span>
            {humidityTrend !== "stable" && (
              humidityTrend === "up"
                ? <TrendingUp className="w-3 h-3 text-orange-500" />
                : <TrendingDown className="w-3 h-3 text-blue-500" />
            )}
          </div>
          <MiniSparkline data={humiditySeries} color="rgb(59, 130, 246)" height={20} width={70} />
        </div>

        {/* VPD */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Gauge className="w-3 h-3 text-green-500" />
            <span>VPD</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {latestData.vpd?.value?.toFixed(2) ?? "--"}
            </span>
            <span className="text-xs text-muted-foreground">
              {latestData.vpd?.unit ?? "kPa"}
            </span>
            {vpdTrend !== "stable" && (
              vpdTrend === "up"
                ? <TrendingUp className="w-3 h-3 text-orange-500" />
                : <TrendingDown className="w-3 h-3 text-blue-500" />
            )}
          </div>
          <MiniSparkline data={vpdSeries} color="rgb(34, 197, 94)" height={20} width={70} />
        </div>
      </div>

      {/* Connection status indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            connectionStatus === "connected" ? "bg-green-500" :
            connectionStatus === "polling" ? "bg-yellow-500" :
            connectionStatus === "reconnecting" ? "bg-yellow-500 animate-pulse" :
            "bg-red-500"
          )} />
          <span className="capitalize">{connectionStatus}</span>
        </div>
        <span>24h trend</span>
      </div>
    </div>
  );
}
