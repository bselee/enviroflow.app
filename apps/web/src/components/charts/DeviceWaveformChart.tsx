"use client";

/**
 * DeviceWaveformChart — AC Infinity Style Overlayed Device Activity Chart
 *
 * All devices share ONE chart area with overlapping semi-transparent waveforms:
 * - Y-axis: ON at top, OFF at bottom (speed 0-100% mapped to height)
 * - Each device rendered as a step waveform with semi-transparent fill
 * - Different blue/cyan shades per port (dark → light)
 * - Legend row below chart shows device names with color dots
 * - Time axis aligned with sensor chart above
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

const CHART_AREA_HEIGHT = 100; // Taller shared chart area for better definition
const WAVEFORM_STROKE_WIDTH = 2; // Bold strokes for clear definition
const Y_LABEL_WIDTH = 32; // Width for ON/OFF labels on left
const LEGEND_HEIGHT = 24; // Height for legend row below chart
const TIME_LABEL_HEIGHT = 20; // Height for time axis labels
const PADDING_TOP = 4;
const PADDING_BOTTOM = 4;

// High-contrast colors — distinct hues so overlapping waveforms are clearly separable
const PORT_COLORS = [
  "#00bcd4", // Port 1 — cyan (primary, like AC Infinity)
  "#1565c0", // Port 2 — dark blue
  "#7c4dff", // Port 3 — purple
  "#26a69a", // Port 4 — teal
  "#42a5f5", // Port 5 — blue
  "#80cbc4", // Port 6 — light teal
  "#64b5f6", // Port 7 — light blue
  "#b388ff", // Port 8 — light purple
];

function getPortColor(index: number): string {
  return PORT_COLORS[Math.min(index, PORT_COLORS.length - 1)];
}

// =============================================================================
// SVG Helpers
// =============================================================================

function f(v: number): string {
  return v.toFixed(1);
}

/**
 * Build step waveform path for a single device overlaid on shared chart area.
 * Speed 0 = bottomY (OFF), Speed 100 = topY (ON).
 */
function buildOverlayPath(
  states: Array<{ ts: number; speed: number }>,
  t0: number,
  dur: number,
  cw: number,
  topY: number,
  bottomY: number,
  padL: number
): string {
  if (states.length === 0 || dur === 0) return "";

  const areaH = bottomY - topY;
  const xS = (t: number) => padL + ((t - t0) / dur) * cw;
  const yS = (speed: number) => bottomY - (Math.min(100, Math.max(0, speed)) / 100) * areaH;

  let d = `M${f(xS(states[0].ts))},${f(yS(states[0].speed))}`;

  for (let i = 1; i < states.length; i++) {
    const x = xS(states[i].ts);
    const prevY = yS(states[i - 1].speed);
    const curY = yS(states[i].speed);

    // Step-after: horizontal to new X at previous level, then vertical to new level
    d += ` L${f(x)},${f(prevY)}`;
    if (Math.abs(curY - prevY) > 0.1) {
      d += ` L${f(x)},${f(curY)}`;
    }
  }

  return d;
}

/**
 * Close the waveform path into a filled area down to the baseline (OFF/speed=0).
 */
function buildFillPath(
  linePath: string,
  states: Array<{ ts: number; speed: number }>,
  t0: number,
  dur: number,
  cw: number,
  bottomY: number,
  padL: number
): string {
  if (!linePath || states.length < 2 || dur === 0) return "";

  const xS = (t: number) => padL + ((t - t0) / dur) * cw;
  const lastX = xS(states[states.length - 1].ts);
  const firstX = xS(states[0].ts);

  return `${linePath} L${f(lastX)},${f(bottomY)} L${f(firstX)},${f(bottomY)} Z`;
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

  // ── Dimensions — single shared chart area ─────────────────────────────────
  const P = { ...CHART_PAD, left: Y_LABEL_WIDTH + CHART_PAD.left, right: CHART_PAD.right };
  const svgWidth = forcedWidth ?? 800;
  const chartW = svgWidth - P.left - P.right;
  const topY = PADDING_TOP;
  const bottomY = PADDING_TOP + CHART_AREA_HEIGHT - PADDING_BOTTOM;
  const totalH = CHART_AREA_HEIGHT + TIME_LABEL_HEIGHT + LEGEND_HEIGHT;

  // ── Per-device waveforms — all share same topY/bottomY ────────────────────
  const deviceWaveforms = useMemo(() => {
    if (dur === 0 || deviceNames.length === 0) return [];

    return deviceNames.map((name, index) => {
      const raw = deviceStateData[name] || [];

      // Convert to sorted state array with effective speed
      // When state=false (device OFF), effective speed is 0
      // When state=true (device ON), use reported speed (fallback to 100%)
      const states = raw
        .map((pt) => ({
          ts: new Date(pt.timestamp).getTime(),
          speed: pt.state ? (pt.speed || 100) : 0,
        }))
        .sort((a, b) => a.ts - b.ts);

      // Current speed (last known)
      const currentSpeed = states.length > 0 ? states[states.length - 1].speed : 0;
      const isOn = currentSpeed > 0;
      const color = getPortColor(index);

      if (states.length === 0) {
        return { name, wPath: "", fPath: "", currentSpeed, isOn, color };
      }

      // Get speed at a given time
      const getSpeedAtTime = (time: number): number => {
        for (let i = states.length - 1; i >= 0; i--) {
          if (states[i].ts <= time) return states[i].speed;
        }
        return states[0]?.speed ?? 0;
      };

      // Extend to full time domain
      if (states[0].ts > t0) {
        states.unshift({ ts: t0, speed: getSpeedAtTime(t0) });
      }
      if (states[states.length - 1].ts < t1) {
        states.push({ ts: t1, speed: getSpeedAtTime(t1) });
      }

      const wPath = buildOverlayPath(states, t0, dur, chartW, topY, bottomY, P.left);
      const fPath = buildFillPath(wPath, states, t0, dur, chartW, bottomY, P.left);

      return { name, wPath, fPath, currentSpeed, isOn, color };
    });
  }, [deviceNames, deviceStateData, t0, t1, dur, chartW, topY, bottomY, P.left]);

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
      text = format(d, "h:mm a");
    } else if (dur <= 604_800_000) {
      text = format(d, "EEE ha");
    } else {
      text = format(d, "MMM d");
    }
    tLabels.push({ x: P.left + (chartW * i) / tCount, text });
  }

  // ── Render — Overlayed waveforms on single shared chart area ──
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
        {/* ── Y-axis labels: ON / OFF ── */}
        <text
          x={P.left - 6}
          y={topY + 10}
          fill="hsl(var(--muted-foreground))"
          fontSize="9"
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          opacity={0.5}
        >
          ON
        </text>
        <text
          x={P.left - 6}
          y={bottomY}
          fill="hsl(var(--muted-foreground))"
          fontSize="9"
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          opacity={0.5}
        >
          OFF
        </text>

        {/* ── Baseline (OFF) — subtle line ── */}
        <line
          x1={P.left}
          y1={bottomY}
          x2={P.left + chartW}
          y2={bottomY}
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity={0.15}
          strokeWidth={0.5}
        />

        {/* ── Top line (ON) — subtle ── */}
        <line
          x1={P.left}
          y1={topY}
          x2={P.left + chartW}
          y2={topY}
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity={0.08}
          strokeWidth={0.5}
        />

        {/* ── All device waveforms overlaid — stroke-only for clarity ── */}
        {deviceWaveforms.map((device) => (
          <g key={device.name}>
            {/* Subtle fill only for the first (primary) device */}
            {device.fPath && (
              <path
                d={device.fPath}
                fill={device.color}
                opacity={0.06}
              />
            )}

            {/* Bold waveform stroke line — primary visual */}
            {device.wPath && (
              <path
                d={device.wPath}
                fill="none"
                stroke={device.color}
                strokeWidth={WAVEFORM_STROKE_WIDTH}
                opacity={0.95}
              />
            )}
          </g>
        ))}

        {/* ── Hover crosshair ── */}
        {hoverX !== null && (
          <line
            x1={hoverX}
            y1={topY}
            x2={hoverX}
            y2={bottomY}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
          />
        )}

        {/* ── Time axis labels ── */}
        {tLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={CHART_AREA_HEIGHT + TIME_LABEL_HEIGHT - 4}
            fill="hsl(var(--muted-foreground))"
            fontSize="10"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            opacity={0.5}
          >
            {l.text}
          </text>
        ))}

        {/* ── Legend — device name with color dot, inline below chart ── */}
        {deviceWaveforms.map((device, idx) => {
          // Space legend items evenly across chart width
          const legendY = CHART_AREA_HEIGHT + TIME_LABEL_HEIGHT + LEGEND_HEIGHT / 2 + 2;
          const itemWidth = chartW / deviceWaveforms.length;
          const itemX = P.left + idx * itemWidth + itemWidth / 2;

          return (
            <g key={`legend-${device.name}`}>
              <circle
                cx={itemX - 24}
                cy={legendY - 3}
                r={3}
                fill={device.isOn ? device.color : "hsl(var(--muted-foreground))"}
                opacity={device.isOn ? 0.9 : 0.3}
              />
              <text
                x={itemX - 18}
                y={legendY}
                fill={device.color}
                fontSize="9"
                textAnchor="start"
                fontFamily="ui-monospace, monospace"
                opacity={0.7}
              >
                {device.name.length > 14 ? device.name.slice(0, 13) + "…" : device.name}
              </text>
            </g>
          );
        })}
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
        {entries.map(([name, { state }], idx) => (
          <div key={name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getPortColor(idx) }}
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

// Helper to get device color by index
export function getDeviceColor(_name: string, index = 0): string {
  return getPortColor(index);
}

export default DeviceWaveformChart;
