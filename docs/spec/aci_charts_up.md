import { useState, useEffect, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// EnviroFlow — Enhanced Sensor Charts v2
// AC Infinity-accurate device activity waveform
// ═══════════════════════════════════════════════════════════════

// --- Data Generation ---
const generateTimeSeriesData = (hours, intervalMinutes = 1) => {
  const now = new Date();
  const points = [];
  const totalPoints = (hours * 60) / intervalMinutes;
  
  for (let i = 0; i < totalPoints; i++) {
    const time = new Date(now.getTime() - (totalPoints - i) * intervalMinutes * 60000);
    const hour = time.getHours();
    const isDaytime = hour >= 6 && hour < 22;
    const transitionSmooth = Math.sin(Math.max(0, Math.min(1, (hour - 6) / 16)) * Math.PI);
    
    const baseTemp = isDaytime ? 72 + transitionSmooth * 4 : 68 + Math.random() * 2;
    const temp = baseTemp + (Math.random() - 0.5) * 1.5 + Math.sin(i * 0.05) * 0.8;
    
    const baseHumidity = isDaytime ? 50 - transitionSmooth * 4 : 48 + Math.random() * 4;
    const humidity = baseHumidity + (Math.random() - 0.5) * 3 + Math.sin(i * 0.03) * 1.5;
    
    const tempC = (temp - 32) * 5 / 9;
    const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    const vpd = svp * (1 - humidity / 100);
    
    points.push({
      time: time.toISOString(),
      timestamp: time.getTime(),
      temp: Math.round(temp * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      vpd: Math.round(vpd * 100) / 100,
    });
  }
  return points;
};

const generateDeviceData = (hours, intervalMinutes = 1) => {
  const now = new Date();
  const totalPoints = (hours * 60) / intervalMinutes;
  const devices = {
    "Exhaust Fan": { color: "#3b82f6", states: [] },
    "Humidifier": { color: "#06b6d4", states: [] },
    "Heater": { color: "#ef4444", states: [] },
    "Circ Fan": { color: "#8b5cf6", states: [] },
  };

  Object.keys(devices).forEach(name => {
    let isOn = Math.random() > 0.5;
    let cycleLength = name === "Circ Fan" ? 15 : 30 + Math.floor(Math.random() * 60);
    let counter = Math.floor(Math.random() * cycleLength);

    for (let i = 0; i < totalPoints; i++) {
      const time = new Date(now.getTime() - (totalPoints - i) * intervalMinutes * 60000);
      counter++;
      if (counter >= cycleLength) {
        isOn = !isOn;
        counter = 0;
        cycleLength = name === "Circ Fan"
          ? 10 + Math.floor(Math.random() * 20)
          : 20 + Math.floor(Math.random() * 80);
      }
      devices[name].states.push({
        time: time.toISOString(),
        timestamp: time.getTime(),
        on: isOn,
      });
    }
  });
  return devices;
};

const downsample = (data, maxPoints) => {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const result = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(data[Math.floor(i * step)]);
  }
  result[result.length - 1] = data[data.length - 1];
  return result;
};

const calcStats = (data, key) => {
  const values = data.map(d => d[key]);
  return {
    min: Math.round(Math.min(...values) * 10) / 10,
    max: Math.round(Math.max(...values) * 10) / 10,
    avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
  };
};

// ═══════════════════════════════════════
// TIME RANGE CONFIG
// ═══════════════════════════════════════
const TIME_RANGES = [
  { label: "1H", hours: 1, interval: 1, desc: "1 min intervals" },
  { label: "6H", hours: 6, interval: 2, desc: "2 min intervals" },
  { label: "24H", hours: 24, interval: 5, desc: "5 min intervals" },
  { label: "1D", hours: 24, interval: 5, desc: "5 min intervals" },
  { label: "7D", hours: 168, interval: 30, desc: "30 min intervals" },
  { label: "30D", hours: 720, interval: 120, desc: "2 hr intervals" },
  { label: "60D", hours: 1440, interval: 240, desc: "4 hr intervals" },
];

// ═══════════════════════════════════════
// THEME
// ═══════════════════════════════════════
const C = {
  bg: "#080c12",
  surface: "#0d1218",
  panel: "#111820",
  border: "rgba(255,255,255,0.06)",
  borderHi: "rgba(255,255,255,0.12)",
  text: "#e6edf3",
  dim: "#7d8590",
  muted: "#484f58",
  temp: "#f97066",
  humidity: "#7cc4fa",
  vpd: "#a78bfa",
  accent: "#58a6ff",
  on: "#3fb950",
  off: "#21262d",
};

const METRICS = {
  temp: { label: "Temperature", unit: "°F", color: C.temp, short: "Temp" },
  humidity: { label: "Humidity", unit: "%", color: C.humidity, short: "Humi" },
  vpd: { label: "VPD", unit: "kPa", color: C.vpd, short: "VPD" },
};

// ═══════════════════════════════════════
// SENSOR CHART (top chart)
// ═══════════════════════════════════════
const SensorChart = ({ data, width, height, visible, hoverIdx, setHoverIdx }) => {
  const pad = { top: 24, right: 56, bottom: 28, left: 48 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;
  if (!data.length || cw <= 0) return null;

  const scales = {};
  Object.keys(METRICS).forEach(k => {
    if (!visible[k]) return;
    const vals = data.map(d => d[k]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const p = (mx - mn) * 0.12 || 1;
    scales[k] = { min: mn - p, max: mx + p };
  });

  const t0 = data[0].timestamp, t1 = data[data.length - 1].timestamp;
  const xS = (t) => pad.left + ((t - t0) / (t1 - t0)) * cw;
  const yS = (v, k) => {
    const s = scales[k]; if (!s) return 0;
    return pad.top + ch - ((v - s.min) / (s.max - s.min)) * ch;
  };

  const mkPath = (k) => {
    if (!visible[k]) return null;
    const pts = data.map(d => ({ x: xS(d.timestamp), y: yS(d[k], k) }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    const area = line + ` L${pts[pts.length-1].x},${pad.top+ch} L${pts[0].x},${pad.top+ch} Z`;
    return { line, area, pts };
  };

  const paths = {};
  Object.keys(METRICS).forEach(k => { paths[k] = mkPath(k); });

  // Time labels
  const dur = t1 - t0;
  const tCount = Math.min(7, Math.max(3, Math.floor(cw / 110)));
  const tLabels = [];
  for (let i = 0; i <= tCount; i++) {
    const t = new Date(t0 + dur * i / tCount);
    let label;
    if (dur <= 86400000) label = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    else if (dur <= 604800000) label = t.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' });
    else label = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    tLabels.push({ x: pad.left + cw * i / tCount, label });
  }

  // Y labels
  const pKey = visible.temp ? 'temp' : visible.humidity ? 'humidity' : 'vpd';
  const yLabels = [];
  const yCount = 5;
  if (scales[pKey]) {
    for (let i = 0; i <= yCount; i++) {
      const v = scales[pKey].min + (scales[pKey].max - scales[pKey].min) * i / yCount;
      yLabels.push({
        y: pad.top + ch - ch * i / yCount,
        label: pKey === 'vpd' ? v.toFixed(2) : Math.round(v),
      });
    }
  }

  // Right axis for VPD when temp is primary
  const rLabels = [];
  if (pKey === 'temp' && visible.vpd && scales.vpd) {
    for (let i = 0; i <= yCount; i++) {
      const v = scales.vpd.min + (scales.vpd.max - scales.vpd.min) * i / yCount;
      rLabels.push({ y: pad.top + ch - ch * i / yCount, label: v.toFixed(2) });
    }
  }

  // Min/Max annotations (like AC Infinity top bar)
  const annotations = Object.entries(METRICS).filter(([k]) => visible[k]).map(([k, m]) => {
    const s = calcStats(data, k);
    return { key: k, color: m.color, unit: m.unit, ...s };
  });

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left - pad.left) / cw;
    const idx = Math.round(Math.max(0, Math.min(1, ratio)) * (data.length - 1));
    setHoverIdx(idx);
  };

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        {Object.entries(METRICS).map(([k, m]) => (
          <linearGradient key={k} id={`sg-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={m.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={m.color} stopOpacity="0.01" />
          </linearGradient>
        ))}
        <filter id="glo">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Min/Max annotation bar */}
      {annotations.map((a, i) => (
        <g key={a.key}>
          <text x={pad.left + i * (cw / annotations.length)} y={14}
            fill={C.muted} fontSize="10" fontFamily="'JetBrains Mono',monospace">
            MIN {a.min}{a.unit}
          </text>
          <text x={pad.left + (i + 1) * (cw / annotations.length) - 4} y={14}
            fill={C.muted} fontSize="10" textAnchor="end" fontFamily="'JetBrains Mono',monospace">
            MAX {a.max}{a.unit}
          </text>
        </g>
      ))}

      {/* Grid */}
      {yLabels.map((l, i) => (
        <g key={i}>
          <line x1={pad.left} y1={l.y} x2={pad.left+cw} y2={l.y} stroke={C.border} />
          <text x={pad.left-8} y={l.y+4} fill={C.muted} fontSize="10"
            textAnchor="end" fontFamily="'JetBrains Mono',monospace">
            {l.label}{pKey === 'temp' ? '°' : pKey === 'humidity' ? '%' : ''}
          </text>
        </g>
      ))}
      {rLabels.map((l, i) => (
        <text key={`r${i}`} x={pad.left+cw+8} y={l.y+4} fill={C.vpd} fontSize="10"
          opacity="0.6" fontFamily="'JetBrains Mono',monospace">{l.label}</text>
      ))}
      {tLabels.map((l, i) => (
        <text key={`t${i}`} x={l.x} y={pad.top+ch+18} fill={C.muted} fontSize="10"
          textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{l.label}</text>
      ))}

      {/* Area fills */}
      {Object.entries(paths).map(([k, p]) => p && (
        <path key={`a-${k}`} d={p.area} fill={`url(#sg-${k})`} />
      ))}
      {/* Lines */}
      {Object.entries(paths).map(([k, p]) => p && (
        <path key={`l-${k}`} d={p.line} fill="none" stroke={METRICS[k].color}
          strokeWidth="1.5" strokeLinejoin="round" filter="url(#glo)" opacity="0.85" />
      ))}

      {/* Hover crosshair */}
      {hoverIdx !== null && hoverIdx >= 0 && hoverIdx < data.length && (
        <g>
          <line x1={xS(data[hoverIdx].timestamp)} y1={pad.top}
            x2={xS(data[hoverIdx].timestamp)} y2={pad.top+ch}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3" />
          {Object.entries(paths).map(([k, p]) => p && p.pts[hoverIdx] && (
            <circle key={k} cx={p.pts[hoverIdx].x} cy={p.pts[hoverIdx].y}
              r="4" fill={METRICS[k].color} stroke={C.bg} strokeWidth="2" />
          ))}
        </g>
      )}

      <rect x={pad.left} y={pad.top} width={cw} height={ch}
        fill="transparent" cursor="crosshair"
        onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)} />
    </svg>
  );
};

// ═══════════════════════════════════════════════════
// DEVICE ACTIVITY CHART — AC Infinity Waveform Style
// ═══════════════════════════════════════════════════
const DeviceWaveformChart = ({ devices, sensorData, width, visible }) => {
  const pad = { left: 48, right: 56, top: 0, bottom: 24 };
  const cw = width - pad.left - pad.right;
  const waveHeight = 36; // height per device waveform
  const sensorOverlayH = 50; // mini sensor overlay at top
  const deviceNames = Object.keys(devices);
  const totalH = pad.top + sensorOverlayH + deviceNames.length * waveHeight + pad.bottom + 16;

  if (!sensorData.length || cw <= 0) return null;

  const t0 = sensorData[0].timestamp;
  const t1 = sensorData[sensorData.length - 1].timestamp;
  const dur = t1 - t0;
  const xS = (t) => pad.left + ((t - t0) / (t1 - t0)) * cw;

  // Mini sensor overlay (ghosted reference lines at the top, like AC Infinity)
  const sensorScales = {};
  Object.keys(METRICS).forEach(k => {
    if (!visible[k]) return;
    const vals = sensorData.map(d => d[k]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const p = (mx - mn) * 0.1 || 1;
    sensorScales[k] = { min: mn - p, max: mx + p };
  });
  
  const miniYS = (v, k) => {
    const s = sensorScales[k]; if (!s) return 0;
    return pad.top + sensorOverlayH - ((v - s.min) / (s.max - s.min)) * sensorOverlayH;
  };

  const sensorPaths = {};
  Object.keys(METRICS).forEach(k => {
    if (!visible[k] || !sensorScales[k]) return;
    const pts = sensorData.map(d => ({ x: xS(d.timestamp), y: miniYS(d[k], k) }));
    sensorPaths[k] = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  });

  // Min labels at top (like AC Infinity: "MIN 71.0°F / 47.0%" and "MIN 0.73kPa")
  const miniStats = Object.entries(METRICS).filter(([k]) => visible[k]).map(([k, m]) => {
    const s = calcStats(sensorData, k);
    return { key: k, ...m, ...s };
  });

  // Build step waveform path for each device (ON = up, OFF = down)
  const buildWaveform = (name, yBase) => {
    const states = devices[name].states;
    if (!states.length) return '';
    
    const onY = yBase + 4;      // ON position (top)
    const offY = yBase + waveHeight - 8; // OFF position (bottom)
    
    let path = '';
    let prevOn = states[0].on;
    let prevX = xS(states[0].timestamp);
    let prevY = prevOn ? onY : offY;
    path = `M${prevX},${prevY}`;
    
    for (let i = 1; i < states.length; i++) {
      const x = xS(states[i].timestamp);
      const isOn = states[i].on;
      
      if (isOn !== prevOn) {
        // Horizontal to current x at previous level
        path += ` L${x},${prevY}`;
        // Vertical step to new level
        const newY = isOn ? onY : offY;
        path += ` L${x},${newY}`;
        prevY = newY;
        prevOn = isOn;
      }
      prevX = x;
    }
    // Final horizontal to end
    path += ` L${xS(states[states.length-1].timestamp)},${prevY}`;
    
    return path;
  };

  // Day/time labels along bottom
  const tCount = Math.min(7, Math.max(3, Math.floor(cw / 110)));
  const tLabels = [];
  for (let i = 0; i <= tCount; i++) {
    const t = new Date(t0 + dur * i / tCount);
    let label;
    if (dur <= 86400000) label = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    else if (dur <= 604800000) label = t.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    else label = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    tLabels.push({ x: pad.left + cw * i / tCount, label });
  }

  const devBaseY = pad.top + sensorOverlayH + 8;

  return (
    <svg width={width} height={totalH} style={{ display: 'block' }}>
      <defs>
        {Object.entries(METRICS).map(([k, m]) => (
          <linearGradient key={`dg-${k}`} id={`dg-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={m.color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={m.color} stopOpacity="0.01" />
          </linearGradient>
        ))}
      </defs>

      {/* Mini sensor stats label bar */}
      <text x={pad.left} y={pad.top + 10} fill={C.muted} fontSize="9"
        fontFamily="'JetBrains Mono',monospace">
        {miniStats.map(s => `MIN ${s.min}${s.unit}`).join(' / ')}
      </text>
      <text x={pad.left + cw} y={pad.top + 10} fill={C.muted} fontSize="9"
        textAnchor="end" fontFamily="'JetBrains Mono',monospace">
        {miniStats.map(s => `MAX ${s.max}${s.unit}`).join(' / ')}
      </text>

      {/* Mini sensor overlay lines (ghosted) */}
      {Object.entries(sensorPaths).map(([k, path]) => (
        <path key={`mini-${k}`} d={path} fill="none"
          stroke={METRICS[k].color} strokeWidth="1" opacity="0.25" />
      ))}

      {/* Separator */}
      <line x1={pad.left} y1={devBaseY - 4} x2={pad.left+cw} y2={devBaseY - 4}
        stroke={C.borderHi} strokeWidth="0.5" />

      {/* ON / OFF labels on left side */}
      {deviceNames.map((name, idx) => {
        const yBase = devBaseY + idx * waveHeight;
        return (
          <g key={`labels-${name}`}>
            <text x={pad.left - 8} y={yBase + 12} fill={C.muted} fontSize="8"
              textAnchor="end" fontFamily="'JetBrains Mono',monospace">ON</text>
            <text x={pad.left - 8} y={yBase + waveHeight - 6} fill={C.muted} fontSize="8"
              textAnchor="end" fontFamily="'JetBrains Mono',monospace">OFF</text>
          </g>
        );
      })}

      {/* Device waveforms */}
      {deviceNames.map((name, idx) => {
        const yBase = devBaseY + idx * waveHeight;
        const color = devices[name].color;
        const wPath = buildWaveform(name, yBase);
        
        return (
          <g key={name}>
            {/* Device label above waveform */}
            <text x={pad.left + 4} y={yBase + 2} fill={color} fontSize="9"
              fontFamily="'JetBrains Mono',monospace" fontWeight="600" opacity="0.8">
              {name.toUpperCase()}
            </text>

            {/* ON/OFF reference lines */}
            <line x1={pad.left} y1={yBase + 4} x2={pad.left+cw} y2={yBase + 4}
              stroke={C.border} strokeWidth="0.5" strokeDasharray="2,4" />
            <line x1={pad.left} y1={yBase + waveHeight - 8} x2={pad.left+cw} y2={yBase + waveHeight - 8}
              stroke={C.border} strokeWidth="0.5" strokeDasharray="2,4" />

            {/* Step waveform */}
            <path d={wPath} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />

            {/* Row separator */}
            {idx < deviceNames.length - 1 && (
              <line x1={pad.left} y1={yBase + waveHeight}
                x2={pad.left+cw} y2={yBase + waveHeight}
                stroke={C.border} strokeWidth="0.5" />
            )}
          </g>
        );
      })}

      {/* Time labels at bottom */}
      {tLabels.map((l, i) => (
        <text key={i} x={l.x} y={totalH - 4} fill={C.muted} fontSize="10"
          textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{l.label}</text>
      ))}
    </svg>
  );
};

// ═══════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════
const Tooltip = ({ data, index, visible }) => {
  if (index === null || !data[index]) return null;
  const d = data[index];
  const time = new Date(d.time);

  return (
    <div style={{
      position: 'absolute', top: '12px', right: '12px',
      background: 'rgba(13,18,24,0.94)', backdropFilter: 'blur(16px)',
      border: `1px solid ${C.borderHi}`, borderRadius: '10px',
      padding: '10px 14px', zIndex: 10, minWidth: '175px',
    }}>
      <div style={{ color: C.dim, fontSize: '11px', marginBottom: '6px',
        fontFamily: "'JetBrains Mono',monospace" }}>
        {time.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
      </div>
      {Object.entries(METRICS).map(([k, m]) => visible[k] && (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
          <span style={{ color: C.dim, fontSize: '12px', flex: 1 }}>{m.short}</span>
          <span style={{ color: m.color, fontSize: '13px', fontWeight: 600,
            fontFamily: "'JetBrains Mono',monospace" }}>
            {d[k]}{m.unit}
          </span>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════
// STAT CARDS
// ═══════════════════════════════════════
const StatCards = ({ data }) => {
  const latest = data[data.length - 1];
  if (!latest) return null;

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
      {Object.entries(METRICS).map(([k, m]) => {
        const stats = calcStats(data, k);
        return (
          <div key={k} style={{
            flex: 1, background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: '12px', padding: '14px 16px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
              background: `linear-gradient(90deg, transparent, ${m.color}, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: C.dim, fontSize: '11px', marginBottom: '3px', letterSpacing: '0.5px' }}>
                  {m.label.toUpperCase()}
                </div>
                <div style={{ color: m.color, fontSize: '26px', fontWeight: 700,
                  fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
                  {latest[k]}{m.unit}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace" }}>
                <div style={{ color: C.muted, fontSize: '10px' }}>
                  <span style={{ color: '#f85149' }}>↑</span> {stats.max}{m.unit}
                </div>
                <div style={{ color: C.muted, fontSize: '10px' }}>
                  <span style={{ color: C.accent }}>↓</span> {stats.min}{m.unit}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function EnviroFlowCharts() {
  const [rangeIdx, setRangeIdx] = useState(2);
  const [visible, setVisible] = useState({ temp: true, humidity: true, vpd: true });
  const [hoverIdx, setHoverIdx] = useState(null);
  const [chartW, setChartW] = useState(800);
  const [showDevices, setShowDevices] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    const u = () => { if (ref.current) setChartW(ref.current.offsetWidth); };
    u(); window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);

  const range = TIME_RANGES[rangeIdx];
  const sensorData = useMemo(() => {
    const raw = generateTimeSeriesData(range.hours, range.interval);
    return downsample(raw, Math.min(raw.length, 400));
  }, [rangeIdx]);

  const deviceData = useMemo(() => generateDeviceData(range.hours, range.interval), [rangeIdx]);

  const toggle = (k) => {
    setVisible(p => {
      const n = { ...p, [k]: !p[k] };
      return Object.values(n).some(v => v) ? n : p;
    });
  };

  return (
    <div style={{
      background: C.bg, minHeight: '100vh', color: C.text,
      fontFamily: "'DM Sans',-apple-system,sans-serif", padding: '24px',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #10b981, #3b82f6)',
            borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.5px' }}>EnviroFlow</div>
            <div style={{ fontSize: '12px', color: C.dim }}>Controller: Biggie</div>
          </div>
        </div>
        <div style={{ color: C.muted, fontSize: '11px', fontFamily: "'JetBrains Mono',monospace" }}>
          {sensorData.length} pts · {range.desc}
        </div>
      </div>

      <StatCards data={sensorData} />

      {/* Chart Panel */}
      <div ref={ref} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', gap: '14px' }}>
            {Object.entries(METRICS).map(([k, m]) => (
              <button key={k} onClick={() => toggle(k)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0',
                opacity: visible[k] ? 1 : 0.3, transition: 'opacity 0.2s',
              }}>
                <div style={{ width: 10, height: 3, borderRadius: 2, background: m.color }} />
                <span style={{ color: C.dim, fontSize: '12px', fontWeight: 500 }}>{m.label} {m.unit}</span>
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)',
            borderRadius: '8px', padding: '3px',
          }}>
            {TIME_RANGES.map((r, i) => (
              <button key={r.label} onClick={() => setRangeIdx(i)} style={{
                padding: '4px 9px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: rangeIdx === i ? 600 : 500,
                fontFamily: "'JetBrains Mono',monospace",
                color: rangeIdx === i ? '#fff' : C.muted,
                background: rangeIdx === i ? 'rgba(88,166,255,0.2)' : 'transparent',
                transition: 'all 0.15s',
              }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sensor Chart */}
        <div style={{ position: 'relative', padding: '4px 0' }}>
          <Tooltip data={sensorData} index={hoverIdx} visible={visible} />
          <SensorChart data={sensorData} width={chartW} height={260}
            visible={visible} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
        </div>

        {/* Device Activity */}
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 16px',
          }}>
            <div style={{ color: C.dim, fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px' }}>
              DEVICE ACTIVITY
            </div>
            <button onClick={() => setShowDevices(!showDevices)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.muted, fontSize: '11px', padding: '2px 8px',
            }}>
              {showDevices ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>

          {showDevices && (
            <DeviceWaveformChart
              devices={deviceData}
              sensorData={sensorData}
              width={chartW}
              visible={visible}
            />
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════ */}
      {/* DEVELOPER REFERENCE                        */}
      {/* ════════════════════════════════════════════ */}
      <div style={{
        marginTop: '28px', background: C.panel, border: `1px solid ${C.border}`,
        borderRadius: '14px', padding: '20px 24px',
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: C.accent, marginBottom: '14px' }}>
          🛠 Developer Reference: Time Range + Device Activity Implementation
        </h2>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px',
          lineHeight: 1.7, color: C.dim, whiteSpace: 'pre-wrap',
        }}>
{`══════════════════════════════════════════════════════════════
TIME RANGE BUTTONS — WHY THEY DON'T WORK & HOW TO FIX
══════════════════════════════════════════════════════════════

Root cause: onClick only updates which button looks "active" 
but does NOT trigger a new data fetch from Supabase.

Required flow:
  button click → setRangeIdx(i) → useEffect([rangeIdx]) → 
  fetch new data with time bounds → chart re-renders

// ─── Hook Pattern ───────────────────────────────────
function useSensorData(controllerId, rangeIdx) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const range = TIME_RANGES[rangeIdx];
  
  useEffect(() => {
    const since = new Date(
      Date.now() - range.hours * 3600000
    ).toISOString();
    
    setLoading(true);
    
    // For 1H/6H/24H — direct query is fine
    // For 7D/30D/60D — use server-side downsampling RPC
    const fetchFn = range.hours <= 24 
      ? fetchDirect(controllerId, since)
      : fetchDownsampled(controllerId, since, range.interval);
    
    fetchFn.then(readings => {
      setData(readings);
      setLoading(false);
    });
  }, [controllerId, rangeIdx]); // ← rangeIdx triggers refetch
  
  return { data, loading };
}

async function fetchDirect(controllerId, since) {
  const { data } = await supabase
    .from('sensor_readings')
    .select('recorded_at, temperature, humidity, vpd')
    .eq('controller_id', controllerId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });
  return data || [];
}

async function fetchDownsampled(controllerId, since, intervalMin) {
  const { data } = await supabase.rpc(
    'get_sensor_readings_downsampled', {
      p_controller_id: controllerId,
      p_since: since,
      p_interval: intervalMin + ' minutes',
    }
  );
  return data || [];
}

══════════════════════════════════════════════════════════════
SUPABASE RPC — Server-Side Downsampling
══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_sensor_readings_downsampled(
  p_controller_id UUID,
  p_since TIMESTAMPTZ,
  p_interval TEXT DEFAULT '5 minutes'
)
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  temperature FLOAT, humidity FLOAT, vpd FLOAT,
  temp_min FLOAT, temp_max FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      p_since, NOW(), p_interval::interval
    ) AS bucket_start
  )
  SELECT
    b.bucket_start,
    AVG(s.temperature)::FLOAT,
    AVG(s.humidity)::FLOAT,
    AVG(s.vpd)::FLOAT,
    MIN(s.temperature)::FLOAT,
    MAX(s.temperature)::FLOAT
  FROM buckets b
  LEFT JOIN sensor_readings s
    ON s.controller_id = p_controller_id
    AND s.recorded_at >= b.bucket_start
    AND s.recorded_at < b.bucket_start + p_interval::interval
  GROUP BY b.bucket_start
  ORDER BY b.bucket_start;
END;
$$ LANGUAGE plpgsql STABLE;

══════════════════════════════════════════════════════════════
DEVICE ACTIVITY — Schema & Query
══════════════════════════════════════════════════════════════

-- Log every state change (not polling — event-driven)
CREATE TABLE device_state_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  controller_id UUID REFERENCES controllers(id),
  device_name TEXT NOT NULL,
  device_port INT,
  state BOOLEAN NOT NULL,       -- true=ON, false=OFF
  trigger TEXT,                  -- 'auto','manual','schedule'
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dsl_lookup 
  ON device_state_log(controller_id, recorded_at DESC);

-- Query for waveform chart
SELECT device_name, state, recorded_at
FROM device_state_log
WHERE controller_id = $1 AND recorded_at >= $2
ORDER BY device_name, recorded_at;

-- Waveform rendering: For each device, iterate state 
-- changes and draw step lines:
--   ON  → y = topY    (high)
--   OFF → y = bottomY (low)
--   State change → vertical line connecting them

══════════════════════════════════════════════════════════════
PERFORMANCE CHECKLIST
══════════════════════════════════════════════════════════════

□ 1H-24H: Direct query, client renders all points
□ 7D+:    Server-side downsampling via RPC
□ Cap at ~400 points client-side max
□ Debounce rapid range switching (300ms)
□ React.memo on chart SVG components
□ Show skeleton loader during fetch
□ Cache with SWR: useSWR(['readings', rangeIdx], ...)
□ Device activity: only fetch state CHANGES not polls`}
        </div>
      </div>
    </div>
  );
}