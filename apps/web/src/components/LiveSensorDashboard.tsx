"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Wifi, WifiOff, Thermometer, Droplets, Activity, Power, PowerOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LiveSensorResponse, LiveSensor, LivePort } from "@/types";

// =============================================================================
// Type Definitions
// =============================================================================

interface LiveSensorDashboardProps {
  /** Auto-refresh interval in seconds (default: 30) */
  refreshInterval?: number;
  /** Additional CSS classes */
  className?: string;
  /** Optional list of registered controller names to filter by (shows only these) */
  registeredControllerNames?: string[];
}

// =============================================================================
// VPD Status Helper
// =============================================================================

/**
 * Get VPD status indicator based on value.
 * Reference: https://www.advancednutrients.com/articles/vpd-charts-vapor-pressure-deficit/
 */
function getVPDStatus(vpd: number): { label: string; color: string; bgColor: string } {
  if (vpd < 0.4) return { label: "Very Low", color: "text-blue-500", bgColor: "bg-blue-500/10" };
  if (vpd < 0.8) return { label: "Low", color: "text-yellow-500", bgColor: "bg-yellow-500/10" };
  if (vpd <= 1.2) return { label: "Optimal", color: "text-green-500", bgColor: "bg-green-500/10" };
  if (vpd <= 1.6) return { label: "High", color: "text-orange-500", bgColor: "bg-orange-500/10" };
  return { label: "Very High", color: "text-red-500", bgColor: "bg-red-500/10" };
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for sensor cards.
 */
function SensorCardSkeleton() {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

/**
 * Port status display component.
 */
function PortStatus({ ports }: { ports: LivePort[] }) {
  if (!ports || ports.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        No ports configured
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Device Ports</div>
      <div className="grid grid-cols-2 gap-2">
        {ports.map((port) => (
          <div
            key={port.portId}
            className={cn(
              "flex items-center gap-2 rounded-md border p-2 text-xs",
              port.isOn
                ? "border-green-500/50 bg-green-500/10"
                : "border-border bg-card/50"
            )}
          >
            {port.isOn ? (
              <Power className="h-3 w-3 text-green-500" />
            ) : (
              <PowerOff className="h-3 w-3 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{port.name}</div>
              <div className="text-muted-foreground">
                {port.isOn ? `Speed: ${port.speed}%` : "Off"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Sensor card component.
 */
function SensorCard({ sensor }: { sensor: LiveSensor }) {
  const vpdStatus = getVPDStatus(sensor.vpd);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold truncate">
            {sensor.name}
          </CardTitle>
          <Badge
            variant={sensor.online ? "default" : "destructive"}
            className="ml-2 shrink-0"
          >
            {sensor.online ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sensor Readings Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Temperature */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Thermometer className="h-3.5 w-3.5" />
              <span>Temperature</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {sensor.temperature.toFixed(1)}°C
            </div>
          </div>

          {/* Humidity */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Droplets className="h-3.5 w-3.5" />
              <span>Humidity</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {sensor.humidity.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* VPD Display */}
        <div
          className={cn(
            "rounded-md p-3 border",
            vpdStatus.bgColor,
            "border-current/20"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className={cn("h-4 w-4", vpdStatus.color)} />
              <div>
                <div className="text-xs text-muted-foreground">VPD</div>
                <div className={cn("text-lg font-bold tabular-nums", vpdStatus.color)}>
                  {sensor.vpd.toFixed(2)} kPa
                </div>
              </div>
            </div>
            <Badge variant="outline" className={cn(vpdStatus.color, "border-current")}>
              {vpdStatus.label}
            </Badge>
          </div>
        </div>

        {/* Port Status */}
        {sensor.ports && sensor.ports.length > 0 && (
          <PortStatus ports={sensor.ports} />
        )}

        {/* Last Update */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
          Updated: {new Date(sensor.lastUpdate).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * LiveSensorDashboard - Displays real-time sensor data from AC Infinity API.
 *
 * Features:
 * - Fetches live data from /api/sensors/live
 * - Auto-refresh every 30 seconds (toggleable)
 * - Manual refresh button
 * - Shows temperature, humidity, VPD, and port status
 * - VPD status indicator with color coding
 * - Response time display for debugging
 * - Loading skeleton states
 * - Error handling with retry
 *
 * @example
 * ```tsx
 * <LiveSensorDashboard refreshInterval={30} />
 * ```
 */
export function LiveSensorDashboard({
  refreshInterval = 30,
  className,
  registeredControllerNames,
}: LiveSensorDashboardProps) {
  const [data, setData] = useState<LiveSensorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isMountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch sensor data from API.
   */
  const fetchSensors = useCallback(async () => {
    if (!isMountedRef.current) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/sensors/live");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: LiveSensorResponse = await response.json();

      if (!isMountedRef.current) return;

      setData(result);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : "Failed to fetch sensor data";
      setError(errorMessage);
      console.error("LiveSensorDashboard fetch error:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  /**
   * Handle manual refresh.
   */
  const handleManualRefresh = useCallback(() => {
    fetchSensors();
  }, [fetchSensors]);

  /**
   * Setup auto-refresh interval.
   */
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Setup new interval if auto-refresh is enabled
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchSensors();
      }, refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchSensors]);

  /**
   * Initial fetch on mount.
   */
  useEffect(() => {
    isMountedRef.current = true;
    fetchSensors();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchSensors]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Live Sensor Data</h2>
          <p className="text-sm text-muted-foreground">
            Real-time environmental monitoring from AC Infinity devices
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <label
              htmlFor="auto-refresh"
              className="text-sm font-medium cursor-pointer select-none"
            >
              Auto-refresh ({refreshInterval}s)
            </label>
          </div>

          {/* Manual refresh button */}
          <Button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      {(lastRefresh || data) && !loading && (
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-card/30 rounded-lg px-4 py-2 border border-border/50">
          <div className="flex items-center gap-4">
            {lastRefresh && (
              <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
            )}
            {data && (
              <>
                <span className="text-border">|</span>
                <span>{data.count} device{data.count !== 1 ? "s" : ""}</span>
                <span className="text-border">|</span>
                <span>Response: {data.responseTimeMs}ms</span>
              </>
            )}
          </div>
          {data?.source && (
            <Badge variant="outline" className="text-xs">
              {data.source}
            </Badge>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <SensorCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <Card className="bg-destructive/10 border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <WifiOff className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Connection Error</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {error}
                </p>
              </div>
              <Button onClick={handleManualRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && data && data.sensors.length === 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
              <Activity className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg mb-1">No Sensors Found</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  No AC Infinity devices are currently connected. Add a controller to start monitoring.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sensor Cards Grid */}
      {!loading && !error && data && data.sensors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.sensors
            .filter((sensor) => {
              // If no filter provided, show all sensors
              if (!registeredControllerNames || registeredControllerNames.length === 0) {
                return true;
              }
              // Only show sensors whose name matches a registered controller
              return registeredControllerNames.some(
                (name) => name.toLowerCase().trim() === sensor.name.toLowerCase().trim()
              );
            })
            .map((sensor) => (
              <SensorCard key={sensor.id} sensor={sensor} />
            ))}
        </div>
      )}
    </div>
  );
}
