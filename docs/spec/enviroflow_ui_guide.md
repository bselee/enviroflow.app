<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EnviroFlow UI/UX Design System — AC Infinity–Inspired Coding Guide</title>
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
  --text-primary: #e8edf4;
  --text-secondary: #8896a8;
  --text-dim: #4a5568;
  --border-subtle: rgba(255,255,255,0.06);
  --border-active: rgba(0, 212, 255, 0.3);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --shadow-card: 0 2px 12px rgba(0,0,0,0.4);
  --shadow-glow: 0 0 20px rgba(0, 212, 255, 0.1);
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

/* ===== NOISE OVERLAY ===== */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9999;
}

/* ===== SCROLLBAR ===== */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--accent-cyan-dim); border-radius: 3px; }

/* ===== LAYOUT ===== */
.container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }

/* ===== HERO ===== */
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  overflow: hidden;
  padding: 80px 0;
}

.hero::before {
  content: '';
  position: absolute;
  top: -200px; right: -200px;
  width: 800px; height: 800px;
  background: radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 60%);
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  bottom: -100px; left: -100px;
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(0,230,118,0.04) 0%, transparent 60%);
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
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-cyan);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 32px;
}

.hero-badge::before {
  content: '';
  width: 8px; height: 8px;
  background: var(--accent-cyan);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.hero h1 {
  font-size: clamp(42px, 6vw, 80px);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -2px;
  margin-bottom: 24px;
}

.hero h1 .gradient {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 20px;
  color: var(--text-secondary);
  max-width: 640px;
  line-height: 1.6;
  margin-bottom: 48px;
}

.hero-meta {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}

.hero-meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-meta-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text-dim);
  font-weight: 600;
}

.hero-meta-value {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
}

/* ===== NAV ===== */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10, 14, 20, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 32px;
}

.nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 8px 0;
}

.nav-inner::-webkit-scrollbar { display: none; }

.nav-link {
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: var(--transition);
  letter-spacing: 0.3px;
}

.nav-link:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.04);
}

.nav-link.active {
  color: var(--accent-cyan);
  background: var(--accent-cyan-glow);
}

/* ===== SECTIONS ===== */
section {
  padding: 100px 0;
  border-top: 1px solid var(--border-subtle);
}

.section-header {
  margin-bottom: 64px;
}

.section-number {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--accent-cyan);
  font-weight: 600;
  letter-spacing: 2px;
  margin-bottom: 12px;
}

.section-title {
  font-size: clamp(32px, 4vw, 48px);
  font-weight: 800;
  letter-spacing: -1px;
  line-height: 1.1;
  margin-bottom: 16px;
}

.section-desc {
  font-size: 17px;
  color: var(--text-secondary);
  max-width: 640px;
  line-height: 1.6;
}

/* ===== CARDS ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 20px;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 32px;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}

.card:hover {
  border-color: var(--border-active);
  box-shadow: var(--shadow-glow);
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 20px;
}

.card-icon.cyan { background: rgba(0,212,255,0.1); color: var(--accent-cyan); }
.card-icon.green { background: rgba(0,230,118,0.1); color: var(--accent-green); }
.card-icon.orange { background: rgba(255,145,0,0.1); color: var(--accent-orange); }
.card-icon.red { background: rgba(255,82,82,0.1); color: var(--accent-red); }
.card-icon.purple { background: rgba(179,136,255,0.1); color: var(--accent-purple); }

.card h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 10px;
}

.card p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ===== COLOR SWATCHES ===== */
.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.color-swatch {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}

.color-swatch-preview {
  height: 80px;
  position: relative;
}

.color-swatch-info {
  padding: 14px 16px;
  background: var(--bg-card);
}

.color-swatch-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.color-swatch-hex {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.color-swatch-usage {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 4px;
}

/* ===== CODE BLOCKS ===== */
.code-block {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
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
  font-size: 11px;
  color: var(--accent-cyan);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.code-block-file {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.code-block pre {
  padding: 20px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
  tab-size: 2;
}

.code-block pre code { color: inherit; }

/* Syntax coloring classes */
.ck { color: var(--text-dim); } /* comment */
.cs { color: var(--accent-cyan); } /* string */
.cn { color: var(--accent-orange); } /* number */
.cp { color: var(--accent-purple); } /* property/keyword */
.cf { color: var(--accent-green); } /* function */
.ct { color: var(--accent-red); } /* tag */
.cv { color: var(--text-primary); } /* value */

/* ===== TABLES ===== */
.spec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 24px 0;
}

.spec-table th {
  text-align: left;
  padding: 14px 18px;
  background: var(--bg-card);
  border-bottom: 2px solid var(--accent-cyan-dim);
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent-cyan);
}

.spec-table td {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.spec-table tr:hover td {
  background: rgba(255,255,255,0.02);
}

.spec-table code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: rgba(0,212,255,0.08);
  color: var(--accent-cyan);
  padding: 2px 8px;
  border-radius: 4px;
}

/* ===== COMPONENT PREVIEWS ===== */
.preview-frame {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 24px 0;
  min-height: 300px;
}

/* ===== MOCK DEVICE CARD ===== */
.mock-device-card {
  width: 360px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.mock-device-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.mock-device-name {
  font-weight: 700;
  font-size: 15px;
}

.mock-device-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--accent-green);
  font-weight: 600;
}

.mock-device-status::before {
  content: '';
  width: 6px; height: 6px;
  background: var(--accent-green);
  border-radius: 50%;
}

.mock-readings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border-subtle);
}

.mock-reading {
  background: var(--bg-card);
  padding: 16px;
  text-align: center;
}

.mock-reading-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  margin-bottom: 6px;
  font-weight: 600;
}

.mock-reading-value {
  font-size: 28px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.mock-reading-unit {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.mock-ports {
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mock-port {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.mock-port-name { color: var(--text-secondary); font-weight: 500; }
.mock-port-level {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--accent-cyan);
  font-size: 16px;
}

.mock-port-icon {
  font-size: 14px;
  margin-right: 6px;
}

/* ===== MOCK AUTOMATION CARD ===== */
.mock-automation {
  width: 360px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  padding: 20px;
}

.mock-automation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.mock-automation-name {
  font-weight: 700;
  font-size: 15px;
}

.mock-toggle {
  width: 48px;
  height: 26px;
  background: var(--accent-cyan);
  border-radius: 13px;
  position: relative;
  cursor: pointer;
}

.mock-toggle::after {
  content: '';
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
}

.mock-automation-schedule {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.mock-automation-params {
  font-size: 12px;
  color: var(--text-dim);
}

.mock-automation-bar {
  height: 32px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  margin-top: 16px;
  position: relative;
  overflow: hidden;
}

.mock-automation-bar-fill {
  position: absolute;
  top: 0;
  left: 20%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, var(--accent-cyan-glow), rgba(0,212,255,0.3));
  border-left: 2px solid var(--accent-cyan);
  border-right: 2px solid var(--accent-cyan);
}

/* ===== MOCK GAUGE ===== */
.mock-gauge-wrapper {
  text-align: center;
}

.mock-gauge {
  width: 200px;
  height: 200px;
  position: relative;
}

.mock-gauge svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.mock-gauge circle {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
}

.mock-gauge .bg { stroke: var(--bg-surface); }
.mock-gauge .fill {
  stroke: var(--accent-cyan);
  stroke-dasharray: 502;
  stroke-dashoffset: 200;
  filter: drop-shadow(0 0 6px rgba(0,212,255,0.4));
}

.mock-gauge-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.mock-gauge-value {
  font-size: 36px;
  font-weight: 800;
  font-family: var(--font-mono);
}

.mock-gauge-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ===== TYPOGRAPHY SHOWCASE ===== */
.type-showcase {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 24px 0;
}

.type-row {
  display: flex;
  align-items: baseline;
  gap: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.type-label {
  min-width: 140px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent-cyan);
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.type-sample { flex: 1; }

/* ===== SPACING & GRID EXAMPLES ===== */
.spacing-demo {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin: 24px 0;
}

.spacing-block {
  background: var(--accent-cyan-glow);
  border: 1px solid var(--accent-cyan-dim);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent-cyan);
  font-weight: 600;
}

/* ===== CALLOUTS ===== */
.callout {
  padding: 20px 24px;
  border-radius: var(--radius-md);
  margin: 24px 0;
  font-size: 14px;
  line-height: 1.6;
}

.callout.info {
  background: rgba(0,212,255,0.06);
  border-left: 3px solid var(--accent-cyan);
  color: var(--text-secondary);
}

.callout.warning {
  background: rgba(255,145,0,0.06);
  border-left: 3px solid var(--accent-orange);
  color: var(--text-secondary);
}

.callout.critical {
  background: rgba(255,82,82,0.06);
  border-left: 3px solid var(--accent-red);
  color: var(--text-secondary);
}

.callout strong {
  color: var(--text-primary);
}

/* ===== TOC ===== */
.toc {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 32px;
  margin: 40px 0;
}

.toc h3 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--accent-cyan);
  margin-bottom: 20px;
  font-weight: 700;
}

.toc-list {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 8px;
}

.toc-list a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  transition: var(--transition);
}

.toc-list a:hover {
  background: rgba(255,255,255,0.03);
  color: var(--text-primary);
}

.toc-list .toc-num {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent-cyan-dim);
  font-weight: 600;
  min-width: 28px;
}

/* ===== COMPONENT ANATOMY ===== */
.anatomy {
  position: relative;
  margin: 32px 0;
}

.anatomy-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--accent-cyan);
  color: var(--bg-primary);
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  position: absolute;
  white-space: nowrap;
}

/* ===== TWO COLUMNS ===== */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: start;
}

@media (max-width: 768px) {
  .two-col { grid-template-columns: 1fr; }
  .hero h1 { letter-spacing: -1px; }
  .card-grid { grid-template-columns: 1fr; }
  .mock-device-card, .mock-automation { width: 100%; }
  .preview-frame { padding: 20px; }
  .type-row { flex-direction: column; gap: 8px; }
}

/* ===== FILE STRUCTURE ===== */
.file-tree {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 2;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 24px;
  margin: 20px 0;
}

.file-tree .dir { color: var(--accent-cyan); font-weight: 600; }
.file-tree .file { color: var(--text-secondary); }
.file-tree .desc { color: var(--text-dim); font-size: 11px; }

/* ===== BADGES ===== */
.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge.required { background: rgba(255,82,82,0.15); color: var(--accent-red); }
.badge.recommended { background: rgba(0,212,255,0.15); color: var(--accent-cyan); }
.badge.optional { background: rgba(255,255,255,0.06); color: var(--text-dim); }

/* ===== SUB SECTIONS ===== */
h4 {
  font-size: 20px;
  font-weight: 700;
  margin: 48px 0 16px;
  padding-top: 24px;
  border-top: 1px solid var(--border-subtle);
}

h4:first-of-type { border-top: none; padding-top: 0; }

.sub-text {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 20px;
}

.inline-code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: rgba(0,212,255,0.08);
  color: var(--accent-cyan);
  padding: 2px 8px;
  border-radius: 4px;
}

/* ===== FOOTER ===== */
footer {
  border-top: 1px solid var(--border-subtle);
  padding: 60px 0;
  text-align: center;
  color: var(--text-dim);
  font-size: 13px;
}

footer .brand {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8px;
}
</style>
</head>
<body>

<!-- ===== HERO ===== -->
<div class="hero">
  <div class="container">
    <div class="hero-badge">UI/UX Design System</div>
    <h1>
      EnviroFlow<br>
      <span class="gradient">Coding Guide</span>
    </h1>
    <p class="hero-subtitle">
      A comprehensive UI/UX specification inspired by AC Infinity's environmental controller app. 
      This guide deconstructs every pattern, component, and interaction to give your development 
      team a pixel-perfect blueprint for building a world-class grow environment dashboard.
    </p>
    <div class="hero-meta">
      <div class="hero-meta-item">
        <span class="hero-meta-label">Platform</span>
        <span class="hero-meta-value">React + TypeScript</span>
      </div>
      <div class="hero-meta-item">
        <span class="hero-meta-label">Style</span>
        <span class="hero-meta-value">Tailwind CSS + CSS Variables</span>
      </div>
      <div class="hero-meta-item">
        <span class="hero-meta-label">Theme</span>
        <span class="hero-meta-value">Dark Industrial HUD</span>
      </div>
      <div class="hero-meta-item">
        <span class="hero-meta-label">Sections</span>
        <span class="hero-meta-value">12 Comprehensive Modules</span>
      </div>
    </div>
  </div>
</div>

<!-- ===== NAV ===== -->
<nav class="nav">
  <div class="nav-inner">
    <a href="#philosophy" class="nav-link active">Philosophy</a>
    <a href="#colors" class="nav-link">Colors</a>
    <a href="#typography" class="nav-link">Typography</a>
    <a href="#layout" class="nav-link">Layout</a>
    <a href="#components" class="nav-link">Components</a>
    <a href="#device-dashboard" class="nav-link">Dashboard</a>
    <a href="#automations" class="nav-link">Automations</a>
    <a href="#data-viz" class="nav-link">Data Viz</a>
    <a href="#controls" class="nav-link">Controls</a>
    <a href="#navigation" class="nav-link">Navigation</a>
    <a href="#animations" class="nav-link">Animation</a>
    <a href="#architecture" class="nav-link">Architecture</a>
  </div>
</nav>

<!-- ===== TABLE OF CONTENTS ===== -->
<div class="container">
  <div class="toc">
    <h3>Table of Contents</h3>
    <ul class="toc-list">
      <li><a href="#philosophy"><span class="toc-num">01</span> Design Philosophy & Principles</a></li>
      <li><a href="#colors"><span class="toc-num">02</span> Color System & Theming</a></li>
      <li><a href="#typography"><span class="toc-num">03</span> Typography Scale</a></li>
      <li><a href="#layout"><span class="toc-num">04</span> Layout Grid & Spacing</a></li>
      <li><a href="#components"><span class="toc-num">05</span> Core Components</a></li>
      <li><a href="#device-dashboard"><span class="toc-num">06</span> Device Dashboard (Home)</a></li>
      <li><a href="#automations"><span class="toc-num">07</span> Automation System</a></li>
      <li><a href="#data-viz"><span class="toc-num">08</span> Data Visualization</a></li>
      <li><a href="#controls"><span class="toc-num">09</span> Controls & Inputs</a></li>
      <li><a href="#navigation"><span class="toc-num">10</span> Navigation Architecture</a></li>
      <li><a href="#animations"><span class="toc-num">11</span> Animation & Motion</a></li>
      <li><a href="#architecture"><span class="toc-num">12</span> File Architecture & Stack</a></li>
    </ul>
  </div>
</div>

<!-- ===== 01: PHILOSOPHY ===== -->
<section id="philosophy">
  <div class="container">
    <div class="section-header">
      <div class="section-number">01 — DESIGN PHILOSOPHY</div>
      <h2 class="section-title">Dark Industrial HUD</h2>
      <p class="section-desc">
        The AC Infinity app establishes a design language that merges IoT control-room precision 
        with the organic warmth of grow-environment management. Every design decision optimizes 
        for at-a-glance monitoring and confident control of environmental equipment.
      </p>
    </div>

    <div class="card-grid">
      <div class="card">
        <div class="card-icon cyan">◉</div>
        <h3>Dark-First Design</h3>
        <p>
          The entire UI is built on a near-black foundation (#0A0E14 → #1A2332). This isn't 
          aesthetic preference — it's functional. Growers often check devices in dark grow rooms 
          or at night. Dark backgrounds reduce eye strain and make luminous data points (cyan readings, 
          green status indicators) immediately scannable. All backgrounds use cool-blue undertones, 
          never pure neutral gray.
        </p>
      </div>
      <div class="card">
        <div class="card-icon green">⚡</div>
        <h3>Glanceable Hierarchy</h3>
        <p>
          The most critical data (temperature, humidity, VPD) is always the largest element on screen 
          at 28–36px monospaced type. Port status and device levels use a secondary tier (16–20px). 
          Labels and metadata are tertiary (10–12px uppercase tracking). A user should know their 
          environment's status within 0.5 seconds of opening the app.
        </p>
      </div>
      <div class="card">
        <div class="card-icon orange">◈</div>
        <h3>Card-Based Architecture</h3>
        <p>
          Every device is a self-contained card that expands/collapses to reveal port details. 
          This pattern scales from 1 controller to 20+ without UI complexity growing. Cards group 
          related information (readings + ports + status) into scannable units with clear boundaries 
          using subtle borders and elevation shifts.
        </p>
      </div>
      <div class="card">
        <div class="card-icon purple">⊞</div>
        <h3>Progressive Disclosure</h3>
        <p>
          The AC Infinity app uses tabs (Controls → Advance → AI → Data → History → Settings) to 
          layer complexity. Basic users see simple ON/OFF controls. Advanced users access automations, 
          triggers, and data exports. This same pattern should govern EnviroFlow: show what's needed, 
          hide what isn't, reveal on demand.
        </p>
      </div>
      <div class="card">
        <div class="card-icon red">◎</div>
        <h3>Connectivity Awareness</h3>
        <p>
          Every device card displays real-time connection status (Bluetooth icon, WiFi icon, timestamp 
          of last update). The device code (e.g., "E-W4206") is always visible for troubleshooting. 
          Status indicators use a traffic-light system: green = online, orange = degraded/stale data, 
          red = disconnected. This must be a first-class citizen of every device component.
        </p>
      </div>
      <div class="card">
        <div class="card-icon cyan">⟐</div>
        <h3>Precision Control Metaphors</h3>
        <p>
          The Controls tab uses a circular gauge/wheel for fan speed and trigger visualization — 
          a deliberate metaphor echoing physical control dials. Sliders for temperature ranges 
          (32°F–194°F) with colored zones. Time pickers with scroll wheels mimicking physical 
          controllers. Every input should feel like operating premium hardware.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- ===== 02: COLORS ===== -->
<section id="colors">
  <div class="container">
    <div class="section-header">
      <div class="section-number">02 — COLOR SYSTEM</div>
      <h2 class="section-title">The Palette</h2>
      <p class="section-desc">
        AC Infinity's color system is built on deep blue-blacks with electric cyan as the primary 
        accent. The palette communicates precision, technology, and environmental awareness.
      </p>
    </div>

    <h4>Background Layers</h4>
    <p class="sub-text">Five distinct background tones create depth and elevation hierarchy. Never use pure black (#000).</p>
    
    <div class="color-grid">
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #0a0e14;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">bg-primary</div>
          <div class="color-swatch-hex">#0A0E14</div>
          <div class="color-swatch-usage">Main app background, page canvas</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #111820;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">bg-secondary</div>
          <div class="color-swatch-hex">#111820</div>
          <div class="color-swatch-usage">Code blocks, recessed areas, nav bar</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #151c26;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">bg-card</div>
          <div class="color-swatch-hex">#151C26</div>
          <div class="color-swatch-usage">Device cards, panels, modals</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #1a2332;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">bg-card-elevated</div>
          <div class="color-swatch-hex">#1A2332</div>
          <div class="color-swatch-usage">Hovered cards, active states</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #1e2a3a;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">bg-surface</div>
          <div class="color-swatch-hex">#1E2A3A</div>
          <div class="color-swatch-usage">Port chips, input fields, toggles off</div>
        </div>
      </div>
    </div>

    <h4>Accent Colors</h4>
    <p class="sub-text">Each accent serves a specific semantic purpose. Never use accents decoratively without meaning.</p>

    <div class="color-grid">
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #00d4ff;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">accent-cyan</div>
          <div class="color-swatch-hex">#00D4FF</div>
          <div class="color-swatch-usage">PRIMARY — active elements, links, focus rings, port levels</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #00e676;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">accent-green</div>
          <div class="color-swatch-hex">#00E676</div>
          <div class="color-swatch-usage">STATUS — online, connected, healthy, within range</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #ff5252;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">accent-red</div>
          <div class="color-swatch-hex">#FF5252</div>
          <div class="color-swatch-usage">TEMPERATURE — readings, charts, alarms, disconnected</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #4fc3f7;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">reading-blue</div>
          <div class="color-swatch-hex">#4FC3F7</div>
          <div class="color-swatch-usage">HUMIDITY — readings, charts, water/moisture devices</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #b388ff;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">accent-purple</div>
          <div class="color-swatch-hex">#B388FF</div>
          <div class="color-swatch-usage">VPD — readings, charts, AI mode, advanced features</div>
        </div>
      </div>
      <div class="color-swatch">
        <div class="color-swatch-preview" style="background: #ff9100;"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-name">accent-orange</div>
          <div class="color-swatch-hex">#FF9100</div>
          <div class="color-swatch-usage">WARNING — approaching limits, stale data, outlets</div>
        </div>
      </div>
    </div>

    <h4>CSS Variable Implementation</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">CSS</span>
        <span class="code-block-file">tailwind.config.ts / globals.css</span>
      </div>
<pre><code><span class="cp">:root</span> {
  <span class="ck">/* Background Layers — cool blue-black progression */</span>
  <span class="cv">--bg-primary</span>: <span class="cs">#0a0e14</span>;
  <span class="cv">--bg-secondary</span>: <span class="cs">#111820</span>;
  <span class="cv">--bg-card</span>: <span class="cs">#151c26</span>;
  <span class="cv">--bg-card-elevated</span>: <span class="cs">#1a2332</span>;
  <span class="cv">--bg-surface</span>: <span class="cs">#1e2a3a</span>;

  <span class="ck">/* Accent Colors — semantic meaning required */</span>
  <span class="cv">--accent-cyan</span>: <span class="cs">#00d4ff</span>;      <span class="ck">/* primary action, port levels, focus */</span>
  <span class="cv">--accent-cyan-dim</span>: <span class="cs">#007a94</span>;  <span class="ck">/* borders, secondary highlights */</span>
  <span class="cv">--accent-green</span>: <span class="cs">#00e676</span>;     <span class="ck">/* online, healthy, in-range */</span>
  <span class="cv">--accent-red</span>: <span class="cs">#ff5252</span>;       <span class="ck">/* TEMPERATURE readings + alarms */</span>
  <span class="cv">--reading-blue</span>: <span class="cs">#4fc3f7</span>;     <span class="ck">/* HUMIDITY readings + water devices */</span>
  <span class="cv">--accent-purple</span>: <span class="cs">#b388ff</span>;    <span class="ck">/* VPD readings + AI mode */</span>
  <span class="cv">--accent-orange</span>: <span class="cs">#ff9100</span>;    <span class="ck">/* warning, stale data, outlets */</span>

  <span class="ck">/* Glow Effects — for active/focus states */</span>
  <span class="cv">--glow-cyan</span>: <span class="cs">rgba(0, 212, 255, 0.15)</span>;
  <span class="cv">--glow-green</span>: <span class="cs">rgba(0, 230, 118, 0.15)</span>;
  <span class="cv">--glow-red</span>: <span class="cs">rgba(255, 82, 82, 0.15)</span>;

  <span class="ck">/* Text Hierarchy */</span>
  <span class="cv">--text-primary</span>: <span class="cs">#e8edf4</span>;    <span class="ck">/* headings, values */</span>
  <span class="cv">--text-secondary</span>: <span class="cs">#8896a8</span>;  <span class="ck">/* body, descriptions */</span>
  <span class="cv">--text-dim</span>: <span class="cs">#4a5568</span>;         <span class="ck">/* labels, metadata */</span>

  <span class="ck">/* Border System */</span>
  <span class="cv">--border-subtle</span>: <span class="cs">rgba(255,255,255,0.06)</span>;
  <span class="cv">--border-active</span>: <span class="cs">rgba(0, 212, 255, 0.3)</span>;
}</code></pre>
    </div>

    <div class="callout info">
      <strong>Tailwind Integration:</strong> Map these CSS variables to your Tailwind config 
      under <span class="inline-code">theme.extend.colors</span>. Use semantic names like 
      <span class="inline-code">bg-card</span> and <span class="inline-code">text-dim</span> 
      rather than generic gray scales. This ensures every color usage communicates intent.
    </div>
  </div>
</section>

<!-- ===== 03: TYPOGRAPHY ===== -->
<section id="typography">
  <div class="container">
    <div class="section-header">
      <div class="section-number">03 — TYPOGRAPHY</div>
      <h2 class="section-title">Type Scale</h2>
      <p class="section-desc">
        Two font families create the dual personality: a geometric sans-serif for UI chrome 
        and a monospace for data precision. The AC Infinity app uses this exact duality.
      </p>
    </div>

    <div class="two-col">
      <div>
        <h4>Font Stack</h4>
        <table class="spec-table">
          <thead><tr><th>Role</th><th>Font</th><th>Usage</th></tr></thead>
          <tbody>
            <tr><td>UI / Display</td><td><code>Outfit</code></td><td>Headings, labels, buttons, nav</td></tr>
            <tr><td>Data / Mono</td><td><code>JetBrains Mono</code></td><td>Readings, values, codes, time</td></tr>
            <tr><td>Fallback</td><td><code>system-ui</code></td><td>If webfonts fail to load</td></tr>
          </tbody>
        </table>

        <div class="callout info">
          <strong>Why these fonts?</strong> Outfit is a modern geometric sans with excellent weight range 
          (300–900) and clean forms that match the technical-industrial aesthetic. JetBrains Mono has 
          distinctive character forms that make numbers highly legible at all sizes — critical for 
          environmental readings. Both are free Google Fonts.
        </div>
      </div>
      <div>
        <h4>Type Scale</h4>
        <table class="spec-table">
          <thead><tr><th>Token</th><th>Size</th><th>Weight</th><th>Use Case</th></tr></thead>
          <tbody>
            <tr><td><code>display-xl</code></td><td>48px</td><td>900</td><td>Page titles</td></tr>
            <tr><td><code>display-lg</code></td><td>36px</td><td>800</td><td>Sensor readings</td></tr>
            <tr><td><code>heading-lg</code></td><td>24px</td><td>700</td><td>Section headers</td></tr>
            <tr><td><code>heading-md</code></td><td>18px</td><td>700</td><td>Card titles</td></tr>
            <tr><td><code>heading-sm</code></td><td>15px</td><td>600</td><td>Sub-headers</td></tr>
            <tr><td><code>body</code></td><td>14px</td><td>400</td><td>General text</td></tr>
            <tr><td><code>body-sm</code></td><td>13px</td><td>400</td><td>Descriptions</td></tr>
            <tr><td><code>caption</code></td><td>11px</td><td>600</td><td>Labels, metadata</td></tr>
            <tr><td><code>micro</code></td><td>10px</td><td>600</td><td>Units (°F, %, kPa)</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <h4>Typography Showcase</h4>
    <div class="type-showcase">
      <div class="type-row">
        <span class="type-label">display-xl</span>
        <div class="type-sample" style="font-size:48px; font-weight:900;">Grow Tent 2×4</div>
      </div>
      <div class="type-row">
        <span class="type-label">data / mono</span>
        <div class="type-sample" style="font-family:var(--font-mono); font-size:36px; font-weight:700;"><span style="color:#ff5252;">75.1°F</span> &nbsp; <span style="color:#4fc3f7;">52.6%</span> &nbsp; <span style="color:#b388ff;">1.34 kPa</span></div>
      </div>
      <div class="type-row">
        <span class="type-label">heading-lg</span>
        <div class="type-sample" style="font-size:24px; font-weight:700;">Advance Automations</div>
      </div>
      <div class="type-row">
        <span class="type-label">caption</span>
        <div class="type-sample" style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-dim);">Temperature &nbsp;&nbsp; Humidity &nbsp;&nbsp; VPD</div>
      </div>
    </div>

    <div class="callout warning">
      <strong>Critical Rule:</strong> All sensor/environmental readings MUST use the monospace font. 
      All reading labels MUST be uppercase with 1–2px letter-spacing. This is the single most 
      important typographic rule for maintaining the "control room" aesthetic.
    </div>
  </div>
</section>

<!-- ===== 04: LAYOUT ===== -->
<section id="layout">
  <div class="container">
    <div class="section-header">
      <div class="section-number">04 — LAYOUT GRID & SPACING</div>
      <h2 class="section-title">Spatial System</h2>
      <p class="section-desc">
        A consistent 4px base grid with an 8px spacing scale ensures rhythmic alignment 
        across all components. The AC Infinity app uses tight, information-dense layouts 
        with clear visual separation.
      </p>
    </div>

    <h4>Spacing Scale (8px base)</h4>
    <div class="spacing-demo">
      <div>
        <div class="spacing-block" style="width:4px; height:4px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">2</div>
      </div>
      <div>
        <div class="spacing-block" style="width:8px; height:8px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">4</div>
      </div>
      <div>
        <div class="spacing-block" style="width:16px; height:16px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">8</div>
      </div>
      <div>
        <div class="spacing-block" style="width:24px; height:24px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">12</div>
      </div>
      <div>
        <div class="spacing-block" style="width:32px; height:32px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">16</div>
      </div>
      <div>
        <div class="spacing-block" style="width:40px; height:40px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">20</div>
      </div>
      <div>
        <div class="spacing-block" style="width:48px; height:48px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">24</div>
      </div>
      <div>
        <div class="spacing-block" style="width:64px; height:64px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">32</div>
      </div>
      <div>
        <div class="spacing-block" style="width:80px; height:80px;"></div>
        <div style="font-size:10px; color:var(--text-dim); text-align:center; margin-top:4px;">40</div>
      </div>
    </div>

    <h4>Border Radius Scale</h4>
    <table class="spec-table">
      <thead><tr><th>Token</th><th>Value</th><th>Use Case</th></tr></thead>
      <tbody>
        <tr><td><code>radius-sm</code></td><td>6px</td><td>Buttons, chips, port indicators, badges</td></tr>
        <tr><td><code>radius-md</code></td><td>10px</td><td>Input fields, code blocks, small cards</td></tr>
        <tr><td><code>radius-lg</code></td><td>16px</td><td>Device cards, modals, panels</td></tr>
        <tr><td><code>radius-xl</code></td><td>24px</td><td>Floating action buttons, hero elements</td></tr>
        <tr><td><code>radius-full</code></td><td>9999px</td><td>Pills, toggle tracks, status dots</td></tr>
      </tbody>
    </table>

    <h4>Device Card Layout Spec</h4>
    <p class="sub-text">
      The device card is the fundamental unit of the dashboard. Here's the exact specification 
      matching the AC Infinity app's layout:
    </p>

    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">Layout Spec</span>
        <span class="code-block-file">Device Card Dimensions</span>
      </div>
<pre><code><span class="ck">/* Device Card — Full Width on Mobile, Max 480px on Desktop */</span>

┌─────────────────────────────────────────────┐
│  <span class="cf">HEADER</span>: pad 16px 20px                        │
│  ┌─────────┐            <span class="cs">E-W4206</span>  ✦ WiFi    │
│  │ <span class="cp">ICON</span>    │  <span class="cv">GROW TENT 2x2</span>                │
│  │ 32x32   │            <span class="ck">JUN 14, 4:52 PM</span>    │
│  └─────────┘                                │
├─────────────────────────────────────────────┤
│  <span class="cf">READINGS</span>: 3-col grid, 1px gap border         │
│  ┌─────────────┬─────────────┬─────────────┐│
│  │ <span class="ck">TEMPERATURE</span> │ <span class="ck">HUMIDITY</span>    │ <span class="ck">VPD</span>         ││
│  │  <span class="cn">75.1</span> °F   │  <span class="cn">52.6</span> %    │  <span class="cn">1.34</span> kPa  ││
│  │ pad 16px    │ pad 16px    │ pad 16px    ││
│  └─────────────┴─────────────┴─────────────┘│
├─────────────────────────────────────────────┤
│  <span class="cf">PORTS</span>: 2-col grid, gap 10px, pad 16px 20px   │
│  ┌──────────────────┬──────────────────┐    │
│  │ ⊙ Port 1: ION B. │ ⊙ Port 2: Clou. │    │
│  │   ADVANCE    <span class="cn">6</span>   │   ON          <span class="cn">1</span>  │    │
│  ├──────────────────┼──────────────────┤    │
│  │ ☁ Port 3: Cloud  │ ☁ Port 4: S6 De │    │
│  │   ON          <span class="cn">0</span>  │   ON          <span class="cn">0</span>  │    │
│  └──────────────────┴──────────────────┘    │
│                     ▾ <span class="ck">(collapse toggle)</span>      │
└─────────────────────────────────────────────┘</code></pre>
    </div>
  </div>
</section>

<!-- ===== 05: COMPONENTS ===== -->
<section id="components">
  <div class="container">
    <div class="section-header">
      <div class="section-number">05 — CORE COMPONENTS</div>
      <h2 class="section-title">Component Library</h2>
      <p class="section-desc">
        Every component maps to an AC Infinity UI element. Build these as isolated, 
        reusable React components with TypeScript interfaces.
      </p>
    </div>

    <h4>Device Card — Live Preview</h4>
    <div class="preview-frame">
      <div class="mock-device-card">
        <div class="mock-device-header">
          <div>
            <div class="mock-device-name">GROW TENT 2×2</div>
          </div>
          <div class="mock-device-status">ONLINE</div>
        </div>
        <div class="mock-readings">
          <div class="mock-reading">
            <div class="mock-reading-label">Temperature</div>
            <div class="mock-reading-value" style="color:#ff5252;">75.1<span class="mock-reading-unit">°F</span></div>
          </div>
          <div class="mock-reading">
            <div class="mock-reading-label">Humidity</div>
            <div class="mock-reading-value" style="color:#4fc3f7;">52.6<span class="mock-reading-unit">%</span></div>
          </div>
          <div class="mock-reading">
            <div class="mock-reading-label">VPD</div>
            <div class="mock-reading-value" style="color:#b388ff;">1.34<span class="mock-reading-unit">kPa</span></div>
          </div>
        </div>
        <div class="mock-ports">
          <div class="mock-port">
            <span><span class="mock-port-icon">⊙</span><span class="mock-port-name">Port 1</span></span>
            <span class="mock-port-level">6</span>
          </div>
          <div class="mock-port">
            <span><span class="mock-port-icon">⊙</span><span class="mock-port-name">Port 2</span></span>
            <span class="mock-port-level">1</span>
          </div>
          <div class="mock-port">
            <span><span class="mock-port-icon">☁</span><span class="mock-port-name">Port 3</span></span>
            <span class="mock-port-level">0</span>
          </div>
          <div class="mock-port">
            <span><span class="mock-port-icon">☁</span><span class="mock-port-name">Port 4</span></span>
            <span class="mock-port-level">0</span>
          </div>
        </div>
      </div>
    </div>

    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">TypeScript</span>
        <span class="code-block-file">types/device.ts</span>
      </div>
<pre><code><span class="cp">interface</span> <span class="cf">Device</span> {
  id: <span class="cp">string</span>;
  name: <span class="cp">string</span>;
  code: <span class="cp">string</span>;               <span class="ck">// e.g., "E-W4206"</span>
  type: <span class="cs">'controller'</span> | <span class="cs">'hygrometer'</span>;
  connectivity: <span class="cs">'bluetooth'</span> | <span class="cs">'wifi'</span> | <span class="cs">'offline'</span>;
  lastSeen: <span class="cp">Date</span>;
  readings: {
    temperature: <span class="cp">number</span>;     <span class="ck">// Fahrenheit</span>
    humidity: <span class="cp">number</span>;        <span class="ck">// Percentage</span>
    vpd: <span class="cp">number</span>;             <span class="ck">// kPa</span>
  };
  ports: <span class="cf">Port</span>[];
}

<span class="cp">interface</span> <span class="cf">Port</span> {
  id: <span class="cp">number</span>;               <span class="ck">// 1–4 (or 1–8 for Pro+)</span>
  name: <span class="cp">string</span>;             <span class="ck">// User-assigned name</span>
  deviceType: <span class="cs">'fan'</span> | <span class="cs">'light'</span> | <span class="cs">'outlet'</span> | <span class="cs">'humidifier'</span> | <span class="cs">'heater'</span>;
  mode: <span class="cs">'off'</span> | <span class="cs">'on'</span> | <span class="cs">'auto'</span> | <span class="cs">'vpd'</span> | <span class="cs">'timer'</span> | <span class="cs">'cycle'</span> | <span class="cs">'schedule'</span> | <span class="cs">'advance'</span>;
  level: <span class="cp">number</span>;            <span class="ck">// 0–10</span>
  trend: <span class="cs">'up'</span> | <span class="cs">'down'</span> | <span class="cs">'steady'</span>;
}

<span class="cp">interface</span> <span class="cf">Automation</span> {
  id: <span class="cp">string</span>;
  name: <span class="cp">string</span>;
  enabled: <span class="cp">boolean</span>;
  schedule: {
    startTime: <span class="cp">string</span>;     <span class="ck">// "09:00"</span>
    endTime: <span class="cp">string</span>;       <span class="ck">// "17:00"</span>
    days: <span class="cp">string</span>[];        <span class="ck">// ["Mon","Tue",...] or ["Everyday"]</span>
  };
  mode: <span class="cs">'off'</span> | <span class="cs">'on'</span> | <span class="cs">'auto'</span>;
  triggers?: {
    temperature?: { min: <span class="cp">number</span>; max: <span class="cp">number</span> };
    humidity?: { min: <span class="cp">number</span>; max: <span class="cp">number</span> };
  };
  targetPorts: <span class="cp">number</span>[];
}</code></pre>
    </div>

    <h4>Automation Card — Live Preview</h4>
    <div class="preview-frame">
      <div class="mock-automation">
        <div class="mock-automation-header">
          <div class="mock-automation-name">🅰 Automation</div>
          <div class="mock-toggle"></div>
        </div>
        <div class="mock-automation-schedule">9:00am – 5:00pm · AUTO</div>
        <div class="mock-automation-params">H 75°F / L 54°F · H 54% / L 39% &nbsp;·&nbsp; Everyday &nbsp;·&nbsp; Min: 1 / Max: 3</div>
        <div class="mock-automation-bar">
          <div class="mock-automation-bar-fill"></div>
        </div>
      </div>
    </div>

    <h4>Component Checklist</h4>
    <table class="spec-table">
      <thead><tr><th>Component</th><th>AC Infinity Equivalent</th><th>Priority</th></tr></thead>
      <tbody>
        <tr><td>DeviceCard</td><td>Device Homepage card (expanded/collapsed)</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>ReadingDisplay</td><td>Temp/Humidity/VPD trio with labels</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>PortStatus</td><td>Port chip showing type, mode, level</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>ControlWheel</td><td>Circular gauge with speed/trigger hands</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>AutomationCard</td><td>Advance tab automation entry</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>AutomationForm</td><td>Add Device modal (name, time, mode, triggers)</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>ToggleSwitch</td><td>Cyan/off toggle for enabling features</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>TimelineBand</td><td>24hr bar showing active automation windows</td><td><span class="badge recommended">Recommended</span></td></tr>
        <tr><td>ClimateChart</td><td>Data tab — line/area chart (hr/day/wk/mo/yr)</td><td><span class="badge recommended">Recommended</span></td></tr>
        <tr><td>RangeSlider</td><td>Temperature trigger slider (32°F–194°F)</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>ConnectionBadge</td><td>BT/WiFi icon + last-seen timestamp</td><td><span class="badge required">Required</span></td></tr>
        <tr><td>HistoryLog</td><td>History tab — trigger/alert event list</td><td><span class="badge optional">Optional</span></td></tr>
      </tbody>
    </table>
  </div>
</section>

<!-- ===== 06: DEVICE DASHBOARD ===== -->
<section id="device-dashboard">
  <div class="container">
    <div class="section-header">
      <div class="section-number">06 — DEVICE DASHBOARD</div>
      <h2 class="section-title">Home Screen</h2>
      <p class="section-desc">
        The "DEVICES" page is the app's front door. It must communicate the status of every 
        connected controller and sensor at a glance. Here's the complete specification.
      </p>
    </div>

    <h4>Screen Architecture</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">Layout</span>
        <span class="code-block-file">Dashboard Screen Structure</span>
      </div>
<pre><code>┌──────────────────────────────────────────────┐
│  <span class="cf">TOP BAR</span> (sticky, blur backdrop)                │
│  ☰ Account     <span class="cv">DEVICES</span>            + Add Device │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  <span class="cp">DeviceCard</span> — GROW TENT 2×2          │    │
│  │  ✦ E-W4206 · WiFi · Jun 14 4:52PM   │    │
│  │  ┌──────┬──────┬──────┐              │    │
│  │  │75.1°F│52.6% │1.34kP│ <span class="ck">← Readings</span>  │    │
│  │  └──────┴──────┴──────┘              │    │
│  │  ┌──────────┬──────────┐             │    │
│  │  │ Port 1: 6│ Port 2: 1│ <span class="ck">← Ports</span>    │    │
│  │  │ Port 3: 0│ Port 4: 0│             │    │
│  │  └──────────┴──────────┘             │    │
│  │           ▾ Collapse                 │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  <span class="cp">DeviceCard</span> — GROW TENT 2×4          │    │
│  │  <span class="ck">(collapsed — readings only)</span>          │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  <span class="cp">DeviceCard</span> — HYGROMETER              │    │
│  │  <span class="ck">(sensor-only, no ports)</span>              │    │
│  └──────────────────────────────────────┘    │
│                                              │
└──────────────────────────────────────────────┘</code></pre>
    </div>

    <h4>Key Behaviors</h4>
    <div class="card-grid">
      <div class="card">
        <div class="card-icon cyan">↕</div>
        <h3>Expand / Collapse</h3>
        <p>
          Cards default to <strong>expanded</strong> showing ports. Tapping the chevron (▾/▴) 
          collapses to readings-only view. State persists in localStorage. Transition: 250ms 
          ease-out with height animation via <span class="inline-code">max-height</span> or 
          Framer Motion's <span class="inline-code">AnimatePresence</span>.
        </p>
      </div>
      <div class="card">
        <div class="card-icon green">→</div>
        <h3>Card Navigation</h3>
        <p>
          Tapping anywhere on the card (except the collapse toggle) navigates to the device's 
          detail view with tabs: Controls → Advance → AI → Data → History → Settings. This is 
          a full-page route, not a modal.
        </p>
      </div>
      <div class="card">
        <div class="card-icon orange">↻</div>
        <h3>Real-Time Updates</h3>
        <p>
          Readings update every 5–15 seconds via WebSocket or polling. Stale data (>2 min) 
          triggers orange timestamp. Disconnected (>5 min) triggers red status badge. Use 
          <span class="inline-code">transition: color 0.3s</span> when values change to create 
          a subtle "tick" effect.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- ===== 07: AUTOMATIONS ===== -->
<section id="automations">
  <div class="container">
    <div class="section-header">
      <div class="section-number">07 — AUTOMATION SYSTEM</div>
      <h2 class="section-title">Advance Tab</h2>
      <p class="section-desc">
        The automation system is where the AC Infinity app's UI truly shines — complex 
        time-based and trigger-based rules presented through clean, scannable cards.
      </p>
    </div>

    <h4>Automation List View</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">Layout</span>
        <span class="code-block-file">Advance Tab Structure</span>
      </div>
<pre><code>┌──────────────────────────────────────────────┐
│  ← Back        <span class="cv">ADVANCE</span>             ⚙ Settings │
├──────────────────────────────────────────────┤
│  <span class="ck">Port Tabs (horizontal scroll)</span>                │
│  [ All ] [ 1: Port... ] [ 2: Port... ] [ 3: ]│
├────────────────────┬─────────────────────────┤
│   <span class="cp">AUTOMATIONS</span>       │        ALERTS            │
├────────────────────┴─────────────────────────┤
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 🅰 <span class="cv">Automation</span>              <span class="cf">[● ON]</span>    │    │
│  │ 9:00am - 5:00pm · AUTO              │    │
│  │ H 75°F / L 54°F · H 54% / L 39%    │    │
│  │ Everyday · Min: 1 / Max: 3          │    │
│  │ ┌────────────────────────────────┐   │    │
│  │ │<span class="ck">░░░</span><span class="cs">████████████████</span><span class="ck">░░░░░░░░░</span>│   │    │
│  │ └────────────────────────────────┘   │    │
│  └──────────────────────────────────────┘    │
│                                              │
│                               <span class="cf">[ + ]</span> <span class="ck">FAB</span>      │
└──────────────────────────────────────────────┘</code></pre>
    </div>

    <h4>Automation Creation Form</h4>
    <p class="sub-text">
      The "ADD DEVICE" / creation modal from the AC Infinity app (shown in Image 2) follows 
      a specific field order. Implement as a slide-up sheet or full-page form:
    </p>

    <table class="spec-table">
      <thead><tr><th>Field</th><th>Type</th><th>Spec</th></tr></thead>
      <tbody>
        <tr><td>Name</td><td>Text input</td><td>Max 20 chars, shown with char counter "(10/20)"</td></tr>
        <tr><td>Start Time</td><td>Time picker</td><td>Scroll-wheel style, HH:MM + AM/PM segments</td></tr>
        <tr><td>End Time</td><td>Time picker</td><td>Same as start, highlighted in cyan when active</td></tr>
        <tr><td>Mode</td><td>Radio group</td><td>OFF MODE / ON MODE / AUTO MODE — circular radio buttons, right-aligned</td></tr>
        <tr><td>Temperature Trigger</td><td>Dual range slider</td><td>32°F–194°F range, cyan handles, red fill for active zone</td></tr>
        <tr><td>Humidity Trigger</td><td>Dual range slider</td><td>0%–100% range, same visual treatment</td></tr>
        <tr><td>Level Range</td><td>Min/Max inputs</td><td>0–10 numeric, shown when AUTO selected</td></tr>
      </tbody>
    </table>

    <div class="callout critical">
      <strong>Time Picker UX Lesson from AC Infinity Reviews:</strong> Google Play reviews 
      specifically complain that the scroll-based time picker accidentally changes the "start" 
      time when scrolling to set "end" time. For EnviroFlow: use discrete tap-to-select time 
      fields, NOT scroll wheels embedded in a scrollable page. Consider a bottom-sheet time 
      picker that captures scroll events.
    </div>

    <h4>Mode Selector Pattern</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">React TSX</span>
        <span class="code-block-file">components/ModeSelector.tsx</span>
      </div>
<pre><code><span class="cp">type</span> Mode = <span class="cs">'off'</span> | <span class="cs">'on'</span> | <span class="cs">'auto'</span>;

<span class="cp">const</span> modes: { value: Mode; label: <span class="cp">string</span>; desc: <span class="cp">string</span> }[] = [
  { value: <span class="cs">'off'</span>,  label: <span class="cs">'OFF MODE'</span>,  desc: <span class="cs">'Device will be off during scheduled time.'</span> },
  { value: <span class="cs">'on'</span>,   label: <span class="cs">'ON MODE'</span>,   desc: <span class="cs">'Device runs continuously at set level.'</span> },
  { value: <span class="cs">'auto'</span>, label: <span class="cs">'AUTO MODE'</span>, desc: <span class="cs">'Triggers on/off based on temp & humidity.'</span> },
];

<span class="ck">// Visual: vertical stack of radio options</span>
<span class="ck">// Active radio = solid cyan fill</span>
<span class="ck">// Inactive = outlined circle with bg-surface fill</span>
<span class="ck">// Description text below each label in text-dim</span></code></pre>
    </div>
  </div>
</section>

<!-- ===== 08: DATA VIZ ===== -->
<section id="data-viz">
  <div class="container">
    <div class="section-header">
      <div class="section-number">08 — DATA VISUALIZATION</div>
      <h2 class="section-title">Charts & Graphs</h2>
      <p class="section-desc">
        The DATA tab provides historical environmental tracking — the most data-dense 
        screen in the app. Use Recharts or Chart.js with the established color system.
      </p>
    </div>

    <h4>Chart Specifications</h4>
    <div class="card-grid">
      <div class="card">
        <div class="card-icon cyan">📈</div>
        <h3>Climate Line Chart</h3>
        <p>
          Primary visualization. X-axis: time intervals (Hour/Day/Week/Month/Year — tabbed selector). 
          Y-axis: dual axis for Temp (°F) and Humidity (%). VPD as separate overlay. 
          Use area fills with 0.15 opacity beneath lines. Tooltip on hover/touch shows 
          exact values at timestamp.
        </p>
      </div>
      <div class="card">
        <div class="card-icon green">📊</div>
        <h3>Distribution Bar Chart</h3>
        <p>
          Shows frequency distribution of readings. Helps growers identify how stable 
          their environment is. Bars colored by zone: green for optimal range, orange 
          for marginal, red for out-of-bounds.
        </p>
      </div>
      <div class="card">
        <div class="card-icon purple">⭕</div>
        <h3>Control Wheel / Gauge</h3>
        <p>
          The circular gauge from the Controls tab. SVG-based with animatable stroke-dashoffset. 
          Center displays current speed/level. Orange hand shows current temp reading on the arc. 
          Blue hands show trigger points. Interactive: drag hands to set values.
        </p>
      </div>
    </div>

    <h4>Chart Color Mapping</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">TypeScript</span>
        <span class="code-block-file">config/chartColors.ts</span>
      </div>
<pre><code><span class="cp">export const</span> chartColors = {
  temperature: {
    line: <span class="cs">'#ff5252'</span>,         <span class="ck">// Red — heat / warmth</span>
    fill: <span class="cs">'rgba(255,82,82,0.1)'</span>,
    gradient: [<span class="cs">'#ff5252'</span>, <span class="cs">'rgba(255,82,82,0)'</span>],
  },
  humidity: {
    line: <span class="cs">'#4fc3f7'</span>,         <span class="ck">// Blue — water / moisture</span>
    fill: <span class="cs">'rgba(79,195,247,0.1)'</span>,
    gradient: [<span class="cs">'#4fc3f7'</span>, <span class="cs">'rgba(79,195,247,0)'</span>],
  },
  vpd: {
    line: <span class="cs">'#b388ff'</span>,         <span class="ck">// Purple — advanced / calculated metric</span>
    fill: <span class="cs">'rgba(179,136,255,0.1)'</span>,
    gradient: [<span class="cs">'#b388ff'</span>, <span class="cs">'rgba(179,136,255,0)'</span>],
  },
  grid: <span class="cs">'rgba(255,255,255,0.04)'</span>,
  axis: <span class="cs">'#4a5568'</span>,
  tooltip: {
    bg: <span class="cs">'#1a2332'</span>,
    border: <span class="cs">'rgba(0,212,255,0.2)'</span>,
  }
};</code></pre>
    </div>

    <h4>Gauge Component Preview</h4>
    <div class="preview-frame">
      <div class="mock-gauge-wrapper">
        <div class="mock-gauge">
          <svg viewBox="0 0 200 200">
            <circle class="bg" cx="100" cy="100" r="80"/>
            <circle class="fill" cx="100" cy="100" r="80"/>
          </svg>
          <div class="mock-gauge-center">
            <div class="mock-gauge-value" style="color:var(--accent-cyan);">6</div>
            <div class="mock-gauge-label">Fan Speed</div>
          </div>
        </div>
        <div style="margin-top:16px; font-size:13px; color:var(--text-dim);">
          <span style="color:#ff5252;">75.1°F</span> &nbsp;·&nbsp; <span style="color:#4fc3f7;">52.6%</span> &nbsp;·&nbsp; <span style="color:#b388ff;">1.34 kPa</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== 09: CONTROLS ===== -->
<section id="controls">
  <div class="container">
    <div class="section-header">
      <div class="section-number">09 — CONTROLS & INPUTS</div>
      <h2 class="section-title">Interactive Elements</h2>
      <p class="section-desc">
        Every input must feel precise and responsive. The AC Infinity app uses specific 
        interaction patterns that growers have learned — match them for familiarity.
      </p>
    </div>

    <h4>Toggle Switch</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">CSS</span>
        <span class="code-block-file">components/Toggle.module.css</span>
      </div>
<pre><code><span class="cp">.toggle</span> {
  <span class="cv">width</span>: <span class="cn">48px</span>;
  <span class="cv">height</span>: <span class="cn">26px</span>;
  <span class="cv">border-radius</span>: <span class="cn">13px</span>;
  <span class="cv">background</span>: <span class="cs">var(--bg-surface)</span>;
  <span class="cv">position</span>: relative;
  <span class="cv">cursor</span>: pointer;
  <span class="cv">transition</span>: background <span class="cn">0.2s</span> ease;
}

<span class="cp">.toggle[data-active="true"]</span> {
  <span class="cv">background</span>: <span class="cs">var(--accent-cyan)</span>;
  <span class="cv">box-shadow</span>: <span class="cn">0 0 12px</span> <span class="cs">rgba(0,212,255,0.3)</span>;
}

<span class="cp">.toggle-thumb</span> {
  <span class="cv">width</span>: <span class="cn">20px</span>;
  <span class="cv">height</span>: <span class="cn">20px</span>;
  <span class="cv">border-radius</span>: <span class="cn">50%</span>;
  <span class="cv">background</span>: <span class="cs">white</span>;
  <span class="cv">position</span>: absolute;
  <span class="cv">top</span>: <span class="cn">3px</span>;
  <span class="cv">left</span>: <span class="cn">3px</span>;
  <span class="cv">transition</span>: transform <span class="cn">0.2s</span> ease;
}

<span class="cp">.toggle[data-active="true"] .toggle-thumb</span> {
  <span class="cv">transform</span>: <span class="cf">translateX</span>(<span class="cn">22px</span>);
}</code></pre>
    </div>

    <h4>Dual Range Slider (Temperature/Humidity Triggers)</h4>
    <p class="sub-text">
      The AC Infinity app's trigger sliders show a colored zone between the two handles 
      representing the active trigger range. Below the slider, min/max values are displayed.
    </p>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">Spec</span>
        <span class="code-block-file">Range Slider Anatomy</span>
      </div>
<pre><code>            <span class="cn">54°F</span>          <span class="cn">75°F</span>
              ↓              ↓
<span class="ck">───────</span><span class="cs">●━━━━━━━━━━━━━●</span><span class="ck">──────────────────</span>
32°F                                        194°F

<span class="ck">Track:</span>     bg-surface, h-4px, rounded
<span class="cs">Active Zone:</span> accent-red (temperature) or accent-cyan (humidity)
<span class="ck">Handle:</span>    16px circle, white fill, 2px cyan border
           On drag: glow shadow, haptic feedback (mobile)
<span class="ck">Labels:</span>    Monospace, accent color, positioned above handles</code></pre>
    </div>

    <h4>Time Picker Pattern</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">Spec</span>
        <span class="code-block-file">Time Picker UI</span>
      </div>
<pre><code><span class="ck">AC Infinity uses a scroll-wheel time picker:</span>

┌─────────────────────────┐
│     08         59       │  <span class="ck">← Dimmed (previous)</span>
│  ┌──────┐ : ┌──────┐   │
│  │  <span class="cn">09</span>  │   │  <span class="cn">00</span>  │ <span class="cs">AM</span> │  <span class="ck">← Active (cyan bg)</span>
│  └──────┘   └──────┘   │
│     10         01       │  <span class="ck">← Dimmed (next)</span>
└─────────────────────────┘

<span class="cf">RECOMMENDATION for EnviroFlow:</span>
Use tap-to-edit number inputs instead of scroll wheels.
Each segment (HH, MM, AM/PM) is an independent tap target.
Active segment highlighted with cyan background + bold text.
Arrow buttons (▲/▼) or +/- for increment/decrement.
This avoids the scroll-conflict bugs in AC Infinity's app.</code></pre>
    </div>

    <h4>Complete Input Pattern Reference</h4>
    <table class="spec-table">
      <thead><tr><th>Input</th><th>States</th><th>Colors</th></tr></thead>
      <tbody>
        <tr><td>Text Field</td><td>Default → Focus → Error</td><td>bg-surface → border-active glow → accent-red border</td></tr>
        <tr><td>Toggle</td><td>Off → On</td><td>bg-surface → accent-cyan + glow</td></tr>
        <tr><td>Radio Button</td><td>Unselected → Selected</td><td>border-subtle circle → accent-cyan filled circle</td></tr>
        <tr><td>Range Slider</td><td>Inactive → Active → Dragging</td><td>bg-surface → accent-cyan thumb → glow + enlarged</td></tr>
        <tr><td>Number Stepper</td><td>Default → Focus → Min/Max reached</td><td>bg-surface → border-active → text-dim (disabled)</td></tr>
        <tr><td>Dropdown/Select</td><td>Closed → Open → Selected</td><td>bg-card → elevated + border-active → selected item cyan bg</td></tr>
      </tbody>
    </table>
  </div>
</section>

<!-- ===== 10: NAVIGATION ===== -->
<section id="navigation">
  <div class="container">
    <div class="section-header">
      <div class="section-number">10 — NAVIGATION</div>
      <h2 class="section-title">App Architecture</h2>
      <p class="section-desc">
        The AC Infinity app uses a hub-and-spoke navigation model: the DEVICES page 
        is the hub, each device opens a spoke with tabbed sub-navigation.
      </p>
    </div>

    <h4>Navigation Flow</h4>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">Architecture</span>
        <span class="code-block-file">Route Map</span>
      </div>
<pre><code><span class="cf">DEVICES</span> (Home)
├── ☰ <span class="cp">Account</span> (Side Panel)
│   ├── Login / Profile
│   ├── Device Sharing
│   ├── App Updates
│   └── Support Links
├── <span class="cp">+ Add Device</span> (Modal → Pairing Flow)
└── <span class="cv">[Device Card Tap]</span> → <span class="cf">DEVICE DETAIL</span>
    ├── Tab: <span class="cp">CONTROLS</span>
    │   ├── Port selector (1–4 horizontal pills)
    │   ├── Mode selector (OFF / ON / AUTO / VPD / TIMER / CYCLE / SCHEDULE)
    │   ├── Control Wheel (gauge visualization)
    │   └── Trigger settings per mode
    ├── Tab: <span class="cp">ADVANCE</span>
    │   ├── Sub-tab: AUTOMATIONS (list + create)
    │   └── Sub-tab: ALERTS (alarm configuration)
    ├── Tab: <span class="cp">AI</span>
    │   └── Self-learning mode configuration
    ├── Tab: <span class="cp">DATA</span>
    │   ├── Time interval selector (H / D / W / M / Y)
    │   ├── Climate line chart
    │   ├── Distribution chart
    │   └── CSV export button
    ├── Tab: <span class="cp">HISTORY</span>
    │   └── Chronological event log (triggers, alerts, changes)
    └── ⚙ <span class="cp">SETTINGS</span> (gear icon → full page)
        ├── Device name
        ├── F°/C° toggle
        ├── Display brightness
        ├── Transition speed slider
        ├── Calibration offsets
        ├── VPD leaf offset
        ├── Firmware update
        └── Delete device</code></pre>
    </div>

    <h4>Tab Bar Specification</h4>
    <p class="sub-text">
      The device detail tab bar is the most-used navigation element. It must be thumb-reachable 
      on mobile and clearly indicate the active tab.
    </p>
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">CSS</span>
        <span class="code-block-file">Tab bar styles</span>
      </div>
<pre><code><span class="cp">.tab-bar</span> {
  <span class="cv">display</span>: flex;
  <span class="cv">gap</span>: <span class="cn">0</span>;
  <span class="cv">border-bottom</span>: <span class="cn">1px</span> solid <span class="cs">var(--border-subtle)</span>;
  <span class="cv">background</span>: <span class="cs">var(--bg-secondary)</span>;
  <span class="cv">overflow-x</span>: auto;
  <span class="cv">-webkit-overflow-scrolling</span>: touch;
}

<span class="cp">.tab</span> {
  <span class="cv">padding</span>: <span class="cn">14px 20px</span>;
  <span class="cv">font-size</span>: <span class="cn">13px</span>;
  <span class="cv">font-weight</span>: <span class="cn">600</span>;
  <span class="cv">letter-spacing</span>: <span class="cn">0.5px</span>;
  <span class="cv">color</span>: <span class="cs">var(--text-dim)</span>;
  <span class="cv">white-space</span>: nowrap;
  <span class="cv">border-bottom</span>: <span class="cn">2px</span> solid transparent;
  <span class="cv">transition</span>: all <span class="cn">0.2s</span> ease;
}

<span class="cp">.tab:hover</span> { <span class="cv">color</span>: <span class="cs">var(--text-secondary)</span>; }

<span class="cp">.tab.active</span> {
  <span class="cv">color</span>: <span class="cs">var(--accent-cyan)</span>;
  <span class="cv">border-bottom-color</span>: <span class="cs">var(--accent-cyan)</span>;
}</code></pre>
    </div>
  </div>
</section>

<!-- ===== 11: ANIMATIONS ===== -->
<section id="animations">
  <div class="container">
    <div class="section-header">
      <div class="section-number">11 — ANIMATION & MOTION</div>
      <h2 class="section-title">Motion Design</h2>
      <p class="section-desc">
        Motion should be functional, not decorative. Every animation serves a purpose: 
        confirming actions, revealing content, or guiding attention.
      </p>
    </div>

    <h4>Timing Tokens</h4>
    <table class="spec-table">
      <thead><tr><th>Token</th><th>Duration</th><th>Easing</th><th>Use Case</th></tr></thead>
      <tbody>
        <tr><td><code>instant</code></td><td>100ms</td><td>ease-out</td><td>Button press, toggle flip</td></tr>
        <tr><td><code>fast</code></td><td>200ms</td><td>ease-out</td><td>Hover states, focus rings</td></tr>
        <tr><td><code>normal</code></td><td>300ms</td><td>cubic-bezier(0.4, 0, 0.2, 1)</td><td>Card expand, tab switch, slide</td></tr>
        <tr><td><code>slow</code></td><td>500ms</td><td>cubic-bezier(0.16, 1, 0.3, 1)</td><td>Page transitions, chart draws</td></tr>
      </tbody>
    </table>

    <h4>Key Animations</h4>
    <div class="card-grid">
      <div class="card">
        <div class="card-icon cyan">◉</div>
        <h3>Status Pulse</h3>
        <p>
          Online status dot pulses gently (opacity 0.5→1, scale 0.8→1) on a 2s loop. 
          Disconnect uses a static red dot — no animation, because urgency doesn't need distraction.
        </p>
      </div>
      <div class="card">
        <div class="card-icon green">↕</div>
        <h3>Card Expand/Collapse</h3>
        <p>
          Use Framer Motion <span class="inline-code">AnimatePresence</span> with 
          <span class="inline-code">initial={{height:0, opacity:0}}</span> → 
          <span class="inline-code">animate={{height:"auto", opacity:1}}</span>. 
          Duration: 250ms. Chevron rotates 180° with the same timing.
        </p>
      </div>
      <div class="card">
        <div class="card-icon orange">↻</div>
        <h3>Value Updates</h3>
        <p>
          When a reading changes, briefly flash the number's color to accent-cyan (200ms) 
          then return. This creates a subtle "heartbeat" effect showing live data. 
          Never animate the number itself (no counting up/down).
        </p>
      </div>
      <div class="card">
        <div class="card-icon purple">📊</div>
        <h3>Chart Line Draw</h3>
        <p>
          On tab switch to DATA, animate <span class="inline-code">stroke-dashoffset</span> 
          from total path length to 0 over 800ms with ease-out. Area fill fades in with 
          200ms delay. Creates a satisfying "drawing" effect.
        </p>
      </div>
    </div>

    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">CSS</span>
        <span class="code-block-file">Glow Effect for Active Cards</span>
      </div>
<pre><code><span class="ck">/* Subtle glow on card hover — matches AC Infinity's elevated feel */</span>
<span class="cp">.device-card</span> {
  <span class="cv">transition</span>: border-color <span class="cn">0.25s</span> ease, box-shadow <span class="cn">0.25s</span> ease;
}

<span class="cp">.device-card:hover</span> {
  <span class="cv">border-color</span>: <span class="cs">rgba(0, 212, 255, 0.2)</span>;
  <span class="cv">box-shadow</span>:
    <span class="cn">0 0 0 1px</span> <span class="cs">rgba(0, 212, 255, 0.1)</span>,
    <span class="cn">0 4px 24px</span> <span class="cs">rgba(0, 0, 0, 0.3)</span>,
    <span class="cn">0 0 40px</span> <span class="cs">rgba(0, 212, 255, 0.05)</span>;
}

<span class="ck">/* Reading value flash on update */</span>
<span class="cp">@keyframes valueFlash</span> {
  <span class="cn">0%</span> { <span class="cv">color</span>: <span class="cs">var(--accent-cyan)</span>; }
  <span class="cn">100%</span> { <span class="cv">color</span>: <span class="cs">var(--text-primary)</span>; }
}

<span class="cp">.reading-value.updated</span> {
  <span class="cv">animation</span>: valueFlash <span class="cn">0.3s</span> ease-out;
}</code></pre>
    </div>
  </div>
</section>

<!-- ===== 12: ARCHITECTURE ===== -->
<section id="architecture">
  <div class="container">
    <div class="section-header">
      <div class="section-number">12 — FILE ARCHITECTURE</div>
      <h2 class="section-title">Project Structure</h2>
      <p class="section-desc">
        Recommended project structure for a React + TypeScript + Tailwind implementation 
        targeting both web dashboard and potential React Native mobile port.
      </p>
    </div>

    <h4>Directory Structure</h4>
    <div class="file-tree">
<span class="dir">src/</span>
├── <span class="dir">app/</span>                          <span class="desc"># Next.js App Router pages</span>
│   ├── <span class="file">layout.tsx</span>               <span class="desc"># Root layout (dark theme, fonts)</span>
│   ├── <span class="file">page.tsx</span>                 <span class="desc"># DEVICES home page</span>
│   └── <span class="dir">device/[id]/</span>
│       ├── <span class="file">page.tsx</span>             <span class="desc"># Device detail (tabbed)</span>
│       ├── <span class="file">controls.tsx</span>         <span class="desc"># Controls tab</span>
│       ├── <span class="file">advance.tsx</span>          <span class="desc"># Automations tab</span>
│       ├── <span class="file">data.tsx</span>             <span class="desc"># Charts tab</span>
│       ├── <span class="file">history.tsx</span>          <span class="desc"># Event log tab</span>
│       └── <span class="file">settings.tsx</span>         <span class="desc"># Settings page</span>
├── <span class="dir">components/</span>
│   ├── <span class="dir">device/</span>
│   │   ├── <span class="file">DeviceCard.tsx</span>       <span class="desc"># Main dashboard card</span>
│   │   ├── <span class="file">ReadingDisplay.tsx</span>   <span class="desc"># Temp/Humidity/VPD trio</span>
│   │   ├── <span class="file">PortStatus.tsx</span>       <span class="desc"># Individual port chip</span>
│   │   └── <span class="file">ConnectionBadge.tsx</span>  <span class="desc"># BT/WiFi + timestamp</span>
│   ├── <span class="dir">controls/</span>
│   │   ├── <span class="file">ControlWheel.tsx</span>     <span class="desc"># SVG circular gauge</span>
│   │   ├── <span class="file">ModeSelector.tsx</span>     <span class="desc"># OFF/ON/AUTO/VPD radio group</span>
│   │   ├── <span class="file">RangeSlider.tsx</span>      <span class="desc"># Dual-thumb temperature slider</span>
│   │   └── <span class="file">LevelStepper.tsx</span>     <span class="desc"># 0-10 speed/brightness stepper</span>
│   ├── <span class="dir">automation/</span>
│   │   ├── <span class="file">AutomationCard.tsx</span>   <span class="desc"># Automation list entry</span>
│   │   ├── <span class="file">AutomationForm.tsx</span>   <span class="desc"># Create/edit form</span>
│   │   ├── <span class="file">TimelineBand.tsx</span>     <span class="desc"># 24hr visual schedule bar</span>
│   │   └── <span class="file">TimePicker.tsx</span>       <span class="desc"># HH:MM AM/PM picker</span>
│   ├── <span class="dir">charts/</span>
│   │   ├── <span class="file">ClimateChart.tsx</span>     <span class="desc"># Recharts line/area chart</span>
│   │   ├── <span class="file">DistributionChart.tsx</span><span class="desc"># Bar chart for frequency</span>
│   │   └── <span class="file">ChartTooltip.tsx</span>     <span class="desc"># Custom dark tooltip</span>
│   └── <span class="dir">ui/</span>
│       ├── <span class="file">Toggle.tsx</span>           <span class="desc"># Cyan toggle switch</span>
│       ├── <span class="file">TabBar.tsx</span>           <span class="desc"># Horizontal scrollable tabs</span>
│       ├── <span class="file">TopBar.tsx</span>           <span class="desc"># Sticky header w/ blur</span>
│       ├── <span class="file">FAB.tsx</span>              <span class="desc"># Floating action button (+)</span>
│       └── <span class="file">StatusDot.tsx</span>        <span class="desc"># Animated online/offline dot</span>
├── <span class="dir">hooks/</span>
│   ├── <span class="file">useDevices.ts</span>           <span class="desc"># Supabase realtime subscription</span>
│   ├── <span class="file">useReadings.ts</span>          <span class="desc"># Sensor data polling/websocket</span>
│   └── <span class="file">useAutomations.ts</span>       <span class="desc"># CRUD for automation rules</span>
├── <span class="dir">types/</span>
│   ├── <span class="file">device.ts</span>               <span class="desc"># Device, Port, Reading interfaces</span>
│   ├── <span class="file">automation.ts</span>           <span class="desc"># Automation, Schedule, Trigger</span>
│   └── <span class="file">chart.ts</span>                <span class="desc"># Chart data point types</span>
├── <span class="dir">config/</span>
│   ├── <span class="file">theme.ts</span>                <span class="desc"># CSS variable exports for JS</span>
│   └── <span class="file">chartColors.ts</span>          <span class="desc"># Chart color mappings</span>
├── <span class="dir">lib/</span>
│   ├── <span class="file">supabase.ts</span>             <span class="desc"># Supabase client init</span>
│   └── <span class="file">vpd.ts</span>                  <span class="desc"># VPD calculation utility</span>
└── <span class="dir">styles/</span>
    └── <span class="file">globals.css</span>              <span class="desc"># CSS variables, Tailwind base</span>
    </div>

    <h4>Recommended Stack</h4>
    <table class="spec-table">
      <thead><tr><th>Layer</th><th>Technology</th><th>Rationale</th></tr></thead>
      <tbody>
        <tr><td>Framework</td><td><code>Next.js 14+ (App Router)</code></td><td>SSR for fast initial loads, API routes for device proxy</td></tr>
        <tr><td>Language</td><td><code>TypeScript (strict)</code></td><td>Type safety for device/sensor data models</td></tr>
        <tr><td>Styling</td><td><code>Tailwind CSS + CSS Variables</code></td><td>Utility-first with semantic design tokens</td></tr>
        <tr><td>State</td><td><code>Zustand or Jotai</code></td><td>Lightweight, good for real-time data subscriptions</td></tr>
        <tr><td>Charts</td><td><code>Recharts</code></td><td>React-native, composable, supports custom tooltips</td></tr>
        <tr><td>Animation</td><td><code>Framer Motion</code></td><td>AnimatePresence for mount/unmount, spring physics</td></tr>
        <tr><td>Backend</td><td><code>Supabase</code></td><td>Realtime subscriptions, row-level security, existing infra</td></tr>
        <tr><td>Icons</td><td><code>Lucide React</code></td><td>Clean, consistent, tree-shakeable</td></tr>
      </tbody>
    </table>

    <div class="callout info">
      <strong>EnviroFlow Integration:</strong> This design system is built to integrate directly 
      with your existing Supabase + Vercel stack. The device/port data models align with how 
      environmental controllers report data. The automation types map to PPFD-based lighting 
      control and growth phase transitions you're building into EnviroFlow.
    </div>
  </div>
</section>

<!-- ===== FOOTER ===== -->
<footer>
  <div class="container">
    <div class="brand">EnviroFlow Design System v1.0</div>
    <p>AC Infinity–Inspired UI/UX Coding Guide &nbsp;·&nbsp; Built for the development team &nbsp;·&nbsp; February 2026</p>
  </div>
</footer>

<script>
// Sticky nav active state
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
      });
    }
  });
}, { rootMargin: '-20% 0px -80% 0px' });

sections.forEach(section => observer.observe(section));
</script>
</body>
</html>