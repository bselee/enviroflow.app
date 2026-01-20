# EnviroFlow Backend Development - Claude Code Handoff

**Project:** EnviroFlow Automation Engine  
**Domain:** enviroflow.app  
**Tech Stack:** Supabase (PostgreSQL + Edge Functions) + TypeScript  
**Target:** Production-ready backend API in 1 week  

---

## 🎯 What You're Building

The **backend brain** that:
1. Stores controller data, workflows, and sensor readings
2. Connects to different controller brands (AC Infinity, Inkbird, Generic WiFi)
3. Executes automated workflows every 60 seconds
4. Handles sunrise/sunset lighting automation
5. Provides REST API for frontend

**NOT building (that's Lovable's job):**
❌ UI components  
❌ React Flow canvas  
❌ Styling/design  

---

## 📁 File Structure (Your Scope)

```
enviroflow/
├── apps/
│   └── automation-engine/
│       ├── supabase/
│       │   ├── functions/
│       │   │   ├── workflow-executor/
│       │   │   │   └── index.ts           # Main automation engine
│       │   │   ├── sunrise-sunset/
│       │   │   │   └── index.ts           # Lighting automation
│       │   │   └── health-check/
│       │   │       └── index.ts           # Controller status checker
│       │   ├── migrations/
│       │   │   └── 20260120000000_initial_schema.sql
│       │   └── config.toml
│       ├── lib/
│       │   ├── adapters/
│       │   │   ├── ControllerAdapter.ts   # Interface
│       │   │   ├── ACInfinityAdapter.ts
│       │   │   ├── InkbirdAdapter.ts
│       │   │   └── GenericWiFiAdapter.ts
│       │   ├── types/
│       │   │   ├── controller.ts
│       │   │   ├── workflow.ts
│       │   │   └── sensor.ts
│       │   └── utils/
│       │       ├── encryption.ts          # Credential encryption
│       │       └── logger.ts
│       └── package.json
│
└── README.md
```

---

## 🗄️ Database Schema (PostgreSQL)

### Step 1: Create Migration File

**File:** `supabase/migrations/20260120000000_initial_schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONTROLLERS TABLE
-- ============================================
CREATE TABLE controllers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,                    -- 'ac_infinity', 'inkbird', 'generic_wifi'
  controller_id TEXT NOT NULL,            -- Brand-specific device ID
  name TEXT NOT NULL,
  credentials JSONB NOT NULL,             -- Encrypted credentials
  capabilities JSONB,                     -- Ports, sensors, features
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, controller_id)
);

-- RLS Policies
ALTER TABLE controllers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own controllers"
  ON controllers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own controllers"
  ON controllers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own controllers"
  ON controllers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own controllers"
  ON controllers FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_controllers_user_id ON controllers(user_id);
CREATE INDEX idx_controllers_online ON controllers(is_online);

-- ============================================
-- WORKFLOWS TABLE
-- ============================================
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL,                   -- React Flow nodes
  edges JSONB NOT NULL,                   -- React Flow edges
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflows"
  ON workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflows"
  ON workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_workflows_user_id ON workflows(user_id);
CREATE INDEX idx_workflows_active ON workflows(is_active);

-- ============================================
-- WORKFLOW ROOM MAPPINGS
-- ============================================
CREATE TABLE workflow_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workflow_id, controller_id)
);

-- RLS Policies
ALTER TABLE workflow_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflow_rooms"
  ON workflow_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_rooms.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own workflow_rooms"
  ON workflow_rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = workflow_rooms.workflow_id
      AND w.user_id = auth.uid()
    )
  );

-- ============================================
-- ACTIVITY LOGS TABLE (90-day retention)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                   -- 'workflow_executed', 'device_controlled', etc.
  result TEXT NOT NULL,                   -- 'success', 'failed', 'skipped'
  metadata JSONB,                         -- Additional context
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity_logs"
  ON activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX idx_activity_logs_workflow_id ON activity_logs(workflow_id);

-- Auto-delete logs older than 90 days (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SENSOR READINGS TABLE (Optional - for caching)
-- ============================================
CREATE TABLE sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL,              -- 'temperature', 'humidity', 'vpd', etc.
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,                     -- 'F', '%', 'kPa', etc.
  port INTEGER,                           -- Physical port number (if applicable)
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX idx_sensor_readings_controller_timestamp 
  ON sensor_readings(controller_id, timestamp DESC);

-- Partitioning by month (for performance with large datasets)
-- CREATE TABLE sensor_readings_2026_01 PARTITION OF sensor_readings
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ============================================
-- DIMMER CONFIGS TABLE (Sunrise/Sunset)
-- ============================================
CREATE TABLE dimmer_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  dimmer_port INTEGER NOT NULL,
  sunrise_time TIME NOT NULL,             -- e.g., '06:00:00'
  sunrise_duration INTEGER DEFAULT 30,    -- minutes
  sunrise_curve TEXT DEFAULT 'sigmoid',   -- 'linear', 'sigmoid', 'exponential'
  sunset_time TIME NOT NULL,              -- e.g., '20:00:00'
  sunset_duration INTEGER DEFAULT 30,
  sunset_curve TEXT DEFAULT 'sigmoid',
  target_intensity INTEGER DEFAULT 100,   -- 0-100%
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE dimmer_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dimmer_configs"
  ON dimmer_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = dimmer_configs.workflow_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own dimmer_configs"
  ON dimmer_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workflows w
      WHERE w.id = dimmer_configs.workflow_id
      AND w.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_controllers_updated_at
  BEFORE UPDATE ON controllers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL SEED DATA (Optional - for testing)
-- ============================================

-- You can add sample data here for development
-- INSERT INTO ... (add after user signup in dev)
```

---

## 🔌 Controller Adapters (TypeScript)

### Interface Definition

**File:** `lib/adapters/ControllerAdapter.ts`

```typescript
export interface ControllerAdapter {
  /**
   * Connect to controller using credentials
   * Returns controller metadata (ID, capabilities)
   */
  connect(credentials: ControllerCredentials): Promise<ControllerMetadata>
  
  /**
   * Read all sensor data from controller
   * Returns array of sensor readings
   */
  readSensors(controllerId: string): Promise<SensorReading[]>
  
  /**
   * Control a device (fan, light, etc.)
   */
  controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult>
  
  /**
   * Get current controller status (online/offline)
   */
  getStatus(controllerId: string): Promise<ControllerStatus>
  
  /**
   * Disconnect and cleanup
   */
  disconnect(controllerId: string): Promise<void>
}

export interface ControllerCredentials {
  email?: string
  password?: string
  apiKey?: string
  ipAddress?: string
  [key: string]: any  // Adapter-specific fields
}

export interface ControllerMetadata {
  controllerId: string
  brand: string
  model?: string
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
  type: 'fan' | 'light' | 'heater' | 'humidifier' | 'dehumidifier'
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
  value?: number  // 0-100 for dimmers, on/off for relays
}

export interface CommandResult {
  success: boolean
  error?: string
  currentState?: any
}

export interface ControllerStatus {
  isOnline: boolean
  lastSeen: Date
  firmware?: string
}
```

---

### AC Infinity Adapter

**File:** `lib/adapters/ACInfinityAdapter.ts`

```typescript
import { ControllerAdapter, ControllerCredentials, SensorReading, DeviceCommand } from './ControllerAdapter'

export class ACInfinityAdapter implements ControllerAdapter {
  private apiBase = 'https://www.acinfinityserver.com'
  private tokens = new Map<string, string>()  // controllerId -> token
  
  async connect(credentials: ControllerCredentials) {
    const { email, password } = credentials
    
    // Login to AC Infinity API
    const response = await fetch(`${this.apiBase}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        appEmail: email,
        appPasswordl: password  // Note: typo in API (appPasswordl)
      })
    })
    
    if (!response.ok) {
      throw new Error('AC Infinity login failed')
    }
    
    const data = await response.json()
    const token = data.token
    
    // Fetch device list
    const devicesResponse = await fetch(`${this.apiBase}/api/user/devInfoListAll`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token': token
      }
    })
    
    const devicesData = await devicesResponse.json()
    const devices = devicesData.data || []
    
    if (devices.length === 0) {
      throw new Error('No AC Infinity devices found')
    }
    
    // Use first device (can be enhanced to select specific device)
    const device = devices[0]
    const controllerId = device.devId
    
    this.tokens.set(controllerId, token)
    
    // Get device capabilities
    const settingsResponse = await fetch(`${this.apiBase}/api/dev/getDevSetting`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token': token
      },
      body: JSON.stringify({ devId: controllerId })
    })
    
    const settings = await settingsResponse.json()
    const portData = settings.data?.portData || []
    
    return {
      controllerId,
      brand: 'ac_infinity',
      model: device.devType,
      capabilities: {
        sensors: portData
          .filter((p: any) => p.devType === 10)  // Type 10 = UIS sensor
          .map((p: any) => ({
            port: p.port,
            type: this.mapSensorType(p.sensorType),
            unit: this.mapSensorUnit(p.sensorType)
          })),
        devices: portData
          .filter((p: any) => [11, 12].includes(p.devType))  // 11=UIS, 12=fan
          .map((p: any) => ({
            port: p.port,
            type: p.devType === 11 ? 'light' : 'fan',
            supportsDimming: true,
            minLevel: 0,
            maxLevel: 10
          }))
      }
    }
  }
  
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const token = this.tokens.get(controllerId)
    if (!token) {
      throw new Error('Controller not connected')
    }
    
    const response = await fetch(`${this.apiBase}/api/dev/getDevSetting`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token': token
      },
      body: JSON.stringify({ devId: controllerId })
    })
    
    const data = await response.json()
    const portData = data.data?.portData || []
    
    return portData
      .filter((p: any) => p.devType === 10 && p.value !== null)
      .map((p: any) => ({
        port: p.port,
        type: this.mapSensorType(p.sensorType),
        value: this.convertSensorValue(p.value, p.sensorType),
        unit: this.mapSensorUnit(p.sensorType),
        timestamp: new Date()
      }))
  }
  
  async controlDevice(controllerId: string, port: number, command: DeviceCommand) {
    const token = this.tokens.get(controllerId)
    if (!token) {
      throw new Error('Controller not connected')
    }
    
    let power: number
    if (command.type === 'set_level') {
      // Map 0-100 to AC Infinity's 0-10 scale
      power = Math.round((command.value || 0) / 10)
    } else if (command.type === 'turn_on') {
      power = 10
    } else {
      power = 0
    }
    
    const response = await fetch(`${this.apiBase}/api/dev/updateDevPort`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'token': token
      },
      body: JSON.stringify({
        devId: controllerId,
        port,
        power
      })
    })
    
    return {
      success: response.ok,
      error: response.ok ? undefined : 'Failed to control device'
    }
  }
  
  async getStatus(controllerId: string) {
    const token = this.tokens.get(controllerId)
    if (!token) {
      return { isOnline: false, lastSeen: new Date() }
    }
    
    try {
      const response = await fetch(`${this.apiBase}/api/dev/getDevSetting`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'token': token
        },
        body: JSON.stringify({ devId: controllerId })
      })
      
      return {
        isOnline: response.ok,
        lastSeen: new Date()
      }
    } catch {
      return { isOnline: false, lastSeen: new Date() }
    }
  }
  
  async disconnect(controllerId: string) {
    this.tokens.delete(controllerId)
  }
  
  // Helper methods
  private mapSensorType(acType: number): string {
    const typeMap: Record<number, string> = {
      1: 'temperature',
      2: 'humidity',
      3: 'vpd'
    }
    return typeMap[acType] || 'unknown'
  }
  
  private mapSensorUnit(acType: number): string {
    const unitMap: Record<number, string> = {
      1: 'F',
      2: '%',
      3: 'kPa'
    }
    return unitMap[acType] || ''
  }
  
  private convertSensorValue(value: number, acType: number): number {
    // AC Infinity sends temp as integer (72 = 72°F)
    // Humidity as percentage (55 = 55%)
    // VPD as kPa * 10 (9 = 0.9 kPa)
    if (acType === 3) {
      return value / 10
    }
    return value
  }
}
```

---

### Inkbird Adapter (Stub)

**File:** `lib/adapters/InkbirdAdapter.ts`

```typescript
import { ControllerAdapter } from './ControllerAdapter'

export class InkbirdAdapter implements ControllerAdapter {
  // TODO: Implement Inkbird-specific API calls
  // Inkbird has limited official API, may need reverse engineering
  
  async connect(credentials: any) {
    throw new Error('Inkbird adapter not yet implemented')
  }
  
  async readSensors(controllerId: string) {
    throw new Error('Inkbird adapter not yet implemented')
  }
  
  async controlDevice(controllerId: string, port: number, command: any) {
    throw new Error('Inkbird adapter not yet implemented')
  }
  
  async getStatus(controllerId: string) {
    throw new Error('Inkbird adapter not yet implemented')
  }
  
  async disconnect(controllerId: string) {
    // No-op
  }
}
```

---

### Generic WiFi Adapter (Template)

**File:** `lib/adapters/GenericWiFiAdapter.ts`

```typescript
import { ControllerAdapter } from './ControllerAdapter'

export class GenericWiFiAdapter implements ControllerAdapter {
  // Generic REST API pattern
  // Users provide: apiBase URL, auth method, endpoint paths
  
  private config = new Map<string, any>()
  
  async connect(credentials: any) {
    // Store user-provided config
    this.config.set(credentials.controllerId, {
      apiBase: credentials.apiBase,
      apiKey: credentials.apiKey,
      endpoints: credentials.endpoints  // { sensors: '/api/sensors', control: '/api/control' }
    })
    
    // Test connection
    const config = this.config.get(credentials.controllerId)
    const response = await fetch(`${config.apiBase}${config.endpoints.sensors}`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    })
    
    if (!response.ok) {
      throw new Error('Generic WiFi connection failed')
    }
    
    return {
      controllerId: credentials.controllerId,
      brand: 'generic_wifi',
      capabilities: {
        sensors: [],  // Parse from API response
        devices: []
      }
    }
  }
  
  async readSensors(controllerId: string) {
    const config = this.config.get(controllerId)
    const response = await fetch(`${config.apiBase}${config.endpoints.sensors}`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    })
    
    const data = await response.json()
    // Map generic response to SensorReading[]
    return []
  }
  
  async controlDevice(controllerId: string, port: number, command: any) {
    const config = this.config.get(controllerId)
    const response = await fetch(`${config.apiBase}${config.endpoints.control}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ port, command })
    })
    
    return { success: response.ok }
  }
  
  async getStatus(controllerId: string) {
    return { isOnline: true, lastSeen: new Date() }
  }
  
  async disconnect(controllerId: string) {
    this.config.delete(controllerId)
  }
}
```

---

## ⚙️ Automation Engine (Edge Function)

### Workflow Executor (Main Cron Job)

**File:** `supabase/functions/workflow-executor/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ACInfinityAdapter } from '../../lib/adapters/ACInfinityAdapter.ts'
import { InkbirdAdapter } from '../../lib/adapters/InkbirdAdapter.ts'
import { GenericWiFiAdapter } from '../../lib/adapters/GenericWiFiAdapter.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  try {
    console.log('[Workflow Executor] Starting execution cycle')
    
    // 1. Fetch all active workflows
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select(`
        *,
        workflow_rooms (
          controller_id,
          controllers (*)
        )
      `)
      .eq('is_active', true)
    
    if (error) throw error
    
    console.log(`[Workflow Executor] Found ${workflows?.length || 0} active workflows`)
    
    // 2. Execute each workflow
    for (const workflow of workflows || []) {
      await executeWorkflow(workflow)
    }
    
    return new Response(
      JSON.stringify({ success: true, workflowsExecuted: workflows?.length || 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Workflow Executor] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function executeWorkflow(workflow: any) {
  console.log(`[Workflow ${workflow.id}] Executing: ${workflow.name}`)
  
  // Get workflow nodes and edges
  const nodes = workflow.nodes || []
  const edges = workflow.edges || []
  
  // Find trigger node
  const triggerNode = nodes.find((n: any) => n.type === 'trigger')
  if (!triggerNode) {
    console.log(`[Workflow ${workflow.id}] No trigger node found, skipping`)
    return
  }
  
  // Check if trigger condition is met
  const shouldExecute = await evaluateTrigger(triggerNode, workflow)
  if (!shouldExecute) {
    console.log(`[Workflow ${workflow.id}] Trigger condition not met, skipping`)
    return
  }
  
  // Execute workflow graph
  const rooms = workflow.workflow_rooms || []
  for (const room of rooms) {
    const controller = room.controllers
    if (!controller || !controller.is_online) {
      console.log(`[Workflow ${workflow.id}] Controller ${controller?.id} offline, skipping`)
      continue
    }
    
    // Walk node graph starting from trigger
    await walkNodes(triggerNode, nodes, edges, controller, workflow)
    
    // Log successful execution
    await supabase.from('activity_logs').insert({
      user_id: workflow.user_id,
      workflow_id: workflow.id,
      controller_id: controller.id,
      action: 'workflow_executed',
      result: 'success',
      metadata: { trigger: triggerNode.data.label }
    })
  }
}

async function evaluateTrigger(triggerNode: any, workflow: any): Promise<boolean> {
  // For timer triggers, always return true (cron handles timing)
  if (triggerNode.data.variant === 'timer') {
    return true
  }
  
  // For sensor triggers, check threshold
  if (triggerNode.data.variant === 'sensor') {
    // TODO: Read sensor value and compare to threshold
    return true
  }
  
  return false
}

async function walkNodes(
  currentNode: any,
  allNodes: any[],
  edges: any[],
  controller: any,
  workflow: any
) {
  // Find next node(s) connected to current node
  const outgoingEdges = edges.filter(e => e.source === currentNode.id)
  
  for (const edge of outgoingEdges) {
    const nextNode = allNodes.find(n => n.id === edge.target)
    if (!nextNode) continue
    
    // Execute node based on type
    if (nextNode.type === 'action') {
      await executeAction(nextNode, controller, workflow)
    } else if (nextNode.type === 'condition') {
      const conditionMet = await evaluateCondition(nextNode, controller)
      if (conditionMet) {
        // Continue to next node
        await walkNodes(nextNode, allNodes, edges, controller, workflow)
      }
    } else {
      // Continue walking
      await walkNodes(nextNode, allNodes, edges, controller, workflow)
    }
  }
}

async function executeAction(actionNode: any, controller: any, workflow: any) {
  console.log(`[Action] Executing: ${actionNode.data.label}`)
  
  // Get adapter for controller brand
  const adapter = getAdapter(controller.brand)
  
  // Connect to controller
  await adapter.connect(controller.credentials)
  
  // Execute action
  if (actionNode.data.variant === 'set_fan') {
    const port = actionNode.data.port
    const level = actionNode.data.level || 50
    
    await adapter.controlDevice(controller.controller_id, port, {
      type: 'set_level',
      value: level
    })
    
    console.log(`[Action] Set fan port ${port} to ${level}%`)
  } else if (actionNode.data.variant === 'set_light') {
    const port = actionNode.data.port
    const level = actionNode.data.level || 100
    
    await adapter.controlDevice(controller.controller_id, port, {
      type: 'set_level',
      value: level
    })
    
    console.log(`[Action] Set light port ${port} to ${level}%`)
  }
  
  await adapter.disconnect(controller.controller_id)
}

async function evaluateCondition(conditionNode: any, controller: any): Promise<boolean> {
  // Get adapter
  const adapter = getAdapter(controller.brand)
  await adapter.connect(controller.credentials)
  
  // Read sensors
  const sensors = await adapter.readSensors(controller.controller_id)
  
  // Evaluate condition (e.g., VPD > 1.2)
  const sensorType = conditionNode.data.sensorType
  const operator = conditionNode.data.operator  // '>', '<', '==', etc.
  const threshold = conditionNode.data.threshold
  
  const reading = sensors.find(s => s.type === sensorType)
  if (!reading) return false
  
  switch (operator) {
    case '>':
      return reading.value > threshold
    case '<':
      return reading.value < threshold
    case '==':
      return reading.value === threshold
    default:
      return false
  }
}

function getAdapter(brand: string) {
  switch (brand) {
    case 'ac_infinity':
      return new ACInfinityAdapter()
    case 'inkbird':
      return new InkbirdAdapter()
    case 'generic_wifi':
      return new GenericWiFiAdapter()
    default:
      throw new Error(`Unknown brand: ${brand}`)
  }
}
```

---

### Sunrise/Sunset Edge Function

**File:** `supabase/functions/sunrise-sunset/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  try {
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 8)  // HH:MM:SS
    
    // Fetch active dimmer configs
    const { data: configs } = await supabase
      .from('dimmer_configs')
      .select(`
        *,
        workflows!inner(*),
        controllers!inner(*)
      `)
      .eq('is_active', true)
      .eq('workflows.is_active', true)
    
    for (const config of configs || []) {
      // Check if we're in sunrise window
      const sunriseEnd = addMinutes(config.sunrise_time, config.sunrise_duration)
      if (isTimeInRange(currentTime, config.sunrise_time, sunriseEnd)) {
        await executeSunrise(config, now)
      }
      
      // Check if we're in sunset window
      const sunsetEnd = addMinutes(config.sunset_time, config.sunset_duration)
      if (isTimeInRange(currentTime, config.sunset_time, sunsetEnd)) {
        await executeSunset(config, now)
      }
    }
    
    return new Response(JSON.stringify({ success: true }))
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

async function executeSunrise(config: any, now: Date) {
  const brightness = calculateBrightness('sunrise', config, now)
  
  // Get adapter and control dimmer
  const adapter = getAdapter(config.controllers.brand)
  await adapter.connect(config.controllers.credentials)
  
  await adapter.controlDevice(
    config.controllers.controller_id,
    config.dimmer_port,
    { type: 'set_level', value: brightness }
  )
  
  console.log(`[Sunrise] Set brightness to ${brightness}% (${config.controllers.name})`)
}

async function executeSunset(config: any, now: Date) {
  const brightness = calculateBrightness('sunset', config, now)
  
  const adapter = getAdapter(config.controllers.brand)
  await adapter.connect(config.controllers.credentials)
  
  await adapter.controlDevice(
    config.controllers.controller_id,
    config.dimmer_port,
    { type: 'set_level', value: brightness }
  )
  
  console.log(`[Sunset] Set brightness to ${brightness}% (${config.controllers.name})`)
}

function calculateBrightness(
  type: 'sunrise' | 'sunset',
  config: any,
  now: Date
): number {
  const startTime = type === 'sunrise' ? config.sunrise_time : config.sunset_time
  const duration = type === 'sunrise' ? config.sunrise_duration : config.sunset_duration
  const curve = type === 'sunrise' ? config.sunrise_curve : config.sunset_curve
  
  // Calculate elapsed time in minutes
  const start = parseTime(startTime)
  const current = now.getHours() * 60 + now.getMinutes()
  const elapsed = current - start
  
  // Calculate progress (0.0 to 1.0)
  const progress = Math.min(elapsed / duration, 1.0)
  
  // Apply curve
  let adjustedProgress: number
  switch (curve) {
    case 'linear':
      adjustedProgress = progress
      break
    case 'sigmoid':
      // S-curve
      adjustedProgress = 1 / (1 + Math.exp(-10 * (progress - 0.5)))
      break
    case 'exponential':
      adjustedProgress = Math.pow(progress, 0.5)
      break
    default:
      adjustedProgress = progress
  }
  
  // Calculate brightness
  if (type === 'sunrise') {
    return Math.round(adjustedProgress * config.target_intensity)
  } else {
    return Math.round((1 - adjustedProgress) * config.target_intensity)
  }
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function isTimeInRange(current: string, start: string, end: string): boolean {
  return current >= start && current <= end
}

function addMinutes(time: string, minutes: number): string {
  const [h, m, s] = time.split(':').map(Number)
  const totalMinutes = h * 60 + m + minutes
  const newH = Math.floor(totalMinutes / 60) % 24
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getAdapter(brand: string) {
  // Same as workflow-executor
}
```

---

## 🚀 Deployment

### Step 1: Set Up Supabase Project

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Initialize project
cd apps/automation-engine
supabase init

# Link to Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 2: Run Migrations

```bash
# Apply database schema
supabase db push
```

### Step 3: Deploy Edge Functions

```bash
# Deploy workflow executor
supabase functions deploy workflow-executor

# Deploy sunrise/sunset
supabase functions deploy sunrise-sunset

# Set environment variables
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

### Step 4: Set Up Cron Jobs

In Supabase Dashboard → Database → Cron Jobs:

**Workflow Executor** (every 60 seconds):
```sql
SELECT cron.schedule(
  'workflow-executor',
  '*/1 * * * *',  -- Every 1 minute
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/workflow-executor',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )
  $$
);
```

**Sunrise/Sunset** (every 1 minute during active hours):
```sql
SELECT cron.schedule(
  'sunrise-sunset',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sunrise-sunset',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )
  $$
);
```

---

## 📋 Testing

### Test Adapters

```typescript
// test-adapter.ts
import { ACInfinityAdapter } from './lib/adapters/ACInfinityAdapter.ts'

const adapter = new ACInfinityAdapter()

const metadata = await adapter.connect({
  email: 'test@example.com',
  password: 'password123'
})

console.log('Connected:', metadata)

const sensors = await adapter.readSensors(metadata.controllerId)
console.log('Sensors:', sensors)

await adapter.controlDevice(metadata.controllerId, 1, {
  type: 'set_level',
  value: 50
})

console.log('Fan set to 50%')
```

### Test Edge Functions Locally

```bash
# Start Supabase locally
supabase start

# Invoke function
supabase functions serve workflow-executor

# Test via curl
curl -X POST http://localhost:54321/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🎯 Deliverables Checklist

- [ ] Supabase project created
- [ ] Database schema deployed (migrations)
- [ ] Row Level Security policies configured
- [ ] AC Infinity adapter implemented
- [ ] Inkbird adapter stubbed (can be finished post-MVP)
- [ ] Generic WiFi adapter stubbed
- [ ] Workflow executor Edge Function deployed
- [ ] Sunrise/sunset Edge Function deployed
- [ ] Cron jobs configured (60s execution)
- [ ] Environment variables set
- [ ] Local testing completed
- [ ] API documentation for frontend team

---

## 📞 Handoff to Frontend Team

**Provide to Lovable:**
1. Supabase project URL
2. Anon key
3. Database table schemas (from migration file)
4. Example API responses for each table

**Example Controller Object:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "user-uuid",
  "brand": "ac_infinity",
  "controller_id": "dev-12345",
  "name": "Grow Room 1",
  "credentials": { "encrypted": true },
  "is_online": true,
  "last_seen": "2026-01-20T12:00:00Z"
}
```

---

## 🏁 Success Criteria

**Backend is ready when:**
1. ✅ Database schema deployed
2. ✅ At least 1 controller adapter working (AC Infinity)
3. ✅ Can add controller via API (POST to Supabase)
4. ✅ Can read sensor data via API
5. ✅ Can create workflow via API
6. ✅ Workflow executor runs every 60s (test with simple workflow)
7. ✅ Sunrise/sunset function works (test with 5-min ramp)
8. ✅ Activity logs populated
9. ✅ Frontend can authenticate and query data

---

**Timeline:** 1 week for backend MVP  
**Output:** Production Supabase backend with working automation engine  
**Next Step:** Frontend team integrates with APIs  

Let's build the brain! 🧠
