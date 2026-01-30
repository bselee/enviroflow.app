"use client";

/**
 * ControllerSensorPreview Component
 *
 * Displays a compact preview of sensor data AND connected devices for a controller:
 * - Current temperature, humidity, and VPD values
 * - Connected devices (fans, lights, outlets) with current state
 *
 * Fetches LIVE data directly from AC Infinity API via /api/controllers/[id]/sensors
 * NO Supabase dependency - Supabase is only for historical charts.
 *
 * Inspired by AC Infinity's elegant data visualization.
 */

import { useState, useEffect, useCallback } from "react";
import { Thermometer, Droplets, Gauge, Activity, Fan, Lightbulb, Power, Zap, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeviceControl, type DeviceState } from "@/hooks/use-device-control";
import { createClient } from "@/lib/supabase";

// Live sensor data from API
interface LiveSensorData {
  temperature: number | null;
  humidity: number | null;
  vpd: number | null;
  timestamp: string | null;
}

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
 * Single sensor value display (simplified - no trends)
 */
function SensorValue({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
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

export function ControllerSensorPreview({
  controllerId,
  className,
  compact = false,
  showDevices = true
}: ControllerSensorPreviewProps) {
  // Live sensor data state - fetched directly from AC Infinity API
  const [sensorData, setSensorData] = useState<LiveSensorData>({
    temperature: null,
    humidity: null,
    vpd: null,
    timestamp: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch connected devices
  const { devices, isLoading: devicesLoading, error: devicesError } = useDeviceControl(controllerId);

  // Debug log for devices
  useEffect(() => {
    console.log('[ControllerSensorPreview] Devices state:', {
      controllerId,
      deviceCount: devices.length,
      devices: devices.map(d => ({ port: d.port, name: d.name, type: d.deviceType, isOn: d.isOn })),
      devicesLoading,
      devicesError,
    });
  }, [devices, devicesLoading, devicesError, controllerId]);

  /**
   * Fetch live sensor data directly from AC Infinity API
   * NO Supabase dependency - this is the direct API approach
   */
  const fetchLiveSensors = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      // Get auth token for the request
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/controllers/${controllerId}/sensors?store=false`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();

      if (response.ok && data.success && data.readings) {
        // Extract sensor values from readings array
        const tempReading = data.readings.find((r: { type: string }) => r.type === 'temperature');
        const humidityReading = data.readings.find((r: { type: string }) => r.type === 'humidity');
        const vpdReading = data.readings.find((r: { type: string }) => r.type === 'vpd');

        setSensorData({
          temperature: tempReading?.value ?? null,
          humidity: humidityReading?.value ?? null,
          vpd: vpdReading?.value ?? null,
          timestamp: data.timestamp,
        });

        console.log('[ControllerSensorPreview] Live data fetched:', {
          controllerId,
          temp: tempReading?.value,
          humidity: humidityReading?.value,
          vpd: vpdReading?.value,
        });
      } else {
        setError(data.error || 'Failed to fetch sensor data');
        console.warn('[ControllerSensorPreview] API error:', data.error || data);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setError(errorMsg);
      console.error('[ControllerSensorPreview] Fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [controllerId]);

  // Fetch on mount
  useEffect(() => {
    fetchLiveSensors();
  }, [fetchLiveSensors]);

  // Check if we have any data
  const hasData = sensorData.temperature !== null || sensorData.humidity !== null || sensorData.vpd !== null;

  // Debug log
  console.log('[ControllerSensorPreview] Render:', {
    controllerId,
    hasData,
    temp: sensorData.temperature,
    humidity: sensorData.humidity,
    vpd: sensorData.vpd,
    error,
  });

  // Check if we have any device data
  const hasDevices = devices.length > 0;

  if (isLoading && devicesLoading) {
    return (
      <div className={cn("animate-pulse bg-muted rounded-md h-16", className)} />
    );
  }

  if (error && !hasData && !hasDevices) {
    return (
      <div className={cn(
        "flex items-center justify-center text-destructive/80 text-xs py-3 border rounded-md border-dashed border-destructive/30",
        className
      )}>
        <Activity className="w-3.5 h-3.5 mr-1.5 opacity-50" />
        {error}
      </div>
    );
  }

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
              label="Temp"
              value={sensorData.temperature}
              unit="°F"
              color="text-red-500"
            />
          )}
          {sensorData.humidity !== null && (
            <SensorValue
              icon={Droplets}
              label="Humidity"
              value={sensorData.humidity}
              unit="%"
              color="text-blue-500"
            />
          )}
          {sensorData.vpd !== null && (
            <SensorValue
              icon={Gauge}
              label="VPD"
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

  // Full view - live data without sparklines (no historical data dependency)
  return (
    <div className={cn("space-y-3", className)}>
      {/* Live sensor values */}
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

      {/* Status indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-1">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            hasData ? "bg-green-500" : error ? "bg-red-500" : "bg-yellow-500"
          )} />
          <span>{hasData ? "Live" : error ? "Error" : "Loading"}</span>
        </div>
        <button
          onClick={() => fetchLiveSensors()}
          disabled={isRefreshing}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
}
