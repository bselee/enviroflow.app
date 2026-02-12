# EnviroFlow Port Programming Plan
## Mapping AC Infinity's Controller Model to the EnviroFlow Automation Engine

**Version:** 1.0  
**Date:** February 6, 2026  
**Target:** enviroflow.app → Controllers Page + Drag-and-Drop Programmer  

---

## 1. Executive Summary

This document maps every AC Infinity controller programming concept — modes, triggers, transitions, buffers, advance automations, and per-port settings — into EnviroFlow's architecture. The goal: a user connects their AC Infinity controller, and EnviroFlow presents a visual programming interface that matches or exceeds the AC Infinity app's functionality, with the added power of drag-and-drop automation workflows that can orchestrate **multiple controllers and cross-device logic** in ways the native app cannot.

The plan covers two layers:
1. **Controllers Page** — per-port configuration UI that mirrors AC Infinity's Controls Tab (modes, levels, triggers, settings)
2. **Automation Programmer** — drag-and-drop workflow builder where configured ports become actionable nodes

---

## 2. AC Infinity Programming Model (Complete Reference)

### 2.1 Port Architecture

Each AC Infinity controller has **4 ports** (CTR69 Pro) or **8 ports** (CTR69 Pro+, Controller AI+). Each port:
- Connects to one UIS device (fan, light, humidifier, heater, etc.)
- Has **independent** programming — each port gets its own mode, triggers, and settings
- Can also be programmed as a group via "ALL" port selection
- Outputs a PWM level from **0–10** (fans/lights) or **ON/OFF** (outlet devices)

**Critical distinction:**
- **PWM devices** (fans, lights): Variable speed/brightness, levels 0–10
- **Outlet devices** (humidifiers, heaters, ACs, dehumidifiers): Binary ON/OFF only — no variable levels

### 2.2 Programming Modes (per port)

Every port operates in exactly **one mode at a time**. These are the 8 modes:

| Mode | Type | Description | Parameters |
|------|------|-------------|------------|
| **OFF** | Static | Device off (runs at min level if set) | Min level (0–10) |
| **ON** | Static | Device runs continuously | Level (0–10) |
| **AUTO** | Climate | Reacts to temp/humidity triggers | 4 trigger points + transition + buffer |
| **VPD** | Climate | Reacts to VPD triggers | 2 trigger points + transition + buffer |
| **TIMER TO ON** | Time | Countdown → turns ON | Duration (HH:MM) |
| **TIMER TO OFF** | Time | Countdown → turns OFF | Duration (HH:MM) |
| **CYCLE** | Time | Repeating ON/OFF durations | ON duration, OFF duration |
| **SCHEDULE** | Time | Daily ON/OFF clock times | ON time, OFF time (24h) |

### 2.3 AUTO Mode — The Core Climate Engine

AUTO mode has **4 independent triggers** that can ALL fire simultaneously:

| Trigger | Activates When | Typical Device | Action |
|---------|---------------|----------------|--------|
| **High Temp** | Temp ≥ setpoint | Inline fan, AC | Cool down |
| **Low Temp** | Temp ≤ setpoint | Heater | Warm up |
| **High Humidity** | Humidity ≥ setpoint | Dehumidifier, exhaust fan | Dry out |
| **Low Humidity** | Humidity ≤ setpoint | Humidifier | Add moisture |

**Key behaviors:**
- Any trigger not in use MUST be turned off — they all evaluate concurrently
- Most setups use only 1–2 triggers per port
- When triggered ON → device runs at ON mode level (max level)
- When triggered OFF → device runs at OFF mode level (min level)
- Trigger ranges: Temp 32°F–194°F, Humidity 0%–100%

### 2.4 VPD Mode (PRO / PRO+ / AI+ only)

VPD mode has **2 triggers**:

| Trigger | Activates When | Typical Use |
|---------|---------------|-------------|
| **High VPD** | VPD ≥ setpoint | Humidifier (air too dry for plant) |
| **Low VPD** | VPD ≤ setpoint | Dehumidifier / fan (air too moist) |

VPD is calculated from: ambient temp + relative humidity + leaf temperature offset.

### 2.5 Settings That Modify All Modes

#### 2.5.1 Max/Min Level Settings
- **ON Mode level** = the MAXIMUM level when any trigger activates the device
- **OFF Mode level** = the MINIMUM level when the device is "off" (baseline)
- Example: OFF=3, ON=8 → Fan always runs at speed 3, ramps to 8 when triggered
- Outlet devices: OFF=0, ON=1 (must be set this way for proper operation)

#### 2.5.2 Transition Settings
Controls how **gradually** the device ramps between min and max levels when in AUTO/VPD mode.

- **Temperature transition:** How many °F/°C of deviation from trigger = 1 level step
- **Humidity transition:** How many %RH of deviation = 1 level step  
- **VPD transition:** How many kPa of deviation = 1 level step

Example: High temp trigger = 80°F, temp transition = 2°F, min level = 3, max level = 10
- At 80°F → level 3 (just triggered)
- At 82°F → level 4
- At 84°F → level 5
- At 94°F+ → level 10 (max)

Higher transition value = wider gap between level steps = more gradual ramp.

#### 2.5.3 Buffer Settings (Hysteresis)
Prevents rapid ON/OFF cycling for outlet devices by creating separate trigger-ON and trigger-OFF points.

**For HIGH triggers** — buffer creates a trigger-OFF point BELOW the trigger-ON point:
- High Temp trigger = 82°F, buffer = 4°F
- ON at ≥ 82°F, OFF only when drops below 78°F

**For LOW triggers** — buffer creates a trigger-OFF point ABOVE the trigger-ON point:
- Low Temp trigger = 60°F, buffer = 4°F  
- ON at ≤ 60°F, OFF only when rises above 64°F

Buffer ranges: Temp 0–8°F, Humidity 0–10%, VPD 0–0.5 kPa

### 2.6 Advance Automations (App-Only)

The AC Infinity app's ADVANCE tab adds **time-windowed overrides** on top of the Controls tab:

- **Name:** Custom name (up to 20 chars)
- **Start/End Time:** When the automation is active during the day
- **Port Selection:** Which ports this automation controls (All, or specific ports)
- **Mode:** Any of the 8 modes above, applied ONLY during the time window
- **Days:** Which days of the week (or everyday)

**Key rules:**
- Advance automations **override** the Controls tab programming while active
- Multiple automations allowed if time windows don't overlap
- Each automation controls one mode at a time per port
- Can create multiple automations for different time periods (e.g., day vs night)

### 2.7 Recipes (Growth Stage Presets)

The CTR69 Pro offers 3 preset automation "recipes":
- **Vegetative** — preconfigured light schedules, fan/humidity targets for veg
- **Flowering** — adjusted light cycle, tighter climate control
- **Seedling** — gentle conditions, heat mat activation

Each recipe auto-configures lights, fans, and humidifiers across ports.

---

## 3. EnviroFlow Data Model

### 3.1 Database Schema (Supabase)

```sql
-- Controller registration
CREATE TABLE controllers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,                        -- "GROW TENT 2x2"
  model TEXT NOT NULL,                       -- "CTR69P", "CTR69Q", "CTRL_AI_PLUS"
  device_code TEXT,                          -- "E-W4206"
  connection_type TEXT CHECK (connection_type IN ('wifi', 'bluetooth', 'cloud_api')),
  port_count INT NOT NULL DEFAULT 4,         -- 4 or 8
  firmware_version TEXT,
  sensor_config JSONB DEFAULT '{}',          -- probe type, calibration offsets
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-port device assignment & configuration
CREATE TABLE controller_ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers ON DELETE CASCADE NOT NULL,
  port_number INT NOT NULL CHECK (port_number BETWEEN 1 AND 8),
  device_name TEXT,                          -- "Cloudline T6"
  device_type TEXT CHECK (device_type IN (
    'inline_fan', 'clip_fan', 'light', 'humidifier', 
    'dehumidifier', 'heater', 'ac', 'outlet', 'heatmat', 'pump'
  )),
  control_type TEXT CHECK (control_type IN ('pwm', 'outlet')) DEFAULT 'pwm',
  
  -- Current mode
  active_mode TEXT CHECK (active_mode IN (
    'off', 'on', 'auto', 'vpd', 
    'timer_to_on', 'timer_to_off', 'cycle', 'schedule'
  )) DEFAULT 'off',
  
  -- Level settings (0-10)
  on_level INT DEFAULT 10 CHECK (on_level BETWEEN 0 AND 10),
  off_level INT DEFAULT 0 CHECK (off_level BETWEEN 0 AND 10),
  
  -- AUTO mode triggers (null = trigger disabled)
  auto_high_temp NUMERIC(5,1),               -- °F, e.g. 82.0
  auto_low_temp NUMERIC(5,1),
  auto_high_humidity NUMERIC(5,1),           -- %, e.g. 65.0
  auto_low_humidity NUMERIC(5,1),
  
  -- VPD mode triggers
  vpd_high NUMERIC(4,2),                     -- kPa, e.g. 1.60
  vpd_low NUMERIC(4,2),
  
  -- Transition settings
  transition_temp NUMERIC(4,1) DEFAULT 2.0,  -- °F per level step
  transition_humidity NUMERIC(4,1) DEFAULT 5.0,
  transition_vpd NUMERIC(4,2) DEFAULT 0.10,
  
  -- Buffer settings (hysteresis)
  buffer_temp NUMERIC(4,1) DEFAULT 0.0,      -- °F
  buffer_humidity NUMERIC(4,1) DEFAULT 0.0,  -- %
  buffer_vpd NUMERIC(4,2) DEFAULT 0.00,      -- kPa
  
  -- Time-based mode params
  timer_duration_minutes INT,
  cycle_on_minutes INT,
  cycle_off_minutes INT,
  schedule_on_time TIME,
  schedule_off_time TIME,
  
  -- Runtime state (updated by controller polling)
  current_level INT DEFAULT 0,
  current_trend TEXT CHECK (current_trend IN ('up', 'down', 'steady')),
  is_triggered BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ,
  
  UNIQUE(controller_id, port_number),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Advance automations (time-windowed overrides)
CREATE TABLE port_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controller_id UUID REFERENCES controllers ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                        -- "Night Cycle"
  port_numbers INT[] NOT NULL,               -- {1,2,3,4} or {2}
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Time window
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week INT[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun, 6=Sat
  
  -- Override mode + settings (same structure as port config)
  override_mode TEXT NOT NULL,
  override_config JSONB NOT NULL,            -- mode-specific params
  
  priority INT DEFAULT 0,                    -- higher = takes precedence
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Brand-agnostic sensor registry (see section 8.5 for details)
CREATE TABLE sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,                                -- 'ac_infinity', 'inkbird', 'ecowitt', 'generic'
  model TEXT,
  connection_type TEXT CHECK (connection_type IN ('uis_probe', 'wifi', 'ble', 'zigbee', 'api')),
  capabilities TEXT[] NOT NULL,              -- {'temperature','humidity','vpd','co2','ph','ec','soil_moisture'}
  data_source JSONB,
  calibration JSONB DEFAULT '{}',
  controller_id UUID REFERENCES controllers,
  is_primary BOOLEAN DEFAULT FALSE,
  poll_interval_seconds INT DEFAULT 10,
  last_reading JSONB,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Live sensor readings (time-series, consider TimescaleDB extension)
CREATE TABLE sensor_readings (
  sensor_id UUID REFERENCES sensors NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  readings JSONB NOT NULL,                   -- {"temperature": 75.1, "humidity": 52.6, "vpd": 1.34}
  PRIMARY KEY (sensor_id, timestamp)
);

-- Growth stage recipes
CREATE TABLE growth_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,        -- null = system preset
  name TEXT NOT NULL,                         -- "Vegetative", "Flowering", "Seedling"
  stage TEXT CHECK (stage IN ('seedling', 'vegetative', 'flowering', 'drying', 'custom')),
  description TEXT,
  port_configs JSONB NOT NULL,                -- array of per-port-type configs
  is_preset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 TypeScript Interfaces

```typescript
// Matches the port programming model exactly
interface PortConfig {
  portNumber: number;                        // 1-8
  deviceName: string;
  deviceType: DeviceType;
  controlType: 'pwm' | 'outlet';
  
  activeMode: PortMode;
  
  // Levels
  onLevel: number;                           // 0-10 (max when triggered)
  offLevel: number;                          // 0-10 (min / baseline)
  
  // AUTO triggers (null = disabled)
  autoHighTemp: number | null;
  autoLowTemp: number | null;
  autoHighHumidity: number | null;
  autoLowHumidity: number | null;
  
  // VPD triggers
  vpdHigh: number | null;
  vpdLow: number | null;
  
  // Transition (°F, %, kPa per level step)
  transitionTemp: number;
  transitionHumidity: number;
  transitionVpd: number;
  
  // Buffer / hysteresis
  bufferTemp: number;
  bufferHumidity: number;
  bufferVpd: number;
  
  // Time-based params
  timerDurationMinutes?: number;
  cycleOnMinutes?: number;
  cycleOffMinutes?: number;
  scheduleOnTime?: string;                   // "HH:MM"
  scheduleOffTime?: string;
}

type PortMode = 
  | 'off' | 'on' | 'auto' | 'vpd'
  | 'timer_to_on' | 'timer_to_off' | 'cycle' | 'schedule';

type DeviceType = 
  | 'inline_fan' | 'clip_fan' | 'light' | 'humidifier'
  | 'dehumidifier' | 'heater' | 'ac' | 'outlet' | 'heatmat' | 'pump';
```

---

## 4. Controllers Page — UI Architecture

### 4.1 Page Layout

```
┌─────────────────────────────────────────────────────┐
│  CONTROLLERS                              + Add     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ Controller Card: GROW TENT 2x2 ──────────────┐ │
│  │  [Monitor] GROW TENT 2x2    🟢 E-W4206       │ │
│  │                                                │ │
│  │  ╔═══════════╤═══════════╤═══════════╗        │ │
│  │  ║ TEMP      │ HUMIDITY  │ VPD       ║        │ │
│  │  ║ 75.1°F    │ 52.6%    │ 1.34 kPa  ║        │ │
│  │  ╚═══════════╧═══════════╧═══════════╝        │ │
│  │                                                │ │
│  │  ┌─ PORT 1 ─────────────────────────────────┐ │ │
│  │  │ [Fan] Cloudline T6     AUTO  Lvl: 6 ↑    │ │ │
│  │  │  ▸ High Temp: 82°F  ▸ Transition: 2°F    │ │ │
│  │  │  [Configure Port]                         │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                                │ │
│  │  ┌─ PORT 2 ─────────────────────────────────┐ │ │
│  │  │ [Light] IONGRID S44    SCHEDULE  Lvl: 0   │ │ │
│  │  │  ▸ ON: 6:00 AM  OFF: 12:00 AM            │ │ │
│  │  │  [Configure Port]                         │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                                │ │
│  │  ┌─ PORT 3 ─────────────────────────────────┐ │ │
│  │  │ [Drop] S6 Humidifier   AUTO  ON/OFF       │ │ │
│  │  │  ▸ Low Humidity: 45%  ▸ Buffer: 6%       │ │ │
│  │  │  [Configure Port]                         │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                                │ │
│  │  ┌─ PORT 4 ─────────────────────────────────┐ │ │
│  │  │ [Plug] Empty Port                OFF      │ │ │
│  │  └───────────────────────────────────────────┘ │ │
│  │                                                │ │
│  │  [📋 Automations: 2 active] [📊 Data] [⚙ Settings] │
│  └────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.2 Port Configuration Panel (Slide-Out Drawer)

When user taps "Configure Port", a full-height drawer slides in:

```
┌─ CONFIGURE PORT 1 ──────────────── ✕ ─┐
│                                        │
│  DEVICE                                │
│  ┌──────────────────────────────────┐  │
│  │ Name: [Cloudline T6            ] │  │
│  │ Type: [● Fan ○ Light ○ Outlet  ] │  │
│  │       [○ Humidifier ○ Heater   ] │  │
│  └──────────────────────────────────┘  │
│                                        │
│  MODE                                  │
│  ┌──────────────────────────────────┐  │
│  │ [OFF][ON][AUTO][VPD]             │  │
│  │ [TIMER▸ON][TIMER▸OFF]           │  │
│  │ [CYCLE][SCHEDULE]                │  │
│  └──────────────────────────────────┘  │
│                                        │
│  LEVELS                                │
│  ┌──────────────────────────────────┐  │
│  │ ON Level (Max):  ●━━━━━━━━━● 8  │  │
│  │ OFF Level (Min): ●━━● 3         │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ═══ AUTO MODE TRIGGERS ═══           │
│  (visible only when mode = AUTO)       │
│                                        │
│  High Temp    [✓ Enabled]              │
│  ┌──────────────────────────────────┐  │
│  │  32°F ●━━━━━━━━━━━━━━●━━● 194°F │  │
│  │              Trigger: 82°F       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Low Temp     [  Disabled]             │
│  High Humidity [  Disabled]            │
│  Low Humidity  [  Disabled]            │
│                                        │
│  ═══ ADVANCED SETTINGS ═══            │
│                                        │
│  Transition Temp:     [2.0] °F/step   │
│  Transition Humidity: [5.0] %/step    │
│  Buffer Temp:         [4.0] °F        │
│  Buffer Humidity:     [0.0] %         │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │         [Save Configuration]      │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### 4.3 Mode-Specific UI Components

| Mode | UI Component | Fields |
|------|-------------|--------|
| OFF | Static display | Off level slider (0–10) |
| ON | Level slider | On level (0–10) with live preview |
| AUTO | Trigger cards (4x) | Each: enabled toggle, setpoint slider, transition, buffer |
| VPD | Trigger cards (2x) | High/Low VPD, transition, buffer |
| TIMER TO ON | Countdown picker | Hours : Minutes (tap-to-edit, NOT scroll wheel) |
| TIMER TO OFF | Countdown picker | Hours : Minutes |
| CYCLE | Dual duration | ON duration + OFF duration pickers |
| SCHEDULE | Dual time | ON time + OFF time (24h clock) |

**Critical UX decision:** For time pickers, use **tap-to-edit numeric fields** — NOT scroll wheels. AC Infinity's scroll-wheel pickers have a known UX bug where they conflict with page scrolling. We fix this.

### 4.4 Smart Defaults by Device Type

When user assigns a device type, auto-populate sensible starting config:

| Device Type | Default Mode | Default Triggers | Notes |
|-------------|-------------|------------------|-------|
| Inline Fan | AUTO | High Temp: 80°F | Transition: 2°F, Min level: 3 |
| Clip Fan | ON | Level: 4 | Constant gentle circulation |
| Grow Light | SCHEDULE | ON: 6:00 AM, OFF: 12:00 AM | 18/6 veg default |
| Humidifier | AUTO | Low Humidity: 50% | Buffer: 6%, outlet control |
| Dehumidifier | AUTO | High Humidity: 60% | Buffer: 4%, outlet control |
| Heater | AUTO | Low Temp: 65°F | Buffer: 4°F, outlet control |
| AC Unit | AUTO | High Temp: 85°F | Buffer: 4°F, outlet control |
| Heat Mat | ON | Level: 1 (on) | Or AUTO Low Temp: 72°F |
| Water Pump | CYCLE | ON: 15min, OFF: 45min | Irrigation cycle |

---

## 5. Drag-and-Drop Automation Integration

### 5.1 How Port Configs Become Automation Nodes

The existing EnviroFlow drag-and-drop builder gains new node types that represent configured ports:

```
AUTOMATION WORKFLOW CANVAS

┌─────────┐    ┌──────────────┐    ┌─────────────┐
│ TRIGGER │───▸│  CONDITION   │───▸│   ACTION    │
│ 6:00 AM │    │ Temp > 80°F  │    │ Port 1 → 8  │
└─────────┘    └──────────────┘    └─────────────┘
                     │
                     │ else
                     ▾
               ┌─────────────┐
               │   ACTION    │
               │ Port 1 → 3  │
               └─────────────┘
```

### 5.2 Node Types for Port Programming

#### Trigger Nodes (inputs)
| Node | Description | Output |
|------|-------------|--------|
| **Clock Trigger** | Time of day (replaces SCHEDULE mode) | Fires at specified time |
| **Interval Trigger** | Repeating timer (replaces CYCLE mode) | Fires every N minutes |
| **Sensor Trigger** | Temp/humidity/VPD threshold crossed | Fires when condition met |
| **Countdown Trigger** | One-shot timer (replaces TIMER modes) | Fires after N minutes |
| **Growth Phase Trigger** | Day of grow cycle | Fires on phase transitions |

#### Condition Nodes (logic)
| Node | Description | Inputs |
|------|-------------|--------|
| **Climate Check** | Compare sensor reading to threshold | Sensor value, operator, target |
| **Time Window** | Is it within a time range? | Start time, end time, days |
| **Port State Check** | Is a port at a specific level? | Port, level comparison |
| **AND / OR / NOT** | Logic gates | Multiple boolean inputs |
| **Hysteresis Band** | Buffer/deadband logic | Value, trigger-on, trigger-off |

#### Action Nodes (outputs)
| Node | Description | Parameters |
|------|-------------|------------|
| **Set Port Level** | Set a port to a specific level 0–10 | Controller, port, level |
| **Set Port Mode** | Switch a port's active mode | Controller, port, mode |
| **Ramp Port** | Gradually transition over time | Port, from, to, duration |
| **Apply Recipe** | Load a growth stage recipe | Recipe name |
| **Send Alert** | Push notification | Message, severity |
| **Wait** | Delay before next node | Duration |
| **Log Event** | Record to history | Event name, data |

### 5.3 The Power Over AC Infinity's Native App

Things EnviroFlow automations can do that AC Infinity's app CANNOT:

1. **Cross-controller logic** — "If Controller A's temp > 85°F, also ramp Controller B's exhaust fan"
2. **Multi-condition triggers** — "IF temp > 80 AND humidity > 60 AND time is between 6AM-6PM"
3. **Cascading actions** — "Turn on dehumidifier → wait 5 min → if humidity still high → turn on exhaust fan"
4. **Growth-phase-aware** — "On day 1–21 use veg settings, day 22+ switch to flower settings automatically"
5. **Smooth ramping** — "Sunrise simulation: ramp light from 0→8 over 30 minutes"
6. **VPD-to-action mapping** — "Calculate ideal VPD for current growth stage and auto-adjust humidifier + fan"
7. **Alert escalation** — "If temp > 90°F for more than 5 minutes, send critical push notification"
8. **Data-driven transitions** — "Transition settings that use actual sensor history, not just fixed step sizes"

### 5.4 Example Workflow: Full Grow Tent Automation

```
┌───────────┐
│ CLOCK     │
│ 6:00 AM   │──────────────────────────────────────┐
└───────────┘                                       │
                                                    ▾
┌───────────┐    ┌──────────────┐    ┌──────────────────────┐
│ CLOCK     │    │ TIME WINDOW  │    │ RAMP PORT            │
│ 6:00 AM   │───▸│ 6AM – 12AM   │───▸│ Port 2 (Light): 0→8 │
└───────────┘    │ (Light ON)   │    │ Duration: 30min      │
                 └──────────────┘    │ (Sunrise sim)        │
                                     └──────────────────────┘
                                               │
                                               ▾
┌───────────┐    ┌──────────────┐    ┌──────────────────────┐
│ SENSOR    │    │ HYSTERESIS   │    │ SET PORT LEVEL       │
│ Temp read │───▸│ ON ≥ 82°F    │───▸│ Port 1 (Fan): AUTO   │
│ (every    │    │ OFF < 78°F   │    │ Transition: 2°F/step │
│  30sec)   │    │ Buffer: 4°F  │    └──────────────────────┘
└───────────┘    └──────────────┘
                                     ┌──────────────────────┐
┌───────────┐    ┌──────────────┐    │ SET PORT LEVEL       │
│ SENSOR    │───▸│ HYSTERESIS   │───▸│ Port 3 (Humid): ON   │
│ Humi read │    │ ON ≤ 50%     │    │ Buffer: 6%           │
└───────────┘    │ OFF > 56%    │    └──────────────────────┘
                 └──────────────┘

┌───────────┐                        ┌──────────────────────┐
│ CLOCK     │                        │ RAMP PORT            │
│ 12:00 AM  │───────────────────────▸│ Port 2 (Light): 8→0 │
└───────────┘                        │ Duration: 15min      │
                                     │ (Sunset sim)         │
                                     └──────────────────────┘
```

---

## 6. Implementation Phases

### Phase 1: Controllers Page (Foundation)
**Scope:** Read-only controller dashboard + per-port configuration UI
**Effort:** 2–3 weeks

- [ ] Controller CRUD (add/edit/remove controllers)
- [ ] Port assignment UI (assign device type + name to each port)
- [ ] Mode selector component (8-mode toggle strip)
- [ ] Level slider component (0–10 with live value display)
- [ ] AUTO mode trigger cards (4x with enable/disable + setpoint slider)
- [ ] VPD mode trigger cards (2x)
- [ ] Time-based mode pickers (tap-to-edit, dual time/duration)
- [ ] Settings panel (transition + buffer per sensor type)
- [ ] Smart defaults by device type
- [ ] Supabase schema migration + RLS policies
- [ ] Real-time sensor reading display with color-coded values (red/blue/purple)

### Phase 2: Port Configuration Engine
**Scope:** The evaluation engine that resolves what level each port should be at
**Effort:** 2 weeks

- [ ] Trigger evaluation logic (AUTO + VPD mode)
- [ ] Transition calculation (sensor delta → level mapping)
- [ ] Buffer / hysteresis state machine
- [ ] Timer/cycle/schedule countdown engine
- [ ] Port state resolver (when multiple triggers fire simultaneously)
- [ ] Real-time Supabase subscriptions for sensor data
- [ ] Level change event logging

### Phase 3: Automation Nodes
**Scope:** Drag-and-drop nodes that can READ and WRITE port configurations
**Effort:** 2–3 weeks

- [ ] Trigger nodes: Clock, Interval, Sensor, Countdown, Growth Phase
- [ ] Condition nodes: Climate Check, Time Window, Port State, Logic Gates, Hysteresis
- [ ] Action nodes: Set Port Level, Set Port Mode, Ramp, Apply Recipe, Alert, Wait, Log
- [ ] Cross-controller references (action on Controller B from Controller A trigger)
- [ ] Workflow validation (no conflicting port writes, no infinite loops)
- [ ] Automation priority system (higher priority overrides lower)

### Phase 4: Recipes + Growth Phases
**Scope:** Preset configurations and growth-phase-aware automation
**Effort:** 1–2 weeks

- [ ] Growth recipe system (Vegetative, Flowering, Seedling, Drying, Custom)
- [ ] Recipe editor (configure all ports for a growth stage)
- [ ] Apply Recipe action node
- [ ] Growth phase timeline (day counting from start date)
- [ ] Automatic phase transitions (e.g., flip to flower on day 30)
- [ ] Recipe sharing / community presets

### Phase 5: Polish + Advanced Features
**Scope:** Pro-level features and UX refinements
**Effort:** 2+ weeks

- [ ] Sunrise/sunset light ramping with configurable curves
- [ ] VPD autopilot (auto-derive ideal VPD from growth stage + adjust)
- [ ] Historical data overlays (show past runs against current)
- [ ] Alert escalation chains
- [ ] Multi-tent / multi-room dashboards
- [ ] CSV export of port programming history
- [ ] Mobile-responsive port configuration

---

## 7. Component Inventory

| Component | File | Description |
|-----------|------|-------------|
| `ControllerCard` | `components/device/ControllerCard.tsx` | Main card on Controllers page |
| `PortChip` | `components/device/PortChip.tsx` | Compact port status in card |
| `PortConfigDrawer` | `components/device/PortConfigDrawer.tsx` | Full configuration panel |
| `ModeSelector` | `components/controls/ModeSelector.tsx` | 8-mode toggle strip |
| `LevelSlider` | `components/controls/LevelSlider.tsx` | 0–10 PWM level control |
| `TriggerCard` | `components/controls/TriggerCard.tsx` | Auto/VPD trigger with slider |
| `DualRangeSlider` | `components/controls/DualRangeSlider.tsx` | High/low trigger range |
| `TimePicker` | `components/controls/TimePicker.tsx` | Tap-to-edit (NOT scroll) |
| `DurationPicker` | `components/controls/DurationPicker.tsx` | HH:MM countdown input |
| `TransitionSettings` | `components/controls/TransitionSettings.tsx` | Transition °F/step |
| `BufferSettings` | `components/controls/BufferSettings.tsx` | Hysteresis band config |
| `ReadingsDisplay` | `components/device/ReadingsDisplay.tsx` | Color-coded temp/humi/vpd |
| `PortActionNode` | `components/automation/nodes/PortActionNode.tsx` | DnD set-level node |
| `SensorTriggerNode` | `components/automation/nodes/SensorTriggerNode.tsx` | DnD sensor trigger |
| `HysteresisNode` | `components/automation/nodes/HysteresisNode.tsx` | DnD buffer logic |
| `RecipeSelector` | `components/automation/RecipeSelector.tsx` | Growth stage presets |
| `usePortEngine` | `hooks/usePortEngine.ts` | Trigger evaluation hook |
| `useControllerSync` | `hooks/useControllerSync.ts` | Supabase real-time sync |

---

## 8. Architecture Decisions (Resolved)

### 8.1 Controller Communication
**Decision:** Dual-path — WiFi local API + Cloud-to-cloud

EnviroFlow will communicate with AC Infinity controllers via two methods:

- **WiFi Local API** — Reverse-engineer the local network protocol AC Infinity controllers use (they communicate on 2.4GHz WiFi). If/when AC Infinity publishes an official API, migrate to that. This gives low-latency direct control when EnviroFlow and the controller are on the same network.
- **Cloud-to-cloud** — If AC Infinity opens a cloud API (similar to SmartThings, Tuya, etc.), integrate as a secondary path for remote access when not on the same LAN.

Local API is the priority path — it eliminates cloud dependency for time-critical operations like trigger evaluation.

### 8.2 Conflict Resolution with AC Infinity App
**Decision:** AC Infinity app takes first seat. User can disable AC Infinity control when ready.

- By default, the AC Infinity app retains control authority over the physical controller
- EnviroFlow operates as a **monitoring + overlay layer** — it reads sensor data and displays port states, but doesn't fight the native app for control
- When the user is ready to let EnviroFlow take over, they disable AC Infinity's active programming in the native app (set ports to OFF mode), then EnviroFlow's automation engine takes control via the local API
- The UI should include a clear **"EnviroFlow Control" toggle** per controller that warns the user: "This will override AC Infinity app programming. You can disable AC Infinity's Advance automations in their app to prevent conflicts."
- A status indicator on each controller card shows who currently has control: `🟢 EnviroFlow` or `🔵 AC Infinity` or `⚠️ Both Active`

### 8.3 Sensor Polling Rate
**Decision:** 5–15 second polling, matching AC Infinity's native rate.

- Poll sensor readings every 10 seconds as the default
- Store readings in `sensor_readings` table with TimescaleDB or partitioned by day
- Real-time Supabase subscription pushes updates to all connected clients
- Stale data indicator at >2 min, disconnected at >5 min (already in design system)

### 8.4 Offline Fallback
**Decision:** AC Infinity controller's local programs are the failsafe.

- If EnviroFlow's cloud/server goes down, the physical AC Infinity controller continues running whatever program was last set on it locally
- This is why the architecture preserves AC Infinity's native programming model — the controller's onboard firmware handles OFF/ON/AUTO/VPD/TIMER/CYCLE/SCHEDULE independently
- EnviroFlow's automation engine writes configurations TO the controller, which then executes them locally
- The controller is the execution layer; EnviroFlow is the orchestration layer
- On reconnection, EnviroFlow re-syncs state and resumes orchestration

### 8.5 Multi-Brand Sensor Support
**Decision:** Sensors are first-class, brand-agnostic entities added programmatically.

The system supports sensors from any brand (AC Infinity, Inkbird, Ecowitt, generic WiFi/BLE sensors, etc.) as independent data sources:

```sql
-- Brand-agnostic sensor registry
CREATE TABLE sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,                        -- "Tent A Probe", "Inkbird IBS-TH2"
  brand TEXT,                                -- "ac_infinity", "inkbird", "ecowitt", "generic"
  model TEXT,
  connection_type TEXT CHECK (connection_type IN ('uis_probe', 'wifi', 'ble', 'zigbee', 'api')),
  
  -- What this sensor measures
  capabilities TEXT[] NOT NULL,              -- {'temperature', 'humidity', 'vpd', 'co2', 'ph', 'ec', 'soil_moisture'}
  
  -- Where readings come from
  data_source JSONB,                         -- connection-specific config (IP, API key, BLE MAC, etc.)
  
  -- Calibration offsets
  calibration JSONB DEFAULT '{}',            -- {"temperature": -1.5, "humidity": 2.0}
  
  -- Assignment (which controller/zone uses this sensor)
  controller_id UUID REFERENCES controllers, -- null = standalone sensor
  zone_id UUID,                              -- future: multi-zone support
  
  is_primary BOOLEAN DEFAULT FALSE,          -- primary sensor for its controller
  poll_interval_seconds INT DEFAULT 10,
  last_reading JSONB,
  last_seen TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

This means:
- AC Infinity's built-in probe is just one sensor entry with `brand: 'ac_infinity'`, `connection_type: 'uis_probe'`
- An Inkbird IBS-TH2 becomes another sensor with `brand: 'inkbird'`, `connection_type: 'ble'`
- The automation engine references **sensors**, not controllers, for trigger evaluation
- Users can mix and match: use an Inkbird sensor to trigger an AC Infinity fan
- The `sensor_readings` table stays universal — all sensors write to the same time-series

Updated `sensor_readings` to reference sensors instead of controllers:

```sql
CREATE TABLE sensor_readings (
  sensor_id UUID REFERENCES sensors NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  readings JSONB NOT NULL,                   -- {"temperature": 75.1, "humidity": 52.6, "vpd": 1.34}
  PRIMARY KEY (sensor_id, timestamp)
);
```

And the automation trigger nodes reference sensors directly:

```typescript
interface SensorTriggerNode {
  sensorId: string;          // any sensor, any brand
  metric: 'temperature' | 'humidity' | 'vpd' | 'co2' | 'ph' | 'ec' | 'soil_moisture';
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq';
  threshold: number;
  bufferValue?: number;      // hysteresis
}
```

---

## 9. Design System References

All UI components should follow the EnviroFlow design system documented in:
- **UI Guide:** `enviroflow-ui-guide.html` — Complete component specs, colors, typography
- **Icon Reference:** `enviroflow-icon-reference.html` — Device icons, port icons, status indicators
- **Reading Colors:** Temperature = `#FF5252` (red), Humidity = `#4FC3F7` (blue), VPD = `#B388FF` (purple)
- **Chart Colors:** Match reading colors in `chartColors.ts` configuration