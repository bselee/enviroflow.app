"use client";

/**
 * ControllerSensorPreview Component
 *
 * Displays a compact preview of sensor data AND connected devices for a controller:
 * - Current temperature, humidity, and VPD values
 * - Connected devices (fans, lights, outlets) with current state
 *
 * Uses database-backed sensor readings via useSensorReadings hook with Supabase Realtime.
 * This avoids rate limiting issues by reading from cached data populated by the cron job.
 *
 * In compact mode (controllers list page), realtime subscriptions are disabled to reduce
 * connection overhead. Instead, the component uses periodic polling (30s interval).
 */

import { useMemo, useEffect, useCallback } from "react";
import { Thermometer, Droplets, Gauge, Activity, Fan, Lightbulb, Power, Zap, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeviceControl, type DeviceState } from "@/hooks/use-device-control";
import { useSensorReadings } from "@/hooks/use-sensor-readings";

interface ControllerSensorPreviewProps {
  controllerId: string;
  className?: string;
  compact?: boolean;
  showDevices?: boolean;
}

/**
 * Get icon for device type
 */
function getDeviceIcon(deviceType: string) {
  switch (deviceType.toLowerCase()) {
    case 'fan':
      return Fan;
    case 'light':
      return Lightbulb;
    case 'outlet':
      return Power;
    default:
      return Zap;
  }
}

/**
 * Compact device status display
 */
function DeviceStatusBadge({ device }: { device: DeviceState }) {
  const Icon = getDeviceIcon(device.deviceType);

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
      device.isOn
        ? "bg-green-500/10 text-green-600 dark:text-green-400"
        : "bg-muted text-muted-foreground"
    )}>
      <Icon className="w-3 h-3" />
      <span className="font-medium truncate max-w-[60px]">{device.name}</span>
      {device.isOn && device.supportsDimming && (
        <span className="text-[10px] opacity-75">{device.level}%</span>
      )}
      {device.isOn && !device.supportsDimming && (
        <span className="text-[10px] opacity-75">ON</span>
      )}
    </div>
  );
}

/**
 * Single sensor value display
 */
function SensorValue({
  icon: Icon,
  value,
  unit,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | null;
  unit: string;
  color: string;
}) {
  if (value === null) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5 opacity-50" />
        <span className="text-xs">--</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("w-3.5 h-3.5", color)} />
      <span className="text-sm font-medium tabular-nums">
        {value.toFixed(1)}
        <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "No data";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return then.toLocaleDateString();
}

export function ControllerSensorPreview({
  controllerId,
  className,
  compact = false,
  showDevices = true
}: ControllerSensorPreviewProps) {
  // Use database-backed sensor readings
  // In compact mode (controllers list), disable realtime to reduce connection overhead
  // and use periodic polling instead
  const {
    isLoading: sensorsLoading,
    error: sensorsError,
    connectionStatus,
    getLatestForController,
    isStale,
    refetch,
  } = useSensorReadings({
    controllerIds: [controllerId],
    timeRangeHours: 1, // Only need recent data for preview
    limit: 10, // Small limit for preview
    enableRealtime: !compact, // Disable realtime for compact mode (controllers page)
  });

  // In compact mode, use periodic polling instead of realtime subscriptions
  // This reduces connection overhead when displaying multiple controller cards
  // Note: We intentionally exclude `refetch` from deps to avoid infinite loops
  // since `refetch` changes when controllerIds array changes
  useEffect(() => {
    if (!compact) return;

    // Initial fetch is already handled by the hook
    // Set up 30-second polling interval for compact mode
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  // Fetch connected devices (still uses API for device capabilities)
  const { devices, isLoading: devicesLoading } = useDeviceControl(controllerId);

  // Get latest aggregated sensor data
  const latestData = useMemo(() => {
    return getLatestForController(controllerId);
  }, [getLatestForController, controllerId]);

  // Extract sensor values
  const sensorData = useMemo(() => ({
    temperature: latestData.temperature?.value ?? null,
    humidity: latestData.humidity?.value ?? null,
    vpd: latestData.vpd?.value ?? null,
    timestamp: latestData.temperature?.timestamp || latestData.humidity?.timestamp || null,
  }), [latestData]);

  // Check if data is stale (older than 10 minutes)
  const dataIsStale = isStale(controllerId, 10);

  // Check if we have any data
  const hasData = sensorData.temperature !== null || sensorData.humidity !== null || sensorData.vpd !== null;
  const hasDevices = devices.length > 0;

  // Loading state
  if (sensorsLoading && devicesLoading) {
    return (
      <div className={cn("animate-pulse bg-muted rounded-md h-16", className)} />
    );
  }

  // Error state (only show if no data at all)
  if (sensorsError && !hasData && !hasDevices) {
    return (
      <div className={cn(
        "flex items-center justify-center text-destructive/80 text-xs py-3 border rounded-md border-dashed border-destructive/30",
        className
      )}>
        <Activity className="w-3.5 h-3.5 mr-1.5 opacity-50" />
        {sensorsError}
      </div>
    );
  }

  // No data state
  if (!hasData && !hasDevices) {
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
    // Compact inline view with sensors and devices
    return (
      <div className={cn("space-y-2", className)}>
        {/* Sensor values */}
        <div className="flex items-center gap-4 text-sm">
          {sensorData.temperature !== null && (
            <SensorValue
              icon={Thermometer}
              value={sensorData.temperature}
              unit="°F"
              color="text-red-500"
            />
          )}
          {sensorData.humidity !== null && (
            <SensorValue
              icon={Droplets}
              value={sensorData.humidity}
              unit="%"
              color="text-blue-500"
            />
          )}
          {sensorData.vpd !== null && (
            <SensorValue
              icon={Gauge}
              value={sensorData.vpd}
              unit="kPa"
              color="text-green-500"
            />
          )}
        </div>
        {/* Connected devices */}
        {showDevices && hasDevices && (
          <div className="flex flex-wrap gap-1.5">
            {devices.map((device) => (
              <DeviceStatusBadge key={device.port} device={device} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full view - database-backed data with realtime updates
  return (
    <div className={cn("space-y-3", className)}>
      {/* Sensor values */}
      <div className="grid grid-cols-3 gap-3">
        {/* Temperature */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Thermometer className="w-3 h-3 text-red-500" />
            <span>Temperature</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {sensorData.temperature?.toFixed(1) ?? "--"}
            </span>
            <span className="text-xs text-muted-foreground">°F</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Droplets className="w-3 h-3 text-blue-500" />
            <span>Humidity</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {sensorData.humidity?.toFixed(1) ?? "--"}
            </span>
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>

        {/* VPD */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Gauge className="w-3 h-3 text-green-500" />
            <span>VPD</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {sensorData.vpd?.toFixed(2) ?? "--"}
            </span>
            <span className="text-xs text-muted-foreground">kPa</span>
          </div>
        </div>
      </div>

      {/* Connected Devices Section */}
      {showDevices && hasDevices && (
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Connected Devices ({devices.length})
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {devices.map((device) => {
              const Icon = getDeviceIcon(device.deviceType);
              return (
                <div
                  key={device.port}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-sm",
                    device.isOn
                      ? "bg-green-500/5 border-green-500/20"
                      : "bg-muted/50 border-border"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center",
                    device.isOn ? "bg-green-500/10" : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "w-4 h-4",
                      device.isOn ? "text-green-500" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{device.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Port {device.port} • {device.deviceType}
                      {device.isOn && device.supportsDimming && ` • ${device.level}%`}
                      {device.isOn && !device.supportsDimming && ' • ON'}
                      {!device.isOn && ' • OFF'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status indicator - shows realtime connection status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            connectionStatus === 'connected' ? "bg-green-500" :
            connectionStatus === 'polling' ? "bg-yellow-500" :
            connectionStatus === 'error' ? "bg-red-500" : "bg-blue-500"
          )} />
          <Database className="w-3 h-3 opacity-50" />
          <span>
            {dataIsStale ? "Stale" :
             connectionStatus === 'connected' ? "Live" :
             connectionStatus === 'polling' ? "Polling" :
             connectionStatus === 'connecting' ? "Connecting" :
             "Offline"}
          </span>
        </div>
        {sensorData.timestamp && (
          <span className="text-[10px]">
            {formatRelativeTime(sensorData.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}
