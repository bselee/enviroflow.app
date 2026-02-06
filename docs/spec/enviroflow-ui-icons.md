<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EnviroFlow Icon Reference — Device & System Icons</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root {
  --bg-primary: #0a0e14;
  --bg-secondary: #111820;
  --bg-card: #151c26;
  --bg-card-elevated: #1a2332;
  --bg-surface: #1e2a3a;
  --accent-cyan: #00d4ff;
  --accent-cyan-dim: #007a94;
  --accent-cyan-glow: rgba(0, 212, 255, 0.15);
  --accent-green: #00e676;
  --accent-orange: #ff9100;
  --accent-red: #ff5252;
  --accent-purple: #b388ff;
  --accent-yellow: #ffd740;
  --text-primary: #e8edf4;
  --text-secondary: #8896a8;
  --text-dim: #4a5568;
  --border-subtle: rgba(255,255,255,0.06);
  --border-active: rgba(0, 212, 255, 0.3);
  --font-display: 'Outfit', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-weight: 400;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9999;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--accent-cyan-dim); border-radius: 3px; }

.container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }

/* ===== HERO ===== */
.hero {
  padding: 80px 0 40px;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -200px; right: -200px;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 60%);
  pointer-events: none;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--accent-cyan-glow);
  border: 1px solid var(--border-active);
  border-radius: 100px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-cyan);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 24px;
}

.hero h1 {
  font-size: clamp(36px, 5vw, 64px);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -2px;
  margin-bottom: 16px;
}

.hero h1 .gradient {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 17px;
  color: var(--text-secondary);
  max-width: 640px;
  line-height: 1.6;
}

/* ===== SECTIONS ===== */
section {
  padding: 64px 0;
  border-top: 1px solid var(--border-subtle);
}

.section-header { margin-bottom: 48px; }

.section-number {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent-cyan);
  font-weight: 600;
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.section-title {
  font-size: clamp(28px, 3.5vw, 42px);
  font-weight: 800;
  letter-spacing: -1px;
  line-height: 1.1;
  margin-bottom: 12px;
}

.section-desc {
  font-size: 15px;
  color: var(--text-secondary);
  max-width: 640px;
  line-height: 1.6;
}

/* ===== ICON GRID ===== */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.icon-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
  transition: var(--transition);
  cursor: default;
  position: relative;
}

.icon-card:hover {
  border-color: var(--border-active);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.08);
  transform: translateY(-2px);
}

.icon-card .icon-preview {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255,255,255,0.03);
}

.icon-card .icon-preview svg {
  width: 28px;
  height: 28px;
}

.icon-card .icon-name {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.icon-card .icon-context {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.4;
}

.icon-card .icon-lucide {
  margin-top: 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent-cyan-dim);
  background: rgba(0,212,255,0.06);
  padding: 3px 8px;
  border-radius: 4px;
  display: inline-block;
}

.icon-card .icon-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
}

.icon-tag.port { background: rgba(0,212,255,0.12); color: var(--accent-cyan); }
.icon-tag.device { background: rgba(0,230,118,0.12); color: var(--accent-green); }
.icon-tag.status { background: rgba(255,145,0,0.12); color: var(--accent-orange); }
.icon-tag.nav { background: rgba(179,136,255,0.12); color: var(--accent-purple); }
.icon-tag.action { background: rgba(255,215,64,0.12); color: var(--accent-yellow); }

/* ===== CONTEXT PREVIEW ===== */
.context-frame {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  overflow: hidden;
  margin: 32px 0;
}

.context-frame-header {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--border-subtle);
}

.context-frame-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-cyan);
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.context-frame-desc {
  font-size: 11px;
  color: var(--text-dim);
}

.context-frame-body {
  padding: 32px;
  display: flex;
  justify-content: center;
}

/* ===== MOCK DEVICE CARD ===== */
.mock-card {
  width: 380px;
  background: var(--bg-card);
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.mock-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
}

.mock-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.04);
  flex-shrink: 0;
}

.mock-card-icon svg { width: 20px; height: 20px; }

.mock-card-info { flex: 1; }
.mock-card-name { font-size: 14px; font-weight: 700; }
.mock-card-meta { font-size: 11px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; margin-top: 2px; }

.mock-card-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.mock-readings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border-subtle);
}

.mock-reading {
  background: var(--bg-card);
  padding: 14px 12px;
  text-align: center;
}

.mock-reading-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  font-weight: 600;
  margin-bottom: 4px;
}

.mock-reading-value {
  font-size: 26px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.mock-reading-unit {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 400;
}

.mock-ports {
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mock-port {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-radius: 8px;
  font-size: 11px;
}

.mock-port-icon {
  width: 24px; height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mock-port-icon svg { width: 14px; height: 14px; }

.mock-port-info { flex: 1; min-width: 0; }
.mock-port-name { font-weight: 600; color: var(--text-secondary); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mock-port-mode { font-size: 9px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; }

.mock-port-level {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 18px;
  color: var(--accent-cyan);
}

.mock-port-trend { font-size: 10px; margin-left: 2px; }

.mock-collapse {
  text-align: center;
  padding: 8px;
  color: var(--text-dim);
  font-size: 10px;
  cursor: pointer;
}

/* ===== SPEC TABLE ===== */
.spec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 20px 0;
}

.spec-table th {
  text-align: left;
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 2px solid var(--accent-cyan-dim);
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent-cyan);
}

.spec-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  vertical-align: top;
}

.spec-table tr:hover td { background: rgba(255,255,255,0.02); }

.spec-table code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: rgba(0,212,255,0.08);
  color: var(--accent-cyan);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ===== CODE BLOCK ===== */
.code-block {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  margin: 20px 0;
}

.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--border-subtle);
}

.code-block-lang {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent-cyan);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.code-block-file {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
}

.code-block pre {
  padding: 18px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.ck { color: var(--text-dim); }
.cs { color: var(--accent-cyan); }
.cn { color: var(--accent-orange); }
.cp { color: var(--accent-purple); }
.cf { color: var(--accent-green); }

/* ===== CALLOUT ===== */
.callout {
  padding: 18px 22px;
  border-radius: 10px;
  margin: 24px 0;
  font-size: 13px;
  line-height: 1.6;
}
.callout.info { background: rgba(0,212,255,0.06); border-left: 3px solid var(--accent-cyan); color: var(--text-secondary); }
.callout strong { color: var(--text-primary); }

/* ===== SIZE DEMO ===== */
.size-demo {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  margin: 24px 0;
  flex-wrap: wrap;
}

.size-demo-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.size-demo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.03);
  border: 1px dashed var(--border-active);
  border-radius: 8px;
}

.size-demo-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  font-weight: 600;
}

/* ===== COLOR ICON ROW ===== */
.icon-color-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.icon-color-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.icon-color-chip svg { width: 18px; height: 18px; }

.icon-color-chip .hex {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
}

/* ===== ANIMATION DEMO ===== */
@keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.7); } }
@keyframes blink-alert { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes rotate-fan { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes glow-pulse { 0%, 100% { filter: drop-shadow(0 0 2px rgba(0,212,255,0.3)); } 50% { filter: drop-shadow(0 0 8px rgba(0,212,255,0.6)); } }

.anim-pulse { animation: pulse-dot 2s ease-in-out infinite; }
.anim-blink { animation: blink-alert 1s ease-in-out infinite; }
.anim-rotate { animation: rotate-fan 2s linear infinite; }
.anim-glow { animation: glow-pulse 2s ease-in-out infinite; }

/* ===== SUB HEADINGS ===== */
h4 {
  font-size: 18px;
  font-weight: 700;
  margin: 40px 0 14px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
}
h4:first-of-type { border-top: none; padding-top: 0; }

.sub-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}

footer {
  border-top: 1px solid var(--border-subtle);
  padding: 48px 0;
  text-align: center;
  color: var(--text-dim);
  font-size: 12px;
}

@media (max-width: 768px) {
  .icon-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .mock-card { width: 100%; }
  .size-demo { gap: 16px; }
}
</style>
</head>
<body>

<!-- HERO -->
<div class="hero">
  <div class="container">
    <div class="hero-badge">Icon Reference Sheet</div>
    <h1>Device <span class="gradient">Icons</span></h1>
    <p class="hero-subtitle">
      Complete icon catalog for the EnviroFlow UI — covering every device type, port type, 
      status indicator, connectivity state, and navigation element from the AC Infinity app ecosystem.
    </p>
  </div>
</div>

<!-- ===== PORT / DEVICE TYPE ICONS ===== -->
<section id="port-icons">
  <div class="container">
    <div class="section-header">
      <div class="section-number">01 — PORT DEVICE TYPES</div>
      <h2 class="section-title">Equipment Icons</h2>
      <p class="section-desc">
        Each port on the controller connects to a specific type of grow equipment. The AC Infinity 
        app uses small icons next to each port to indicate device type. These icons appear in port 
        status chips, automation selectors, and device pairing screens.
      </p>
    </div>

    <div class="icon-grid">
      <!-- Inline Fan — ducted cylinder, NO visible blades -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);">
            <!-- Cylindrical duct housing -->
            <ellipse cx="6" cy="12" rx="2.5" ry="5"/>
            <ellipse cx="18" cy="12" rx="2.5" ry="5"/>
            <line x1="6" y1="7" x2="18" y2="7"/>
            <line x1="6" y1="17" x2="18" y2="17"/>
            <!-- Airflow arrows inside duct -->
            <path d="M10 12L14 12" opacity="0.5"/>
            <path d="M12.5 10L14.5 12L12.5 14" opacity="0.5"/>
            <!-- Flange ring -->
            <line x1="3" y1="7" x2="3" y2="17" stroke-width="2.2" opacity="0.4"/>
            <line x1="21" y1="7" x2="21" y2="17" stroke-width="2.2" opacity="0.4"/>
          </svg>
        </div>
        <div class="icon-name">Inline Fan</div>
        <div class="icon-context">Ducted exhaust / intake (no visible blades)</div>
        <div class="icon-lucide">Wind</div>
      </div>

      <!-- Clip Fan / Circulation — visible spinning blades + guard -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);">
            <!-- Circular guard -->
            <circle cx="12" cy="10" r="7"/>
            <!-- Hub -->
            <circle cx="12" cy="10" r="1.5" fill="currentColor" opacity="0.3"/>
            <!-- Visible blades (4-blade fan) -->
            <path d="M12 8.5C12 8.5 12.8 5 15.5 4.5C17 4.2 17 6 16.2 7.5C15.5 8.8 13 9.5 12 10"/>
            <path d="M13.5 10C13.5 10 17 10.8 17.5 13.5C17.8 15 16 15 14.5 14.2C13.2 13.5 12.5 11 12 10"/>
            <path d="M12 11.5C12 11.5 11.2 15 8.5 15.5C7 15.8 7 14 7.8 12.5C8.5 11.2 11 10.5 12 10"/>
            <path d="M10.5 10C10.5 10 7 9.2 6.5 6.5C6.2 5 8 5 9.5 5.8C10.8 6.5 11.5 9 12 10"/>
            <!-- Clip stand -->
            <line x1="10" y1="17" x2="8.5" y2="21"/>
            <line x1="14" y1="17" x2="15.5" y2="21"/>
            <line x1="7.5" y1="21" x2="16.5" y2="21"/>
          </svg>
        </div>
        <div class="icon-name">Clip / Circulation Fan</div>
        <div class="icon-context">Visible blades, oscillating canopy airflow</div>
        <div class="icon-lucide">Fan</div>
      </div>

      <!-- Grow Light -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-yellow);">
            <rect x="4" y="4" width="16" height="4" rx="1"/>
            <line x1="8" y1="8" x2="6" y2="14"/>
            <line x1="12" y1="8" x2="12" y2="14"/>
            <line x1="16" y1="8" x2="18" y2="14"/>
            <circle cx="6" cy="15" r="1" fill="currentColor" opacity="0.4"/>
            <circle cx="12" cy="15" r="1" fill="currentColor" opacity="0.4"/>
            <circle cx="18" cy="15" r="1" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <div class="icon-name">Grow Light</div>
        <div class="icon-context">LED panel / board, brightness 0–10</div>
        <div class="icon-lucide">Sun</div>
      </div>

      <!-- Humidifier -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: #4fc3f7;">
            <path d="M12 3C12 3 5 11 5 15C5 18.87 8.13 22 12 22C15.87 22 19 18.87 19 15C19 11 12 3 12 3Z"/>
            <path d="M10 16C10 16 10.5 14 12 14C13.5 14 14 16 14 16" opacity="0.5"/>
          </svg>
        </div>
        <div class="icon-name">Humidifier</div>
        <div class="icon-context">Mist output, outlet control (on/off)</div>
        <div class="icon-lucide">Droplets</div>
      </div>

      <!-- Dehumidifier -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: #4fc3f7;">
            <path d="M12 3C12 3 5 11 5 15C5 18.87 8.13 22 12 22C15.87 22 19 18.87 19 15C19 11 12 3 12 3Z"/>
            <line x1="7" y1="14" x2="17" y2="14" stroke-width="2" opacity="0.6"/>
            <path d="M9 17L15 11" stroke-width="2" opacity="0.4"/>
          </svg>
        </div>
        <div class="icon-name">Dehumidifier</div>
        <div class="icon-context">Moisture removal, outlet control</div>
        <div class="icon-lucide">Droplets + Slash</div>
      </div>

      <!-- Heater -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-red);">
            <path d="M12 21C8 21 5 18 5 14C5 10 8 8 10 6C10 10 14 11 14 7C14 5 12 3 12 3C16 5 19 9 19 14C19 18 16 21 12 21Z"/>
            <path d="M12 21C10 21 8 19 8 17C8 15 10 14 11 13C11 15 13 15.5 13 13.5C15 15 16 16 16 17C16 19 14 21 12 21Z" fill="currentColor" opacity="0.2"/>
          </svg>
        </div>
        <div class="icon-name">Heater</div>
        <div class="icon-context">Space heater, outlet control</div>
        <div class="icon-lucide">Flame</div>
      </div>

      <!-- Air Conditioner -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: #80deea;">
            <rect x="3" y="5" width="18" height="10" rx="2"/>
            <line x1="6" y1="12" x2="18" y2="12" opacity="0.4"/>
            <line x1="6" y1="10" x2="18" y2="10" opacity="0.4"/>
            <path d="M7 15L7 19"/>
            <path d="M12 15L12 20"/>
            <path d="M17 15L17 19"/>
          </svg>
        </div>
        <div class="icon-name">Air Conditioner</div>
        <div class="icon-context">Cooling unit, outlet control</div>
        <div class="icon-lucide">AirVent</div>
      </div>

      <!-- Outlet / Control Plug -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-orange);">
            <rect x="5" y="6" width="14" height="12" rx="2"/>
            <circle cx="9" cy="11" r="1.5"/>
            <circle cx="15" cy="11" r="1.5"/>
            <line x1="12" y1="14" x2="12" y2="15"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
          </svg>
        </div>
        <div class="icon-name">Outlet / Control Plug</div>
        <div class="icon-context">Generic outlet device (on/off only)</div>
        <div class="icon-lucide">Plug</div>
      </div>

      <!-- Seedling Heat Mat -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-orange);">
            <rect x="3" y="14" width="18" height="4" rx="1"/>
            <path d="M5 14C5 14 7 12 9 12C11 12 13 16 15 16C17 16 19 14 19 14" opacity="0.4" stroke-dasharray="2 2"/>
            <path d="M10 10L10 7C10 5 14 5 14 7L14 10"/>
            <circle cx="12" cy="5" r="1" fill="currentColor" opacity="0.3"/>
          </svg>
        </div>
        <div class="icon-name">Heat Mat</div>
        <div class="icon-context">Seedling propagation</div>
        <div class="icon-lucide">Thermometer</div>
      </div>

      <!-- Water Pump -->
      <div class="icon-card">
        <span class="icon-tag port">Port</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: #4fc3f7;">
            <circle cx="8" cy="14" r="5"/>
            <circle cx="8" cy="14" r="1.5"/>
            <path d="M13 14L20 14"/>
            <path d="M13 11L20 11"/>
            <path d="M20 9L20 16" stroke-width="2"/>
          </svg>
        </div>
        <div class="icon-name">Water Pump</div>
        <div class="icon-context">Irrigation / hydroponics</div>
        <div class="icon-lucide">Waves</div>
      </div>
    </div>
  </div>
</section>

<!-- ===== CONTROLLER / DEVICE TYPE ICONS ===== -->
<section id="controller-icons">
  <div class="container">
    <div class="section-header">
      <div class="section-number">02 — CONTROLLER & SENSOR TYPES</div>
      <h2 class="section-title">Device Card Icons</h2>
      <p class="section-desc">
        These icons appear at the top-left of each device card on the DEVICES home screen. 
        In the AC Infinity app, controllers show a small screen/display icon and hygrometers 
        show a thermometer icon (visible in Image 1).
      </p>
    </div>

    <div class="icon-grid">
      <div class="icon-card">
        <span class="icon-tag device">Device</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <rect x="4" y="4" width="16" height="12" rx="2"/>
            <path d="M8 8L8 12" opacity="0.4"/>
            <path d="M11 8L11 12" opacity="0.4"/>
            <path d="M14 8L14 10" opacity="0.4"/>
            <line x1="4" y1="20" x2="20" y2="20"/>
            <line x1="9" y1="16" x2="9" y2="20"/>
            <line x1="15" y1="16" x2="15" y2="20"/>
          </svg>
        </div>
        <div class="icon-name">Controller</div>
        <div class="icon-context">CTR69 Pro, AI+, smart controllers</div>
        <div class="icon-lucide">Monitor</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag device">Device</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <path d="M10 4C10 2.9 10.9 2 12 2C13.1 2 14 2.9 14 4L14 14C14 14 16 15 16 17.5C16 19.7 14.2 21.5 12 21.5C9.8 21.5 8 19.7 8 17.5C8 15 10 14 10 14L10 4Z"/>
            <circle cx="12" cy="17.5" r="2" fill="currentColor" opacity="0.3"/>
            <line x1="12" y1="15" x2="12" y2="8" opacity="0.3" stroke-width="2"/>
          </svg>
        </div>
        <div class="icon-name">Hygrometer / Sensor</div>
        <div class="icon-context">CLOUDCOM, standalone temp/humidity</div>
        <div class="icon-lucide">Thermometer</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag device">Device</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-purple);">
            <rect x="4" y="4" width="16" height="12" rx="2"/>
            <circle cx="12" cy="10" r="3"/>
            <path d="M12 7L12 4" stroke-width="1.5"/>
            <path d="M14.1 7.9L16 6" stroke-width="1.5"/>
            <path d="M15 10L18 10" stroke-width="1.5"/>
            <line x1="4" y1="20" x2="20" y2="20"/>
            <line x1="9" y1="16" x2="9" y2="20"/>
            <line x1="15" y1="16" x2="15" y2="20"/>
          </svg>
        </div>
        <div class="icon-name">Controller AI+</div>
        <div class="icon-context">AI-powered smart controller</div>
        <div class="icon-lucide">BrainCircuit</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag device">Device</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <rect x="3" y="8" width="18" height="8" rx="2"/>
            <circle cx="7" cy="12" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="17" cy="12" r="1.5"/>
            <line x1="3" y1="5" x2="21" y2="5" stroke-width="2"/>
          </svg>
        </div>
        <div class="icon-name">Smart Outlet</div>
        <div class="icon-context">CTR76, multi-outlet controller</div>
        <div class="icon-lucide">PlugZap</div>
      </div>
    </div>
  </div>
</section>

<!-- ===== CONNECTIVITY & STATUS ===== -->
<section id="status-icons">
  <div class="container">
    <div class="section-header">
      <div class="section-number">03 — CONNECTIVITY & STATUS</div>
      <h2 class="section-title">Status Indicators</h2>
      <p class="section-desc">
        These icons communicate real-time device health. In the AC Infinity app, they appear 
        in the top-right area of each device card alongside the device code and last-seen timestamp.
      </p>
    </div>

    <div class="icon-grid">
      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);" class="anim-glow">
            <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <circle cx="12" cy="20" r="1" fill="currentColor"/>
          </svg>
        </div>
        <div class="icon-name">WiFi Connected</div>
        <div class="icon-context">Remote access active, cloud sync</div>
        <div class="icon-lucide">Wifi</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);">
            <path d="M7 7L17 17"/>
            <path d="M17 7C17 7 13 11 12 12"/>
            <rect x="9" y="15" width="6" height="6" rx="1"/>
          </svg>
        </div>
        <div class="icon-name">Bluetooth Connected</div>
        <div class="icon-context">Local connection, no cloud access</div>
        <div class="icon-lucide">Bluetooth</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-green);">
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3" class="anim-pulse"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
          </svg>
        </div>
        <div class="icon-name">Online</div>
        <div class="icon-context">Pulsing green dot — data flowing</div>
        <div class="icon-lucide">Circle (filled)</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-orange);">
            <circle cx="12" cy="12" r="4"/>
            <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.5"/>
          </svg>
        </div>
        <div class="icon-name">Stale Data</div>
        <div class="icon-context">Orange dot — no update for >2 min</div>
        <div class="icon-lucide">CircleDot</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-red);">
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.2"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
          </svg>
        </div>
        <div class="icon-name">Disconnected</div>
        <div class="icon-context">Red dot — no response for >5 min</div>
        <div class="icon-lucide">Circle (filled, red)</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-red);" class="anim-blink">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <circle cx="12" cy="17" r="1" fill="currentColor"/>
          </svg>
        </div>
        <div class="icon-name">Alarm Active</div>
        <div class="icon-context">Blinking — trigger threshold exceeded</div>
        <div class="icon-lucide">AlertTriangle</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
        </div>
        <div class="icon-name">Trend Up</div>
        <div class="icon-context">Value increasing arrow beside port level</div>
        <div class="icon-lucide">TrendingUp</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag status">Status</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-orange);">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
            <polyline points="17 18 23 18 23 12"/>
          </svg>
        </div>
        <div class="icon-name">Trend Down</div>
        <div class="icon-context">Value decreasing arrow beside port level</div>
        <div class="icon-lucide">TrendingDown</div>
      </div>
    </div>
  </div>
</section>

<!-- ===== NAVIGATION & ACTION ICONS ===== -->
<section id="nav-icons">
  <div class="container">
    <div class="section-header">
      <div class="section-number">04 — NAVIGATION & ACTIONS</div>
      <h2 class="section-title">System Icons</h2>
      <p class="section-desc">
        Navigation chrome, tab icons, action buttons, and automation identifiers 
        used throughout the AC Infinity app interface.
      </p>
    </div>

    <div class="icon-grid">
      <div class="icon-card">
        <span class="icon-tag nav">Nav</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </div>
        <div class="icon-name">Account Menu</div>
        <div class="icon-context">Top-left hamburger → side panel</div>
        <div class="icon-lucide">Menu</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag action">Action</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <div class="icon-name">Add Device / Add Automation</div>
        <div class="icon-context">Top-right (device) or FAB (automation)</div>
        <div class="icon-lucide">Plus</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag nav">Nav</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <div class="icon-name">Back</div>
        <div class="icon-context">Navigate to previous screen</div>
        <div class="icon-lucide">ChevronLeft</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag nav">Nav</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
        <div class="icon-name">Settings</div>
        <div class="icon-context">Device settings gear (top-right)</div>
        <div class="icon-lucide">Settings</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag nav">Nav</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="icon-name">Expand / Collapse</div>
        <div class="icon-context">Card toggle (rotates 180° when open)</div>
        <div class="icon-lucide">ChevronDown</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag action">Action</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="icon-name">Info Overlay</div>
        <div class="icon-context">Help tooltips, feature explanations</div>
        <div class="icon-lucide">Info</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag action">Action</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <div class="icon-name">Automation [A]</div>
        <div class="icon-context">Automation badge icon on list entries</div>
        <div class="icon-lucide">LayoutGrid</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag action">Action</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div class="icon-name">CSV Export</div>
        <div class="icon-context">Data tab — export climate data</div>
        <div class="icon-lucide">FileDown</div>
      </div>

      <div class="icon-card">
        <span class="icon-tag action">Action</span>
        <div class="icon-preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-primary);">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="icon-name">Share Device</div>
        <div class="icon-context">Account — share controller access</div>
        <div class="icon-lucide">Share</div>
      </div>
    </div>
  </div>
</section>

<!-- ===== IN-CONTEXT PREVIEW ===== -->
<section id="in-context">
  <div class="container">
    <div class="section-header">
      <div class="section-number">05 — IN-CONTEXT PREVIEW</div>
      <h2 class="section-title">Icons in the Device Card</h2>
      <p class="section-desc">
        Here's how all the icon types come together in a live device card, matching 
        the AC Infinity DEVICES home screen layout from Image 1.
      </p>
    </div>

    <div class="context-frame">
      <div class="context-frame-header">
        <span class="context-frame-label">Live Preview</span>
        <span class="context-frame-desc">All icons annotated with their roles</span>
      </div>
      <div class="context-frame-body">
        <div class="mock-card">
          <!-- Header -->
          <div class="mock-card-header">
            <div class="mock-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary);">
                <rect x="4" y="4" width="16" height="12" rx="2"/>
                <path d="M8 8L8 12" opacity="0.4"/>
                <path d="M11 8L11 12" opacity="0.4"/>
                <path d="M14 8L14 10" opacity="0.4"/>
                <line x1="4" y1="20" x2="20" y2="20"/>
                <line x1="9" y1="16" x2="9" y2="20"/>
                <line x1="15" y1="16" x2="15" y2="20"/>
              </svg>
            </div>
            <div class="mock-card-info">
              <div class="mock-card-name">GROW TENT 2×2</div>
              <div class="mock-card-meta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px; color: var(--accent-cyan);">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                  <circle cx="12" cy="20" r="1" fill="currentColor"/>
                </svg>
                <span style="color:var(--accent-cyan); font-family:var(--font-mono); font-size:10px;">E-W4206</span>
                <span>JUN 14, 4:52 PM</span>
              </div>
            </div>
            <div class="mock-card-status" style="color: var(--accent-green);">
              <span class="status-dot anim-pulse" style="background: var(--accent-green);"></span>
            </div>
          </div>

          <!-- Readings -->
          <div class="mock-readings">
            <div class="mock-reading">
              <div class="mock-reading-label">Temperature</div>
              <div class="mock-reading-value">75.1<span class="mock-reading-unit">°F</span></div>
            </div>
            <div class="mock-reading">
              <div class="mock-reading-label">Humidity</div>
              <div class="mock-reading-value">52.6<span class="mock-reading-unit">%</span></div>
            </div>
            <div class="mock-reading">
              <div class="mock-reading-label">VPD</div>
              <div class="mock-reading-value" style="color: var(--accent-cyan);">1.34<span class="mock-reading-unit">kPa</span></div>
            </div>
          </div>

          <!-- Ports -->
          <div class="mock-ports">
            <div class="mock-port">
              <div class="mock-port-icon" style="background: rgba(0,212,255,0.1);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);">
                  <ellipse cx="6" cy="12" rx="2.5" ry="5"/>
                  <ellipse cx="18" cy="12" rx="2.5" ry="5"/>
                  <line x1="6" y1="7" x2="18" y2="7"/>
                  <line x1="6" y1="17" x2="18" y2="17"/>
                  <path d="M10 12L14 12" opacity="0.5"/>
                  <path d="M12.5 10L14.5 12L12.5 14" opacity="0.5"/>
                </svg>
              </div>
              <div class="mock-port-info">
                <div class="mock-port-name">1: ION Board</div>
                <div class="mock-port-mode">ADVANCE</div>
              </div>
              <div class="mock-port-level">6<span class="mock-port-trend" style="color: var(--accent-cyan);">↑</span></div>
            </div>

            <div class="mock-port">
              <div class="mock-port-icon" style="background: rgba(0,212,255,0.1);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-cyan);">
                  <circle cx="12" cy="10" r="7"/>
                  <circle cx="12" cy="10" r="2"/>
                  <line x1="10" y1="17" x2="8" y2="21"/>
                  <line x1="14" y1="17" x2="16" y2="21"/>
                </svg>
              </div>
              <div class="mock-port-info">
                <div class="mock-port-name">2: Cloudline</div>
                <div class="mock-port-mode">ON</div>
              </div>
              <div class="mock-port-level">1</div>
            </div>

            <div class="mock-port">
              <div class="mock-port-icon" style="background: rgba(255,215,64,0.1);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-yellow);">
                  <rect x="4" y="4" width="16" height="4" rx="1"/>
                  <line x1="8" y1="8" x2="6" y2="14"/>
                  <line x1="12" y1="8" x2="12" y2="14"/>
                  <line x1="16" y1="8" x2="18" y2="14"/>
                </svg>
              </div>
              <div class="mock-port-info">
                <div class="mock-port-name">3: IONGRID</div>
                <div class="mock-port-mode">ON</div>
              </div>
              <div class="mock-port-level">0</div>
            </div>

            <div class="mock-port">
              <div class="mock-port-icon" style="background: rgba(79,195,247,0.1);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #4fc3f7;">
                  <path d="M12 3C12 3 5 11 5 15C5 18.87 8.13 22 12 22C15.87 22 19 18.87 19 15C19 11 12 3 12 3Z"/>
                </svg>
              </div>
              <div class="mock-port-info">
                <div class="mock-port-name">4: S6 Humid.</div>
                <div class="mock-port-mode">ON</div>
              </div>
              <div class="mock-port-level">0</div>
            </div>
          </div>

          <div class="mock-collapse">▾</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== ICON SIZING & IMPLEMENTATION ===== -->
<section id="implementation">
  <div class="container">
    <div class="section-header">
      <div class="section-number">06 — IMPLEMENTATION</div>
      <h2 class="section-title">Sizing, Colors & Code</h2>
      <p class="section-desc">
        Exact specifications for rendering icons at each UI context, plus the recommended 
        Lucide React import map for your codebase.
      </p>
    </div>

    <h4>Icon Size Scale</h4>
    <div class="size-demo">
      <div class="size-demo-item">
        <div class="size-demo-icon" style="width:20px;height:20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>
        </div>
        <div class="size-demo-label">12px</div>
        <div style="font-size:10px;color:var(--text-dim);text-align:center;">Meta inline</div>
      </div>
      <div class="size-demo-item">
        <div class="size-demo-icon" style="width:28px;height:28px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M12 9C12 9 13 5 17 4C21 3 21 7 20 9C19 11 15 12 12 12"/><path d="M15 12C15 12 19 13 20 17C21 21 17 21 15 20C13 19 12 15 12 12"/><path d="M12 15C12 15 11 19 7 20C3 21 3 17 4 15C5 13 9 12 12 12"/><path d="M9 12C9 12 5 11 4 7C3 3 7 3 9 4C11 5 12 9 12 12"/></svg>
        </div>
        <div class="size-demo-label">16px</div>
        <div style="font-size:10px;color:var(--text-dim);text-align:center;">Port chips</div>
      </div>
      <div class="size-demo-item">
        <div class="size-demo-icon" style="width:36px;height:36px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><rect x="4" y="4" width="16" height="12" rx="2"/><line x1="4" y1="20" x2="20" y2="20"/><line x1="9" y1="16" x2="9" y2="20"/><line x1="15" y1="16" x2="15" y2="20"/></svg>
        </div>
        <div class="size-demo-label">20px</div>
        <div style="font-size:10px;color:var(--text-dim);text-align:center;">Card header</div>
      </div>
      <div class="size-demo-item">
        <div class="size-demo-icon" style="width:48px;height:48px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;"><circle cx="12" cy="12" r="3"/><path d="M12 9C12 9 13 5 17 4C21 3 21 7 20 9C19 11 15 12 12 12"/><path d="M15 12C15 12 19 13 20 17C21 21 17 21 15 20C13 19 12 15 12 12"/><path d="M12 15C12 15 11 19 7 20C3 21 3 17 4 15C5 13 9 12 12 12"/><path d="M9 12C9 12 5 11 4 7C3 3 7 3 9 4C11 5 12 9 12 12"/></svg>
        </div>
        <div class="size-demo-label">28px</div>
        <div style="font-size:10px;color:var(--text-dim);text-align:center;">Feature cards</div>
      </div>
      <div class="size-demo-item">
        <div class="size-demo-icon" style="width:64px;height:64px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-cyan)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;"><circle cx="12" cy="12" r="3"/><path d="M12 9C12 9 13 5 17 4C21 3 21 7 20 9C19 11 15 12 12 12"/><path d="M15 12C15 12 19 13 20 17C21 21 17 21 15 20C13 19 12 15 12 12"/><path d="M12 15C12 15 11 19 7 20C3 21 3 17 4 15C5 13 9 12 12 12"/><path d="M9 12C9 12 5 11 4 7C3 3 7 3 9 4C11 5 12 9 12 12"/></svg>
        </div>
        <div class="size-demo-label">40px</div>
        <div style="font-size:10px;color:var(--text-dim);text-align:center;">Empty states</div>
      </div>
    </div>

    <h4>Lucide React Import Map</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">TypeScript</span>
        <span class="code-block-file">config/deviceIcons.tsx</span>
      </div>
<pre><code><span class="cp">import</span> {
  <span class="cf">Fan</span>,              <span class="ck">// Inline fan, clip fan, circulation</span>
  <span class="cf">Sun</span>,              <span class="ck">// Grow lights (LED panels, boards)</span>
  <span class="cf">Droplets</span>,         <span class="ck">// Humidifier</span>
  <span class="cf">Flame</span>,            <span class="ck">// Heater</span>
  <span class="cf">AirVent</span>,          <span class="ck">// Air conditioner / dehumidifier</span>
  <span class="cf">Plug</span>,             <span class="ck">// Outlet / control plug (generic)</span>
  <span class="cf">Thermometer</span>,      <span class="ck">// Hygrometer / sensor / heat mat</span>
  <span class="cf">Monitor</span>,          <span class="ck">// Controller device card icon</span>
  <span class="cf">Waves</span>,            <span class="ck">// Water pump</span>
  <span class="cf">Wifi</span>,             <span class="ck">// WiFi connected</span>
  <span class="cf">Bluetooth</span>,        <span class="ck">// Bluetooth connected</span>
  <span class="cf">AlertTriangle</span>,    <span class="ck">// Alarm active</span>
  <span class="cf">TrendingUp</span>,       <span class="ck">// Value increasing</span>
  <span class="cf">TrendingDown</span>,     <span class="ck">// Value decreasing</span>
  <span class="cf">Minus</span>,            <span class="ck">// Steady / no change</span>
  <span class="cf">Settings</span>,         <span class="ck">// Settings gear</span>
  <span class="cf">Plus</span>,             <span class="ck">// Add device / add automation</span>
  <span class="cf">ChevronLeft</span>,      <span class="ck">// Back navigation</span>
  <span class="cf">ChevronDown</span>,      <span class="ck">// Expand/collapse toggle</span>
  <span class="cf">Info</span>,             <span class="ck">// Help overlay</span>
  <span class="cf">FileDown</span>,         <span class="ck">// CSV export</span>
  <span class="cf">Share</span>,            <span class="ck">// Share device access</span>
  <span class="cf">BrainCircuit</span>,     <span class="ck">// AI controller variant</span>
  <span class="cf">PlugZap</span>,          <span class="ck">// Smart outlet controller</span>
} <span class="cp">from</span> <span class="cs">'lucide-react'</span>;

<span class="ck">// Device type → icon + color mapping</span>
<span class="cp">export const</span> portIconMap: <span class="cp">Record</span>&lt;<span class="cp">string</span>, { icon: <span class="cp">any</span>; color: <span class="cp">string</span>; bg: <span class="cp">string</span> }&gt; = {
  <span class="cs">'fan'</span>:          { icon: Fan,       color: <span class="cs">'#00d4ff'</span>, bg: <span class="cs">'rgba(0,212,255,0.10)'</span> },
  <span class="cs">'light'</span>:        { icon: Sun,       color: <span class="cs">'#ffd740'</span>, bg: <span class="cs">'rgba(255,215,64,0.10)'</span> },
  <span class="cs">'humidifier'</span>:   { icon: Droplets,  color: <span class="cs">'#4fc3f7'</span>, bg: <span class="cs">'rgba(79,195,247,0.10)'</span> },
  <span class="cs">'dehumidifier'</span>:  { icon: AirVent,   color: <span class="cs">'#4fc3f7'</span>, bg: <span class="cs">'rgba(79,195,247,0.10)'</span> },
  <span class="cs">'heater'</span>:       { icon: Flame,     color: <span class="cs">'#ff5252'</span>, bg: <span class="cs">'rgba(255,82,82,0.10)'</span> },
  <span class="cs">'ac'</span>:           { icon: AirVent,   color: <span class="cs">'#80deea'</span>, bg: <span class="cs">'rgba(128,222,234,0.10)'</span> },
  <span class="cs">'outlet'</span>:       { icon: Plug,      color: <span class="cs">'#ff9100'</span>, bg: <span class="cs">'rgba(255,145,0,0.10)'</span> },
  <span class="cs">'pump'</span>:         { icon: Waves,     color: <span class="cs">'#4fc3f7'</span>, bg: <span class="cs">'rgba(79,195,247,0.10)'</span> },
  <span class="cs">'heatmat'</span>:      { icon: Thermometer, color: <span class="cs">'#ff9100'</span>, bg: <span class="cs">'rgba(255,145,0,0.10)'</span> },
};

<span class="ck">// Usage in component:</span>
<span class="ck">// const { icon: Icon, color, bg } = portIconMap[port.deviceType];</span>
<span class="ck">// &lt;div style={{ background: bg }}&gt;</span>
<span class="ck">//   &lt;Icon size={14} color={color} /&gt;</span>
<span class="ck">// &lt;/div&gt;</span></code></pre>
    </div>

    <h4>Icon Color Rules</h4>
    <div class="icon-color-row">
      <div class="icon-color-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><circle cx="12" cy="12" r="3"/><path d="M12 9C12 9 13 5 17 4C21 3 21 7 20 9C19 11 15 12 12 12"/></svg>
        <span>Fans</span>
        <span class="hex">#00D4FF</span>
      </div>
      <div class="icon-color-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffd740" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><rect x="4" y="4" width="16" height="4" rx="1"/><line x1="8" y1="8" x2="6" y2="14"/><line x1="16" y1="8" x2="18" y2="14"/></svg>
        <span>Lights</span>
        <span class="hex">#FFD740</span>
      </div>
      <div class="icon-color-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M12 3C12 3 5 11 5 15C5 18.87 8.13 22 12 22C15.87 22 19 18.87 19 15C19 11 12 3 12 3Z"/></svg>
        <span>Water/Humidity</span>
        <span class="hex">#4FC3F7</span>
      </div>
      <div class="icon-color-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ff5252" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><path d="M12 21C8 21 5 18 5 14C5 10 8 8 10 6C10 10 14 11 14 7C14 5 12 3 12 3C16 5 19 9 19 14C19 18 16 21 12 21Z"/></svg>
        <span>Heat</span>
        <span class="hex">#FF5252</span>
      </div>
      <div class="icon-color-chip">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ff9100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><rect x="5" y="6" width="14" height="12" rx="2"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/></svg>
        <span>Outlets</span>
        <span class="hex">#FF9100</span>
      </div>
    </div>

    <div class="callout info">
      <strong>Design Rule:</strong> Every port icon sits inside a 24×24px rounded container 
      with a 10% opacity tinted background matching the icon color. This creates the colored 
      "chip" effect visible in the AC Infinity app's port status area. The icon itself renders 
      at 14px with a 2px stroke weight inside the container.
    </div>

    <h4>Animation States for Status Icons</h4>
    <table class="spec-table">
      <thead><tr><th>Icon</th><th>State</th><th>Animation</th><th>CSS</th></tr></thead>
      <tbody>
        <tr><td>Online dot</td><td>Connected</td><td>Gentle pulse (opacity + scale)</td><td><code>animation: pulse 2s ease infinite</code></td></tr>
        <tr><td>Stale dot</td><td>>2min no data</td><td>Static (no animation)</td><td>None — static orange</td></tr>
        <tr><td>Offline dot</td><td>>5min no data</td><td>Static (no animation)</td><td>None — static red</td></tr>
        <tr><td>Alarm triangle</td><td>Threshold hit</td><td>Fast blink</td><td><code>animation: blink 1s ease infinite</code></td></tr>
        <tr><td>WiFi icon</td><td>Active sync</td><td>Subtle glow pulse</td><td><code>filter: drop-shadow(0 0 Npx ...)</code></td></tr>
        <tr><td>Fan icon</td><td>Port active</td><td>Rotate (optional, playful)</td><td><code>animation: rotate 2s linear infinite</code></td></tr>
      </tbody>
    </table>
  </div>
</section>

<footer>
  <div class="container">
    EnviroFlow Icon Reference v1.0 — Companion to the UI/UX Design System — February 2026
  </div>
</footer>

</body>
</html>