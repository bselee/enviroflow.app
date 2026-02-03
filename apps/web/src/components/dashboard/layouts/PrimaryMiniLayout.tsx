"use client";

import { useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Thermometer,
  Droplet,
  Activity,
  Settings,
  MoreVertical,
  Cpu,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { formatTemperature } from "@/lib/temperature-utils";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
import type { Controller, TimeSeriesPoint, ControllerPort } from "@/types";
import type { RoomSummary } from "@/hooks/use-dashboard-data";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the PrimaryMiniLayout component.
 */
interface PrimaryMiniLayoutProps {
  /** Room summaries with sensor data and controllers */
  roomSummaries: RoomSummary[];
  /** Currently selected primary room ID */
  primaryRoomId: string | null;
  /** Callback when a room is selected as primary */
  onPrimaryRoomChange: (roomId: string) => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when a room is created */
  onRoomCreated?: () => void;
  /** Optional function to get ports for a controller (not used in this layout) */
  getPortsForController?: (controllerId: string) => ControllerPort[];
}

/**
 * Display-friendly room data combining Room and computed data.
 */
interface RoomDisplayData {
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
}

// =============================================================================
// Helper Functions
// =============================================================================

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

/**
 * Converts RoomSummary to display-friendly format.
 */
function toDisplayData(summary: RoomSummary): RoomDisplayData {
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
  };
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Mini sparkline chart component for sensor readings.
 */
function MiniChart({
  data,
  color = "hsl(var(--primary))",
  height = 32,
}: {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
}): JSX.Element {
  if (data.length < 2) {
    return (
      <div className="relative overflow-hidden rounded" style={{ height }}>
        {/* Animated placeholder bars */}
        <div className="h-full flex items-end justify-around gap-[2px] px-2">
          {[40, 65, 50, 75, 55, 45, 70, 60].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-muted-foreground/10 animate-pulse rounded-t"
              style={{
                height: `${h}%`,
                animationDelay: `${i * 150}ms`,
                animationDuration: '1.5s'
              }}
            />
          ))}
        </div>
        {/* Overlay text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground/50 font-medium">Building chart...</span>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="primaryChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#primaryChartGradient)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Primary (large) room card component.
 */
function PrimaryRoomCard({
  room,
  isLoading,
}: {
  room: RoomDisplayData;
  isLoading?: boolean;
}): JSX.Element {
  const { preferences } = useUserPreferences();

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-10 w-10 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-8 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="mt-6 pt-6 border-t border-border">
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  return (
    <Link href={`/rooms/${room.id}`} className="block">
      <div
        className={cn(
          "bg-card rounded-xl border p-8 transition-all duration-300 ease-out",
          "hover:shadow-lg hover:border-primary/50 cursor-pointer",
          room.isOnline ? "border-border" : "border-destructive/30"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{room.name}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  "text-sm",
                  room.isOnline
                    ? "bg-success/10 text-success hover:bg-success/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full mr-2",
                    room.isOnline ? "bg-success" : "bg-muted-foreground"
                  )}
                />
                {room.isOnline ? "Online" : "Offline"}
              </Badge>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Cpu className="w-4 h-4" />
                <span>
                  {room.controllers.length} controller{room.controllers.length !== 1 ? "s" : ""}
                </span>
              </div>

              {room.hasStaleData && room.isOnline && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant="secondary"
                        className="bg-warning/10 text-warning hover:bg-warning/20 text-sm"
                      >
                        <Clock className="w-3 h-3 mr-1.5" />
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

          <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              asChild
            >
              <Link href={`/rooms/${room.id}/settings`}>
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <MoreVertical className="h-5 w-5" />
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

        {/* Offline Warning */}
        {!room.isOnline && room.controllers.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium">All controllers offline</p>
                <p className="mt-1 text-amber-600 dark:text-amber-400">
                  Check power and WiFi connections
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sensor Readings - Large Display */}
        {room.controllers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-lg">No controllers assigned</p>
            <p className="text-sm mt-2">Add a controller to see sensor data</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-8 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                <Thermometer className="w-5 h-5" />
                <span className="text-sm font-medium">Temperature</span>
              </div>
              <p
                className={cn(
                  "text-4xl font-bold",
                  room.temperature != null ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {formatTemperature(room.temperature, preferences.temperatureUnit)}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                <Droplet className="w-5 h-5" />
                <span className="text-sm font-medium">Humidity</span>
              </div>
              <p
                className={cn(
                  "text-4xl font-bold",
                  room.humidity != null ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {room.humidity != null ? `${room.humidity}%` : "--"}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                <Activity className="w-5 h-5" />
                <span className="text-sm font-medium">VPD</span>
              </div>
              <p
                className={cn(
                  "text-4xl font-bold",
                  room.vpd != null ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {room.vpd != null ? `${room.vpd} kPa` : "--"}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        {room.temperatureTimeSeries.length > 0 && (
          <div className="mt-4">
            <MiniChart
              data={room.temperatureTimeSeries}
              color="hsl(var(--primary))"
              height={80}
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Last update: {formatRelativeTime(room.lastUpdate)}
          </span>
          <div className="flex items-center text-sm text-primary">
            View details
            <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Mini room card component for the sidebar.
 */
function MiniRoomCard({
  room,
  isSelected,
  onClick,
}: {
  room: RoomDisplayData;
  isSelected: boolean;
  onClick: () => void;
}): JSX.Element {
  const { preferences } = useUserPreferences();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full bg-card rounded-lg border p-4 text-left transition-all duration-200 ease-out",
        "hover:border-primary/50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : room.isOnline
          ? "border-border"
          : "border-destructive/30"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-foreground truncate pr-2">{room.name}</h4>
        <span
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
            room.isOnline ? "bg-success" : "bg-muted-foreground"
          )}
        />
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5" />
            Temp
          </span>
          <span className={room.temperature != null ? "text-foreground font-medium" : ""}>
            {formatTemperature(room.temperature, preferences.temperatureUnit)}
          </span>
        </div>

        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Droplet className="w-3.5 h-3.5" />
            Humidity
          </span>
          <span className={room.humidity != null ? "text-foreground font-medium" : ""}>
            {room.humidity != null ? `${room.humidity}%` : "--"}
          </span>
        </div>

        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            VPD
          </span>
          <span className={room.vpd != null ? "text-foreground font-medium" : ""}>
            {room.vpd != null ? `${room.vpd}` : "--"}
          </span>
        </div>
      </div>

      {room.controllers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-1.5">
          <Cpu className="w-3 h-3" />
          {room.controllers.length} controller{room.controllers.length !== 1 ? "s" : ""}
        </div>
      )}
    </button>
  );
}

/**
 * Loading skeleton for mini cards.
 */
function MiniCardSkeleton(): JSX.Element {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-start justify-between mb-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="w-2 h-2 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * PrimaryMiniLayout Component
 *
 * Displays one large primary room card with mini cards for other rooms in a sidebar.
 * Clicking a mini card makes it the primary (large) card.
 *
 * Layout adapts responsively:
 * - Desktop: Side-by-side layout with primary card (2/3) and mini cards sidebar (1/3)
 * - Tablet: Stacked layout with primary card on top
 * - Mobile: Stacked layout, mini cards scroll horizontally
 *
 * @example
 * ```tsx
 * <PrimaryMiniLayout
 *   roomSummaries={roomSummaries}
 *   primaryRoomId={selectedRoom}
 *   onPrimaryRoomChange={setSelectedRoom}
 * />
 * ```
 */
export function PrimaryMiniLayout({
  roomSummaries,
  primaryRoomId,
  onPrimaryRoomChange,
  isLoading,
  onRoomCreated: _onRoomCreated,
  getPortsForController: _getPortsForController,
}: PrimaryMiniLayoutProps): JSX.Element {
  /**
   * Convert room summaries to display-friendly format.
   */
  const displayRooms = useMemo(() => {
    return roomSummaries.map(toDisplayData);
  }, [roomSummaries]);

  /**
   * Determine the primary room to display.
   * Falls back to the first room if no primary is selected.
   */
  const primaryRoom = useMemo(() => {
    if (displayRooms.length === 0) return null;

    const selected = displayRooms.find((r) => r.id === primaryRoomId);
    return selected || displayRooms[0];
  }, [displayRooms, primaryRoomId]);

  /**
   * Other rooms to display as mini cards.
   */
  const otherRooms = useMemo(() => {
    if (!primaryRoom) return displayRooms;
    return displayRooms.filter((r) => r.id !== primaryRoom.id);
  }, [displayRooms, primaryRoom]);

  /**
   * Handles clicking a mini card to make it primary.
   */
  const handleMiniCardClick = useCallback(
    (roomId: string) => {
      onPrimaryRoomChange(roomId);
    },
    [onPrimaryRoomChange]
  );

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PrimaryRoomCard room={{} as RoomDisplayData} isLoading />
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Other Rooms</h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <MiniCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (displayRooms.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-foreground mb-2">No rooms yet</h3>
        <p className="text-muted-foreground mb-4">
          Get started by creating your first grow room.
        </p>
      </div>
    );
  }

  // Show single room (no sidebar needed)
  if (displayRooms.length === 1 && primaryRoom) {
    return (
      <div className="max-w-4xl mx-auto">
        <PrimaryRoomCard room={primaryRoom} />
      </div>
    );
  }

  // Main layout with primary and mini cards
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Primary Room Card */}
      <div className="lg:col-span-2">
        {primaryRoom && <PrimaryRoomCard room={primaryRoom} />}
      </div>

      {/* Mini Cards Sidebar */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Other Rooms ({otherRooms.length})
        </h3>

        {/* Desktop: Vertical scroll */}
        <div className="hidden lg:block space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
          {otherRooms.map((room) => (
            <MiniRoomCard
              key={room.id}
              room={room}
              isSelected={false}
              onClick={() => handleMiniCardClick(room.id)}
            />
          ))}
        </div>

        {/* Mobile/Tablet: Horizontal scroll */}
        <div className="lg:hidden">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 pb-4">
              {otherRooms.map((room) => (
                <div key={room.id} className="w-[200px] flex-shrink-0">
                  <MiniRoomCard
                    room={room}
                    isSelected={false}
                    onClick={() => handleMiniCardClick(room.id)}
                  />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
