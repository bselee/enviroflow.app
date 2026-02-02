"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { format, parseISO, isValid, subHours } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Thermometer, Droplet, Activity, TrendingUp, TrendingDown, Power } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LiveSensor, LivePort } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Time series data point for the chart.
 */
export interface TimeSeriesData {
  timestamp: string;
  vpd?: number;
  temperature?: number;
  humidity?: number;
  controllerId?: string;
}

/**
 * Port activation event for the timeline.
 */
export interface PortActivationEvent {
  timestamp: string;
  portId: number;
  portName: string;
  controllerId: string;
  controllerName: string;
  isOn: boolean;
  speed?: number;
}

/**
 * Automation event marker.
 */
export interface AutomationEvent {
  timestamp: string;
  name: string;
  action: string;
}

/**
 * Controller info for selector.
 */
export interface ControllerOption {
  id: string;
  name: string;
}

/**
 * Extended time range options - supports 1h to 60 days.
 */
export type TimeRange = "1h" | "6h" | "24h" | "1d" | "7d" | "30d" | "60d";

export type FocusMetric = "vpd" | "temperature" | "humidity";
export type OptimalRange = [number, number];

export interface OptimalRanges {
  vpd?: OptimalRange;
  temperature?: OptimalRange;
  humidity?: OptimalRange;
}

export interface IntelligentTimelineProps {
  data: TimeSeriesData[];
  automationEvents?: AutomationEvent[];
  portActivations?: PortActivationEvent[];
  controllers?: ControllerOption[];
  liveSensors?: LiveSensor[];
  selectedControllerId?: string;
  onControllerChange?: (controllerId: string | null) => void;
  focusMetric?: FocusMetric;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  onPointTap?: (data: TimeSeriesData) => void;
  optimalRanges?: OptimalRanges;
  isLoading?: boolean;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CHART_HEIGHT = 200;
const ANIMATION_DURATION = 600;

const DEFAULT_OPTIMAL_RANGES: OptimalRanges = {
  vpd: [0.8, 1.2],
  temperature: [70, 85],
  humidity: [50, 70],
};

const METRIC_COLORS: Record<FocusMetric, { stroke: string; fill: string; label: string; bgColor: string }> = {
  temperature: {
    stroke: "#ef4444",
    fill: "#ef4444",
    label: "Temperature",
    bgColor: "bg-red-500/10",
  },
  humidity: {
    stroke: "#3b82f6",
    fill: "#3b82f6",
    label: "Humidity",
    bgColor: "bg-blue-500/10",
  },
  vpd: {
    stroke: "#22c55e",
    fill: "#22c55e",
    label: "VPD",
    bgColor: "bg-green-500/10",
  },
};

/** Extended time range labels */
const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1h": "1H",
  "6h": "6H",
  "24h": "24H",
  "1d": "1D",
  "7d": "7D",
  "30d": "30D",
  "60d": "60D",
};

// =============================================================================
// Helper Functions
// =============================================================================

function getTimeRangeHours(range: TimeRange): number {
  const hoursMap: Record<TimeRange, number> = {
    "1h": 1,
    "6h": 6,
    "24h": 24,
    "1d": 24,
    "7d": 24 * 7,
    "30d": 24 * 30,
    "60d": 24 * 60,
  };
  return hoursMap[range];
}

function filterDataByTimeRange(data: TimeSeriesData[], range: TimeRange): TimeSeriesData[] {
  const now = new Date();
  const hours = getTimeRangeHours(range);
  const cutoff = subHours(now, hours);

  return data.filter((point) => {
    const timestamp = parseISO(point.timestamp);
    return isValid(timestamp) && timestamp >= cutoff;
  });
}

function formatTimeLabel(timestamp: string, range: TimeRange): string {
  const date = parseISO(timestamp);
  if (!isValid(date)) return "";

  // Format based on range duration
  if (range === "60d" || range === "30d") {
    return format(date, "MMM d");
  }
  if (range === "7d") {
    return format(date, "EEE");
  }
  if (range === "24h" || range === "1d") {
    return format(date, "ha");
  }
  return format(date, "h:mm");
}

interface MetricStats {
  current: number | null;
  min: number | null;
  max: number | null;
}

function calculateMetricStats(data: TimeSeriesData[], metric: FocusMetric): MetricStats {
  const values = data
    .map((d) => d[metric])
    .filter((v): v is number => v != null);

  if (values.length === 0) {
    return { current: null, min: null, max: null };
  }

  return {
    current: values[values.length - 1],
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

// =============================================================================
// Sub-Components
// =============================================================================

interface StatCardProps {
  metric: FocusMetric;
  stats: MetricStats;
  unit: string;
  decimals?: number;
}

function StatCard({ metric, stats, unit, decimals = 1 }: StatCardProps): JSX.Element {
  const config = METRIC_COLORS[metric];
  const formatValue = (val: number | null): string => {
    if (val === null) return "—";
    return val.toFixed(decimals);
  };

  return (
    <div className={cn("flex items-center gap-3 rounded-lg px-4 py-3", config.bgColor)}>
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full"
        style={{ backgroundColor: `${config.stroke}20` }}
      >
        {metric === "temperature" && <Thermometer className="w-5 h-5" style={{ color: config.stroke }} />}
        {metric === "humidity" && <Droplet className="w-5 h-5" style={{ color: config.stroke }} />}
        {metric === "vpd" && <Activity className="w-5 h-5" style={{ color: config.stroke }} />}
      </div>

      <div className="flex-1">
        <div className="text-xl font-bold" style={{ color: config.stroke }}>
          {formatValue(stats.current)}{unit}
        </div>
        <div className="text-xs text-muted-foreground">{config.label}</div>
      </div>

      {stats.min !== null && stats.max !== null && (
        <div className="flex flex-col gap-0.5 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="w-3 h-3 text-red-400" />
            <span>{formatValue(stats.max)}{unit}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingDown className="w-3 h-3 text-blue-400" />
            <span>{formatValue(stats.min)}{unit}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-[200px] w-full" />
      <Skeleton className="h-[80px] w-full" />
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center bg-gradient-to-b from-muted/10 to-muted/30 rounded-lg border border-dashed border-border"
      style={{ height: CHART_HEIGHT }}
    >
      <div className="relative">
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-primary/20 opacity-75" />
        </span>
        <Activity className="w-8 h-8 text-muted-foreground mb-2 relative" />
      </div>
      <p className="text-sm font-medium text-foreground/80 mt-4">Waiting for sensor data</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Your timeline will populate as sensors report readings
      </p>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }

  const formattedTime = label ? format(parseISO(label), "MMM d, h:mm a") : "";
  const tempPayload = payload.find(p => p.dataKey === "temperature");
  const humPayload = payload.find(p => p.dataKey === "humidity");
  const vpdPayload = payload.find(p => p.dataKey === "vpd");

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-xs text-muted-foreground mb-2 font-medium border-b border-border pb-2">
        {formattedTime}
      </p>
      <div className="space-y-2">
        {tempPayload && tempPayload.value != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs">
              <Thermometer className="w-3 h-3" style={{ color: METRIC_COLORS.temperature.stroke }} />
              <span style={{ color: METRIC_COLORS.temperature.stroke }}>Temperature</span>
            </span>
            <span className="text-sm font-bold" style={{ color: METRIC_COLORS.temperature.stroke }}>
              {tempPayload.value.toFixed(1)}°C
            </span>
          </div>
        )}
        {humPayload && humPayload.value != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs">
              <Droplet className="w-3 h-3" style={{ color: METRIC_COLORS.humidity.stroke }} />
              <span style={{ color: METRIC_COLORS.humidity.stroke }}>Humidity</span>
            </span>
            <span className="text-sm font-bold" style={{ color: METRIC_COLORS.humidity.stroke }}>
              {humPayload.value.toFixed(1)}%
            </span>
          </div>
        )}
        {vpdPayload && vpdPayload.value != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs">
              <Activity className="w-3 h-3" style={{ color: METRIC_COLORS.vpd.stroke }} />
              <span style={{ color: METRIC_COLORS.vpd.stroke }}>VPD</span>
            </span>
            <span className="text-sm font-bold" style={{ color: METRIC_COLORS.vpd.stroke }}>
              {vpdPayload.value.toFixed(2)} kPa
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Port Timeline Component
// =============================================================================

interface PortTimelineProps {
  ports: LivePort[];
  controllerName?: string;
}

function PortTimeline({ ports, controllerName }: PortTimelineProps): JSX.Element {
  if (ports.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-4">
        No ports configured
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          Port Status {controllerName && <span className="text-foreground">• {controllerName}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ports.map((port) => (
          <div
            key={port.portId}
            className={cn(
              "flex items-center gap-2 rounded-md border p-2 text-xs transition-colors",
              port.isOn
                ? "border-green-500/50 bg-green-500/10"
                : "border-border bg-card/50"
            )}
          >
            <Power
              className={cn(
                "w-3.5 h-3.5",
                port.isOn ? "text-green-500" : "text-muted-foreground/50"
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{port.name}</div>
              <div className="text-muted-foreground">
                {port.isOn ? `Speed: ${port.speed}%` : "Off"}
              </div>
            </div>
            {port.isOn && (
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function IntelligentTimeline({
  data,
  automationEvents = [],
  portActivations = [],
  controllers = [],
  liveSensors = [],
  selectedControllerId,
  onControllerChange,
  focusMetric = "vpd",
  timeRange: controlledTimeRange,
  onTimeRangeChange,
  onPointTap,
  optimalRanges = DEFAULT_OPTIMAL_RANGES,
  isLoading = false,
  className,
}: IntelligentTimelineProps): JSX.Element {
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>("24h");
  const [internalControllerId, setInternalControllerId] = useState<string | null>(null);

  const timeRange = controlledTimeRange ?? internalTimeRange;
  const controllerId = selectedControllerId ?? internalControllerId;

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

  const handleControllerChange = useCallback(
    (value: string): void => {
      const newValue = value === "all" ? null : value;
      if (onControllerChange) {
        onControllerChange(newValue);
      } else {
        setInternalControllerId(newValue);
      }
    },
    [onControllerChange]
  );

  // Build controller options from liveSensors if not provided
  const controllerOptions = useMemo((): ControllerOption[] => {
    if (controllers.length > 0) return controllers;
    return liveSensors.map(s => ({ id: s.id, name: s.name }));
  }, [controllers, liveSensors]);

  // Get the selected controller's live data
  const selectedSensor = useMemo(() => {
    if (!controllerId) return null;
    return liveSensors.find(s => s.id === controllerId) ?? null;
  }, [liveSensors, controllerId]);

  // Filter data by controller if selected
  const controllerFilteredData = useMemo(() => {
    if (!controllerId) return data;
    return data.filter(d => d.controllerId === controllerId);
  }, [data, controllerId]);

  // Filter by time range
  const filteredData = useMemo(
    () => filterDataByTimeRange(controllerFilteredData, timeRange),
    [controllerFilteredData, timeRange]
  );

  // Sort by timestamp
  const sortedData = useMemo(
    () =>
      [...filteredData].sort(
        (a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime()
      ),
    [filteredData]
  );

  // Filter automation events
  const filteredEvents = useMemo(() => {
    const hours = getTimeRangeHours(timeRange);
    const cutoff = subHours(new Date(), hours);
    return automationEvents.filter((event) => {
      const timestamp = parseISO(event.timestamp);
      return isValid(timestamp) && timestamp >= cutoff;
    });
  }, [automationEvents, timeRange]);

  // Calculate stats
  const tempStats = useMemo(() => calculateMetricStats(sortedData, "temperature"), [sortedData]);
  const humStats = useMemo(() => calculateMetricStats(sortedData, "humidity"), [sortedData]);
  const vpdStats = useMemo(() => calculateMetricStats(sortedData, "vpd"), [sortedData]);

  // Get ports for selected controller
  const selectedPorts = useMemo((): LivePort[] => {
    if (selectedSensor?.ports) return selectedSensor.ports;
    // If no specific controller, aggregate all ports from first controller
    if (!controllerId && liveSensors.length > 0 && liveSensors[0].ports) {
      return liveSensors[0].ports;
    }
    return [];
  }, [selectedSensor, controllerId, liveSensors]);

  // Get controller name for port timeline
  const selectedControllerName = useMemo(() => {
    if (selectedSensor) return selectedSensor.name;
    if (!controllerId && liveSensors.length > 0) return liveSensors[0].name;
    return undefined;
  }, [selectedSensor, controllerId, liveSensors]);

  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <TimelineSkeleton />
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Header: Controller Selector + Time Range */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Controller Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Controller:</span>
          <Select
            value={controllerId ?? "all"}
            onValueChange={handleControllerChange}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="All Controllers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Controllers</SelectItem>
              {controllerOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time Range Selector - Extended */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={cn(
                "px-2 py-1 text-xs font-medium rounded-md transition-colors",
                timeRange === range
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {TIME_RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard metric="temperature" stats={tempStats} unit="°C" decimals={2} />
        <StatCard metric="humidity" stats={humStats} unit="%" decimals={2} />
        <StatCard metric="vpd" stats={vpdStats} unit=" kPa" decimals={2} />
      </div>

      {/* Empty state or Chart */}
      {sortedData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Main Chart */}
          <div
            className="w-full relative bg-card/30 rounded-lg p-2"
            style={{ height: CHART_HEIGHT }}
            role="img"
            aria-label={`Sensor data chart for the last ${TIME_RANGE_LABELS[timeRange]}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sortedData}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value: string) => formatTimeLabel(value, timeRange)}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={60}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  tickFormatter={(value: number) => Math.round(value).toString()}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 2]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  tickFormatter={(value: number) => value.toFixed(1)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke={METRIC_COLORS.temperature.stroke}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: METRIC_COLORS.temperature.stroke }}
                  connectNulls={true}
                  isAnimationActive={true}
                  animationDuration={ANIMATION_DURATION}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="humidity"
                  stroke={METRIC_COLORS.humidity.stroke}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: METRIC_COLORS.humidity.stroke }}
                  connectNulls={true}
                  isAnimationActive={true}
                  animationDuration={ANIMATION_DURATION}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="vpd"
                  stroke={METRIC_COLORS.vpd.stroke}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: METRIC_COLORS.vpd.stroke }}
                  connectNulls={true}
                  isAnimationActive={true}
                  animationDuration={ANIMATION_DURATION}
                />
                {filteredEvents.map((event) => (
                  <ReferenceLine
                    key={`event-${event.timestamp}-${event.name}`}
                    x={event.timestamp}
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    yAxisId="left"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: METRIC_COLORS.temperature.stroke }} />
              <span>Temperature</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: METRIC_COLORS.humidity.stroke }} />
              <span>Humidity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: METRIC_COLORS.vpd.stroke }} />
              <span>VPD</span>
            </div>
            {sortedData.length > 1 && (
              <span className="text-muted-foreground/50">
                ({sortedData.length} readings)
              </span>
            )}
          </div>
        </>
      )}

      {/* Port Timeline */}
      {selectedPorts.length > 0 && (
        <div className="border-t border-border pt-4">
          <PortTimeline
            ports={selectedPorts}
            controllerName={selectedControllerName}
          />
        </div>
      )}
    </div>
  );
}

export default IntelligentTimeline;
