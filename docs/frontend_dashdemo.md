import React, { useState, useEffect, useRef, createContext, useContext } from 'react';

// ============================================================================
// CONTEXTS
// ============================================================================
const ThemeContext = createContext();
const SettingsContext = createContext();
const DragDropContext = createContext();

const useTheme = () => useContext(ThemeContext);
const useSettings = () => useContext(SettingsContext);
const useDragDrop = () => useContext(DragDropContext);

// ============================================================================
// PROVIDERS
// ============================================================================
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('enviroflow-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('enviroflow-theme', theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => !localStorage.getItem('enviroflow-theme') && setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
};

const SettingsProvider = ({ children }) => {
  const defaults = {
    temperatureUnit: 'F', showCO2: false, co2SensorAvailable: false, refreshInterval: 5000,
    vpdOptimalMin: 0.8, vpdOptimalMax: 1.2, tempOptimalMin: 72, tempOptimalMax: 82,
    humidityOptimalMin: 50, humidityOptimalMax: 65, co2OptimalMin: 800, co2OptimalMax: 1200,
  };
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('enviroflow-settings');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  useEffect(() => { localStorage.setItem('enviroflow-settings', JSON.stringify(settings)); }, [settings]);
  const updateSettings = (u) => setSettings(p => ({ ...p, ...u }));

  return <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>;
};

const DragDropProvider = ({ children }) => {
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem('enviroflow-card-order');
    return saved ? JSON.parse(saved) : null;
  });
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverCard, setDragOverCard] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { cardOrder && localStorage.setItem('enviroflow-card-order', JSON.stringify(cardOrder)); }, [cardOrder]);

  const reorderCards = (from, to) => {
    setCardOrder(p => { const n = [...(p || [])]; const [r] = n.splice(from, 1); n.splice(to, 0, r); return n; });
  };

  return <DragDropContext.Provider value={{ cardOrder, setCardOrder, draggedCard, setDraggedCard, dragOverCard, setDragOverCard, isEditing, setIsEditing, reorderCards }}>{children}</DragDropContext.Provider>;
};

// ============================================================================
// DATA GENERATION
// ============================================================================
const generateSensorData = (baseTemp = 76, baseHumidity = 58, points = 48) => {
  const data = [];
  let temp = baseTemp, humidity = baseHumidity;
  for (let i = 0; i < points; i++) {
    const hour = (i / 2) % 24;
    const isDaytime = hour >= 6 && hour <= 20;
    temp += ((isDaytime ? baseTemp + 4 : baseTemp - 2) - temp) * 0.1 + (Math.random() - 0.5) * 0.8;
    humidity += ((isDaytime ? baseHumidity - 5 : baseHumidity + 3) - humidity) * 0.1 + (Math.random() - 0.5) * 1.2;
    humidity = Math.max(30, Math.min(80, humidity));
    const tempC = (temp - 32) * 5 / 9;
    const svp = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    const vpd = svp * (1 - humidity / 100);
    data.push({
      time: `${String(Math.floor(hour)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      timestamp: Date.now() - (points - i) * 30 * 60 * 1000,
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      vpd: Math.round(vpd * 100) / 100,
      co2: Math.round(900 + Math.sin(i / 6) * 200 + (Math.random() - 0.5) * 100),
    });
  }
  return data;
};

// ============================================================================
// SENSOR CHART
// ============================================================================
const SensorChart = ({ data, height = 220 }) => {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 500, height });
  const [hovered, setHovered] = useState(null);
  const [activeMetrics, setActiveMetrics] = useState(['temperature', 'humidity', 'vpd']);

  useEffect(() => {
    const update = () => containerRef.current && setDims({ width: containerRef.current.getBoundingClientRect().width || 500, height });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [height]);

  const colors = {
    temperature: { stroke: '#ef4444', label: 'Temp' },
    humidity: { stroke: '#3b82f6', label: 'Humidity' },
    vpd: { stroke: '#10b981', label: 'VPD' },
    co2: { stroke: '#f59e0b', label: 'CO₂' },
  };

  const pad = { top: 20, right: 20, bottom: 35, left: 45 };
  const cw = dims.width - pad.left - pad.right;
  const ch = dims.height - pad.top - pad.bottom;

  const ranges = { temperature: { min: 60, max: 95 }, humidity: { min: 20, max: 90 }, vpd: { min: 0.3, max: 2.0 }, co2: { min: 400, max: 2000 } };
  const norm = (v, m) => (v - ranges[m].min) / (ranges[m].max - ranges[m].min);
  const xScale = (i) => pad.left + (i / (data.length - 1)) * cw;
  const yScale = (n) => pad.top + ch - n * ch;

  const createPath = (metric) => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(Math.max(0, Math.min(1, norm(d[metric], metric))))}`).join(' ');
  const createArea = (metric) => `${createPath(metric)} L ${xScale(data.length - 1)} ${pad.top + ch} L ${xScale(0)} ${pad.top + ch} Z`;

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const textColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  const available = settings.showCO2 && settings.co2SensorAvailable ? ['temperature', 'humidity', 'vpd', 'co2'] : ['temperature', 'humidity', 'vpd'];
  const toggle = (m) => setActiveMetrics(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {available.map(m => (
          <button key={m} onClick={() => toggle(m)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', border: 'none',
            background: activeMetrics.includes(m) ? (theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
            cursor: 'pointer', opacity: activeMetrics.includes(m) ? 1 : 0.4, transition: 'all 0.2s',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[m].stroke }} />
            <span style={{ fontSize: '11px', color: theme === 'dark' ? '#fff' : '#1f2937', fontWeight: 500 }}>{colors[m].label}</span>
          </button>
        ))}
      </div>
      <svg width="100%" height={dims.height}>
        <defs>
          {available.map(m => (
            <linearGradient key={m} id={`grad-${m}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors[m].stroke} stopOpacity="0.25" />
              <stop offset="100%" stopColor={colors[m].stroke} stopOpacity="0.02" />
            </linearGradient>
          ))}
          <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => <line key={i} x1={pad.left} y1={yScale(t)} x2={dims.width - pad.right} y2={yScale(t)} stroke={gridColor} strokeDasharray="4,4" />)}
        {data.filter((_, i) => i % 8 === 0).map((d, i) => <text key={i} x={xScale(i * 8)} y={dims.height - 8} textAnchor="middle" fill={textColor} fontSize="10">{d.time}</text>)}
        {activeMetrics.map(m => <path key={`a-${m}`} d={createArea(m)} fill={`url(#grad-${m})`} />)}
        {activeMetrics.map(m => <path key={`l-${m}`} d={createPath(m)} fill="none" stroke={colors[m].stroke} strokeWidth="2" strokeLinecap="round" filter="url(#glow)" />)}
        <rect x={pad.left} y={pad.top} width={cw} height={ch} fill="transparent"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = e.clientX - r.left; const i = Math.round((x / cw) * (data.length - 1)); if (i >= 0 && i < data.length) setHovered({ index: i, x: xScale(i) }); }}
          onMouseLeave={() => setHovered(null)} />
        {hovered && <>
          <line x1={hovered.x} y1={pad.top} x2={hovered.x} y2={pad.top + ch} stroke={theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} strokeDasharray="4,4" />
          {activeMetrics.map(m => <circle key={m} cx={hovered.x} cy={yScale(Math.max(0, Math.min(1, norm(data[hovered.index][m], m))))} r="5" fill={colors[m].stroke} stroke={theme === 'dark' ? '#1a1f2e' : '#fff'} strokeWidth="2" />)}
        </>}
      </svg>
      {hovered && data[hovered.index] && (
        <div style={{
          position: 'absolute', left: Math.min(hovered.x + 10, dims.width - 140), top: '50px',
          background: theme === 'dark' ? 'rgba(20,24,35,0.95)' : 'rgba(255,255,255,0.95)',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '8px', padding: '10px 12px', fontSize: '11px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: theme === 'dark' ? '#fff' : '#1f2937' }}>{data[hovered.index].time}</div>
          {activeMetrics.map(m => (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[m].stroke }} />
              <span style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>{colors[m].label}:</span>
              <span style={{ fontWeight: 600, color: colors[m].stroke }}>
                {m === 'temperature' ? `${data[hovered.index][m]}°${settings.temperatureUnit}` : m === 'humidity' ? `${data[hovered.index][m]}%` : m === 'vpd' ? `${data[hovered.index][m]} kPa` : `${data[hovered.index][m]} ppm`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ROOM CARD
// ============================================================================
const RoomCard = ({ room, index, onExpand }) => {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const { draggedCard, setDraggedCard, dragOverCard, setDragOverCard, isEditing, reorderCards } = useDragDrop();
  const [hovered, setHovered] = useState(false);
  const cur = room.data[room.data.length - 1] || {};

  const getStatus = (v, min, max) => {
    if (v >= min && v <= max) return 'optimal';
    const dev = v < min ? min - v : v - max;
    return dev / (max - min) < 0.2 ? 'warning' : 'alert';
  };

  const vpdS = getStatus(cur.vpd, settings.vpdOptimalMin, settings.vpdOptimalMax);
  const tempS = getStatus(cur.temperature, settings.tempOptimalMin, settings.tempOptimalMax);
  const humS = getStatus(cur.humidity, settings.humidityOptimalMin, settings.humidityOptimalMax);
  const statusColors = { optimal: '#10b981', warning: '#f59e0b', alert: '#ef4444' };
  const overall = [vpdS, tempS, humS].includes('alert') ? 'alert' : [vpdS, tempS, humS].includes('warning') ? 'warning' : 'optimal';

  const isDragging = draggedCard === index;
  const isDragOver = dragOverCard === index && draggedCard !== index;

  return (
    <div
      draggable={isEditing}
      onDragStart={(e) => { if (isEditing) { setDraggedCard(index); e.dataTransfer.effectAllowed = 'move'; } }}
      onDragOver={(e) => { if (isEditing) { e.preventDefault(); setDragOverCard(index); } }}
      onDrop={(e) => { if (isEditing) { e.preventDefault(); if (draggedCard !== null && draggedCard !== index) reorderCards(draggedCard, index); setDraggedCard(null); setDragOverCard(null); } }}
      onDragEnd={() => { setDraggedCard(null); setDragOverCard(null); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !isEditing && onExpand(room)}
      style={{
        background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${isDragOver ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '16px', padding: '20px', cursor: isEditing ? 'grab' : 'pointer',
        transition: 'all 0.3s ease', transform: isDragging ? 'scale(1.02) rotate(2deg)' : hovered && !isEditing ? 'translateY(-2px)' : 'none',
        opacity: isDragging ? 0.7 : 1, boxShadow: isDragOver ? '0 0 0 2px #3b82f6' : hovered ? `0 8px 30px ${theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}` : 'none',
        position: 'relative', backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ position: 'absolute', top: '12px', right: '12px', width: '10px', height: '10px', borderRadius: '50%', background: statusColors[overall], boxShadow: `0 0 10px ${statusColors[overall]}` }} />
      {isEditing && <div style={{ position: 'absolute', top: '12px', left: '12px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', fontSize: '14px' }}>⋮⋮</div>}
      <div style={{ fontSize: '13px', color: statusColors[overall], fontWeight: 600, marginBottom: '2px' }}>{room.name}</div>
      <div style={{ fontSize: '11px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginBottom: '12px' }}>{room.controller}</div>
      <div style={{ fontSize: '40px', fontWeight: 300, letterSpacing: '-2px', color: theme === 'dark' ? '#fff' : '#1f2937', lineHeight: 1, marginBottom: '2px' }}>
        {cur.vpd?.toFixed(2)}<span style={{ fontSize: '14px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginLeft: '4px' }}>kPa</span>
      </div>
      <div style={{ fontSize: '10px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VPD</div>
      <div style={{ display: 'flex', gap: '16px', paddingTop: '12px', borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: statusColors[tempS] }}>{cur.temperature?.toFixed(1)}°{settings.temperatureUnit}</div>
          <div style={{ fontSize: '9px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Temp</div>
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: statusColors[humS] }}>{cur.humidity?.toFixed(1)}%</div>
          <div style={{ fontSize: '9px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Humidity</div>
        </div>
        {settings.showCO2 && settings.co2SensorAvailable && (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#f59e0b' }}>{cur.co2}</div>
            <div style={{ fontSize: '9px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>CO₂</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SETTINGS PANEL
// ============================================================================
const SettingsPanel = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  if (!isOpen) return null;

  const Input = ({ label, value, onChange, type = 'number', step }) => (
    <div style={{ flex: 1 }}>
      <input type={type} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{
        width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', color: theme === 'dark' ? '#fff' : '#1f2937', fontSize: '13px',
      }} />
    </div>
  );

  const Toggle = ({ label, desc, value, onChange }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }}>{label}</div>
        {desc && <div style={{ fontSize: '11px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: '2px' }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
        background: value ? '#10b981' : theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      }}>
        <div style={{ position: 'absolute', top: '2px', left: value ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '360px', zIndex: 1000, overflow: 'auto',
      background: theme === 'dark' ? '#1a1f2e' : '#fff', borderLeft: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      boxShadow: '-10px 0 40px rgba(0,0,0,0.15)',
    }}>
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: theme === 'dark' ? '#fff' : '#1f2937', margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>×</button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: '8px', fontWeight: 500 }}>Appearance</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['light', 'dark'].map(t => (
              <button key={t} onClick={toggleTheme} style={{
                flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, textTransform: 'capitalize',
                border: `1px solid ${theme === t ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                background: theme === t ? 'rgba(59,130,246,0.1)' : 'transparent', color: theme === 'dark' ? '#fff' : '#1f2937',
              }}>{t === 'light' ? '☀️' : '🌙'} {t}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: '8px', fontWeight: 500 }}>Temperature Unit</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['F', 'C'].map(u => (
              <button key={u} onClick={() => updateSettings({ temperatureUnit: u })} style={{
                flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                border: `1px solid ${settings.temperatureUnit === u ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                background: settings.temperatureUnit === u ? 'rgba(59,130,246,0.1)' : 'transparent', color: theme === 'dark' ? '#fff' : '#1f2937',
              }}>°{u}</button>
            ))}
          </div>
        </div>

        <Toggle label="CO₂ Sensor Available" desc="Enable if your controller has CO₂" value={settings.co2SensorAvailable} onChange={(v) => updateSettings({ co2SensorAvailable: v })} />
        {settings.co2SensorAvailable && <Toggle label="Show CO₂ in Dashboard" desc="Display CO₂ readings on cards & charts" value={settings.showCO2} onChange={(v) => updateSettings({ showCO2: v })} />}

        <div style={{ borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, paddingTop: '20px', marginTop: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: theme === 'dark' ? '#fff' : '#1f2937', marginBottom: '16px' }}>Optimal Ranges</div>
          
          {[
            { label: 'VPD (kPa)', min: 'vpdOptimalMin', max: 'vpdOptimalMax', step: 0.1 },
            { label: `Temp (°${settings.temperatureUnit})`, min: 'tempOptimalMin', max: 'tempOptimalMax', step: 1 },
            { label: 'Humidity (%)', min: 'humidityOptimalMin', max: 'humidityOptimalMax', step: 1 },
          ].map(({ label, min, max, step }) => (
            <div key={label} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: '6px' }}>{label}</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Input value={settings[min]} onChange={(v) => updateSettings({ [min]: v })} step={step} />
                <span style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', fontSize: '12px' }}>to</span>
                <Input value={settings[max]} onChange={(v) => updateSettings({ [max]: v })} step={step} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ROOM DETAIL MODAL
// ============================================================================
const RoomDetail = ({ room, onClose }) => {
  const { theme } = useTheme();
  const { settings } = useSettings();
  if (!room) return null;
  const cur = room.data[room.data.length - 1] || {};

  const metrics = [
    { label: 'VPD', value: cur.vpd?.toFixed(2), unit: 'kPa', color: '#10b981' },
    { label: 'Temperature', value: cur.temperature?.toFixed(1), unit: `°${settings.temperatureUnit}`, color: '#ef4444' },
    { label: 'Humidity', value: cur.humidity?.toFixed(1), unit: '%', color: '#3b82f6' },
    ...(settings.showCO2 && settings.co2SensorAvailable ? [{ label: 'CO₂', value: cur.co2, unit: 'ppm', color: '#f59e0b' }] : []),
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'auto', borderRadius: '20px', padding: '32px',
        background: theme === 'dark' ? '#1a1f2e' : '#fff', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: theme === 'dark' ? '#fff' : '#1f2937', margin: 0 }}>{room.name}</h2>
            <p style={{ fontSize: '13px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', margin: '4px 0 0' }}>{room.controller}</p>
          </div>
          <button onClick={onClose} style={{
            background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', border: 'none', width: '36px', height: '36px',
            borderRadius: '10px', fontSize: '18px', cursor: 'pointer', color: theme === 'dark' ? '#fff' : '#1f2937',
          }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: '14px', marginBottom: '28px' }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: '6px', textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 300, color: m.color }}>{m.value}<span style={{ fontSize: '12px', marginLeft: '3px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>{m.unit}</span></div>
            </div>
          ))}
        </div>

        <div style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', borderRadius: '14px', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#1f2937', marginBottom: '16px' }}>24-Hour Trend</h3>
          <SensorChart data={room.data} height={260} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD
// ============================================================================
const Dashboard = () => {
  const { theme, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const { isEditing, setIsEditing, cardOrder, setCardOrder } = useDragDrop();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const demoRooms = [
      { id: 'veg-a', name: 'Veg Room A', controller: 'AC Infinity Controller 69', data: generateSensorData(74, 62) },
      { id: 'flower-1', name: 'Flower Room 1', controller: 'TrolMaster Hydro-X', data: generateSensorData(78, 55) },
      { id: 'flower-2', name: 'Flower Room 2', controller: 'TrolMaster Hydro-X', data: generateSensorData(79, 52) },
      { id: 'clone', name: 'Clone Room', controller: 'AC Infinity Controller 69', data: generateSensorData(76, 70) },
      { id: 'dry', name: 'Dry Room', controller: 'Pulse Pro', data: generateSensorData(65, 58) },
      { id: 'mother', name: 'Mother Room', controller: 'AC Infinity Controller 69', data: generateSensorData(75, 60) },
    ];
    setRooms(demoRooms);
    if (!cardOrder) setCardOrder(demoRooms.map(r => r.id));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRooms(prev => prev.map(room => {
        const last = room.data[room.data.length - 1];
        const newTemp = last.temperature + (Math.random() - 0.5) * 0.3;
        const newHum = Math.max(30, Math.min(80, last.humidity + (Math.random() - 0.5) * 0.5));
        const tempC = (newTemp - 32) * 5 / 9;
        const svp = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
        return {
          ...room,
          data: [...room.data.slice(1), {
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            temperature: Math.round(newTemp * 10) / 10,
            humidity: Math.round(newHum * 10) / 10,
            vpd: Math.round(svp * (1 - newHum / 100) * 100) / 100,
            co2: Math.round(last.co2 + (Math.random() - 0.5) * 20),
          }],
        };
      }));
    }, settings.refreshInterval);
    return () => clearInterval(interval);
  }, [settings.refreshInterval]);

  const sorted = cardOrder ? cardOrder.map(id => rooms.find(r => r.id === id)).filter(Boolean) : rooms;

  return (
    <div style={{
      minHeight: '100vh', fontFamily: "'DM Sans', -apple-system, sans-serif", color: theme === 'dark' ? '#fff' : '#1f2937',
      background: theme === 'dark' ? 'linear-gradient(145deg, #0f1419 0%, #1a1f2e 50%, #0d1117 100%)' : 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg, #10b981, #3b82f6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <span style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.5px' }}>EnviroFlow</span>
          <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, marginLeft: '4px' }}>DEMO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setIsEditing(!isEditing)} style={{
            padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
            border: `1px solid ${isEditing ? '#3b82f6' : theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            background: isEditing ? 'rgba(59,130,246,0.1)' : 'transparent', color: isEditing ? '#3b82f6' : theme === 'dark' ? '#fff' : '#1f2937',
          }}>{isEditing ? '✓ Done' : '⋮⋮ Edit'}</button>
          <button onClick={toggleTheme} style={{ width: '36px', height: '36px', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', cursor: 'pointer', fontSize: '16px' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button onClick={() => setSettingsOpen(true)} style={{ width: '36px', height: '36px', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', cursor: 'pointer', fontSize: '16px' }}>⚙️</button>
        </div>
      </header>

      <main style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Multi-Room Overview</h1>
          {isEditing && <span style={{ fontSize: '12px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>Drag cards to reorder</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '36px' }}>
          {sorted.map((room, i) => <RoomCard key={room.id} room={room} index={i} onExpand={setSelectedRoom} />)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
          {sorted.slice(0, 2).map(room => (
            <div key={`chart-${room.id}`} style={{
              background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: '18px', padding: '22px', backdropFilter: 'blur(10px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>{room.name}</h3>
                <span style={{ fontSize: '10px', color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>Last 24h</span>
              </div>
              <SensorChart data={room.data} height={200} />
            </div>
          ))}
        </div>
      </main>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {selectedRoom && <RoomDetail room={selectedRoom} onClose={() => setSelectedRoom(null)} />}
      {settingsOpen && <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }} />}
    </div>
  );
};

// ============================================================================
// APP EXPORT
// ============================================================================
export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <DragDropProvider>
          <Dashboard />
        </DragDropProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}