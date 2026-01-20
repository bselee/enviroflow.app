# EnviroFlow Backend Development Guide

**Project:** EnviroFlow Automation Engine  
**Domain:** enviroflow.app  
**Repository:** github.com/bselee/enviroflow.app  
**Tech Stack:** Next.js 14 + Supabase (PostgreSQL + Realtime) + Grok AI  
**Last Updated:** January 20, 2026

---

## 📋 Current State Overview

### ✅ Already Built

| Component | Status | Location |
|-----------|--------|----------|
| Next.js Web App | ✅ Deployed on Vercel | `apps/web/` |
| UI Kit (shadcn/ui) | ✅ Complete | `apps/web/src/components/` |
| Dashboard, Auth, Settings Pages | ✅ Complete | `apps/web/src/app/` |
| Supabase Project | ✅ Created | `vhlnnfmuhttjpwyobklu` |
| AI Analysis API | ✅ Working | `apps/web/src/app/api/analyze/` |
| Realtime Hooks | ✅ Built | `apps/web/src/lib/ai-insights.ts` |
| AI Tables Migration | ✅ Ready | `apps/automation-engine/supabase/migrations/` |

### 🔨 Needs Building

| Component | Priority | Description |
|-----------|----------|-------------|
| Core Tables Migration | **HIGH** | controllers, workflows, rooms |
| Controller Adapters | **HIGH** | AC Infinity, Inkbird API connectors |
| Supabase Auth Integration | **HIGH** | Connect frontend auth to Supabase |
| Workflow Executor | MEDIUM | Cron job to run automations |
| Edge Functions | MEDIUM | Supabase serverless functions |

---

## 🔧 Project Configuration

### Supabase Credentials

```bash
# Project Reference
SUPABASE_PROJECT_REF=vhlnnfmuhttjpwyobklu

# URLs
SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
DATABASE_URL=postgresql://postgres:PASSWORD@db.vhlnnfmuhttjpwyobklu.supabase.co:5432/postgres

# Dashboard
https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu
```

### Environment Variables

Create `.env.local` in `apps/web/`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vhlnnfmuhttjpwyobklu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # From Supabase Dashboard > Settings > API
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # From Supabase Dashboard > Settings > API
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.vhlnnfmuhttjpwyobklu.supabase.co:5432/postgres

# AI (Grok)
GROK_API_KEY=xai-...  # From x.ai console

# App
NEXT_PUBLIC_APP_URL=https://enviroflow.app
```

---

## 📁 Project Structure

```
enviroflow.app/
├── apps/
│   ├── web/                          # Next.js 14 frontend (DEPLOYED)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/
│   │   │   │   │   └── analyze/      # ✅ AI analysis endpoint
│   │   │   │   ├── dashboard/        # ✅ Main dashboard
│   │   │   │   ├── automations/      # ✅ Workflow management
│   │   │   │   ├── controllers/      # ✅ Device management
│   │   │   │   ├── settings/         # ✅ User settings
│   │   │   │   ├── login/            # ✅ Auth pages
│   │   │   │   └── signup/           # ✅ Auth pages
│   │   │   ├── components/
│   │   │   │   ├── ui/               # ✅ shadcn/ui components
│   │   │   │   ├── dashboard/        # ✅ RoomCard, ActivityLog
│   │   │   │   └── layout/           # ✅ Sidebar, Header
│   │   │   └── lib/
│   │   │       ├── ai-insights.ts    # ✅ Realtime hooks
│   │   │       └── utils.ts          # ✅ Utilities
│   │   └── .env.local                # Environment variables
│   │
│   └── automation-engine/            # Backend (NEEDS BUILDING)
│       ├── supabase/
│       │   ├── migrations/           # ✅ AI tables exist
│       │   │   └── 20260120_ai_analysis_tables.sql
│       │   ├── functions/            # 🔨 TO BUILD
│       │   │   ├── workflow-executor/
│       │   │   └── sunrise-sunset/
│       │   └── config.toml
│       ├── lib/                      # 🔨 TO BUILD
│       │   ├── adapters/
│       │   │   ├── ACInfinityAdapter.ts
│       │   │   ├── InkbirdAdapter.ts
│       │   │   └── GenericWiFiAdapter.ts
│       │   └── types/
│       └── scripts/
│           └── migrate.js            # ✅ Migration helper
│
└── docs/
    └── BACKEND_GUIDE.md              # This file
```

---

## 🗄️ Database Schema

### Phase 1: Run Existing Migration (AI Tables)

The AI analysis tables are ready. Run via Supabase Dashboard SQL Editor:

**File:** `apps/automation-engine/supabase/migrations/20260120_ai_analysis_tables.sql`

```sql
-- Creates: ai_insights, sensor_logs, automation_actions
-- Already has RLS and Realtime enabled
```

**Run it:**
1. Go to: https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
2. Copy contents of the migration file
3. Click "Run"

### Phase 2: Create Core Tables Migration

Create new file: `apps/automation-engine/supabase/migrations/20260121_core_tables.sql`

```sql
-- ============================================
-- CONTROLLERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS controllers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL CHECK (brand IN ('ac_infinity', 'inkbird', 'generic_wifi')),
  controller_id TEXT NOT NULL,
  name TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  capabilities JSONB DEFAULT '{}',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  room_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, controller_id)
);

-- RLS
ALTER TABLE controllers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own controllers" ON controllers
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_controllers_user_id ON controllers(user_id);
CREATE INDEX IF NOT EXISTS idx_controllers_online ON controllers(is_online);

-- ============================================
-- ROOMS TABLE (Virtual grouping of controllers)
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own rooms" ON rooms
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- WORKFLOWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  last_run TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own workflows" ON workflows
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = true;

-- ============================================
-- WORKFLOW EXECUTION LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed', 'skipped')),
  trigger_type TEXT,
  actions_executed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workflow_logs" ON workflow_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_started ON workflow_logs(started_at DESC);

-- ============================================
-- DIMMER SCHEDULES (Sunrise/Sunset)
-- ============================================
CREATE TABLE IF NOT EXISTS dimmer_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('sunrise', 'sunset', 'custom')),
  start_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  curve TEXT DEFAULT 'sigmoid' CHECK (curve IN ('linear', 'sigmoid', 'exponential')),
  target_intensity INTEGER DEFAULT 100 CHECK (target_intensity >= 0 AND target_intensity <= 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dimmer_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own dimmer_schedules" ON dimmer_schedules
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_controllers_updated_at
  BEFORE UPDATE ON controllers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE controllers;
ALTER PUBLICATION supabase_realtime ADD TABLE workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_logs;
```

---

## 🔌 Controller Adapters

### Create the Adapter Interface

**File:** `apps/automation-engine/lib/adapters/types.ts`

```typescript
export interface ControllerAdapter {
  connect(credentials: ControllerCredentials): Promise<ControllerMetadata>
  readSensors(controllerId: string): Promise<SensorReading[]>
  controlDevice(controllerId: string, port: number, command: DeviceCommand): Promise<CommandResult>
  getStatus(controllerId: string): Promise<ControllerStatus>
  disconnect(controllerId: string): Promise<void>
}

export interface ControllerCredentials {
  email?: string
  password?: string
  apiKey?: string
  ipAddress?: string
  [key: string]: unknown
}

export interface ControllerMetadata {
  controllerId: string
  brand: string
  model?: string
  firmware?: string
  capabilities: {
    sensors: SensorCapability[]
    devices: DeviceCapability[]
  }
}

export interface SensorCapability {
  port: number
  type: 'temperature' | 'humidity' | 'vpd' | 'co2' | 'light'
  unit: string
}

export interface DeviceCapability {
  port: number
  type: 'fan' | 'light' | 'heater' | 'humidifier' | 'dehumidifier' | 'outlet'
  supportsDimming: boolean
  minLevel?: number
  maxLevel?: number
}

export interface SensorReading {
  port: number
  type: string
  value: number
  unit: string
  timestamp: Date
}

export interface DeviceCommand {
  type: 'set_level' | 'turn_on' | 'turn_off'
  value?: number  // 0-100 for dimmers
}

export interface CommandResult {
  success: boolean
  error?: string
  currentState?: unknown
}

export interface ControllerStatus {
  isOnline: boolean
  lastSeen: Date
  firmware?: string
}
```

### AC Infinity Adapter

**File:** `apps/automation-engine/lib/adapters/ACInfinityAdapter.ts`

```typescript
import type { 
  ControllerAdapter, 
  ControllerCredentials, 
  ControllerMetadata,
  SensorReading, 
  DeviceCommand, 
  CommandResult,
  ControllerStatus 
} from './types'

const API_BASE = 'https://www.acinfinityserver.com'

export class ACInfinityAdapter implements ControllerAdapter {
  private tokens = new Map<string, string>()
  
  async connect(credentials: ControllerCredentials): Promise<ControllerMetadata> {
    const { email, password } = credentials
    
    if (!email || !password) {
      throw new Error('AC Infinity requires email and password')
    }
    
    // Step 1: Login
    const loginRes = await fetch(`${API_BASE}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    if (!loginRes.ok) {
      throw new Error(`AC Infinity login failed: ${loginRes.status}`)
    }
    
    const loginData = await loginRes.json()
    const token = loginData.data?.token
    
    if (!token) {
      throw new Error('No token returned from AC Infinity')
    }
    
    // Step 2: Get devices
    const devicesRes = await fetch(`${API_BASE}/api/user/devInfoListAll`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
    
    const devicesData = await devicesRes.json()
    const devices = devicesData.data || []
    
    if (devices.length === 0) {
      throw new Error('No AC Infinity devices found for this account')
    }
    
    // Use first device (enhance later for multi-device)
    const device = devices[0]
    const controllerId = device.devId
    
    // Store token
    this.tokens.set(controllerId, token)
    
    // Get device settings/capabilities
    const settingsRes = await fetch(`${API_BASE}/api/dev/getDevSetting`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ devId: controllerId })
    })
    
    const settings = await settingsRes.json()
    const ports = settings.data?.portData || []
    
    return {
      controllerId,
      brand: 'ac_infinity',
      model: device.devName || 'Controller 69',
      firmware: device.firmwareVersion,
      capabilities: {
        sensors: ports
          .filter((p: any) => p.devType === 10)  // Sensor probes
          .map((p: any) => ({
            port: p.portId,
            type: this.mapSensorType(p.sensorType),
            unit: this.mapSensorUnit(p.sensorType)
          })),
        devices: ports
          .filter((p: any) => p.devType !== 10)  // Controllable outputs
          .map((p: any) => ({
            port: p.portId,
            type: this.mapDeviceType(p.devType),
            supportsDimming: p.supportDim === 1,
            minLevel: 0,
            maxLevel: 10  // AC Infinity uses 0-10 scale
          }))
      }
    }
  }
  
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const token = this.tokens.get(controllerId)
    if (!token) throw new Error('Controller not connected')
    
    const res = await fetch(`${API_BASE}/api/dev/getDevSetting`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ devId: controllerId })
    })
    
    const data = await res.json()
    const ports = data.data?.portData || []
    
    return ports
      .filter((p: any) => p.devType === 10 && p.value !== null)
      .map((p: any) => ({
        port: p.portId,
        type: this.mapSensorType(p.sensorType),
        value: this.convertSensorValue(p.value, p.sensorType),
        unit: this.mapSensorUnit(p.sensorType),
        timestamp: new Date()
      }))
  }
  
  async controlDevice(
    controllerId: string, 
    port: number, 
    command: DeviceCommand
  ): Promise<CommandResult> {
    const token = this.tokens.get(controllerId)
    if (!token) throw new Error('Controller not connected')
    
    // Map 0-100 to AC Infinity's 0-10 scale
    let power: number
    if (command.type === 'set_level') {
      power = Math.round((command.value || 0) / 10)
    } else if (command.type === 'turn_on') {
      power = 10
    } else {
      power = 0
    }
    
    const res = await fetch(`${API_BASE}/api/dev/updateDevPort`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        devId: controllerId,
        portId: port,
        power
      })
    })
    
    return {
      success: res.ok,
      error: res.ok ? undefined : `Failed: ${res.status}`
    }
  }
  
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const token = this.tokens.get(controllerId)
    if (!token) {
      return { isOnline: false, lastSeen: new Date() }
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/dev/getDevSetting`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ devId: controllerId })
      })
      
      return {
        isOnline: res.ok,
        lastSeen: new Date()
      }
    } catch {
      return { isOnline: false, lastSeen: new Date() }
    }
  }
  
  async disconnect(controllerId: string): Promise<void> {
    this.tokens.delete(controllerId)
  }
  
  // Mapping helpers
  private mapSensorType(acType: number): string {
    const map: Record<number, string> = { 1: 'temperature', 2: 'humidity', 3: 'vpd' }
    return map[acType] || 'unknown'
  }
  
  private mapSensorUnit(acType: number): string {
    const map: Record<number, string> = { 1: 'F', 2: '%', 3: 'kPa' }
    return map[acType] || ''
  }
  
  private mapDeviceType(acType: number): string {
    const map: Record<number, string> = { 1: 'fan', 2: 'light', 3: 'outlet' }
    return map[acType] || 'outlet'
  }
  
  private convertSensorValue(value: number, acType: number): number {
    // VPD is sent as kPa * 10 (e.g., 9 = 0.9 kPa)
    return acType === 3 ? value / 10 : value
  }
}
```

### Adapter Factory

**File:** `apps/automation-engine/lib/adapters/index.ts`

```typescript
import { ACInfinityAdapter } from './ACInfinityAdapter'
import type { ControllerAdapter } from './types'

export function getAdapter(brand: string): ControllerAdapter {
  switch (brand) {
    case 'ac_infinity':
      return new ACInfinityAdapter()
    case 'inkbird':
      throw new Error('Inkbird adapter not yet implemented')
    case 'generic_wifi':
      throw new Error('Generic WiFi adapter not yet implemented')
    default:
      throw new Error(`Unknown controller brand: ${brand}`)
  }
}

export * from './types'
export { ACInfinityAdapter }
```

---

## 🌐 API Routes (Already Built)

### AI Analysis Endpoint

**Location:** `apps/web/src/app/api/analyze/route.ts`

**Usage:**
```typescript
// POST /api/analyze
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Analyze VPD readings for optimal plant growth',
    dataType: 'vpd',
    timeRange: { start: '2026-01-19', end: '2026-01-20' }  // optional
  })
})

const { insight, analysis, recommendations } = await response.json()
```

### Adding Controller API Route

Create: `apps/web/src/app/api/controllers/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAdapter } from '@/lib/adapters'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/controllers - List user's controllers
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')  // From auth middleware
  
  const { data, error } = await supabase
    .from('controllers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ controllers: data })
}

// POST /api/controllers - Add a new controller
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const { brand, name, credentials } = await request.json()
  
  try {
    // Test connection first
    const adapter = getAdapter(brand)
    const metadata = await adapter.connect(credentials)
    
    // Store in database
    const { data, error } = await supabase
      .from('controllers')
      .insert({
        user_id: userId,
        brand,
        name,
        controller_id: metadata.controllerId,
        credentials: credentials,  // TODO: Encrypt
        capabilities: metadata.capabilities,
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ controller: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Connection failed' },
      { status: 400 }
    )
  }
}
```

---

## 🔐 Supabase Auth Integration

### Setup Auth in Layout

Update `apps/web/src/app/layout.tsx`:

```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  return (
    <html lang="en">
      <body>
        <AuthProvider session={session}>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
```

### Update Login Page to Use Supabase

```typescript
// In apps/web/src/app/login/page.tsx

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

async function onSubmit(data: LoginFormData) {
  const supabase = createClientComponentClient()
  
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  })
  
  if (error) {
    toast({ title: 'Error', description: error.message, variant: 'destructive' })
    return
  }
  
  router.push('/dashboard')
}
```

---

## ⏰ Workflow Executor (Cron)

### Option 1: Vercel Cron

Add to `apps/web/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/workflows",
      "schedule": "* * * * *"
    }
  ]
}
```

Create `apps/web/src/app/api/cron/workflows/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdapter } from '@/lib/adapters'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Verify cron secret (Vercel adds this)
  // if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }
  
  // Fetch active workflows
  const { data: workflows } = await supabase
    .from('workflows')
    .select(`
      *,
      rooms (
        controllers (*)
      )
    `)
    .eq('is_active', true)
  
  let executed = 0
  
  for (const workflow of workflows || []) {
    try {
      await executeWorkflow(workflow)
      executed++
    } catch (err) {
      console.error(`Workflow ${workflow.id} failed:`, err)
    }
  }
  
  return NextResponse.json({ success: true, executed })
}

async function executeWorkflow(workflow: any) {
  // Parse nodes/edges
  const nodes = workflow.nodes || []
  const edges = workflow.edges || []
  
  // Find trigger node
  const trigger = nodes.find((n: any) => n.type === 'trigger')
  if (!trigger) return
  
  // Execute actions in order
  for (const node of nodes.filter((n: any) => n.type === 'action')) {
    const controller = workflow.rooms?.controllers?.[0]
    if (!controller) continue
    
    const adapter = getAdapter(controller.brand)
    await adapter.connect(controller.credentials)
    
    if (node.data.variant === 'set_fan') {
      await adapter.controlDevice(controller.controller_id, node.data.port, {
        type: 'set_level',
        value: node.data.value
      })
    }
    
    await adapter.disconnect(controller.controller_id)
  }
  
  // Update last_run
  await supabase
    .from('workflows')
    .update({ 
      last_run: new Date().toISOString(),
      run_count: workflow.run_count + 1
    })
    .eq('id', workflow.id)
}
```

### Option 2: Supabase Edge Functions + pg_cron

```sql
-- Enable pg_cron in Supabase Dashboard > Database > Extensions
SELECT cron.schedule(
  'execute-workflows',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://vhlnnfmuhttjpwyobklu.supabase.co/functions/v1/workflow-executor',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('supabase.anon_key'))
  )
  $$
);
```

---

## 🚀 Deployment Checklist

### 1. Supabase Setup
- [ ] Run AI tables migration (`20260120_ai_analysis_tables.sql`)
- [ ] Run core tables migration (`20260121_core_tables.sql`)
- [ ] Enable Realtime for tables
- [ ] Configure Auth providers (email/password)

### 2. Vercel Setup
- [ ] Deploy from GitHub (already done!)
- [ ] Add environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GROK_API_KEY`

### 3. Test Endpoints
```bash
# Test AI analysis
curl -X POST https://enviroflow.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "Test VPD analysis", "dataType": "vpd"}'

# Test controllers (after auth setup)
curl https://enviroflow.app/api/controllers \
  -H "Authorization: Bearer USER_TOKEN"
```

### 4. Connect AC Infinity
1. User enters AC Infinity email/password in Controllers page
2. Backend calls ACInfinityAdapter.connect()
3. Stores controller with capabilities
4. UI shows real-time sensor data

---

## 📝 Quick Reference

### Supabase Dashboard Links
- **SQL Editor:** https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/sql
- **Table Editor:** https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/editor
- **Auth:** https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/auth
- **API Settings:** https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/settings/api
- **Logs:** https://supabase.com/dashboard/project/vhlnnfmuhttjpwyobklu/logs

### Local Development
```bash
# Start web app
cd apps/web
npm run dev

# Test API locally
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "Test", "dataType": "vpd"}'
```

### Git Workflow
```bash
cd /workspaces/enviroflow.app
git add -A
git commit -m "feat: add controller adapters"
git push origin main
# Vercel auto-deploys on push
```

---

## 🎯 Priority Tasks

1. **HIGH:** Run core tables migration
2. **HIGH:** Implement Supabase Auth in frontend
3. **HIGH:** Create controller API routes
4. **MEDIUM:** Set up Vercel cron for workflows
5. **MEDIUM:** Add Inkbird adapter (when API docs available)
6. **LOW:** Add encryption for stored credentials

---

**Questions?** Check the Supabase docs or open an issue on GitHub.
