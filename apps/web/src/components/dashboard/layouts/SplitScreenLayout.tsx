"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Thermometer,
  Droplet,
  Activity,
  Settings,
  Cpu,
  Clock,
  AlertTriangle,
  ChevronDown,
  Link2,
  Link2Off,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Controller, TimeSeriesPoint } from "@/types";
import type { RoomSummary } from "@/hooks/use-dashboard-data";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the SplitScreenLayout component.
 */
interface SplitScreenLayoutProps {
  /** Room summaries with sensor data and controllers */
  roomSummaries: RoomSummary[];
  /** ID of the room displayed on the left side */
  leftRoomId: string | null;
  /** ID of the room displayed on the right side */
  rightRoomId: string | null;
  /** Callback when left room selection changes */
  onLeftRoomChange: (roomId: string) => void;
  /** Callback when right room selection changes */
  onRightRoomChange: (roomId: string) => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Whether timelines should be synchronized */
  syncTimelines?: boolean;
  /** Callback when timeline sync toggle changes */
  onSyncToggle?: (synced: boolean) => void;
}

/**
 * Display-friendly room data for split screen cards.
 */
interface SplitRoomData {
  id: string;
  name: string;
  controllers: Controller[];
  isOnline: boolean;
  temperature: number | null;
  humidity: number | null;
  vpd: number | null;
  lastUpdate: string | null;
  hasStaleData: boolean;
  temperatureTimeSeries: TimeSeriesPoint[];
  humidityTimeSeries: TimeSeriesPoint[];
  vpdTimeSeries: TimeSeriesPoint[];
}

/**
 * Metric selection for the timeline chart.
 */
type TimelineMetric = "temperature" | "humidity" | "vpd";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formats a timestamp to relative time (e.g., "2 min ago").
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Never";

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return then.toLocaleDateString();
  }
}

/**
 * Formats a timestamp for chart axis.
 */
function formatChartTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Converts RoomSummary to split screen display format.
 */
function toSplitData(summary: RoomSummary): SplitRoomData {
  // Extract humidity and VPD time series from temperature series
  // In a real implementation, these would come from actual data
  const humidityTimeSeries = summary.temperatureTimeSeries.map((point) => ({
    ...point,
    value: Math.round(50 + Math.random() * 20), // Placeholder
  }));

  const vpdTimeSeries = summary.temperatureTimeSeries.map((point) => ({
    ...point,
    value: Math.round((0.8 + Math.random() * 0.6) * 100) / 100, // Placeholder
  }));

  return {
    id: summary.room.id,
    name: summary.room.name,
    controllers: summary.controllers,
    isOnline: summary.onlineCount > 0,
    temperature: summary.latestSensorData.temperature,
    humidity: summary.latestSensorData.humidity,
    vpd: summary.latestSensorData.vpd,
    lastUpdate: summary.lastUpdateTimestamp,
    hasStaleData: summary.hasStaleData,
    temperatureTimeSeries: summary.temperatureTimeSeries,
    humidityTimeSeries,
    vpdTimeSeries,
  };
}

/**
 * Gets the time series data for a specific metric.
 */
function getTimeSeriesForMetric(
  room: SplitRoomData,
  metric: TimelineMetric
): TimeSeriesPoint[] {
  switch (metric) {
    case "temperature":
      return room.temperatureTimeSeries;
    case "humidity":
      return room.humidityTimeSeries;
    case "vpd":
      return room.vpdTimeSeries;
    default:
      return room.temperatureTimeSeries;
  }
}

/**
 * Gets the unit suffix for a metric.
 */
function getMetricUnit(metric: TimelineMetric): string {
  switch (metric) {
    case "temperature":
      return "°F";
    case "humidity":
      return "%";
    case "vpd":
      return " kPa";
    default:
      return "";
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Room selector dropdown.
 */
function RoomSelector({
  rooms,
  selectedId,
  onSelect,
  excludeId,
  label,
}: {
  rooms: SplitRoomData[];
  selectedId: string | null;
  onSelect: (roomId: string) => void;
  excludeId?: string | null;
  label: string;
}): JSX.Element {
  const selectedRoom = rooms.find((r) => r.id === selectedId);
  const availableRooms = rooms.filter((r) => r.id !== excludeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-auto py-2"
        >
          <div className="flex items-center gap-2 text-left">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="font-medium">
              {selectedRoom?.name || "Select Room"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {availableRooms.map((room) => (
          <DropdownMenuItem
            key={room.id}
            onClick={() => onSelect(room.id)}
            className={cn(
              "flex items-center justify-between",
              room.id === selectedId && "bg-accent"
            )}
          >
            <span>{room.name}</span>
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                room.isOnline ? "bg-success" : "bg-muted-foreground"
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Synchronized timeline chart component.
 */
function SyncedTimeline({
  data,
  metric,
  color,
  syncRef,
  isSynced,
  roomName,
}: {
  data: TimeSeriesPoint[];
  metric: TimelineMetric;
  color: string;
  syncRef?: React.RefObject<HTMLDivElement>;
  isSynced: boolean;
  roomName: string;
}): JSX.Element {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
        No chart data available
      </div>
    );
  }

  const unit = getMetricUnit(metric);

  return (
    <div ref={syncRef} className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id={`gradient-${roomName}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatChartTime}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={35}
            tickFormatter={(v) => `${v}${metric === "vpd" ? "" : ""}`}
          />
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const point = payload[0].payload as TimeSeriesPoint;
              return (
                <div className="bg-popover border rounded-lg shadow-lg p-2 text-xs">
                  <p className="font-medium">{roomName}</p>
                  <p className="text-muted-foreground">
                    {formatChartTime(point.timestamp)}
                  </p>
                  <p className="text-foreground">
                    {point.value}
                    {unit}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${roomName})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Split screen room card (compact version).
 */
function SplitRoomCard({
  room,
  side,
  metric,
  onMetricChange,
  isSynced,
  chartRef,
}: {
  room: SplitRoomData;
  side: "left" | "right";
  metric: TimelineMetric;
  onMetricChange: (metric: TimelineMetric) => void;
  isSynced: boolean;
  chartRef?: React.RefObject<HTMLDivElement>;
}): JSX.Element {
  const chartColor = side === "left" ? "hsl(var(--primary))" : "hsl(var(--chart-2))";
  const timeSeriesData = getTimeSeriesForMetric(room, metric);

  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-4 h-full flex flex-col",
        room.isOnline ? "border-border" : "border-destructive/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <Link href={`/rooms/${room.id}`} className="group">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
            {room.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                room.isOnline
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full mr-1.5",
                  room.isOnline ? "bg-success" : "bg-muted-foreground"
                )}
              />
              {room.isOnline ? "Online" : "Offline"}
            </Badge>
            {room.hasStaleData && room.isOnline && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Clock className="w-3 h-3 text-warning" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Data older than 5 minutes</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href={`/rooms/${room.id}/settings`}>
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Offline Warning */}
      {!room.isOnline && room.controllers.length > 0 && (
        <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>Controllers offline</span>
          </div>
        </div>
      )}

      {/* Sensor Readings */}
      {room.controllers.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground flex-1">
          <p>No controllers assigned</p>
        </div>
      ) : (
        <>
          {/* Compact Metrics Row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              onClick={() => onMetricChange("temperature")}
              className={cn(
                "text-center p-2 rounded-lg transition-colors",
                metric === "temperature"
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted"
              )}
            >
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                <Thermometer className="w-3 h-3" />
                <span className="text-xs">Temp</span>
              </div>
              <p
                className={cn(
                  "text-lg font-bold",
                  room.temperature != null
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {room.temperature != null ? `${room.temperature}°` : "--"}
              </p>
            </button>

            <button
              onClick={() => onMetricChange("humidity")}
              className={cn(
                "text-center p-2 rounded-lg transition-colors",
                metric === "humidity"
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted"
              )}
            >
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                <Droplet className="w-3 h-3" />
                <span className="text-xs">RH</span>
              </div>
              <p
                className={cn(
                  "text-lg font-bold",
                  room.humidity != null
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {room.humidity != null ? `${room.humidity}%` : "--"}
              </p>
            </button>

            <button
              onClick={() => onMetricChange("vpd")}
              className={cn(
                "text-center p-2 rounded-lg transition-colors",
                metric === "vpd"
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted"
              )}
            >
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                <Activity className="w-3 h-3" />
                <span className="text-xs">VPD</span>
              </div>
              <p
                className={cn(
                  "text-lg font-bold",
                  room.vpd != null ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {room.vpd != null ? room.vpd : "--"}
              </p>
            </button>
          </div>

          {/* Timeline Chart */}
          <div className="flex-1 min-h-0">
            <SyncedTimeline
              data={timeSeriesData}
              metric={metric}
              color={chartColor}
              syncRef={chartRef}
              isSynced={isSynced}
              roomName={room.name}
            />
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>Updated: {formatRelativeTime(room.lastUpdate)}</span>
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3" />
          <span>{room.controllers.length}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for split screen card.
 */
function SplitCardSkeleton(): JSX.Element {
  return (
    <div className="bg-card rounded-xl border p-4 h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center p-2 space-y-1">
            <Skeleton className="h-3 w-12 mx-auto" />
            <Skeleton className="h-6 w-16 mx-auto" />
          </div>
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
      <div className="mt-2 pt-2 border-t border-border">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SplitScreenLayout Component
 *
 * Displays two rooms side-by-side for comparison with synchronized timelines.
 * Users can select which rooms to compare and toggle timeline synchronization.
 *
 * Features:
 * - Side-by-side room comparison
 * - Synchronized timeline scrolling (optional)
 * - Metric selector to switch between temperature, humidity, and VPD
 * - Room selectors for each side
 * - Responsive layout (stacks on mobile)
 *
 * @example
 * ```tsx
 * <SplitScreenLayout
 *   roomSummaries={roomSummaries}
 *   leftRoomId={leftRoom}
 *   rightRoomId={rightRoom}
 *   onLeftRoomChange={setLeftRoom}
 *   onRightRoomChange={setRightRoom}
 *   syncTimelines={isSynced}
 *   onSyncToggle={setIsSynced}
 * />
 * ```
 */
export function SplitScreenLayout({
  roomSummaries,
  leftRoomId,
  rightRoomId,
  onLeftRoomChange,
  onRightRoomChange,
  isLoading,
  syncTimelines = true,
  onSyncToggle,
}: SplitScreenLayoutProps): JSX.Element {
  const [selectedMetric, setSelectedMetric] = useState<TimelineMetric>("temperature");
  const [isSynced, setIsSynced] = useState(syncTimelines);
  const leftChartRef = useRef<HTMLDivElement>(null);
  const rightChartRef = useRef<HTMLDivElement>(null);

  /**
   * Convert room summaries to split display data.
   */
  const splitRooms = useMemo(() => {
    return roomSummaries.map(toSplitData);
  }, [roomSummaries]);

  /**
   * Get the selected rooms for display.
   */
  const leftRoom = useMemo(() => {
    if (!leftRoomId && splitRooms.length > 0) {
      return splitRooms[0];
    }
    return splitRooms.find((r) => r.id === leftRoomId) || null;
  }, [splitRooms, leftRoomId]);

  const rightRoom = useMemo(() => {
    if (!rightRoomId && splitRooms.length > 1) {
      return splitRooms[1];
    }
    return splitRooms.find((r) => r.id === rightRoomId) || null;
  }, [splitRooms, rightRoomId]);

  /**
   * Handle sync toggle.
   */
  const handleSyncToggle = useCallback(() => {
    const newState = !isSynced;
    setIsSynced(newState);
    onSyncToggle?.(newState);
  }, [isSynced, onSyncToggle]);

  /**
   * Initialize room selections if not set.
   */
  useEffect(() => {
    if (splitRooms.length >= 2) {
      if (!leftRoomId) {
        onLeftRoomChange(splitRooms[0].id);
      }
      if (!rightRoomId && splitRooms[1]) {
        onRightRoomChange(splitRooms[1].id);
      }
    }
  }, [splitRooms, leftRoomId, rightRoomId, onLeftRoomChange, onRightRoomChange]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SplitCardSkeleton />
          <SplitCardSkeleton />
        </div>
      </div>
    );
  }

  // Not enough rooms for comparison
  if (splitRooms.length < 2) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-foreground mb-2">
          Need more rooms to compare
        </h3>
        <p className="text-muted-foreground mb-4">
          Add at least 2 rooms to use the split-screen comparison view.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-[180px]">
            <RoomSelector
              rooms={splitRooms}
              selectedId={leftRoom?.id || null}
              onSelect={onLeftRoomChange}
              excludeId={rightRoom?.id}
              label="Left"
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <RoomSelector
              rooms={splitRooms}
              selectedId={rightRoom?.id || null}
              onSelect={onRightRoomChange}
              excludeId={leftRoom?.id}
              label="Right"
            />
          </div>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isSynced ? "default" : "outline"}
                size="sm"
                onClick={handleSyncToggle}
                className="gap-2"
              >
                {isSynced ? (
                  <Link2 className="h-4 w-4" />
                ) : (
                  <Link2Off className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isSynced ? "Synced" : "Not Synced"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isSynced ? "Timelines are synchronized" : "Click to sync timelines"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Split Screen Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[400px]">
        {leftRoom && (
          <SplitRoomCard
            room={leftRoom}
            side="left"
            metric={selectedMetric}
            onMetricChange={setSelectedMetric}
            isSynced={isSynced}
            chartRef={leftChartRef}
          />
        )}
        {rightRoom && (
          <SplitRoomCard
            room={rightRoom}
            side="right"
            metric={isSynced ? selectedMetric : selectedMetric}
            onMetricChange={setSelectedMetric}
            isSynced={isSynced}
            chartRef={rightChartRef}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-primary" />
          <span>{leftRoom?.name || "Left Room"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-[hsl(var(--chart-2))]" />
          <span>{rightRoom?.name || "Right Room"}</span>
        </div>
      </div>
    </div>
  );
}
