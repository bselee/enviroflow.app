"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateVPD } from "@/lib/vpd-utils";
import { formatTemperature } from "@/lib/temperature-utils";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import {
  Thermometer,
  Droplet,
  Activity,
  Settings,
  MoreVertical,
  Bot,
  Cpu,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSensorReadings } from "@/hooks/use-sensor-readings";
import { useWorkflows } from "@/hooks/use-workflows";
import { useDragDrop } from "@/components/providers";
import type { RoomWithControllers, Controller, TimeSeriesPoint, ControllerPort } from "@/types";
import type { LatestSensorData } from "@/hooks/use-dashboard-data";

/**
 * Display-friendly room data for RoomCard.
 * Supports both real database Room objects and mock data.
 */
interface RoomDisplayData {
  id: string;
  name: string;
  // Real room properties (from database)
  user_id?: string;
  description?: string | null;
  settings?: Record<string, unknown>;
  current_stage?: string | null;
  stage_started_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
  controllers?: Controller[];
  // Mock room properties (for development)
  isOnline?: boolean;
  workflowActive?: boolean;
  temperature?: number;
  humidity?: number;
  vpd?: number;
  fanSpeed?: number;
  lightLevel?: number;
  lastUpdate?: string;
}

/**
 * Props for RoomCard component.
 * Accepts a room object with optional controllers relation.
 */
interface RoomCardProps {
  room: RoomDisplayData | RoomWithControllers;
  /** Index of this card in the list (for drag-drop) */
  index?: number;
  /** Whether to show loading skeleton */
  isLoading?: boolean;
  /** Optional function to get ports for a controller (avoids N+1 query problem) */
  getPortsForController?: (controllerId: string) => ControllerPort[];
  /** Pre-fetched sensor data (avoids N+1 query problem) */
  sensorData?: LatestSensorData;
  /** Pre-fetched time series data for chart */
  timeSeriesData?: TimeSeriesPoint[];
  /** Pre-calculated online count */
  onlineCount?: number;
  /** Pre-calculated last update timestamp */
  lastUpdate?: string | null;
}

/**
 * Formats a timestamp to relative time (e.g., "2 min ago").
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "Connecting...";

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else {
    return then.toLocaleDateString();
  }
}

// VPD calculation is now imported from vpd-utils.ts for consistency

/**
 * Mini sparkline chart component for sensor readings.
 */
function MiniChart({
  data,
  color = "hsl(var(--primary))",
}: {
  data: TimeSeriesPoint[];
  color?: string;
}) {
  if (data.length < 2) {
    return (
      <div className="h-8 w-full relative overflow-hidden rounded">
        {/* Animated placeholder bars */}
        <div className="h-full flex items-end justify-around gap-[2px] px-2">
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '40%', animationDelay: '0ms', animationDuration: '1.5s' }} />
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '65%', animationDelay: '150ms', animationDuration: '1.5s' }} />
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '50%', animationDelay: '300ms', animationDuration: '1.5s' }} />
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '75%', animationDelay: '450ms', animationDuration: '1.5s' }} />
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '55%', animationDelay: '600ms', animationDuration: '1.5s' }} />
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '45%', animationDelay: '750ms', animationDuration: '1.5s' }} />
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '70%', animationDelay: '900ms', animationDuration: '1.5s' }} />
          <div className="w-1 bg-muted-foreground/10 animate-pulse rounded-t" style={{ height: '60%', animationDelay: '1050ms', animationDuration: '1.5s' }} />
        </div>
        {/* Overlay text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 font-medium">Building chart...</span>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#chartGradient)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Controller devices section component.
 * Shows the controller name and its connected devices/ports.
 */
interface ControllerDevicesSectionProps {
  controller: Controller;
  /** Optional pre-fetched ports data. If provided, skips individual fetch. */
  ports?: ControllerPort[];
}

function ControllerDevicesSection({ controller, ports: propPorts }: ControllerDevicesSectionProps) {
  // Use provided ports or empty array
  const ports = propPorts ?? [];

  // Filter to only show connected devices
  const connectedPorts = ports.filter((port) => port.is_connected);

  // Don't render if no connected ports
  if (connectedPorts.length === 0) {
    return null;
  }

  return (
    <div className="p-2 bg-muted/30 rounded-lg">
      <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <Cpu className="w-3 h-3" />
        {controller.name}
      </div>
      <div className="space-y-1">
        {connectedPorts.map((port) => (
          <div
            key={port.id}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-muted-foreground truncate">
                {port.port_name || `Port ${port.port_number}`}
              </span>
              {port.device_type && (
                <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">
                  {port.device_type}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {port.supports_dimming && (
                <span className="text-muted-foreground">
                  {port.power_level}%
                </span>
              )}
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  port.is_on ? "bg-success" : "bg-muted-foreground/30"
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for RoomCard.
 */
export function RoomCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

/**
 * Room card component displaying room information and sensor readings.
 *
 * Fetches live sensor data for all controllers in the room and displays
 * aggregated readings with a mini sparkline chart. Supports real-time
 * updates via Supabase subscriptions.
 *
 * @example
 * ```tsx
 * const { rooms } = useRooms();
 *
 * return (
 *   <div className="grid grid-cols-3 gap-4">
 *     {rooms.map(room => (
 *       <RoomCard key={room.id} room={room} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function RoomCard({ room, index = 0, isLoading, getPortsForController, sensorData: propSensorData, timeSeriesData: propTimeSeriesData, onlineCount: propOnlineCount, lastUpdate: propLastUpdate }: RoomCardProps) {
  const controllers = room.controllers || [];
  const controllerIds = controllers.map((c) => c.id);

  // User preferences for temperature unit
  const { preferences } = useUserPreferences();

  // Drag-drop state
  const {
    draggedCard,
    setDraggedCard,
    dragOverCard,
    setDragOverCard,
    isEditing,
    reorderCards,
  } = useDragDrop();

  // Workflows state
  const { getWorkflowsByRoom } = useWorkflows();

  const isDragging = draggedCard === index;
  const isDragOver = dragOverCard === index && draggedCard !== index;

  // ✅ FIX: Only fetch sensor readings if NOT provided via props
  // This prevents duplicate requests when parent (DashboardContent) already fetched data
  const shouldFetchOwnData = !propSensorData;

  const {
    readings,
    getLatestForController,
    getTimeSeries,
    isStale,
    isLoading: sensorsLoading,
    refetch: refetchSensors,
  } = useSensorReadings({
    controllerIds: shouldFetchOwnData ? controllerIds : [], // Empty array prevents fetch
    timeRangeHours: 6,
    limit: 50,
    enableRealtime: false, // Disable realtime - parent hook handles this
  });

  // Manual polling state
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  // Poll all controllers in this room
  const handleRefreshAll = async () => {
    if (isPolling || controllers.length === 0) return;

    setIsPolling(true);
    setPollError(null);

    try {
      // Poll each controller in parallel
      const results = await Promise.all(
        controllers.map(async (controller) => {
          const response = await fetch(`/api/controllers/${controller.id}/sensors`);
          const data = await response.json();
          return { controllerId: controller.id, success: response.ok, data };
        })
      );

      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        setPollError(`${failed.length} controller(s) failed to poll`);
      }

      // Refetch sensor readings to get the new data
      await refetchSensors();
    } catch (err) {
      setPollError("Network error");
    } finally {
      setIsPolling(false);
    }
  };

  // Aggregate sensor data across all controllers
  const aggregatedData = useMemo(() => {
    // If pre-fetched sensor data is provided, use it directly
    if (propSensorData) {
      return {
        temperature: propSensorData.temperature,
        humidity: propSensorData.humidity,
        vpd: propSensorData.vpd,
        fanSpeed: null, // Would come from device control data
        lightLevel: null, // Would come from device control data
        lastUpdate: propLastUpdate ?? null,
        isOnline: (propOnlineCount ?? 0) > 0,
      };
    }

    if (controllers.length === 0) {
      return {
        temperature: null,
        humidity: null,
        vpd: null,
        fanSpeed: null,
        lightLevel: null,
        lastUpdate: null,
        isOnline: false,
      };
    }

    // Collect latest readings from all controllers
    let latestTemp: number | null = null;
    let latestHumidity: number | null = null;
    let latestTimestamp: string | null = null;
    let onlineCount = 0;

    for (const controller of controllers) {
      if (controller.status === 'online') {
        onlineCount++;
      }

      const latest = getLatestForController(controller.id);

      if (latest.temperature?.value != null) {
        latestTemp = latest.temperature.value;
        // Guard against null/undefined timestamps before comparison
        const tempTimestamp = latest.temperature.timestamp;
        if (tempTimestamp && (!latestTimestamp ||
          new Date(tempTimestamp).getTime() > new Date(latestTimestamp).getTime())
        ) {
          latestTimestamp = tempTimestamp;
        }
      }

      if (latest.humidity?.value != null) {
        latestHumidity = latest.humidity.value;
        // Guard against null/undefined timestamps before comparison
        const humTimestamp = latest.humidity.timestamp;
        if (humTimestamp && (!latestTimestamp ||
          new Date(humTimestamp).getTime() > new Date(latestTimestamp).getTime())
        ) {
          latestTimestamp = humTimestamp;
        }
      }
    }

    // Calculate VPD if we have both temp and humidity
    let vpd: number | null = null;
    if (latestTemp != null && latestHumidity != null) {
      vpd = calculateVPD(latestTemp, latestHumidity);
    }

    return {
      temperature: latestTemp,
      humidity: latestHumidity,
      vpd,
      fanSpeed: null, // Would come from device control data
      lightLevel: null, // Would come from device control data
      lastUpdate: latestTimestamp,
      isOnline: onlineCount > 0,
    };
    // getLatestForController is memoized in useSensorReadings with readings dependency,
    // so we need readings here to trigger recomputation when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllers, readings, getLatestForController, propSensorData, propLastUpdate, propOnlineCount]);

  // Get temperature chart data aggregated from ALL controllers in the room
  // For multi-controller rooms, we average readings at each timestamp
  const chartData = useMemo(() => {
    // Use pre-fetched time series data if available
    if (propTimeSeriesData) {
      return propTimeSeriesData;
    }

    // Collect all temperature data from all controllers
    const allTempData: TimeSeriesPoint[] = [];
    for (const controller of controllers) {
      const tempData = getTimeSeries(controller.id, "temperature");
      allTempData.push(...tempData);
    }

    if (allTempData.length === 0) {
      return [];
    }

    // Group by timestamp (rounded to nearest minute for alignment)
    const byTimestamp = new Map<number, number[]>();
    for (const point of allTempData) {
      const time = Math.floor(new Date(point.timestamp).getTime() / 60000) * 60000;
      const existing = byTimestamp.get(time) || [];
      existing.push(point.value);
      byTimestamp.set(time, existing);
    }

    // Average values at each timestamp and return sorted
    return Array.from(byTimestamp.entries())
      .map(([time, values]) => ({
        timestamp: new Date(time).toISOString(),
        value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    // getTimeSeries is memoized in useSensorReadings with readings dependency,
    // so we need readings here to trigger recomputation when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllers, readings, getTimeSeries, propTimeSeriesData]);

  // Check if any controller has stale data
  const hasStaleData = useMemo(() => {
    // If pre-fetched, checking stale is harder without timestamps, assume false or calculate from lastUpdate
    if (propSensorData) {
      if (!propLastUpdate) return true;
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      return new Date(propLastUpdate).getTime() < fiveMinsAgo;
    }
    return controllers.some((c) => isStale(c.id, 5));
    // isStale is memoized in useSensorReadings with readings dependency,
    // so we need readings here to trigger recomputation when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllers, readings, isStale, propSensorData, propLastUpdate]);

  // Check if any workflow is active for this room
  const hasActiveWorkflow = useMemo(() => {
    const roomWorkflows = getWorkflowsByRoom(room.id);
    return roomWorkflows.some((w) => w.is_active);
  }, [getWorkflowsByRoom, room.id]);

  if (isLoading) {
    return <RoomCardSkeleton />;
  }

  // Drag-drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (!isEditing) return;
    setDraggedCard(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', room.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCard(index);
  };

  const handleDragLeave = () => {
    if (!isEditing) return;
    setDragOverCard(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    if (draggedCard !== null && draggedCard !== index) {
      reorderCards(draggedCard, index);
    }
    setDraggedCard(null);
    setDragOverCard(null);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverCard(null);
  };

  const cardContent = (
    <div
      draggable={isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      className={cn(
        "bg-card rounded-xl border p-6 transition-all cursor-pointer relative",
        !isEditing && "hover:shadow-md hover:border-primary/50",
        aggregatedData.isOnline ? "border-border" : "border-destructive/30",
        // Drag-drop visual feedback
        isDragging && "opacity-50 scale-[1.02] rotate-1 shadow-lg z-10",
        isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isEditing && "cursor-grab active:cursor-grabbing"
      )}
    >
        {/* Drag Handle - visible in edit mode */}
        {isEditing && (
          <div className="absolute top-3 left-3 text-muted-foreground/60 select-none pointer-events-none">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="opacity-60"
            >
              <circle cx="4" cy="4" r="1.5" />
              <circle cx="4" cy="8" r="1.5" />
              <circle cx="4" cy="12" r="1.5" />
              <circle cx="10" cy="4" r="1.5" />
              <circle cx="10" cy="8" r="1.5" />
              <circle cx="10" cy="12" r="1.5" />
            </svg>
          </div>
        )}

        {/* Header */}
        <div className={cn("flex items-start justify-between mb-4", isEditing && "pl-6")}>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{room.name}</h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  aggregatedData.isOnline
                    ? "bg-success/10 text-success hover:bg-success/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mr-1.5",
                    aggregatedData.isOnline ? "bg-success" : "bg-muted-foreground"
                  )}
                />
                {aggregatedData.isOnline ? "Online" : "Offline"}
              </Badge>

              {hasActiveWorkflow && (
                <Badge
                  variant="secondary"
                  className="bg-info/10 text-info hover:bg-info/20 text-xs"
                >
                  <Bot className="w-3 h-3 mr-1" />
                  Automation
                </Badge>
              )}

              {hasStaleData && aggregatedData.isOnline && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant="secondary"
                        className="bg-warning/10 text-warning hover:bg-warning/20 text-xs"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Stale
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Data older than 5 minutes</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              asChild
            >
              <Link href={`/rooms/${room.id}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/rooms/${room.id}`}>View Details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/rooms/${room.id}/settings`}>Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Delete Room
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Controller Count */}
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <Cpu className="w-4 h-4" />
          <span>
            {controllers.length} controller{controllers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Controllers and Devices Section */}
        {controllers.length > 0 && (
          <div className="mb-4 space-y-2">
            {controllers.map((controller) => (
              <ControllerDevicesSection
                key={controller.id}
                controller={controller}
                ports={getPortsForController?.(controller.id)}
              />
            ))}
          </div>
        )}

        {/* Offline Warning with Quick Tips */}
        {!aggregatedData.isOnline && controllers.length > 0 && (
          <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium">All controllers offline</p>
                <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                  Check power and WiFi connections
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sensor Readings */}
        {(controllers.length === 0 && !propSensorData) ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <p>No controllers assigned</p>
            <p className="text-xs mt-1">Add a controller to see sensor data</p>
          </div>
        ) : (sensorsLoading && !propSensorData) ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Thermometer className="w-4 h-4" />
                Temperature
              </span>
              {aggregatedData.temperature != null ? (
                <span className="text-lg font-semibold text-foreground">
                  {formatTemperature(aggregatedData.temperature, preferences.temperatureUnit)}
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-5 bg-muted-foreground/30 rounded-sm" />
                  <div className="w-2 h-5 bg-muted-foreground/30 rounded-sm" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Droplet className="w-4 h-4" />
                Humidity
              </span>
              {aggregatedData.humidity != null ? (
                <span className="text-lg font-semibold text-foreground">
                  {aggregatedData.humidity}%
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-5 bg-muted-foreground/30 rounded-sm" />
                  <div className="w-2 h-5 bg-muted-foreground/30 rounded-sm" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" />
                VPD
              </span>
              {aggregatedData.vpd != null ? (
                <span className="text-lg font-semibold text-foreground">
                  {aggregatedData.vpd} kPa
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-5 bg-muted-foreground/30 rounded-sm" />
                  <div className="w-2 h-5 bg-muted-foreground/30 rounded-sm" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mini Chart */}
        {chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <MiniChart data={chartData} color="hsl(var(--primary))" />
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Last update: {formatRelativeTime(aggregatedData.lastUpdate)}
          </span>
          <div className="flex items-center gap-2">
            {pollError && (
              <span className="text-xs text-red-500">{pollError}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRefreshAll();
              }}
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
    </div>
  );

  // In edit mode, don't wrap with Link to prevent navigation during drag
  if (isEditing) {
    return cardContent;
  }

  return (
    <Link href={`/rooms/${room.id}`} className="block">
      {cardContent}
    </Link>
  );
}
