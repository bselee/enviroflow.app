"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
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
import type { Controller, TimeSeriesPoint } from "@/types";
import type { RoomSummary } from "@/hooks/use-dashboard-data";

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the CarouselLayout component.
 */
interface CarouselLayoutProps {
  /** Room summaries with sensor data and controllers */
  roomSummaries: RoomSummary[];
  /** Currently selected room index */
  currentIndex?: number;
  /** Callback when the active slide changes */
  onIndexChange?: (index: number) => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when a room is created */
  onRoomCreated?: () => void;
}

/**
 * Display-friendly room data for carousel cards.
 */
interface CarouselRoomData {
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
    return `${diffMinutes} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else {
    return then.toLocaleDateString();
  }
}

/**
 * Converts RoomSummary to carousel-friendly display format.
 */
function toCarouselData(summary: RoomSummary): CarouselRoomData {
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
 * Mini sparkline chart for carousel cards.
 */
function CarouselChart({
  data,
  color = "hsl(var(--primary))",
}: {
  data: TimeSeriesPoint[];
  color?: string;
}): JSX.Element {
  if (data.length < 2) {
    return (
      <div className="h-20 w-full flex items-center justify-center text-sm text-muted-foreground">
        No chart data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="carouselChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill="url(#carouselChartGradient)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Full-width room card for carousel display.
 */
function CarouselRoomCard({ room }: { room: CarouselRoomData }): JSX.Element {
  return (
    <Link href={`/rooms/${room.id}`} className="block">
      <div
        className={cn(
          "bg-card rounded-xl border p-6 sm:p-8 transition-all duration-300 ease-out",
          "hover:shadow-lg hover:border-primary/50 cursor-pointer min-h-[400px]",
          room.isOnline ? "border-border" : "border-destructive/30"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              {room.name}
            </h2>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
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
                  {room.controllers.length} controller
                  {room.controllers.length !== 1 ? "s" : ""}
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
          <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                <Thermometer className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">Temperature</span>
                <span className="text-sm font-medium sm:hidden">Temp</span>
              </div>
              <p
                className={cn(
                  "text-3xl sm:text-4xl font-bold",
                  room.temperature != null
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {room.temperature != null ? `${room.temperature}°` : "--"}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                <Droplet className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline">Humidity</span>
                <span className="text-sm font-medium sm:hidden">RH</span>
              </div>
              <p
                className={cn(
                  "text-3xl sm:text-4xl font-bold",
                  room.humidity != null
                    ? "text-foreground"
                    : "text-muted-foreground"
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
                  "text-3xl sm:text-4xl font-bold",
                  room.vpd != null ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {room.vpd != null ? room.vpd : "--"}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        {room.temperatureTimeSeries.length > 0 && (
          <div className="mt-4">
            <CarouselChart
              data={room.temperatureTimeSeries}
              color="hsl(var(--primary))"
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-border text-sm text-muted-foreground">
          Last update: {formatRelativeTime(room.lastUpdate)}
        </div>
      </div>
    </Link>
  );
}

/**
 * Carousel card skeleton for loading state.
 */
function CarouselCardSkeleton(): JSX.Element {
  return (
    <div className="bg-card rounded-xl border p-6 sm:p-8 min-h-[400px]">
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-10 w-10 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center space-y-2">
            <Skeleton className="h-4 w-16 mx-auto" />
            <Skeleton className="h-10 w-24 mx-auto" />
          </div>
        ))}
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="mt-6 pt-6 border-t border-border">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

/**
 * Dot indicator for carousel pagination.
 */
function CarouselDots({
  count,
  current,
  onDotClick,
}: {
  count: number;
  current: number;
  onDotClick: (index: number) => void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          aria-label={`Go to slide ${i + 1}`}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            i === current
              ? "bg-primary w-6"
              : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
          )}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * CarouselLayout Component
 *
 * Displays rooms in a swipe-enabled carousel format, optimized for mobile.
 * Shows one room at a time with dot indicators and optional arrow navigation.
 *
 * Features:
 * - Touch-enabled swipe gestures
 * - Dot indicators for pagination
 * - Arrow buttons on desktop
 * - Keyboard navigation support
 * - Smooth slide transitions
 *
 * @example
 * ```tsx
 * <CarouselLayout
 *   roomSummaries={roomSummaries}
 *   currentIndex={activeIndex}
 *   onIndexChange={setActiveIndex}
 * />
 * ```
 */
export function CarouselLayout({
  roomSummaries,
  currentIndex = 0,
  onIndexChange,
  isLoading,
  onRoomCreated: _onRoomCreated,
}: CarouselLayoutProps): JSX.Element {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(currentIndex);

  /**
   * Convert room summaries to carousel display data.
   */
  const carouselRooms = useMemo(() => {
    return roomSummaries.map(toCarouselData);
  }, [roomSummaries]);

  /**
   * Sync internal state with external currentIndex prop.
   */
  useEffect(() => {
    if (api && currentIndex !== current) {
      api.scrollTo(currentIndex);
    }
  }, [api, currentIndex, current]);

  /**
   * Listen to carousel API events to track current slide.
   */
  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      const newIndex = api.selectedScrollSnap();
      setCurrent(newIndex);
      onIndexChange?.(newIndex);
    };

    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onIndexChange]);

  /**
   * Navigate to a specific slide by index.
   */
  const scrollTo = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api]
  );

  /**
   * Navigate to previous slide.
   */
  const scrollPrev = useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  /**
   * Navigate to next slide.
   */
  const scrollNext = useCallback(() => {
    api?.scrollNext();
  }, [api]);

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <CarouselCardSkeleton />
        <div className="flex items-center justify-center gap-2 mt-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="w-2.5 h-2.5 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (carouselRooms.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-foreground mb-2">No rooms yet</h3>
        <p className="text-muted-foreground mb-4">
          Get started by creating your first grow room.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* Carousel */}
      <Carousel
        setApi={setApi}
        opts={{
          align: "center",
          loop: carouselRooms.length > 1,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {carouselRooms.map((room) => (
            <CarouselItem key={room.id} className="pl-2 md:pl-4">
              <CarouselRoomCard room={room} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Desktop Arrow Buttons */}
      {carouselRooms.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={scrollPrev}
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10",
              "hidden md:flex h-10 w-10 rounded-full shadow-md",
              "bg-background/80 backdrop-blur-sm"
            )}
            aria-label="Previous room"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={scrollNext}
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10",
              "hidden md:flex h-10 w-10 rounded-full shadow-md",
              "bg-background/80 backdrop-blur-sm"
            )}
            aria-label="Next room"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Dot Indicators */}
      {carouselRooms.length > 1 && (
        <CarouselDots
          count={carouselRooms.length}
          current={current}
          onDotClick={scrollTo}
        />
      )}

      {/* Room Counter */}
      <div className="text-center text-sm text-muted-foreground mt-3">
        {current + 1} of {carouselRooms.length} room{carouselRooms.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
