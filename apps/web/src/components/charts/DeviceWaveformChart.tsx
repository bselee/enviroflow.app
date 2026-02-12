"use client";

/**
 * DeviceWaveformChart Component
 *
 * AC Infinity-style device activity waveform chart showing ON/OFF state changes.
 * Features:
 * - Step-function waveforms for each device
 * - Mini sensor overlay at top (ghosted lines)
 * - Shared crosshair synchronized with parent sensor chart
 * - Device state indicator at hover timestamp
 *
 * Usage:
 * <DeviceWaveformChart
 *   deviceStateData={deviceData}
 *   sensorData={sensorData}
 *   hoverTimestamp={hoveredTime}
 *   onHover={setHoveredTime}
 * />
 */

import { useMemo, useCallback, useRef, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import type { DeviceStateData, DeviceStatePoint, SensorDataPoint } from "@/hooks/use-sensor-data";
import { getDeviceColor } from "@/hooks/use-sensor-data";
import { Power, PowerOff } from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export interface DeviceWaveformChartProps {
  deviceStateData: DeviceStateData;
  sensorData?: SensorDataPoint[];
  /** Synchronized hover timestamp (ISO string or null) */
  hoverTimestamp?: string | null;
  /** Callback when hovering over the chart */
  onHover?: (timestamp: string | null) => void;
  /** Show mini sensor overlay */
  showSensorOverlay?: boolean;
  className?: string;
}

interface WaveformDataPoint {
  timestamp: number; // epoch ms for recharts
  time: string; // ISO string
  state: number; // 0 or 1
  speed: number;
}

// =============================================================================
// Constants
// =============================================================================

const WAVEFORM_HEIGHT = 40; // Height per device row
const SENSOR_OVERLAY_HEIGHT = 48;
const CHART_PADDING = { left: 8, right: 8 };

// =============================================================================
// Component
// =============================================================================

export function DeviceWaveformChart({
  deviceStateData,
  sensorData = [],
  hoverTimestamp,
  onHover,
  showSensorOverlay = true,
  className,
}: DeviceWaveformChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  // Track container width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setChartWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Get device names
  const deviceNames = useMemo(
    () => Object.keys(deviceStateData).sort(),
    [deviceStateData]
  );

  // Calculate time domain from sensor data or device data
  const timeDomain = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;

    // From sensor data
    for (const point of sensorData) {
      const ts = new Date(point.timestamp).getTime();
      if (ts < minTime) minTime = ts;
      if (ts > maxTime) maxTime = ts;
    }

    // From device data
    for (const points of Object.values(deviceStateData)) {
      for (const point of points) {
        const ts = new Date(point.timestamp).getTime();
        if (ts < minTime) minTime = ts;
        if (ts > maxTime) maxTime = ts;
      }
    }

    if (minTime === Infinity) {
      const now = Date.now();
      return [now - 3600000, now];
    }

    return [minTime, maxTime];
  }, [sensorData, deviceStateData]);

  // Convert device state data to waveform format
  const waveformData = useMemo(() => {
    const result: Record<string, WaveformDataPoint[]> = {};

    for (const [deviceName, states] of Object.entries(deviceStateData)) {
      if (!states || states.length === 0) continue;

      // Sort by timestamp
      const sorted = [...states].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Convert to waveform points with step-function behavior
      const points: WaveformDataPoint[] = [];

      for (let i = 0; i < sorted.length; i++) {
        const state = sorted[i];
        const ts = new Date(state.timestamp).getTime();

        // Add point at this timestamp
        points.push({
          timestamp: ts,
          time: state.timestamp,
          state: state.state ? 1 : 0,
          speed: state.speed,
        });
      }

      // Extend to end of time domain
      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        if (lastPoint.timestamp < timeDomain[1]) {
          points.push({
            timestamp: timeDomain[1],
            time: new Date(timeDomain[1]).toISOString(),
            state: lastPoint.state,
            speed: lastPoint.speed,
          });
        }
      }

      result[deviceName] = points;
    }

    return result;
  }, [deviceStateData, timeDomain]);

  // Convert sensor data for mini overlay
  const sensorChartData = useMemo(() => {
    return sensorData.map((point) => ({
      timestamp: new Date(point.timestamp).getTime(),
      temperature: point.temperature,
      humidity: point.humidity,
    }));
  }, [sensorData]);

  // Calculate hover position as percentage of width
  const hoverPosition = useMemo(() => {
    if (!hoverTimestamp) return null;
    const ts = new Date(hoverTimestamp).getTime();
    const [minTime, maxTime] = timeDomain;
    const range = maxTime - minTime;
    if (range === 0 || ts < minTime || ts > maxTime) return null;
    return ((ts - minTime) / range) * 100;
  }, [hoverTimestamp, timeDomain]);

  // Get device states at hover timestamp
  const deviceStatesAtHover = useMemo(() => {
    if (!hoverTimestamp) return null;
    const ts = new Date(hoverTimestamp).getTime();
    if (isNaN(ts)) return null;

    const result: Record<string, { state: boolean; speed: number }> = {};

    for (const [deviceName, points] of Object.entries(waveformData)) {
      if (!points || points.length === 0) continue;

      // Find the state at this timestamp (last state before or at ts)
      let lastState = { state: false, speed: 0 };
      for (const point of points) {
        if (point.timestamp <= ts) {
          lastState = { state: point.state === 1, speed: point.speed };
        } else {
          break;
        }
      }
      result[deviceName] = lastState;
    }

    return Object.keys(result).length > 0 ? result : null;
  }, [hoverTimestamp, waveformData]);

  // Handle mouse move on chart area
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onHover || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - CHART_PADDING.left;
      const chartAreaWidth = rect.width - CHART_PADDING.left - CHART_PADDING.right;
      const ratio = Math.max(0, Math.min(1, x / chartAreaWidth));

      const [minTime, maxTime] = timeDomain;
      const ts = minTime + ratio * (maxTime - minTime);
      onHover(new Date(ts).toISOString());
    },
    [onHover, timeDomain]
  );

  const handleMouseLeave = useCallback(() => {
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  // If no devices, show placeholder
  if (deviceNames.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm", className)}>
        No device activity data available
      </div>
    );
  }

  const totalHeight =
    (showSensorOverlay ? SENSOR_OVERLAY_HEIGHT : 0) +
    deviceNames.length * WAVEFORM_HEIGHT +
    32; // Extra padding

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Mini sensor overlay */}
      {showSensorOverlay && sensorChartData.length > 0 && (
        <div className="relative h-12 mb-2 opacity-40">
          <ResponsiveContainer width="100%" height={SENSOR_OVERLAY_HEIGHT}>
            <ComposedChart
              data={sensorChartData}
              margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
            >
              <XAxis dataKey="timestamp" hide domain={timeDomain} type="number" />
              <YAxis hide />
              <Area
                dataKey="temperature"
                stroke="#ef4444"
                fill="none"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
              <Area
                dataKey="humidity"
                stroke="#3b82f6"
                fill="none"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
              {/* Hover line in sensor overlay */}
              {hoverPosition !== null && (
                <ReferenceLine
                  x={timeDomain[0] + (timeDomain[1] - timeDomain[0]) * (hoverPosition / 100)}
                  stroke="rgba(255,255,255,0.4)"
                  strokeDasharray="3 3"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Separator */}
      <div className="h-px bg-border/50 mb-2" />

      {/* Device waveforms */}
      <div className="space-y-1">
        {deviceNames.map((deviceName) => {
          const data = waveformData[deviceName] || [];
          const color = getDeviceColor(deviceName);
          const stateAtHover = deviceStatesAtHover?.[deviceName];

          return (
            <div key={deviceName} className="flex items-center gap-2">
              {/* Device label */}
              <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] font-medium text-muted-foreground truncate">
                  {deviceName.toUpperCase()}
                </span>
              </div>

              {/* Waveform chart */}
              <div className="flex-1 h-8 relative">
                <ResponsiveContainer width="100%" height={32}>
                  <LineChart
                    data={data}
                    margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                  >
                    <XAxis
                      dataKey="timestamp"
                      hide
                      domain={timeDomain}
                      type="number"
                    />
                    <YAxis hide domain={[0, 1]} />
                    <Line
                      type="stepAfter"
                      dataKey="state"
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {/* Hover line */}
                    {hoverPosition !== null && (
                      <ReferenceLine
                        x={timeDomain[0] + (timeDomain[1] - timeDomain[0]) * (hoverPosition / 100)}
                        stroke="rgba(255,255,255,0.3)"
                        strokeDasharray="3 3"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>

                {/* ON/OFF reference lines */}
                <div
                  className="absolute top-1 left-2 right-2 border-t border-dashed border-border/30"
                  style={{ top: "4px" }}
                />
                <div
                  className="absolute bottom-1 left-2 right-2 border-t border-dashed border-border/30"
                  style={{ bottom: "4px" }}
                />
              </div>

              {/* State indicator at hover */}
              <div className="w-16 flex-shrink-0 flex items-center justify-end gap-1">
                {stateAtHover ? (
                  <>
                    {stateAtHover.state ? (
                      <Power className="h-3 w-3 text-green-500" />
                    ) : (
                      <PowerOff className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-mono",
                        stateAtHover.state ? "text-green-500" : "text-muted-foreground"
                      )}
                    >
                      {stateAtHover.state ? `${stateAtHover.speed}%` : "OFF"}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared crosshair vertical line */}
      {hoverPosition !== null && (
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-10"
          style={{
            left: `calc(${hoverPosition}% + ${CHART_PADDING.left}px)`,
          }}
        />
      )}

      {/* Hover timestamp label */}
      {hoverTimestamp && (
        <div
          className="absolute bottom-0 transform -translate-x-1/2 pointer-events-none z-20"
          style={{
            left: `calc(${hoverPosition}% + ${CHART_PADDING.left}px)`,
          }}
        >
          <div className="bg-card/90 backdrop-blur-sm border border-border/50 rounded px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground whitespace-nowrap">
            {formatTimestamp(hoverTimestamp)}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatTimestamp(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    if (!isValid(date)) return timestamp;
    return format(date, "MMM d, h:mm a");
  } catch {
    return timestamp;
  }
}

// =============================================================================
// Device State Tooltip (for use in parent)
// =============================================================================

export interface DeviceStateTooltipProps {
  deviceStates: Record<string, { state: boolean; speed: number }> | null;
  timestamp: string | null;
  className?: string;
}

export function DeviceStateTooltip({
  deviceStates,
  timestamp,
  className,
}: DeviceStateTooltipProps) {
  if (!deviceStates || !timestamp) return null;

  const entries = Object.entries(deviceStates);
  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        "bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg",
        className
      )}
    >
      <div className="text-[10px] text-muted-foreground mb-2 font-mono">
        {formatTimestamp(timestamp)}
      </div>
      <div className="space-y-1.5">
        {entries.map(([name, { state, speed }]) => (
          <div key={name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getDeviceColor(name) }}
            />
            <span className="text-xs text-muted-foreground flex-1 truncate">
              {name}
            </span>
            <span
              className={cn(
                "text-xs font-mono",
                state ? "text-green-500" : "text-muted-foreground"
              )}
            >
              {state ? `ON ${speed}%` : "OFF"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeviceWaveformChart;
