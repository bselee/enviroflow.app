"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { format, parseISO, isValid, subHours } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Thermometer, Droplet, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { convertTemperatureFromCelsius } from "@/lib/temperature-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LiveSensor, LivePort } from "@/types";
import { DeviceWaveformChart } from "@/components/charts/DeviceWaveformChart";
import { EnviroSensorChart } from "@/components/charts/EnviroSensorChart";
import type { VisibleMetrics } from "@/components/charts/EnviroSensorChart";
import { ChevronDown, ChevronUp } from "lucide-react";

// =============================================================================
// Type Definitions
// =============================================================================

export interface TimeSeriesData {
  timestamp: string;
  vpd?: number;
  temperature?: number;
  humidity?: number;
  controllerId?: string;
}

export interface PortActivationEvent {
  timestamp: string;
  portId: number;
  portName: string;
  controllerId: string;
  controllerName: string;
  isOn: boolean;
  speed?: number;
}

export interface AutomationEvent {
  timestamp: string;
  name: string;
  action: string;
}

export interface ControllerOption {
  id: string;
  name: string;
}

export type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "60d";

export type FocusMetric = "vpd" | "temperature" | "humidity";
export type OptimalRange = [number, number];

export interface OptimalRanges {
  vpd?: OptimalRange;
  temperature?: OptimalRange;
  humidity?: OptimalRange;
}

/** Device state data for waveform chart */
export interface DeviceStateData {
  [deviceName: string]: Array<{
    timestamp: string;
    state: boolean;
    speed: number;
  }>;
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
  /** Device state data for activity waveform chart */
  deviceStateData?: DeviceStateData;
  /** Whether to show device activity section (default: true when deviceStateData provided) */
  showDeviceActivity?: boolean;
  /** Callback when toggling device activity visibility */
  onToggleDeviceActivity?: () => void;
  /** Loading state for sensor data (shows loading indicator in chart) */
  isSensorDataLoading?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const CHART_HEIGHT = 300;

const DEFAULT_OPTIMAL_RANGES: OptimalRanges = {
  vpd: [0.8, 1.2],
  temperature: [70, 85],
  humidity: [50, 70],
};

const METRIC_COLORS: Record<FocusMetric, { stroke: string; gradientId: string; label: string; bgColor: string }> = {
  temperature: {
    stroke: "#ef4444",
    gradientId: "gradTemp",
    label: "Temperature",
    bgColor: "bg-red-500/10",
  },
  humidity: {
    stroke: "#4fc3f7",
    gradientId: "gradHum",
    label: "Humidity",
    bgColor: "bg-sky-400/10",
  },
  vpd: {
    stroke: "#b388ff",
    gradientId: "gradVpd",
    label: "VPD",
    bgColor: "bg-purple-500/10",
  },
};

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1h": "1H",
  "6h": "6H",
  "24h": "24H",
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

interface MetricStats {
  current: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
}

function calculateMetricStats(data: TimeSeriesData[], metric: FocusMetric): MetricStats {
  const values = data
    .map((d) => d[metric])
    .filter((v): v is number => v != null);

  if (values.length === 0) {
    return { current: null, min: null, max: null, avg: null };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    current: values[values.length - 1],
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
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
  transformValue?: (val: number) => number;
}

function StatCard({ metric, stats, unit, decimals = 1, transformValue }: StatCardProps): JSX.Element {
  const config = METRIC_COLORS[metric];
  const formatValue = (val: number | null): string => {
    if (val === null) return "—";
    const transformed = transformValue ? transformValue(val) : val;
    return transformed.toFixed(decimals);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40 bg-card/80 p-4">
      {/* Gradient accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${config.stroke}, transparent)` }}
      />

      <div className="flex justify-between items-start">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">
            {config.label}
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: config.stroke }}>
            {formatValue(stats.current)}<span className="text-base ml-0.5">{unit}</span>
          </div>
        </div>
        {stats.min !== null && stats.max !== null && (
          <div className="text-right space-y-0.5 mt-1">
            <div className="flex items-center gap-1 text-muted-foreground font-mono text-xs">
              <TrendingUp className="w-3 h-3 text-red-400" />
              <span>{formatValue(stats.max)}{unit}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground font-mono text-xs">
              <TrendingDown className="w-3 h-3 text-blue-400" />
              <span>{formatValue(stats.min)}{unit}</span>
            </div>
          </div>
        )}
      </div>
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
  deviceStateData,
  showDeviceActivity: controlledShowDeviceActivity,
  onToggleDeviceActivity,
  isSensorDataLoading = false,
}: IntelligentTimelineProps): JSX.Element {
  const { preferences } = useUserPreferences();
  const tempUnit = preferences.temperatureUnit;

  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>("24h");
  const [internalControllerId, setInternalControllerId] = useState<string | null>(null);
  const [internalShowDeviceActivity, setInternalShowDeviceActivity] = useState(true);

  // Shared hover state for crosshair synchronization between charts
  const [hoverTimestamp, setHoverTimestamp] = useState<string | null>(null);

  // Metric visibility toggles (at least one must remain visible)
  const [visibleMetrics, setVisibleMetrics] = useState<VisibleMetrics>({
    temperature: true,
    humidity: true,
    vpd: true,
  });

  const toggleMetric = useCallback((key: keyof VisibleMetrics) => {
    setVisibleMetrics((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some((v) => v)) return prev;
      return next;
    });
  }, []);

  // Chart container width via ResizeObserver for SVG chart sizing
  const [chartWidth, setChartWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Ref callback - fires immediately when element mounts, before effects
  const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) return;

    // Immediately measure width on mount
    const initialWidth = node.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setChartWidth(Math.floor(initialWidth));
    }

    // Set up ResizeObserver for dynamic resizing
    observerRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) {
          setChartWidth(width);
        }
      }
    });
    observerRef.current.observe(node);
  }, []);

  // Clean up observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Device activity visibility
  const showDeviceActivity = controlledShowDeviceActivity ?? internalShowDeviceActivity;
  const hasDeviceData = deviceStateData && Object.keys(deviceStateData).length > 0;

  const handleToggleDeviceActivity = useCallback(() => {
    if (onToggleDeviceActivity) {
      onToggleDeviceActivity();
    } else {
      setInternalShowDeviceActivity((prev) => !prev);
    }
  }, [onToggleDeviceActivity]);

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

  // Filter data by controller, or average across controllers for "All" mode
  const controllerFilteredData = useMemo(() => {
    if (controllerId) {
      return data.filter(d => d.controllerId === controllerId);
    }

    // "All Controllers" mode: average values per timestamp to avoid interleaving
    // that causes chart lines to zigzag between different controller values
    const byTimestamp = new Map<string, { temps: number[]; hums: number[]; vpds: number[] }>();

    for (const d of data) {
      let bucket = byTimestamp.get(d.timestamp);
      if (!bucket) {
        bucket = { temps: [], hums: [], vpds: [] };
        byTimestamp.set(d.timestamp, bucket);
      }
      if (d.temperature != null) bucket.temps.push(d.temperature);
      if (d.humidity != null) bucket.hums.push(d.humidity);
      if (d.vpd != null) bucket.vpds.push(d.vpd);
    }

    return Array.from(byTimestamp.entries()).map(([timestamp, bucket]) => ({
      timestamp,
      temperature: bucket.temps.length > 0
        ? bucket.temps.reduce((a, b) => a + b, 0) / bucket.temps.length
        : undefined,
      humidity: bucket.hums.length > 0
        ? bucket.hums.reduce((a, b) => a + b, 0) / bucket.hums.length
        : undefined,
      vpd: bucket.vpds.length > 0
        ? bucket.vpds.reduce((a, b) => a + b, 0) / bucket.vpds.length
        : undefined,
    }));
  }, [data, controllerId]);

  // Filter by time range
  const filteredData = useMemo(
    () => filterDataByTimeRange(controllerFilteredData, timeRange),
    [controllerFilteredData, timeRange]
  );

  // Sort and convert timestamps to numeric epoch for proper XAxis scale spacing
  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort(
      (a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime()
    );
    return sorted.map(d => ({
      ...d,
      _ts: parseISO(d.timestamp).getTime(),
    }));
  }, [filteredData]);

  // Calculate stats from real data
  const tempStats = useMemo(() => calculateMetricStats(sortedData, "temperature"), [sortedData]);
  const humStats = useMemo(() => calculateMetricStats(sortedData, "humidity"), [sortedData]);
  const vpdStats = useMemo(() => calculateMetricStats(sortedData, "vpd"), [sortedData]);

  // Optimal range bounds (kept for potential future use)
  // const ranges = optimalRanges ?? DEFAULT_OPTIMAL_RANGES;

  // Fade-in on mount
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <TimelineSkeleton />
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full space-y-4 transition-all duration-700 ease-out",
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
      className
    )}>
      {/* Header: Controller Selector + Time Range + Metric Toggles */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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

        <div className="flex items-center gap-4 flex-wrap">
          {/* Metric Toggles */}
          <div className="flex items-center gap-3">
            {(["temperature", "humidity", "vpd"] as const).map((key) => {
              const mc = METRIC_COLORS[key];
              const label = key === "temperature" ? `Temp °${tempUnit}` : key === "humidity" ? "Humidity %" : "VPD kPa";
              return (
                <button
                  key={key}
                  onClick={() => toggleMetric(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded transition-all text-xs",
                    visibleMetrics[key]
                      ? "opacity-100"
                      : "opacity-30 hover:opacity-50"
                  )}
                >
                  <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: mc.stroke }} />
                  <span className="font-medium" style={{ color: mc.stroke }}>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Time Range Buttons */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium rounded-md transition-all",
                timeRange === range
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {TIME_RANGE_LABELS[range]}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          metric="temperature"
          stats={tempStats}
          unit={`°${tempUnit}`}
          decimals={1}
          transformValue={(val) => convertTemperatureFromCelsius(val, tempUnit)}
        />
        <StatCard metric="humidity" stats={humStats} unit="%" decimals={1} />
        <StatCard metric="vpd" stats={vpdStats} unit=" kPa" decimals={2} />
      </div>

      {/* Empty state or Chart */}
      {sortedData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Main Chart — Custom SVG Sensor Chart */}
          <div
            ref={chartContainerRef}
            className="w-full relative rounded-xl overflow-hidden"
            style={{ minHeight: CHART_HEIGHT }}
            role="img"
            aria-label={`Sensor data chart for the last ${TIME_RANGE_LABELS[timeRange]}`}
          >
            {chartWidth > 0 ? (
              <EnviroSensorChart
                data={sortedData}
                width={chartWidth}
                height={CHART_HEIGHT}
                visible={visibleMetrics}
                hoverTimestamp={hoverTimestamp}
                onHoverChange={setHoverTimestamp}
                timeRange={timeRange}
                tempUnit={tempUnit}
                convertTemp={(v) => convertTemperatureFromCelsius(v, tempUnit)}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-muted/20 rounded-lg"
                style={{ height: CHART_HEIGHT }}
              >
                <div className="text-center">
                  <div className="w-6 h-6 mx-auto border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
                  <span className="text-xs text-muted-foreground">Loading chart...</span>
                </div>
              </div>
            )}
          </div>

          {/* Data point count */}
          {sortedData.length > 1 && (
            <div className="text-center">
              <span className="text-muted-foreground/40 text-[10px] font-mono">
                {sortedData.length} data points
              </span>
            </div>
          )}
        </>
      )}


      {/* Device Activity Waveform Section — AC Infinity Style (minimal, no header) */}
      {hasDeviceData && deviceStateData && (
        <div className="border-t border-border pt-4">
          <DeviceWaveformChart
            deviceStateData={deviceStateData}
            sensorData={sortedData.map((d) => ({
              timestamp: d.timestamp,
              temperature: d.temperature ?? null,
              humidity: d.humidity ?? null,
              vpd: d.vpd ?? null,
            }))}
            hoverTimestamp={hoverTimestamp}
            onHover={setHoverTimestamp}
            showSensorOverlay={true}
            visible={visibleMetrics}
            width={chartWidth > 0 ? chartWidth : undefined}
          />
        </div>
      )}
    </div>
  );
}

export default IntelligentTimeline;
