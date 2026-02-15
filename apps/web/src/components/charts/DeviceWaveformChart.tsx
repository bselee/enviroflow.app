"use client";

/**
 * DeviceWaveformChart — AC Infinity Style Device Activity Chart
 *
 * Shows each device as a separate ON/OFF waveform row:
 * - Binary ON/OFF waveform per device
 * - Cyan/blue color with semi-transparent fill
 * - Device name labels on left
 * - Time axis aligned with sensor chart
 * - Clean step transitions
 */

import { useMemo, useCallback, useRef, memo } from "react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type {
  DeviceStateData,
  SensorDataPoint,
} from "@/hooks/use-sensor-data";
import { CHART_PAD } from "./EnviroSensorChart";

// =============================================================================
// Types
// =============================================================================

export interface DeviceWaveformChartProps {
  deviceStateData: DeviceStateData;
  sensorData?: SensorDataPoint[];
  hoverTimestamp?: string | null;
  onHover?: (timestamp: string | null) => void;
  showSensorOverlay?: boolean;
  visible?: { temperature: boolean; humidity: boolean; vpd: boolean };
  width?: number;
  className?: string;
}

// =============================================================================
// Constants — AC Infinity Style
// =============================================================================

const ROW_HEIGHT = 36; // Height per device row
const WAVEFORM_COLOR = "#4fc3f7"; // AC Infinity cyan/blue
const WAVEFORM_FILL_OPACITY = 0.3;
const WAVEFORM_STROKE_WIDTH = 1;
const LABEL_WIDTH = 90; // Width for device name labels

// =============================================================================
// SVG Helpers
// =============================================================================

function f(v: number): string {
  return v.toFixed(1);
}

/**
 * Build step-after waveform path for binary ON/OFF states
 * AC Infinity style: ON = top, OFF = bottom, clean vertical transitions
 */
function buildOnOffPath(
  states: Array<{ ts: number; on: boolean }>,
  t0: number,
  dur: number,
  cw: number,
  onY: number,
  offY: number,
  padL: number
): string {
  if (states.length === 0 || dur === 0) return "";

  const xS = (t: number) => padL + ((t - t0) / dur) * cw;
  const yS = (on: boolean) => (on ? onY : offY);

  let d = `M${f(xS(states[0].ts))},${f(yS(states[0].on))}`;

  for (let i = 1; i < states.length; i++) {
    const x = xS(states[i].ts);
    const prevY = yS(states[i - 1].on);
    const curY = yS(states[i].on);

    // Step-after: horizontal to new X at previous level, then vertical to new level
    d += ` L${f(x)},${f(prevY)}`;
    if (Math.abs(curY - prevY) > 0.1) {
      d += ` L${f(x)},${f(curY)}`;
    }
  }

  return d;
}

/**
 * Close the waveform path into a fill area reaching the OFF baseline
 */
function buildFillPath(
  linePath: string,
  states: Array<{ ts: number; on: boolean }>,
  t0: number,
  dur: number,
  cw: number,
  offY: number,
  padL: number
): string {
  if (!linePath || states.length < 2 || dur === 0) return "";

  const xS = (t: number) => padL + ((t - t0) / dur) * cw;
  const lastX = xS(states[states.length - 1].ts);
  const firstX = xS(states[0].ts);

  return `${linePath} L${f(lastX)},${f(offY)} L${f(firstX)},${f(offY)} Z`;
}

// =============================================================================
// Component
// =============================================================================

export const DeviceWaveformChart = memo(function DeviceWaveformChart({
  deviceStateData,
  sensorData = [],
  hoverTimestamp,
  onHover,
  width: forcedWidth,
  className,
}: DeviceWaveformChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Device list ────────────────────────────────────────────────────────────
  const deviceNames = useMemo(
    () => Object.keys(deviceStateData).sort(),
    [deviceStateData]
  );

  // ── Time domain ────────────────────────────────────────────────────────────
  const { t0, t1, dur } = useMemo(() => {
    // Use sensor data as primary time domain for alignment
    let sLo = Infinity;
    let sHi = -Infinity;
    for (const pt of sensorData) {
      const t = new Date(pt.timestamp).getTime();
      if (t < sLo) sLo = t;
      if (t > sHi) sHi = t;
    }

    if (sLo !== Infinity && sHi !== -Infinity && sHi > sLo) {
      return { t0: sLo, t1: sHi, dur: sHi - sLo };
    }

    // Fallback: use device state data range
    let lo = Infinity;
    let hi = -Infinity;
    for (const pts of Object.values(deviceStateData)) {
      for (const pt of pts) {
        const t = new Date(pt.timestamp).getTime();
        if (t < lo) lo = t;
        if (t > hi) hi = t;
      }
    }
    if (lo === Infinity) {
      const now = Date.now();
      return { t0: now - 3_600_000, t1: now, dur: 3_600_000 };
    }
    return { t0: lo, t1: hi, dur: hi - lo };
  }, [sensorData, deviceStateData]);

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const P = { ...CHART_PAD, left: LABEL_WIDTH }; // Extra left padding for labels
  const chartW = (forcedWidth ?? 800) - P.left - P.right;
  const totalH = deviceNames.length * ROW_HEIGHT + 28; // Height for all device rows + time labels

  // ── Per-device waveforms ──────────────────────────────────────────────────
  const deviceWaveforms = useMemo(() => {
    if (dur === 0 || deviceNames.length === 0) return [];

    return deviceNames.map((name, index) => {
      const rowTop = index * ROW_HEIGHT;
      const onY = rowTop + 6;  // ON position (top of row)
      const offY = rowTop + ROW_HEIGHT - 6;  // OFF position (bottom of row)

      const raw = deviceStateData[name] || [];

      // Convert to sorted state array
      const states = raw
        .map((pt) => ({
          ts: new Date(pt.timestamp).getTime(),
          on: pt.state,
        }))
        .sort((a, b) => a.ts - b.ts);

      if (states.length === 0) {
        return { name, wPath: "", fPath: "", onY, offY, rowTop };
      }

      // Get state at a given time for this device
      const getStateAtTime = (time: number): boolean => {
        for (let i = states.length - 1; i >= 0; i--) {
          if (states[i].ts <= time) {
            return states[i].on;
          }
        }
        return states[0]?.on ?? false;
      };

      // Extend to start of time domain
      if (states[0].ts > t0) {
        states.unshift({ ts: t0, on: getStateAtTime(t0) });
      }

      // Extend to end of time domain
      if (states[states.length - 1].ts < t1) {
        states.push({ ts: t1, on: getStateAtTime(t1) });
      }

      const wPath = buildOnOffPath(states, t0, dur, chartW, onY, offY, P.left);
      const fPath = buildFillPath(wPath, states, t0, dur, chartW, offY, P.left);

      return { name, wPath, fPath, onY, offY, rowTop };
    });
  }, [deviceNames, deviceStateData, t0, t1, dur, chartW, P.left]);

  // ── Hover X position ──────────────────────────────────────────────────────
  const hoverX = useMemo(() => {
    if (!hoverTimestamp || dur === 0) return null;
    const ts = new Date(hoverTimestamp).getTime();
    const clampedTs = Math.max(t0, Math.min(t1, ts));
    return P.left + ((clampedTs - t0) / dur) * chartW;
  }, [hoverTimestamp, t0, t1, dur, chartW, P.left]);

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const handleMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onHover || dur === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = (x - P.left) / chartW;
      if (ratio < -0.01 || ratio > 1.01) {
        onHover(null);
        return;
      }
      const ts = t0 + Math.max(0, Math.min(1, ratio)) * dur;
      onHover(new Date(ts).toISOString());
    },
    [onHover, t0, dur, chartW, P.left]
  );

  const handleLeave = useCallback(() => {
    if (onHover) onHover(null);
  }, [onHover]);

  // ── Early return ───────────────────────────────────────────────────────────
  if (deviceNames.length === 0 || chartW <= 0) {
    return (
      <div
        className={cn(
          "text-center py-6 text-muted-foreground text-xs",
          className
        )}
      >
        No device activity data
      </div>
    );
  }

  // ── Time labels — Match sensor chart exactly ────
  const tCount = Math.min(7, Math.max(3, Math.floor(chartW / 100)));
  const tLabels: Array<{ x: number; text: string }> = [];
  for (let i = 0; i <= tCount; i++) {
    const t = t0 + (dur * i) / tCount;
    const d = new Date(t);
    if (!isValid(d)) continue;

    let text: string;
    if (dur <= 86_400_000) {
      // Within 24h: show time (matches EnviroSensorChart)
      text = format(d, "h:mm a");
    } else if (dur <= 604_800_000) {
      // Within 7 days: show day + hour (matches EnviroSensorChart)
      text = format(d, "EEE ha");
    } else {
      // Longer: show date (matches EnviroSensorChart)
      text = format(d, "MMM d");
    }
    tLabels.push({ x: P.left + (chartW * i) / tCount, text });
  }

  const svgWidth = forcedWidth ?? 800;

  // ── Render — Multi-device waveform rows ────────────────
  return (
    <div className={cn("relative select-none", className)}>
      <svg
        ref={svgRef}
        width={svgWidth}
        height={totalH}
        className="block"
        style={{ background: "transparent" }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {/* ── Device waveform rows ── */}
        {deviceWaveforms.map((device, idx) => (
          <g key={device.name}>
            {/* Row separator line */}
            {idx > 0 && (
              <line
                x1={0}
                y1={device.rowTop}
                x2={svgWidth}
                y2={device.rowTop}
                stroke="hsl(var(--border))"
                strokeOpacity={0.1}
              />
            )}

            {/* Device name label */}
            <text
              x={P.left - 8}
              y={device.rowTop + ROW_HEIGHT / 2 + 4}
              fill="hsl(var(--muted-foreground))"
              fontSize="10"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
              opacity={0.7}
            >
              {device.name.length > 12 ? device.name.slice(0, 11) + "…" : device.name}
            </text>

            {/* Semi-transparent fill under waveform */}
            {device.fPath && (
              <path
                d={device.fPath}
                fill={WAVEFORM_COLOR}
                opacity={WAVEFORM_FILL_OPACITY}
              />
            )}

            {/* Step waveform line — cyan */}
            {device.wPath && (
              <path
                d={device.wPath}
                fill="none"
                stroke={WAVEFORM_COLOR}
                strokeWidth={WAVEFORM_STROKE_WIDTH}
                opacity={0.9}
              />
            )}
          </g>
        ))}

        {/* ── Hover crosshair — subtle ── */}
        {hoverX !== null && (
          <line
            x1={hoverX}
            y1={0}
            x2={hoverX}
            y2={totalH - 20}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
          />
        )}

        {/* ── Time axis labels ── */}
        {tLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={totalH - 4}
            fill="hsl(var(--muted-foreground))"
            fontSize="10"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            opacity={0.5}
          >
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
});

// Re-export types for compatibility
export type { DeviceStateData };

// Legacy exports maintained for backward compatibility
export interface DeviceStateTooltipProps {
  deviceStates: Record<string, { state: boolean; speed: number }> | null;
  timestamp: string | null;
  className?: string;
}

export function DeviceStateTooltip({
  deviceStates,
  timestamp,
  className,
}: DeviceStateTooltipProps): JSX.Element | null {
  if (!deviceStates || !timestamp) return null;

  const entries = Object.entries(deviceStates);
  if (entries.length === 0) return null;

  let timeStr = "";
  try {
    const d = new Date(timestamp);
    if (isValid(d)) timeStr = format(d, "MMM d, h:mm a");
  } catch {
    /* ignore */
  }

  return (
    <div
      className={cn(
        "bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg p-3 shadow-lg",
        className
      )}
    >
      <div className="text-[10px] text-muted-foreground mb-2 font-mono">
        {timeStr}
      </div>
      <div className="space-y-1.5">
        {entries.map(([name, { state }]) => (
          <div key={name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: WAVEFORM_COLOR }}
            />
            <span className="text-xs text-muted-foreground flex-1 truncate">
              {name}
            </span>
            <span
              className={cn(
                "text-xs font-mono",
                state ? "text-cyan-400" : "text-muted-foreground"
              )}
            >
              {state ? "ON" : "OFF"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper to get device color (now uses unified cyan)
export function getDeviceColor(_name: string): string {
  return WAVEFORM_COLOR;
}

export default DeviceWaveformChart;
