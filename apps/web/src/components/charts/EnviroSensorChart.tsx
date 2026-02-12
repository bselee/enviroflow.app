"use client";

/**
 * EnviroSensorChart — Custom SVG Sensor Chart
 *
 * AC Infinity-inspired environmental data visualization featuring:
 * - Smooth monotone cubic spline curves (Catmull-Rom)
 * - Gradient area fills with soft glow on lines
 * - Independent auto-scaling per metric
 * - MIN/MAX annotation bar
 * - Hover crosshair with intersection dots
 * - Floating tooltip
 * - Dual Y-axes (primary left, secondary right)
 * - Responsive via parent-supplied width
 */

import { useMemo, useCallback, useRef, memo } from "react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type { TimeRange } from "@/components/dashboard/IntelligentTimeline";

// =============================================================================
// Types
// =============================================================================

export interface ChartDataPoint {
  _ts: number;
  timestamp: string;
  temperature?: number;
  humidity?: number;
  vpd?: number;
}

export interface VisibleMetrics {
  temperature: boolean;
  humidity: boolean;
  vpd: boolean;
}

export interface EnviroSensorChartProps {
  data: ChartDataPoint[];
  width: number;
  height: number;
  visible: VisibleMetrics;
  hoverTimestamp: string | null;
  onHoverChange: (timestamp: string | null) => void;
  timeRange: TimeRange;
  tempUnit: "C" | "F";
  convertTemp: (val: number) => number;
}

// =============================================================================
// Constants
// =============================================================================

/** Chart padding — shared with DeviceWaveformChart for alignment */
export const CHART_PAD = { top: 28, right: 54, bottom: 32, left: 46 };

interface MetricDef {
  color: string;
  label: string;
  unit: string;
  short: string;
  decimals: number;
}

const METRICS: Record<string, MetricDef> = {
  temperature: { color: "#ef4444", label: "Temperature", unit: "°", short: "Temp", decimals: 1 },
  humidity:    { color: "#4fc3f7", label: "Humidity",    unit: "%", short: "Humi", decimals: 1 },
  vpd:         { color: "#b388ff", label: "VPD",         unit: " kPa", short: "VPD", decimals: 2 },
};

// =============================================================================
// Geometry helpers
// =============================================================================

interface Pt { x: number; y: number }

function n(v: number): string { return v.toFixed(1); }

/**
 * Catmull-Rom smooth path through points.
 * Tension 0.25 gives smooth curves without overshooting.
 */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${n(pts[0].x)},${n(pts[0].y)}`;
  if (pts.length === 2)
    return `M${n(pts[0].x)},${n(pts[0].y)}L${n(pts[1].x)},${n(pts[1].y)}`;

  const T = 0.25;
  let d = `M${n(pts[0].x)},${n(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${n(p1.x + (p2.x - p0.x) * T)},${n(p1.y + (p2.y - p0.y) * T)},`
       + `${n(p2.x - (p3.x - p1.x) * T)},${n(p2.y - (p3.y - p1.y) * T)},`
       + `${n(p2.x)},${n(p2.y)}`;
  }
  return d;
}

/** Close a line path into a filled area reaching the chart bottom. */
function closedArea(line: string, pts: Pt[], bottom: number): string {
  if (pts.length < 2) return "";
  return `${line} L${n(pts[pts.length - 1].x)},${n(bottom)} L${n(pts[0].x)},${n(bottom)} Z`;
}

/** Auto-scale domain with padding and minimum spread. */
function autoDomain(values: number[], pad = 0.12, minSpread = 5) {
  if (values.length === 0) return { lo: 0, hi: 100 };
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const r = hi - lo;
  if (r < minSpread) {
    const mid = (lo + hi) / 2;
    return { lo: mid - minSpread / 2, hi: mid + minSpread / 2 };
  }
  return { lo: lo - r * pad, hi: hi + r * pad };
}

/** Binary-search for nearest data point index. */
function nearest(data: ChartDataPoint[], ts: number): number {
  if (data.length === 0) return -1;
  let lo = 0, hi = data.length - 1;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (data[m]._ts <= ts) lo = m; else hi = m;
  }
  return Math.abs(data[lo]._ts - ts) <= Math.abs(data[hi]._ts - ts) ? lo : hi;
}

// =============================================================================
// Component
// =============================================================================

export const EnviroSensorChart = memo(function EnviroSensorChart({
  data, width, height, visible, hoverTimestamp, onHoverChange,
  timeRange, tempUnit, convertTemp,
}: EnviroSensorChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const P = CHART_PAD;
  const cw = width - P.left - P.right;
  const ch = height - P.top - P.bottom;

  // ── Data geometry ──────────────────────────────────────────────────────────
  const chart = useMemo(() => {
    if (data.length === 0 || cw <= 0 || ch <= 0) return null;
    const t0 = data[0]._ts;
    const t1 = data[data.length - 1]._ts;
    const dur = t1 - t0;

    // Handle single-point or zero-duration: show a 1-hour window centred on the point
    const singlePoint = dur === 0;
    const effectiveT0 = singlePoint ? t0 - 1_800_000 : t0;  // 30min before
    const effectiveT1 = singlePoint ? t1 + 1_800_000 : t1;  // 30min after
    const effectiveDur = effectiveT1 - effectiveT0;

    const xS = (t: number) => P.left + ((t - effectiveT0) / effectiveDur) * cw;

    type MetricEntry = {
      key: string;
      pts: Pt[];
      line: string;
      area: string;
      scale: { lo: number; hi: number };
      stats: { min: number; max: number; avg: number; cur: number };
    };

    const entries: Record<string, MetricEntry> = {};

    for (const key of ["temperature", "humidity", "vpd"] as const) {
      if (!visible[key]) continue;
      const raw: { ts: number; v: number }[] = [];
      for (const d of data) {
        const v = d[key];
        if (v != null) raw.push({ ts: d._ts, v });
      }
      if (raw.length === 0) continue;

      const vals = raw.map((r) => r.v);
      const ms = key === "vpd" ? 0.5 : key === "humidity" ? 10 : 5;
      const scale = autoDomain(vals, 0.12, ms);
      if (key === "humidity") { scale.lo = Math.max(0, scale.lo); scale.hi = Math.min(100, scale.hi); }
      if (key === "vpd") { scale.lo = Math.max(0, scale.lo); }

      const yS = (v: number) => P.top + ch - ((v - scale.lo) / (scale.hi - scale.lo)) * ch;
      const pts = raw.map((r) => ({ x: xS(r.ts), y: yS(r.v) }));

      const line = smoothPath(pts);
      const area = closedArea(line, pts, P.top + ch);

      let sum = 0, lo2 = Infinity, hi2 = -Infinity;
      for (const v of vals) { sum += v; if (v < lo2) lo2 = v; if (v > hi2) hi2 = v; }

      entries[key] = {
        key,
        pts,
        line,
        area,
        scale,
        stats: { min: lo2, max: hi2, avg: sum / vals.length, cur: vals[vals.length - 1] },
      };
    }

    // Time labels
    const tCount = Math.min(7, Math.max(3, Math.floor(cw / 100)));
    const tLabels: { x: number; text: string }[] = [];
    for (let i = 0; i <= tCount; i++) {
      const t = effectiveT0 + (effectiveDur * i) / tCount;
      const d = new Date(t);
      if (!isValid(d)) continue;
      let text: string;
      if (effectiveDur <= 86_400_000) text = format(d, "h:mm a");
      else if (effectiveDur <= 604_800_000) text = format(d, "EEE ha");
      else text = format(d, "MMM d");
      tLabels.push({ x: P.left + (cw * i) / tCount, text });
    }

    return { entries, t0: effectiveT0, t1: effectiveT1, dur: effectiveDur, xS, tLabels };
  }, [data, visible, cw, ch, P]);

  // ── Hover index ────────────────────────────────────────────────────────────
  const hoverIdx = useMemo(() => {
    if (!hoverTimestamp || !chart) return null;
    const ts = new Date(hoverTimestamp).getTime();
    if (isNaN(ts)) return null;
    const idx = nearest(data, ts);
    return idx >= 0 ? idx : null;
  }, [hoverTimestamp, data, chart]);

  const hoverPt = hoverIdx !== null ? data[hoverIdx] : null;

  // ── Mouse ──────────────────────────────────────────────────────────────────
  const handleMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (!svgRef.current || !chart) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = (x - P.left) / cw;
      if (ratio < -0.01 || ratio > 1.01) { onHoverChange(null); return; }
      const ts = chart.t0 + Math.max(0, Math.min(1, ratio)) * chart.dur;
      const idx = nearest(data, ts);
      if (idx >= 0) onHoverChange(data[idx].timestamp);
    },
    [data, chart, cw, P.left, onHoverChange],
  );

  const handleLeave = useCallback(() => onHoverChange(null), [onHoverChange]);

  // ── Derived ────────────────────────────────────────────────────────────────
  if (!chart || cw <= 0 || ch <= 0) return null;

  const { entries, xS, tLabels } = chart;
  const keys = Object.keys(entries);
  if (keys.length === 0) return null;

  // Primary Y-axis (left) — temperature > humidity > vpd
  const primaryKey = entries.temperature ? "temperature" : entries.humidity ? "humidity" : "vpd";
  const primaryEntry = entries[primaryKey];
  // Secondary Y-axis (right) — VPD if not primary
  const secKey = primaryKey !== "vpd" && entries.vpd ? "vpd" : null;
  const secEntry = secKey ? entries[secKey] : null;

  // Y-axis labels
  const buildYLabels = (
    entry: typeof primaryEntry,
    key: string,
    count: number,
  ) => {
    if (!entry) return [];
    const out: { y: number; text: string }[] = [];
    for (let i = 0; i <= count; i++) {
      const ratio = i / count;
      const v = entry.scale.lo + (entry.scale.hi - entry.scale.lo) * ratio;
      const y = P.top + ch - ch * ratio;
      let text: string;
      if (key === "temperature") text = `${Math.round(convertTemp(v))}°`;
      else if (key === "humidity") text = `${Math.round(v)}%`;
      else text = v.toFixed(1);
      out.push({ y, text });
    }
    return out;
  };
  const yLeft = buildYLabels(primaryEntry, primaryKey, 5);
  const yRight = secEntry ? buildYLabels(secEntry, secKey!, 5) : [];

  // Format metric value for annotation/tooltip
  const fmtVal = (key: string, v: number): string => {
    if (key === "temperature") return `${convertTemp(v).toFixed(1)}°${tempUnit}`;
    if (key === "humidity") return `${v.toFixed(1)}%`;
    return `${v.toFixed(2)} kPa`;
  };

  // Annotation bar entries
  const annot = keys.map((k) => ({
    key: k,
    color: METRICS[k].color,
    min: fmtVal(k, entries[k].stats.min),
    max: fmtVal(k, entries[k].stats.max),
  }));

  // Hover X
  const hoverX = hoverPt ? xS(hoverPt._ts) : null;

  // Hover dots
  const hoverDots: { x: number; y: number; color: string }[] = [];
  if (hoverPt && hoverX !== null) {
    for (const k of keys) {
      const v = hoverPt[k as keyof ChartDataPoint] as number | undefined;
      if (v == null) continue;
      const e = entries[k];
      const y = P.top + ch - ((v - e.scale.lo) / (e.scale.hi - e.scale.lo)) * ch;
      hoverDots.push({ x: hoverX, y, color: METRICS[k].color });
    }
  }

  // Hover tooltip time
  let hoverTimeStr = "";
  if (hoverPt) {
    const d = new Date(hoverPt._ts);
    if (isValid(d)) hoverTimeStr = format(d, "MMM d, h:mm a");
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="block select-none"
      >
        <defs>
          {/* Gradient fills */}
          {keys.map((k) => (
            <linearGradient key={`g-${k}`} id={`efg-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={METRICS[k].color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={METRICS[k].color} stopOpacity={0.01} />
            </linearGradient>
          ))}
          {/* Glow filter */}
          <filter id="ef-glow">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Annotation bar (MIN / MAX) ── */}
        <text
          x={P.left}
          y={14}
          fill="hsl(var(--muted-foreground))"
          fontSize="9.5"
          fontFamily="ui-monospace, monospace"
          opacity={0.55}
        >
          {annot.map((a) => `MIN ${a.min}`).join("  ·  ")}
        </text>
        <text
          x={P.left + cw}
          y={14}
          fill="hsl(var(--muted-foreground))"
          fontSize="9.5"
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          opacity={0.55}
        >
          {annot.map((a) => `MAX ${a.max}`).join("  ·  ")}
        </text>

        {/* ── Grid lines ── */}
        {yLeft.map((l, i) => (
          <line
            key={`g${i}`}
            x1={P.left}
            y1={l.y}
            x2={P.left + cw}
            y2={l.y}
            stroke="hsl(var(--border))"
            strokeOpacity={0.25}
          />
        ))}

        {/* ── Area fills ── */}
        {keys.map((k) => (
          <path key={`a-${k}`} d={entries[k].area} fill={`url(#efg-${k})`} />
        ))}

        {/* ── Lines with glow ── */}
        {keys.map((k) => (
          <path
            key={`l-${k}`}
            d={entries[k].line}
            fill="none"
            stroke={METRICS[k].color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#ef-glow)"
            opacity={0.88}
          />
        ))}

        {/* ── Single-point dots (when only 1 data point per metric) ── */}
        {keys.map((k) => {
          const e = entries[k];
          if (e.pts.length !== 1) return null;
          return (
            <g key={`sp-${k}`}>
              <circle
                cx={e.pts[0].x}
                cy={e.pts[0].y}
                r={6}
                fill={METRICS[k].color}
                opacity={0.2}
              />
              <circle
                cx={e.pts[0].x}
                cy={e.pts[0].y}
                r={4}
                fill="hsl(var(--background))"
                stroke={METRICS[k].color}
                strokeWidth={2}
              />
              {/* Pulsing ring for single point */}
              <circle
                cx={e.pts[0].x}
                cy={e.pts[0].y}
                r={8}
                fill="none"
                stroke={METRICS[k].color}
                strokeWidth={1}
                opacity={0.4}
              >
                <animate
                  attributeName="r"
                  values="4;12"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.5;0"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}

        {/* ── Left Y-axis labels ── */}
        {yLeft.map((l, i) => (
          <text
            key={`yl${i}`}
            x={P.left - 6}
            y={l.y + 3.5}
            fill={METRICS[primaryKey].color}
            fontSize="10"
            textAnchor="end"
            fontFamily="ui-monospace, monospace"
            opacity={0.6}
          >
            {l.text}
          </text>
        ))}

        {/* ── Right Y-axis labels ── */}
        {yRight.map((l, i) => (
          <text
            key={`yr${i}`}
            x={P.left + cw + 8}
            y={l.y + 3.5}
            fill={METRICS[secKey!].color}
            fontSize="10"
            fontFamily="ui-monospace, monospace"
            opacity={0.45}
          >
            {l.text}
          </text>
        ))}

        {/* ── Time labels ── */}
        {tLabels.map((l, i) => (
          <text
            key={`t${i}`}
            x={l.x}
            y={P.top + ch + 20}
            fill="hsl(var(--muted-foreground))"
            fontSize="10"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            opacity={0.55}
          >
            {l.text}
          </text>
        ))}

        {/* ── Hover crosshair ── */}
        {hoverX !== null && (
          <line
            x1={hoverX}
            y1={P.top}
            x2={hoverX}
            y2={P.top + ch}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.35}
          />
        )}

        {/* ── Hover dots ── */}
        {hoverDots.map((dot, i) => (
          <g key={`hd${i}`}>
            <circle cx={dot.x} cy={dot.y} r={5} fill={dot.color} opacity={0.25} />
            <circle cx={dot.x} cy={dot.y} r={4} fill="hsl(var(--background))" strokeWidth={2} stroke={dot.color} />
          </g>
        ))}

        {/* ── Hit area ── */}
        <rect
          x={P.left}
          y={P.top}
          width={Math.max(0, cw)}
          height={Math.max(0, ch)}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        />
      </svg>

      {/* ── Floating tooltip ── */}
      {hoverPt && (
        <div className="absolute top-3 right-3 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-3 min-w-[175px] pointer-events-none z-20">
          <div className="text-[10px] text-muted-foreground mb-2 font-mono border-b border-border/40 pb-1.5">
            {hoverTimeStr}
          </div>
          <div className="space-y-1.5">
            {keys.map((k) => {
              const v = hoverPt[k as keyof ChartDataPoint] as number | undefined;
              if (v == null) return null;
              return (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: METRICS[k].color }} />
                  <span className="text-[11px] text-muted-foreground flex-1">{METRICS[k].short}</span>
                  <span
                    className="text-[13px] font-semibold font-mono"
                    style={{ color: METRICS[k].color }}
                  >
                    {fmtVal(k, v)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default EnviroSensorChart;
