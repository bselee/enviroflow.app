# EnviroFlow Dashboard - Developer Build Guide

> A step-by-step guide for developers to build the EnviroFlow environmental monitoring dashboard, complete with AI prompts for assistance at each stage.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [Phase 1: Project Setup](#3-phase-1-project-setup)
4. [Phase 2: Design System](#4-phase-2-design-system)
5. [Phase 3: Core Components](#5-phase-3-core-components)
6. [Phase 4: Data Layer](#6-phase-4-data-layer)
7. [Phase 5: Real-time Features](#7-phase-5-real-time-features)
8. [Phase 6: Controller Integrations](#8-phase-6-controller-integrations)
9. [Phase 7: Polish & Performance](#9-phase-7-polish--performance)
10. [Prompt Library](#10-prompt-library)

---

## 1. Project Overview

### What We're Building

A real-time environmental monitoring dashboard for indoor grow operations that:
- Aggregates data from multiple controller brands (AC Infinity, TrolMaster, Pulse)
- Displays Temperature, Humidity, VPD, and optionally CO₂
- Provides beautiful multi-line gradient charts
- Supports light/dark themes
- Allows drag-and-drop card customization
- Works offline with demo data, seamlessly transitions to real data

### Key Technical Challenges

| Challenge | Solution Approach |
|-----------|-------------------|
| Multiple controller APIs | Adapter pattern with unified interface |
| Real-time updates | Supabase Realtime (WebSocket) + polling fallback |
| Chart performance | SVG with requestAnimationFrame, virtualization for large datasets |
| Offline support | Demo data generator, localStorage caching |
| Theme switching | CSS custom properties + React context |
| Drag-and-drop | HTML5 Drag API with position persistence |

---

## 2. Tech Stack Decisions

### Recommended Stack

```
Frontend:
├── Next.js 14+ (App Router)
├── TypeScript (strict mode)
├── Tailwind CSS (design tokens)
├── Zustand (state management)
└── Custom SVG charts (no heavy libraries)

Backend:
├── Supabase (PostgreSQL + Realtime + Auth + Edge Functions)
├── pg_cron (scheduled polling)
└── Row Level Security (multi-tenant)

Infrastructure:
├── Vercel (frontend hosting)
├── Supabase (backend)
└── GitHub Actions (CI/CD)
```

### Why These Choices?

**Next.js over plain React**: Server components for initial data fetch, API routes for controller proxying, built-in optimization.

**Custom SVG charts over Chart.js/Recharts**: Full control over aesthetics (gradients, glows), smaller bundle, better performance for real-time updates.

**Zustand over Redux**: Simpler API, less boilerplate, perfect for this scale.

**Supabase over custom backend**: Realtime out of the box, auth included, edge functions for controller polling.

---

## 3. Phase 1: Project Setup

### Step 1.1: Initialize Project

```bash
npx create-next-app@latest enviroflow --typescript --tailwind --eslint --app --src-dir
cd enviroflow
```

### Step 1.2: Install Dependencies

```bash
# State management
npm install zustand

# Supabase
npm install @supabase/supabase-js

# Utilities
npm install clsx date-fns

# Dev dependencies
npm install -D @types/node
```

### Step 1.3: Project Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                    # Reusable primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Toggle.tsx
│   │   └── Modal.tsx
│   ├── charts/                # Chart components
│   │   ├── SensorChart.tsx
│   │   ├── GradientDefs.tsx
│   │   └── ChartTooltip.tsx
│   ├── dashboard/             # Dashboard-specific
│   │   ├── RoomCard.tsx
│   │   ├── RoomDetail.tsx
│   │   ├── Header.tsx
│   │   └── SettingsPanel.tsx
│   └── providers/             # Context providers
│       ├── ThemeProvider.tsx
│       ├── SettingsProvider.tsx
│       └── DragDropProvider.tsx
├── hooks/
│   ├── useTheme.ts
│   ├── useSettings.ts
│   ├── useDragDrop.ts
│   ├── useControllers.ts
│   └── useRealtimeSensors.ts
├── lib/
│   ├── supabase.ts
│   ├── controllers/           # Controller adapters
│   │   ├── types.ts
│   │   ├── ac-infinity.ts
│   │   ├── trolmaster.ts
│   │   └── pulse.ts
│   └── utils/
│       ├── vpd.ts             # VPD calculation
│       ├── temperature.ts     # Unit conversion
│       └── demo-data.ts       # Demo data generator
├── stores/
│   ├── settingsStore.ts
│   └── roomsStore.ts
└── types/
    └── index.ts
```

---

### 🤖 AI Prompt: Project Setup Review

```
I'm setting up a Next.js 14 project for an environmental monitoring dashboard called EnviroFlow. Here's my current structure:

[paste your folder structure]

The app needs to:
1. Display real-time sensor data (temp, humidity, VPD, CO2)
2. Support multiple controller brands via adapters
3. Use Supabase for backend/realtime
4. Support light/dark themes
5. Allow drag-and-drop card reordering

Please review my project structure and suggest:
1. Any missing folders/files I should add
2. Better organization if needed
3. Potential issues with this approach
```

---

## 4. Phase 2: Design System

### Step 2.1: Define Design Tokens

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Colors - Light Theme */
  --color-bg-primary: #f8fafc;
  --color-bg-secondary: #f1f5f9;
  --color-bg-card: rgba(255, 255, 255, 0.7);
  --color-border: rgba(0, 0, 0, 0.08);
  --color-text-primary: #1f2937;
  --color-text-secondary: rgba(0, 0, 0, 0.6);
  --color-text-muted: rgba(0, 0, 0, 0.4);
  
  /* Status Colors */
  --color-optimal: #10b981;
  --color-warning: #f59e0b;
  --color-alert: #ef4444;
  
  /* Sensor Colors */
  --color-temperature: #ef4444;
  --color-humidity: #3b82f6;
  --color-vpd: #10b981;
  --color-co2: #f59e0b;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  
  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}

[data-theme="dark"] {
  --color-bg-primary: #0f1419;
  --color-bg-secondary: #1a1f2e;
  --color-bg-card: rgba(255, 255, 255, 0.03);
  --color-border: rgba(255, 255, 255, 0.06);
  --color-text-primary: #ffffff;
  --color-text-secondary: rgba(255, 255, 255, 0.6);
  --color-text-muted: rgba(255, 255, 255, 0.4);
}

/* Base styles */
body {
  background: linear-gradient(
    145deg,
    var(--color-bg-primary) 0%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-primary) 100%
  );
  color: var(--color-text-primary);
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Utility classes */
.glass-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
}
```

### Step 2.2: Tailwind Config

Update `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          card: 'var(--color-bg-card)',
        },
        border: 'var(--color-border)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        status: {
          optimal: 'var(--color-optimal)',
          warning: 'var(--color-warning)',
          alert: 'var(--color-alert)',
        },
        sensor: {
          temperature: 'var(--color-temperature)',
          humidity: 'var(--color-humidity)',
          vpd: 'var(--color-vpd)',
          co2: 'var(--color-co2)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
}

export default config
```

---

### 🤖 AI Prompt: Design Token Expansion

```
I have these design tokens for my EnviroFlow dashboard:

[paste your CSS variables]

I need to add tokens for:
1. Chart gradient opacities (for area fills under lines)
2. Glow/shadow effects for status indicators
3. Animation timing for number counting effects
4. Hover state variations

Please provide the additional CSS custom properties following the same naming convention.
```

---

## 5. Phase 3: Core Components

### Step 3.1: Theme Provider

Create `src/components/providers/ThemeProvider.tsx`:

```typescript
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  // Load saved theme or system preference
  useEffect(() => {
    const saved = localStorage.getItem('enviroflow-theme') as Theme | null
    if (saved) {
      setTheme(saved)
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light')
    }
    setMounted(true)
  }, [])

  // Apply theme to document
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('enviroflow-theme', theme)
    }
  }, [theme, mounted])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('enviroflow-theme')) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  // Prevent flash of wrong theme
  if (!mounted) return null

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

### Step 3.2: Settings Store (Zustand)

Create `src/stores/settingsStore.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  temperatureUnit: 'F' | 'C'
  showCO2: boolean
  co2SensorAvailable: boolean
  refreshInterval: number
  vpdOptimalMin: number
  vpdOptimalMax: number
  tempOptimalMin: number
  tempOptimalMax: number
  humidityOptimalMin: number
  humidityOptimalMax: number
}

interface SettingsStore extends Settings {
  updateSettings: (updates: Partial<Settings>) => void
  resetToDefaults: () => void
}

const defaults: Settings = {
  temperatureUnit: 'F',
  showCO2: false,
  co2SensorAvailable: false,
  refreshInterval: 5000,
  vpdOptimalMin: 0.8,
  vpdOptimalMax: 1.2,
  tempOptimalMin: 72,
  tempOptimalMax: 82,
  humidityOptimalMin: 50,
  humidityOptimalMax: 65,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      updateSettings: (updates) => set((state) => ({ ...state, ...updates })),
      resetToDefaults: () => set(defaults),
    }),
    { name: 'enviroflow-settings' }
  )
)
```

### Step 3.3: VPD Calculation Utility

Create `src/lib/utils/vpd.ts`:

```typescript
/**
 * Calculate Vapor Pressure Deficit using Magnus-Tetens formula
 * 
 * @param temperatureF - Temperature in Fahrenheit
 * @param humidity - Relative humidity percentage (0-100)
 * @returns VPD in kPa
 */
export function calculateVPD(temperatureF: number, humidity: number): number {
  // Convert to Celsius
  const tempC = (temperatureF - 32) * 5 / 9
  
  // Saturation Vapor Pressure (Magnus-Tetens formula)
  const svp = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3))
  
  // Vapor Pressure Deficit
  const vpd = svp * (1 - humidity / 100)
  
  return Math.round(vpd * 100) / 100
}

/**
 * Get VPD status based on optimal range
 */
export function getVPDStatus(
  vpd: number, 
  min: number, 
  max: number
): 'optimal' | 'warning' | 'alert' {
  if (vpd >= min && vpd <= max) return 'optimal'
  
  const deviation = vpd < min ? min - vpd : vpd - max
  const range = max - min
  
  return deviation / range < 0.25 ? 'warning' : 'alert'
}

/**
 * Get recommended VPD range for growth stage
 */
export function getRecommendedVPD(stage: 'clone' | 'veg' | 'flower' | 'late-flower') {
  const ranges = {
    'clone': { min: 0.4, max: 0.8 },
    'veg': { min: 0.8, max: 1.2 },
    'flower': { min: 1.0, max: 1.5 },
    'late-flower': { min: 1.2, max: 1.6 },
  }
  return ranges[stage]
}
```

---

### 🤖 AI Prompt: Component Architecture

```
I'm building a RoomCard component for EnviroFlow that displays:
- Room name and controller type
- Current VPD as hero metric (large number)
- Temperature and Humidity as secondary metrics
- Optional CO2 reading
- Status indicator (green/amber/red based on optimal ranges)
- Drag handle when in edit mode

The card needs to:
1. Support drag-and-drop reordering
2. Open a detail modal on click (when not in edit mode)
3. Show real-time updates with subtle animations
4. Work in both light and dark themes

Here's my current settings store:
[paste settingsStore.ts]

Please provide:
1. TypeScript interface for the component props
2. Component implementation with all features
3. Suggestions for animation approach (CSS vs JS)
```

---

## 6. Phase 4: Data Layer

### Step 4.1: Type Definitions

Create `src/types/index.ts`:

```typescript
// Sensor reading from any controller
export interface SensorReading {
  timestamp: number
  temperature: number  // Always stored in Fahrenheit
  humidity: number     // Percentage 0-100
  vpd: number          // kPa
  co2: number | null   // ppm, null if sensor not available
}

// Formatted for display
export interface FormattedReading extends SensorReading {
  time: string  // "HH:mm" format for charts
}

// Controller configuration
export interface Controller {
  id: string
  userId: string
  name: string           // "AC Infinity Controller 69"
  roomName: string       // "Flower Room 1"
  controllerType: ControllerType
  apiEndpoint?: string   // For local controllers like TrolMaster
  isActive: boolean
  lastSeenAt: string | null
  createdAt: string
}

export type ControllerType = 'ac_infinity' | 'trolmaster' | 'pulse' | 'custom'

// Room with data (what the UI consumes)
export interface Room {
  id: string
  name: string
  controller: string
  controllerType: ControllerType
  isOnline: boolean
  lastUpdate: Date | null
  data: FormattedReading[]
}

// User settings (persisted)
export interface UserSettings {
  temperatureUnit: 'F' | 'C'
  showCO2: boolean
  co2SensorAvailable: boolean
  refreshInterval: number
  optimalRanges: {
    vpd: { min: number; max: number }
    temperature: { min: number; max: number }
    humidity: { min: number; max: number }
  }
  cardOrder: string[]  // Array of room IDs
}
```

### Step 4.2: Demo Data Generator

Create `src/lib/utils/demo-data.ts`:

```typescript
import { FormattedReading } from '@/types'
import { calculateVPD } from './vpd'

interface DemoConfig {
  baseTemp?: number      // Base temperature in F
  baseHumidity?: number  // Base humidity %
  points?: number        // Number of data points (default 48 = 24h at 30min intervals)
  hasLightCycle?: boolean
  lightOnHour?: number   // Hour lights turn on (0-23)
  lightOffHour?: number  // Hour lights turn off (0-23)
}

/**
 * Generate realistic sensor data with day/night patterns
 */
export function generateDemoData(config: DemoConfig = {}): FormattedReading[] {
  const {
    baseTemp = 76,
    baseHumidity = 58,
    points = 48,
    hasLightCycle = true,
    lightOnHour = 6,
    lightOffHour = 20,
  } = config

  const data: FormattedReading[] = []
  let temp = baseTemp
  let humidity = baseHumidity

  for (let i = 0; i < points; i++) {
    const hour = (i / 2) % 24
    const isLightsOn = hasLightCycle 
      ? (hour >= lightOnHour && hour < lightOffHour)
      : true

    // Temperature rises when lights are on
    const tempTarget = isLightsOn ? baseTemp + 4 : baseTemp - 2
    temp += (tempTarget - temp) * 0.1 + (Math.random() - 0.5) * 0.8
    
    // Humidity inversely correlates with temperature
    const humidityTarget = isLightsOn ? baseHumidity - 5 : baseHumidity + 3
    humidity += (humidityTarget - humidity) * 0.1 + (Math.random() - 0.5) * 1.2
    humidity = Math.max(30, Math.min(80, humidity))

    const vpd = calculateVPD(temp, humidity)
    
    // CO2 follows a pattern: higher during lights-on (plants consuming)
    const co2Base = isLightsOn ? 1000 : 800
    const co2 = Math.round(co2Base + Math.sin(i / 6) * 150 + (Math.random() - 0.5) * 100)

    data.push({
      time: `${String(Math.floor(hour)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
      timestamp: Date.now() - (points - i) * 30 * 60 * 1000,
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      vpd,
      co2,
    })
  }

  return data
}

/**
 * Generate a new reading based on previous reading (for real-time simulation)
 */
export function generateNextReading(previous: FormattedReading): FormattedReading {
  const newTemp = previous.temperature + (Math.random() - 0.5) * 0.3
  const newHumidity = Math.max(30, Math.min(80, 
    previous.humidity + (Math.random() - 0.5) * 0.5
  ))
  const vpd = calculateVPD(newTemp, newHumidity)
  const co2 = previous.co2 
    ? Math.round(previous.co2 + (Math.random() - 0.5) * 20)
    : null

  return {
    time: new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }),
    timestamp: Date.now(),
    temperature: Math.round(newTemp * 10) / 10,
    humidity: Math.round(newHumidity * 10) / 10,
    vpd,
    co2,
  }
}

/**
 * Create demo rooms for first-time users
 */
export function createDemoRooms() {
  return [
    {
      id: 'demo-veg-a',
      name: 'Veg Room A',
      controller: 'AC Infinity Controller 69',
      controllerType: 'ac_infinity' as const,
      isOnline: true,
      lastUpdate: new Date(),
      data: generateDemoData({ baseTemp: 74, baseHumidity: 62 }),
    },
    {
      id: 'demo-flower-1',
      name: 'Flower Room 1',
      controller: 'TrolMaster Hydro-X',
      controllerType: 'trolmaster' as const,
      isOnline: true,
      lastUpdate: new Date(),
      data: generateDemoData({ baseTemp: 78, baseHumidity: 55 }),
    },
    {
      id: 'demo-flower-2',
      name: 'Flower Room 2',
      controller: 'TrolMaster Hydro-X',
      controllerType: 'trolmaster' as const,
      isOnline: true,
      lastUpdate: new Date(),
      data: generateDemoData({ baseTemp: 79, baseHumidity: 52 }),
    },
    {
      id: 'demo-clone',
      name: 'Clone Room',
      controller: 'AC Infinity Controller 69',
      controllerType: 'ac_infinity' as const,
      isOnline: true,
      lastUpdate: new Date(),
      data: generateDemoData({ baseTemp: 76, baseHumidity: 70 }),
    },
  ]
}
```

---

### 🤖 AI Prompt: Supabase Schema Design

```
I need to design a Supabase PostgreSQL schema for EnviroFlow with these requirements:

1. Multi-tenant (users only see their own data)
2. Controllers table (stores API credentials, room names)
3. Sensor readings table (time-series data, high volume)
4. User settings table (preferences, optimal ranges)

Constraints:
- Need efficient queries for "last 24 hours of readings for all my controllers"
- Need real-time subscriptions on new readings
- Should support 100+ readings per controller per day
- Need to handle controllers going offline gracefully

Please provide:
1. Complete SQL schema with indexes
2. Row Level Security policies
3. Recommended Supabase Realtime configuration
4. Any partitioning strategy for the readings table if needed
```

---

## 7. Phase 5: Real-time Features

### Step 5.1: Supabase Client Setup

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Type-safe database types (generate with Supabase CLI)
export type Database = {
  public: {
    Tables: {
      controllers: {
        Row: {
          id: string
          user_id: string
          name: string
          room_name: string
          controller_type: string
          api_endpoint: string | null
          is_active: boolean
          last_seen_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['controllers']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['controllers']['Insert']>
      }
      sensor_readings: {
        Row: {
          id: number
          controller_id: string
          temperature: number
          humidity: number
          vpd: number
          co2: number | null
          recorded_at: string
        }
        Insert: Omit<Database['public']['Tables']['sensor_readings']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['sensor_readings']['Insert']>
      }
    }
  }
}
```

### Step 5.2: Real-time Sensors Hook

Create `src/hooks/useRealtimeSensors.ts`:

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { FormattedReading, Room } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseRealtimeSensorsResult {
  rooms: Room[]
  connectionStatus: ConnectionStatus
  lastUpdate: Date | null
  refetch: () => Promise<void>
}

export function useRealtimeSensors(controllerIds: string[]): UseRealtimeSensorsResult {
  const [rooms, setRooms] = useState<Room[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Fetch initial historical data
  const fetchHistory = useCallback(async () => {
    if (controllerIds.length === 0) return

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: readings, error } = await supabase
      .from('sensor_readings')
      .select(`
        *,
        controller:controllers(id, name, room_name, controller_type, is_active, last_seen_at)
      `)
      .in('controller_id', controllerIds)
      .gte('recorded_at', twentyFourHoursAgo)
      .order('recorded_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch sensor history:', error)
      return
    }

    // Group readings by controller
    const grouped = readings.reduce((acc, reading) => {
      const controllerId = reading.controller_id
      if (!acc[controllerId]) {
        acc[controllerId] = {
          controller: reading.controller,
          readings: [],
        }
      }
      acc[controllerId].readings.push({
        time: new Date(reading.recorded_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        timestamp: new Date(reading.recorded_at).getTime(),
        temperature: reading.temperature,
        humidity: reading.humidity,
        vpd: reading.vpd,
        co2: reading.co2,
      })
      return acc
    }, {} as Record<string, { controller: any; readings: FormattedReading[] }>)

    // Transform to Room objects
    const roomsData: Room[] = Object.entries(grouped).map(([id, { controller, readings }]) => ({
      id,
      name: controller.room_name,
      controller: controller.name,
      controllerType: controller.controller_type,
      isOnline: controller.is_active,
      lastUpdate: controller.last_seen_at ? new Date(controller.last_seen_at) : null,
      data: readings,
    }))

    setRooms(roomsData)
    setLastUpdate(new Date())
  }, [controllerIds])

  // Subscribe to real-time updates
  useEffect(() => {
    if (controllerIds.length === 0) {
      setConnectionStatus('disconnected')
      return
    }

    let channel: RealtimeChannel | null = null

    const setupSubscription = async () => {
      await fetchHistory()

      channel = supabase
        .channel('sensor-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sensor_readings',
            filter: `controller_id=in.(${controllerIds.join(',')})`,
          },
          (payload) => {
            const newReading = payload.new as any

            setRooms((prevRooms) =>
              prevRooms.map((room) => {
                if (room.id !== newReading.controller_id) return room

                const formattedReading: FormattedReading = {
                  time: new Date(newReading.recorded_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }),
                  timestamp: new Date(newReading.recorded_at).getTime(),
                  temperature: newReading.temperature,
                  humidity: newReading.humidity,
                  vpd: newReading.vpd,
                  co2: newReading.co2,
                }

                return {
                  ...room,
                  lastUpdate: new Date(),
                  data: [...room.data.slice(-47), formattedReading], // Keep last 48 readings
                }
              })
            )

            setLastUpdate(new Date())
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected')
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected')
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('error')
          }
        })
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [controllerIds.join(','), fetchHistory])

  return {
    rooms,
    connectionStatus,
    lastUpdate,
    refetch: fetchHistory,
  }
}
```

---

### 🤖 AI Prompt: WebSocket Reconnection Logic

```
I'm implementing real-time sensor updates with Supabase Realtime. I need robust reconnection logic that handles:

1. Network disconnections (WiFi drops)
2. Server-side disconnections
3. Mobile app backgrounding
4. Exponential backoff for reconnection attempts
5. Fallback to HTTP polling if WebSocket fails repeatedly

Current implementation:
[paste useRealtimeSensors.ts]

Please enhance this with:
1. Reconnection logic with exponential backoff (1s, 2s, 4s, 8s, max 16s)
2. HTTP polling fallback after 5 failed WebSocket attempts
3. Connection status indicator updates
4. Automatic recovery when connection is restored
5. Queue for missed updates during disconnection
```

---

## 8. Phase 6: Controller Integrations

### Step 6.1: Controller Adapter Interface

Create `src/lib/controllers/types.ts`:

```typescript
export interface ControllerReading {
  temperature: number  // Fahrenheit
  humidity: number     // Percentage
  vpd: number          // kPa
  co2: number | null   // ppm or null
  timestamp: Date
}

export interface ControllerConfig {
  apiEndpoint?: string
  apiKey?: string
  email?: string
  password?: string
  deviceId?: string
}

export interface ControllerAdapter {
  name: string
  type: string
  
  /**
   * Test if the controller is reachable and credentials are valid
   */
  validate(config: ControllerConfig): Promise<boolean>
  
  /**
   * Get list of devices/sensors from this controller
   */
  getDevices(config: ControllerConfig): Promise<Array<{
    id: string
    name: string
    type: string
  }>>
  
  /**
   * Get current sensor reading
   */
  getCurrentReading(config: ControllerConfig, deviceId: string): Promise<ControllerReading>
  
  /**
   * Get historical readings (if supported)
   */
  getHistoricalReadings?(
    config: ControllerConfig, 
    deviceId: string, 
    since: Date
  ): Promise<ControllerReading[]>
}
```

### Step 6.2: AC Infinity Adapter

Create `src/lib/controllers/ac-infinity.ts`:

```typescript
import { ControllerAdapter, ControllerConfig, ControllerReading } from './types'
import { calculateVPD } from '../utils/vpd'

/**
 * AC Infinity Controller Adapter
 * 
 * Note: AC Infinity uses a cloud API. This is based on reverse-engineering
 * their mobile app. API may change without notice.
 */
export class ACInfinityAdapter implements ControllerAdapter {
  name = 'AC Infinity'
  type = 'ac_infinity'
  
  private baseUrl = 'https://api.acinfinity.com/api/v1'
  private tokenCache: Map<string, { token: string; expires: number }> = new Map()

  async validate(config: ControllerConfig): Promise<boolean> {
    try {
      await this.authenticate(config)
      return true
    } catch {
      return false
    }
  }

  async getDevices(config: ControllerConfig): Promise<Array<{ id: string; name: string; type: string }>> {
    const token = await this.authenticate(config)
    
    const response = await fetch(`${this.baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    
    if (!response.ok) throw new Error('Failed to fetch devices')
    
    const data = await response.json()
    return data.devices.map((d: any) => ({
      id: d.deviceId,
      name: d.deviceName,
      type: d.deviceType,
    }))
  }

  async getCurrentReading(config: ControllerConfig, deviceId: string): Promise<ControllerReading> {
    const token = await this.authenticate(config)
    
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/sensors`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    
    if (!response.ok) throw new Error('Failed to fetch sensor data')
    
    const data = await response.json()
    
    // AC Infinity reports temperature in Celsius
    const tempF = (data.temperature * 9/5) + 32
    const vpd = data.vpd ?? calculateVPD(tempF, data.humidity)
    
    return {
      temperature: Math.round(tempF * 10) / 10,
      humidity: data.humidity,
      vpd: Math.round(vpd * 100) / 100,
      co2: data.co2 ?? null,
      timestamp: new Date(),
    }
  }

  private async authenticate(config: ControllerConfig): Promise<string> {
    const cacheKey = `${config.email}`
    const cached = this.tokenCache.get(cacheKey)
    
    if (cached && cached.expires > Date.now()) {
      return cached.token
    }
    
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.email,
        password: config.password,
      }),
    })
    
    if (!response.ok) throw new Error('Authentication failed')
    
    const data = await response.json()
    
    // Cache token for 50 minutes (tokens typically valid for 1 hour)
    this.tokenCache.set(cacheKey, {
      token: data.token,
      expires: Date.now() + 50 * 60 * 1000,
    })
    
    return data.token
  }
}
```

### Step 6.3: TrolMaster Adapter

Create `src/lib/controllers/trolmaster.ts`:

```typescript
import { ControllerAdapter, ControllerConfig, ControllerReading } from './types'
import { calculateVPD } from '../utils/vpd'

/**
 * TrolMaster Hydro-X Adapter
 * 
 * TrolMaster exposes a local HTTP API on your network.
 * Requires the controller's IP address.
 */
export class TrolMasterAdapter implements ControllerAdapter {
  name = 'TrolMaster'
  type = 'trolmaster'

  async validate(config: ControllerConfig): Promise<boolean> {
    try {
      const response = await fetch(`http://${config.apiEndpoint}/api/status`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
      return response.ok
    } catch {
      return false
    }
  }

  async getDevices(config: ControllerConfig): Promise<Array<{ id: string; name: string; type: string }>> {
    const response = await fetch(`http://${config.apiEndpoint}/api/zones`)
    
    if (!response.ok) throw new Error('Failed to fetch zones')
    
    const data = await response.json()
    return data.zones.map((z: any) => ({
      id: z.zoneId,
      name: z.zoneName,
      type: 'zone',
    }))
  }

  async getCurrentReading(config: ControllerConfig, deviceId: string): Promise<ControllerReading> {
    const response = await fetch(`http://${config.apiEndpoint}/api/zones/${deviceId}/sensors`)
    
    if (!response.ok) throw new Error('Failed to fetch sensor data')
    
    const data = await response.json()
    
    // TrolMaster typically reports in Fahrenheit
    const vpd = data.vpd ?? calculateVPD(data.temperature, data.humidity)
    
    return {
      temperature: data.temperature,
      humidity: data.humidity,
      vpd: Math.round(vpd * 100) / 100,
      co2: data.co2 ?? null,
      timestamp: new Date(),
    }
  }

  async getHistoricalReadings(
    config: ControllerConfig, 
    deviceId: string, 
    since: Date
  ): Promise<ControllerReading[]> {
    const response = await fetch(
      `http://${config.apiEndpoint}/api/zones/${deviceId}/history?since=${since.toISOString()}`
    )
    
    if (!response.ok) throw new Error('Failed to fetch history')
    
    const data = await response.json()
    
    return data.readings.map((r: any) => ({
      temperature: r.temperature,
      humidity: r.humidity,
      vpd: r.vpd ?? calculateVPD(r.temperature, r.humidity),
      co2: r.co2 ?? null,
      timestamp: new Date(r.timestamp),
    }))
  }
}
```

### Step 6.4: Controller Registry

Create `src/lib/controllers/index.ts`:

```typescript
import { ControllerAdapter } from './types'
import { ACInfinityAdapter } from './ac-infinity'
import { TrolMasterAdapter } from './trolmaster'

// Registry of all controller adapters
const adapters: Record<string, ControllerAdapter> = {
  ac_infinity: new ACInfinityAdapter(),
  trolmaster: new TrolMasterAdapter(),
}

export function getAdapter(type: string): ControllerAdapter | null {
  return adapters[type] ?? null
}

export function getSupportedControllers(): Array<{ type: string; name: string }> {
  return Object.entries(adapters).map(([type, adapter]) => ({
    type,
    name: adapter.name,
  }))
}

export * from './types'
```

---

### 🤖 AI Prompt: New Controller Integration

```
I need to add support for a new environmental controller to EnviroFlow. The controller is [CONTROLLER NAME] and has the following API:

API Documentation:
[paste API docs or describe endpoints]

Here's my existing adapter interface:
[paste types.ts]

And an example adapter:
[paste ac-infinity.ts]

Please provide:
1. Complete adapter implementation following the same pattern
2. Any edge cases I should handle (auth expiry, rate limits, etc.)
3. Unit tests for the adapter
4. Documentation for users on how to find their API credentials
```

---

## 9. Phase 7: Polish & Performance

### Performance Checklist

```markdown
## Bundle Size
- [ ] Code split by route (lazy load settings, detail views)
- [ ] Dynamic import for chart components
- [ ] Tree-shake unused Supabase features
- [ ] Target: <200KB initial JS (gzipped)

## Runtime Performance
- [ ] Memoize expensive calculations (VPD, status colors)
- [ ] Use `useMemo` for chart path generation
- [ ] Debounce settings updates
- [ ] Virtual scroll for large data sets (>1000 points)
- [ ] Target: 60fps on mid-range devices

## Charts
- [ ] Use CSS containment on chart containers
- [ ] Batch DOM updates with requestAnimationFrame
- [ ] Simplify paths when zoomed out
- [ ] Reduce point count for overview charts

## Real-time Updates
- [ ] Throttle UI updates to 1/second max
- [ ] Queue rapid updates, apply in batch
- [ ] Use CSS transitions instead of JS animation where possible
```

### Step 7.1: Memoized VPD Status Hook

```typescript
// hooks/useVPDStatus.ts
import { useMemo } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { getVPDStatus } from '@/lib/utils/vpd'

export function useVPDStatus(vpd: number) {
  const { vpdOptimalMin, vpdOptimalMax } = useSettingsStore()
  
  return useMemo(
    () => getVPDStatus(vpd, vpdOptimalMin, vpdOptimalMax),
    [vpd, vpdOptimalMin, vpdOptimalMax]
  )
}
```

### Step 7.2: Optimized Chart Rendering

```typescript
// Simplified path for performance
function simplifyPath(points: number[], tolerance: number = 0.5): number[] {
  if (points.length < 3) return points
  
  // Douglas-Peucker algorithm for path simplification
  // ... implementation
}

// Use in chart component
const chartPath = useMemo(() => {
  const points = data.map((d, i) => ({
    x: xScale(i),
    y: yScale(normalize(d.value)),
  }))
  
  // Simplify if more than 100 points
  if (points.length > 100) {
    return simplifyPath(points, 0.5)
  }
  
  return points
}, [data, xScale, yScale])
```

---

### 🤖 AI Prompt: Performance Optimization

```
I'm seeing performance issues with my EnviroFlow dashboard. Here's my current SensorChart component:

[paste SensorChart component]

Issues:
1. Janky animations when data updates rapidly
2. Slow initial render with 48 data points × 4 metrics
3. High memory usage with multiple charts visible

Please provide:
1. Optimized version with memoization
2. SVG path simplification for large datasets
3. CSS-based animations instead of JS where possible
4. Virtualization strategy if I need to show 1000+ points
```

---

## 10. Prompt Library

### Quick Reference Prompts

#### Architecture & Planning

```
Help me design a [feature] for EnviroFlow that [requirements]. Consider:
- Current tech stack: Next.js 14, Supabase, Zustand, Tailwind
- Existing patterns: [describe relevant patterns]
- Constraints: [performance, mobile, offline, etc.]
```

#### Debugging

```
I'm getting [error] in my EnviroFlow [component/hook]. 

Here's the relevant code:
[paste code]

Here's the error:
[paste error]

What I've tried:
[list attempts]
```

#### Code Review

```
Please review this [component/function] for EnviroFlow:

[paste code]

Check for:
1. TypeScript best practices
2. React performance issues (missing deps, unnecessary renders)
3. Error handling gaps
4. Accessibility issues
5. Security concerns (especially with API keys)
```

#### Testing

```
Generate comprehensive tests for this EnviroFlow [component/function]:

[paste code]

Include:
1. Unit tests for core logic
2. Integration tests for API interactions
3. Edge cases (offline, errors, empty states)
4. Accessibility tests
```

#### Documentation

```
Write documentation for this EnviroFlow [feature]:

Code: [paste code]
User-facing behavior: [describe]

Include:
1. JSDoc comments for functions
2. README section for developers
3. User guide section for end users
```

---

## Appendix: Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm run lint                   # Run ESLint
npm run type-check            # TypeScript check

# Supabase
npx supabase start            # Local Supabase
npx supabase db push          # Push schema changes
npx supabase gen types        # Generate TypeScript types
npx supabase functions serve  # Local Edge Functions

# Testing
npm run test                  # Run tests
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report

# Deployment
vercel                        # Deploy to Vercel
vercel --prod                # Production deploy
```

---

## Next Steps

After completing this guide, you'll have:
- ✅ Fully functional dashboard with demo data
- ✅ Real-time Supabase integration
- ✅ Controller adapters for AC Infinity & TrolMaster
- ✅ Light/dark theme support
- ✅ Drag-and-drop card customization
- ✅ User-configurable optimal ranges

Future enhancements to consider:
- [ ] Push notifications for alerts
- [ ] Historical data export (CSV)
- [ ] Multi-user support (teams)
- [ ] Automation triggers
- [ ] Mobile native app (React Native)