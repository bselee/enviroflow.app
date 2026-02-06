"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, WifiOff, Activity, Fan, Lightbulb, Droplets, Flame, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { formatTemperatureValue } from "@/lib/temperature-utils";
import type { LiveSensorResponse, LiveSensor, LivePort } from "@/types";
import type { TemperatureUnit } from "@/hooks/use-user-preferences";

// =============================================================================
// Type Definitions
// =============================================================================

interface LiveSensorDashboardProps {
  /** Auto-refresh interval in seconds (default: 15) */
  refreshInterval?: number;
  /** Additional CSS classes */
  className?: string;
  /** Optional list of registered controller names to filter by (shows only these) */
  registeredControllerNames?: string[];
}

// =============================================================================
// AC Infinity Style Colors (CSS custom properties for dark mode)
// =============================================================================
// These match the design guide:
// --bg-card: #151c26
// --bg-surface: #1e2a3a (port tiles)
// --accent-cyan: #00d4ff (data readings, port levels when ON)
// --accent-green: #00e676 (online status dot)
// --accent-purple: #b388ff (VPD readings)
// --text-primary: #e8edf4 (sensor values)
// --text-secondary: #8896a8 (descriptions)
// --text-dim: #4a5568 (labels)
// --border-subtle: rgba(255,255,255,0.06)

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Loading skeleton for AC Infinity style sensor cards.
 */
function SensorCardSkeleton() {
  return (
    <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] overflow-hidden">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>

      {/* Readings Grid Skeleton */}
      <div className="grid grid-cols-3 divide-x divide-border dark:divide-[rgba(255,255,255,0.06)] border-t border-border dark:border-[rgba(255,255,255,0.06)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 text-center">
            <Skeleton className="h-2.5 w-16 mx-auto mb-2" />
            <Skeleton className="h-8 w-20 mx-auto" />
          </div>
        ))}
      </div>

      {/* Ports Grid Skeleton */}
      <div className="grid grid-cols-2 gap-2.5 p-4 border-t border-border dark:border-[rgba(255,255,255,0.06)]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted dark:bg-[#1e2a3a]">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * AC Infinity style sensor card component.
 *
 * Layout:
 * - Header: Device name with green status dot + device code (E-XXXXXX format)
 * - 3-column readings grid with dividers between columns
 * - Large monospace values (28px) with small unit labels
 * - VPD uses purple color (#b388ff)
 * - 2-column port grid at bottom
 */
function SensorCard({ sensor, tempUnit }: { sensor: LiveSensor; tempUnit: TemperatureUnit }) {
  // Format device code from ID (last 6 characters, uppercase)
  const deviceCode = `E-${sensor.id.slice(-6).toUpperCase()}`;

  return (
    <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] overflow-hidden transition-all duration-200 hover:border-border/80 dark:hover:border-[rgba(0,212,255,0.3)] hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(0,212,255,0.1)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              sensor.online
                ? "bg-[#00e676] shadow-[0_0_6px_rgba(0,230,118,0.5)]"
                : "bg-gray-500"
            )}
          />
          <h3 className="font-semibold text-[15px] text-foreground dark:text-[#e8edf4] truncate">
            {sensor.name}
          </h3>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground dark:text-[#4a5568] shrink-0 ml-2">
          {deviceCode}
        </span>
      </div>

      {/* 3-Column Readings Grid - Color coded: Red=Temp, Blue=Humidity, Purple=VPD */}
      <div className="grid grid-cols-3 divide-x divide-border dark:divide-[rgba(255,255,255,0.06)] border-t border-border dark:border-[rgba(255,255,255,0.06)]">
        {/* Temperature - Red */}
        <div className="p-4 text-center">
          <div className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground dark:text-[#4a5568] mb-1.5 font-semibold">
            Temperature
          </div>
          <div className="font-mono text-[28px] font-bold leading-tight text-[#ef4444]">
            {formatTemperatureValue(sensor.temperature, tempUnit)}
            <span className="text-[12px] ml-0.5 font-normal text-[#ef4444]/70">
              °{tempUnit}
            </span>
          </div>
        </div>

        {/* Humidity - Blue */}
        <div className="p-4 text-center">
          <div className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground dark:text-[#4a5568] mb-1.5 font-semibold">
            Humidity
          </div>
          <div className="font-mono text-[28px] font-bold leading-tight text-[#3b82f6]">
            {sensor.humidity.toFixed(1)}
            <span className="text-[12px] ml-0.5 font-normal text-[#3b82f6]/70">
              %
            </span>
          </div>
        </div>

        {/* VPD - Purple */}
        <div className="p-4 text-center">
          <div className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground dark:text-[#4a5568] mb-1.5 font-semibold">
            VPD
          </div>
          <div className="font-mono text-[28px] font-bold leading-tight text-[#b388ff]">
            {sensor.vpd.toFixed(2)}
            <span className="text-[12px] ml-0.5 font-normal text-[#b388ff]/70">
              kPa
            </span>
          </div>
        </div>
      </div>

      {/* Port Grid - Only show if ports exist */}
      {sensor.ports && sensor.ports.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 p-4 border-t border-border dark:border-[rgba(255,255,255,0.06)]">
          {sensor.ports.map((port) => (
            <PortTile key={port.portId} port={port} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Get device type icon component based on port device type.
 * Uses outlined Lucide icons for modern, clean look.
 */
function getDeviceIcon(deviceType: string | undefined, isOn: boolean) {
  const iconClass = cn(
    "w-4 h-4 shrink-0",
    isOn ? "text-foreground dark:text-[#e8edf4]" : "text-muted-foreground dark:text-[#4a5568]"
  );

  switch (deviceType) {
    case 'fan':
      return <Fan className={iconClass} />;
    case 'light':
      return <Lightbulb className={iconClass} />;
    case 'humidifier':
      return <Droplets className={iconClass} />;
    case 'heater':
      return <Flame className={iconClass} />;
    default:
      return <Power className={iconClass} />;
  }
}

/**
 * Get mode badge label and styling.
 */
function getModeBadge(mode: string | undefined, isOn: boolean) {
  if (!mode || mode === 'off' || mode === 'on') return null;

  const modeLabels: Record<string, string> = {
    auto: 'AUTO',
    vpd: 'VPD',
    timer: 'TIMER',
    cycle: 'CYCLE',
    schedule: 'SCHED',
    advance: 'ADV',
  };

  const label = modeLabels[mode];
  if (!label) return null;

  // VPD mode gets purple styling, others get cyan
  const isPurple = mode === 'vpd';

  return (
    <span
      className={cn(
        "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
        isPurple
          ? "bg-[#b388ff]/20 text-[#b388ff]"
          : "bg-[#00d4ff]/20 text-[#00d4ff]"
      )}
    >
      {label}
    </span>
  );
}

/**
 * Port tile component for the port grid.
 * Shows device type icon, port name, mode badge, and speed level.
 */
function PortTile({ port }: { port: LivePort }) {
  const modeBadge = getModeBadge(port.mode, port.isOn);

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg text-[12px] transition-colors",
        port.isOn
          ? "bg-[rgba(0,230,118,0.08)] dark:bg-[rgba(0,230,118,0.1)]"
          : "bg-muted dark:bg-[#1e2a3a]"
      )}
    >
      {/* Device Type Icon */}
      {getDeviceIcon(port.deviceType, port.isOn)}

      {/* Port Name + Mode Badge */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-muted-foreground dark:text-[#8896a8] truncate font-medium">
          {port.name}
        </span>
        {modeBadge}
      </div>

      {/* Speed Level */}
      <span
        className={cn(
          "font-mono font-bold text-[16px] shrink-0",
          port.isOn
            ? "text-cyan-500 dark:text-[#00d4ff]"
            : "text-muted-foreground dark:text-[#4a5568]"
        )}
      >
        {/* Display 0-10 scale (AC Infinity convention) - API returns 0-100, convert back */}
        {port.isOn ? Math.round(port.speed / 10) : 0}
      </span>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * LiveSensorDashboard - AC Infinity-style live sensor display.
 *
 * Features:
 * - Fetches live data from /api/sensors/live
 * - Auto-refresh with configurable interval
 * - AC Infinity-inspired dark industrial HUD design
 * - 3-column readings: Temperature, Humidity, VPD
 * - Port status grid with on/off styling
 * - Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop)
 * - Minimal chrome - no verbose headers or status bars
 *
 * @example
 * ```tsx
 * <LiveSensorDashboard refreshInterval={15} />
 * ```
 */
export function LiveSensorDashboard({
  refreshInterval = 15,
  className,
  registeredControllerNames,
}: LiveSensorDashboardProps) {
  const { preferences } = useUserPreferences();
  const tempUnit = preferences.temperatureUnit;

  const [data, setData] = useState<LiveSensorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

    // Setup new interval for auto-refresh
    intervalRef.current = setInterval(() => {
      fetchSensors();
    }, refreshInterval * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval, fetchSensors]);

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

  // Filter sensors based on registered controller names
  const filteredSensors = data?.sensors.filter((sensor) => {
    if (!registeredControllerNames || registeredControllerNames.length === 0) {
      return true;
    }
    return registeredControllerNames.some(
      (name) => name.toLowerCase().trim() === sensor.name.toLowerCase().trim()
    );
  }) ?? [];

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={cn("space-y-4", className)}>
      {/* Minimal Header - Just refresh indicator */}
      <div className="flex items-center justify-end">
        <Button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <SensorCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-destructive/50 p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <WifiOff className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="font-semibold text-lg mb-1 text-foreground dark:text-[#e8edf4]">
                Connection Error
              </h3>
              <p className="text-sm text-muted-foreground dark:text-[#8896a8] max-w-md">
                {error}
              </p>
            </div>
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              className="border-destructive/50 hover:bg-destructive/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredSensors.length === 0 && (
        <div className="bg-card dark:bg-[#151c26] rounded-2xl border border-border dark:border-[rgba(255,255,255,0.06)] p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
            <Activity className="h-12 w-12 text-muted-foreground dark:text-[#4a5568]" />
            <div>
              <h3 className="font-semibold text-lg mb-1 text-foreground dark:text-[#e8edf4]">
                No Sensors Found
              </h3>
              <p className="text-sm text-muted-foreground dark:text-[#8896a8] max-w-md">
                No AC Infinity devices are currently connected. Add a controller to start monitoring.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sensor Cards Grid */}
      {!loading && !error && filteredSensors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSensors.map((sensor) => (
            <SensorCard key={sensor.id} sensor={sensor} tempUnit={tempUnit} />
          ))}
        </div>
      )}
    </div>
  );
}
