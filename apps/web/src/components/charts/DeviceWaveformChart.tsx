"use client";

/**
 * DeviceWaveformChart — Custom SVG Device Activity Chart
 *
 * AC Infinity-style step-function waveforms showing device ON/OFF states:
 * - Pure SVG rendering (no Recharts dependency)
 * - Semi-transparent fill under ON states
 * - Mini ghosted sensor overlay at top
 * - Shared crosshair synchronized with EnviroSensorChart
 * - ON/OFF labels and device name labels
 * - Matching CHART_PAD left/right for pixel-perfect crosshair alignment
 */

import { useMemo, useCallback, useRef, memo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type {
  DeviceStateData,
  SensorDataPoint,
} from "@/hooks/use-sensor-data";
import { getDeviceColor } from "@/hooks/use-sensor-data";
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
// Constants
// =============================================================================

const WAVE_H = 36;
const SENSOR_OVERLAY_H = 44;
const ROW_GAP = 2;
const RIGHT_LABEL_INSET = 6;

const OVERLAY_METRICS: Array<{
  key: "temperature" | "humidity";
  color: string;
  unit: string;
}> = [
  { key: "temperature", color: "#ef4444", unit: "°" },
  { key: "humidity", color: "#4fc3f7", unit: "%" },
];

// =============================================================================
// SVG Helpers
// =============================================================================

function f(v: number): string {
  return v.toFixed(1);
}

/** Build a simple polyline path for the mini sensor overlay. */
function sensorLine(
  pts: Array<{ ts: number; v: number }>,
  t0: number,
  dur: number,
  cw: number,
  vMin: number,
  vMax: number,
  top: number,
  h: number,
  padL: number,
): string {
  if (pts.length < 2 || dur === 0) return "";
  const xS = (t: number) => padL + ((t - t0) / dur) * cw;
  const vRange = vMax - vMin || 1;
  const yS = (v: number) => top + h - ((v - vMin) / vRange) * h;
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${f(xS(p.ts))},${f(yS(p.v))}`)
    .join(" ");
}

/** Build step-after waveform path for device states using speed as height. */
function stepPath(
  states: Array<{ ts: number; on: boolean; speed: number }>,
  t0: number,
  dur: number,
  cw: number,
  onY: number,
  offY: number,
  padL: number,
): string {
  if (states.length === 0 || dur === 0) return "";
  const xS = (t: number) => padL + ((t - t0) / dur) * cw;
  // Map state+speed to Y position.
  // OFF always sits on offY. ON states are mapped by speed, with a small
  // minimum visible lift so ON at 0% still differs from OFF.
  const yS = (on: boolean, speed: number) => {
    if (!on) return offY;
    const normalizedSpeed = Math.max(0, Math.min(100, speed));
    const visibleSpeed = normalizedSpeed > 0 ? normalizedSpeed : 12;
    return offY - ((visibleSpeed / 100) * (offY - onY));
  };

  let d = `M${f(xS(states[0].ts))},${f(yS(states[0].on, states[0].speed))}`;
  for (let i = 1; i < states.length; i++) {
    const x = xS(states[i].ts);
    const prevY = yS(states[i - 1].on, states[i - 1].speed);
    const curY = yS(states[i].on, states[i].speed);
    // Step-after: horizontal to new X, then vertical to new Y
    d += ` L${f(x)},${f(prevY)}`;
    if (Math.abs(curY - prevY) > 0.1) d += ` L${f(x)},${f(curY)}`;
  }
  return d;
}

/** Close the step waveform path into a fill area reaching the offY baseline. */
function stepFillPath(
  linePath: string,
  states: Array<{ ts: number; on: boolean; speed: number }>,
  t0: number,
  dur: number,
  cw: number,
  offY: number,
  padL: number,
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
  showSensorOverlay = true,
  visible = { temperature: true, humidity: true, vpd: true },
  width: forcedWidth,
  className,
}: DeviceWaveformChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Device list ────────────────────────────────────────────────────────────
  const deviceNames = useMemo(
    () => Object.keys(deviceStateData).sort(),
    [deviceStateData],
  );

  // Debug: Log device state data to console
  useEffect(() => {
    if (Object.keys(deviceStateData).length > 0) {
      console.log('[DeviceWaveformChart] Received data:', deviceStateData);
      for (const [name, points] of Object.entries(deviceStateData)) {
        const speeds = points.map(p => p.speed);
        console.log(`[DeviceWaveformChart] ${name}: ${points.length} points, speeds: [${speeds.join(', ')}]`);
      }
    }
  }, [deviceStateData]);

  // ── Time domain ────────────────────────────────────────────────────────────
  // Use sensor data as the primary time domain so waveform aligns with the
  // sensor chart.  Device state timestamps can extend beyond the visible
  // sensor range (e.g. enriched data starts 24h ago while live data covers
  // only a few minutes) — so we clip to the sensor range when available.
  const { t0, t1, dur } = useMemo(() => {
    // Sensor data time bounds (authoritative range for alignment)
    let sLo = Infinity;
    let sHi = -Infinity;
    for (const pt of sensorData) {
      const t = new Date(pt.timestamp).getTime();
      if (t < sLo) sLo = t;
      if (t > sHi) sHi = t;
    }

    // Device state data range
    let lo = Infinity;
    let hi = -Infinity;
    for (const pts of Object.values(deviceStateData)) {
      for (const pt of pts) {
        const t = new Date(pt.timestamp).getTime();
        if (t < lo) lo = t;
        if (t > hi) hi = t;
      }
    }

    // Prefer sensor range for crosshair sync only when it is sufficiently wide.
    // If sensor data is too narrow (e.g. only 1-2 recent points), it hides
    // meaningful device transitions. In that case, use device history range.
    if (sLo !== Infinity && sHi !== -Infinity && sHi > sLo) {
      const sensorDur = sHi - sLo;
      const hasDeviceRange = lo !== Infinity && hi !== -Infinity && hi > lo;

      if (!hasDeviceRange) {
        return { t0: sLo, t1: sHi, dur: sensorDur };
      }

      const deviceDur = hi - lo;
      const sensorTooNarrow = sensorDur < 10 * 60 * 1000;
      const muchNarrowerThanDevice = sensorDur < deviceDur * 0.2;

      if (sensorTooNarrow || muchNarrowerThanDevice) {
        return { t0: lo, t1: hi, dur: deviceDur };
      }

      return { t0: sLo, t1: sHi, dur: sensorDur };
    }

    // Fallback: use device range
    if (lo === Infinity) {
      const now = Date.now();
      return { t0: now - 3_600_000, t1: now, dur: 3_600_000 };
    }
    return { t0: lo, t1: hi, dur: hi - lo };
  }, [sensorData, deviceStateData]);

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const P = CHART_PAD;
  const chartW = (forcedWidth ?? 800) - P.left - P.right;
  const hasSensorOverlay = showSensorOverlay && sensorData.length >= 2;
  const devBaseY = hasSensorOverlay ? SENSOR_OVERLAY_H + 10 : 6;
  const totalH =
    devBaseY + deviceNames.length * (WAVE_H + ROW_GAP) + 8;

  // ── Sensor overlay lines ───────────────────────────────────────────────────
  const overlayPaths = useMemo(() => {
    if (!hasSensorOverlay || dur === 0) return [];
    return OVERLAY_METRICS.filter((m) => visible[m.key])
      .map((m) => {
        const raw = sensorData
          .map((d) => ({
            ts: new Date(d.timestamp).getTime(),
            v: d[m.key],
          }))
          .filter((r): r is { ts: number; v: number } => r.v != null);
        if (raw.length < 2) return null;
        const vals = raw.map((r) => r.v);
        let lo = Infinity;
        let hi = -Infinity;
        for (const v of vals) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const pad = (hi - lo) * 0.15 || 1;
        return {
          color: m.color,
          d: sensorLine(
            raw,
            t0,
            dur,
            chartW,
            lo - pad,
            hi + pad,
            2,
            SENSOR_OVERLAY_H - 4,
            P.left,
          ),
        };
      })
      .filter(Boolean) as Array<{ color: string; d: string }>;
  }, [sensorData, visible, t0, dur, chartW, hasSensorOverlay, P.left]);

  // ── Device waveform data ───────────────────────────────────────────────────
  const deviceWaves = useMemo(() => {
    if (dur === 0) return [];
    return deviceNames.map((name, idx) => {
      const raw = deviceStateData[name] || [];
      const sorted = [...raw]
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime(),
        )
        .map((s) => ({
          ts: new Date(s.timestamp).getTime(),
          on: s.state,
          speed: s.speed,
        }));

      // Extend to start of time domain using first known state
      // This ensures the waveform spans the full visible range
      if (sorted.length > 0 && sorted[0].ts > t0) {
        sorted.unshift({ ...sorted[0], ts: t0 });
      }

      // Extend to end of time domain for a clean trailing edge
      if (
        sorted.length > 0 &&
        sorted[sorted.length - 1].ts < t1
      ) {
        sorted.push({ ...sorted[sorted.length - 1], ts: t1 });
      }

      const yBase = devBaseY + idx * (WAVE_H + ROW_GAP);
      const onY = yBase + 7;
      const offY = yBase + WAVE_H - 7;
      const color = getDeviceColor(name);

      const wPath = stepPath(sorted, t0, dur, chartW, onY, offY, P.left);
      const fPath = stepFillPath(
        wPath,
        sorted,
        t0,
        dur,
        chartW,
        offY,
        P.left,
      );

      // Current state at hover
      let hoverState: { on: boolean; speed: number } | null = null;
      if (hoverTimestamp) {
        const hts = new Date(hoverTimestamp).getTime();
        let last = { on: false, speed: 0 };
        for (const s of sorted) {
          if (s.ts <= hts) last = { on: s.on, speed: s.speed };
          else break;
        }
        hoverState = last;
      }

      return { name, color, yBase, onY, offY, wPath, fPath, hoverState };
    });
  }, [
    deviceNames,
    deviceStateData,
    t0,
    t1,
    dur,
    chartW,
    P.left,
    devBaseY,
    hoverTimestamp,
  ]);

  // ── Hover X position ──────────────────────────────────────────────────────
  const hoverX = useMemo(() => {
    if (!hoverTimestamp || dur === 0) return null;
    const ts = new Date(hoverTimestamp).getTime();
    // Clamp to visible range instead of rejecting - allows crosshair sync
    // even when sensor chart has slightly different time bounds
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
    [onHover, t0, dur, chartW, P.left],
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
          className,
        )}
      >
        No device activity data
      </div>
    );
  }

  // ── Time labels ────────────────────────────────────────────────────────────
  const tCount = Math.min(7, Math.max(3, Math.floor(chartW / 100)));
  const tLabels: Array<{ x: number; text: string }> = [];
  for (let i = 0; i <= tCount; i++) {
    const t = t0 + (dur * i) / tCount;
    const d = new Date(t);
    if (!isValid(d)) continue;
    let text: string;
    if (dur <= 86_400_000) text = format(d, "h:mm a");
    else if (dur <= 604_800_000) text = format(d, "EEE");
    else text = format(d, "MMM d");
    tLabels.push({ x: P.left + (chartW * i) / tCount, text });
  }

  // ── Hover time label ───────────────────────────────────────────────────────
  let hoverTimeStr = "";
  if (hoverTimestamp) {
    const d = new Date(hoverTimestamp);
    if (isValid(d)) hoverTimeStr = format(d, "MMM d, h:mm a");
  }

  const svgWidth = (forcedWidth ?? 800);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn("relative select-none", className)}
    >
      <svg
        ref={svgRef}
        width={svgWidth}
        height={totalH + 22}
        className="block"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {/* ── Mini sensor overlay (ghosted) ── */}
        {hasSensorOverlay && (
          <g opacity={0.28}>
            {overlayPaths.map((op, i) => (
              <path
                key={i}
                d={op.d}
                fill="none"
                stroke={op.color}
                strokeWidth={1}
                opacity={0.65}
              />
            ))}
          </g>
        )}

        {/* ── Separator ── */}
        <line
          x1={P.left}
          y1={devBaseY - 4}
          x2={P.left + chartW}
          y2={devBaseY - 4}
          stroke="hsl(var(--border))"
          strokeOpacity={0.35}
          strokeWidth={0.5}
        />

        {/* ── Device waveform rows ── */}
        {deviceWaves.map((dw, idx) => (
          <g key={dw.name}>
            {/* Left end item name label */}
            <text
              x={P.left - 10}
              y={dw.yBase + WAVE_H / 2 + 3}
              fill={dw.color}
              fontSize="10"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
              opacity={0.85}
            >
              {dw.name.toUpperCase()}
            </text>

            {/* Row background stripe for visibility - BOLDER */}
            <rect
              x={P.left}
              y={dw.yBase}
              width={chartW}
              height={WAVE_H}
              fill={idx % 2 === 0 ? "hsl(var(--muted))" : "transparent"}
              opacity={0.25}
            />

            {/* ON / OFF reference lines - more visible */}
            <line
              x1={P.left}
              y1={dw.onY}
              x2={P.left + chartW}
              y2={dw.onY}
              stroke="hsl(var(--border))"
              strokeOpacity={0.3}
              strokeDasharray="4 4"
            />
            <line
              x1={P.left}
              y1={dw.offY}
              x2={P.left + chartW}
              y2={dw.offY}
              stroke="hsl(var(--border))"
              strokeOpacity={0.3}
              strokeDasharray="4 4"
            />

            {/* Speed scale labels - 100% at top, 0% at bottom */}
            <text
              x={P.left - 5}
              y={dw.onY + 3}
              fill="#22c55e"
              fontSize="8"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
              fontWeight="600"
              opacity={0.8}
            >
              100
            </text>
            <text
              x={P.left - 5}
              y={dw.offY + 3}
              fill="hsl(var(--muted-foreground))"
              fontSize="8"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
              fontWeight="600"
              opacity={0.6}
            >
              0
            </text>

            {/* Solid fill under waveform - BOLD AC Infinity style */}
            {dw.fPath && (
              <path d={dw.fPath} fill={dw.color} opacity={0.6} />
            )}

            {/* Step waveform line - THICK and highly visible */}
            {dw.wPath && (
              <path
                d={dw.wPath}
                fill="none"
                stroke={dw.color}
                strokeWidth={3}
                opacity={1}
              />
            )}

            {/* Row separator */}
            {idx < deviceWaves.length - 1 && (
              <line
                x1={P.left}
                y1={dw.yBase + WAVE_H}
                x2={P.left + chartW}
                y2={dw.yBase + WAVE_H}
                stroke="hsl(var(--border))"
                strokeOpacity={0.12}
              />
            )}

            {/* Right end item name label */}
            <text
              x={P.left + chartW - RIGHT_LABEL_INSET}
              y={dw.yBase + WAVE_H / 2 + 3}
              fill={dw.color}
              fontSize="10"
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
              opacity={0.85}
            >
              {dw.name.toUpperCase()}
            </text>

            {/* Current state indicator (right side) - always visible */}
            {(() => {
              // Get current state (last point in the device state array)
              const devicePoints = deviceStateData[dw.name] || [];
              const lastPoint = devicePoints[devicePoints.length - 1];
              const currentOn = lastPoint?.state ?? false;
              const currentSpeed = lastPoint?.speed ?? 0;

              // Show hovered state if hovering, otherwise show current state
              const displayOn = dw.hoverState ? dw.hoverState.on : currentOn;
              const displaySpeed = dw.hoverState ? dw.hoverState.speed : currentSpeed;

              return (
                <text
                  x={P.left + chartW - RIGHT_LABEL_INSET}
                  y={dw.yBase + WAVE_H / 2 + 15}
                  fill={displayOn ? "#22c55e" : "hsl(var(--muted-foreground))"}
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="600"
                  opacity={displayOn ? 1 : 0.5}
                >
                  {displayOn ? `${displaySpeed}%` : "OFF"}
                </text>
              );
            })()}
          </g>
        ))}

        {/* ── Hover crosshair ── */}
        {hoverX !== null && (
          <line
            x1={hoverX}
            y1={0}
            x2={hoverX}
            y2={totalH}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.22}
          />
        )}

        {/* ── Time axis labels ── */}
        {tLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={totalH + 14}
            fill="hsl(var(--muted-foreground))"
            fontSize="10"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            opacity={0.45}
          >
            {l.text}
          </text>
        ))}
      </svg>

      {/* ── Hover timestamp badge ── */}
      {hoverX !== null && hoverTimeStr && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${hoverX}px`,
            bottom: "2px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-card/90 backdrop-blur-sm border border-border/50 rounded px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground whitespace-nowrap">
            {hoverTimeStr}
          </div>
        </div>
      )}
    </div>
  );
});

// Re-export types for compatibility
export type { DeviceStateData };

// Legacy tooltip component (maintained for backward compat)
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
        className,
      )}
    >
      <div className="text-[10px] text-muted-foreground mb-2 font-mono">
        {timeStr}
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
                state
                  ? "text-green-500"
                  : "text-muted-foreground",
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
