# EnviroFlow Backend Integration Guide

## Overview

This guide provides complete instructions for connecting the EnviroFlow dashboard to real controller data. The dashboard is designed to work immediately with demo data, then seamlessly transition to real data when backend connections are established.

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Controllers    │────▶│  Backend API     │────▶│  Dashboard      │
│  (AC Infinity,  │     │  (Supabase +     │     │  (React App)    │
│  TrolMaster,    │     │  Edge Functions) │     │                 │
│  Pulse, etc.)   │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                        │
        │                       │                        │
        ▼                       ▼                        ▼
   Controller APIs         PostgreSQL              WebSocket/REST
   (polling/webhooks)      + Realtime              (real-time updates)
```

---

## 1. Database Schema (Supabase PostgreSQL)

### Create Tables

```sql
-- Controllers table
CREATE TABLE controllers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room_name TEXT NOT NULL,
  controller_type TEXT NOT NULL, -- 'ac_infinity', 'trolmaster', 'pulse', 'custom'
  api_key TEXT, -- Encrypted API key if needed
  api_endpoint TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sensor readings table (time-series data)
CREATE TABLE sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE,
  temperature DECIMAL(5,2), -- Fahrenheit
  humidity DECIMAL(5,2), -- Percentage
  vpd DECIMAL(4,3), -- kPa
  co2 INTEGER, -- ppm (nullable)
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for time-series queries
  CONSTRAINT sensor_readings_controller_time_idx 
    UNIQUE (controller_id, recorded_at)
);

-- Create index for efficient time-range queries
CREATE INDEX idx_sensor_readings_time ON sensor_readings (controller_id, recorded_at DESC);

-- User settings table
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  temperature_unit TEXT DEFAULT 'F',
  show_co2 BOOLEAN DEFAULT false,
  co2_sensor_available BOOLEAN DEFAULT false,
  refresh_interval INTEGER DEFAULT 5000,
  vpd_optimal_min DECIMAL(3,2) DEFAULT 0.8,
  vpd_optimal_max DECIMAL(3,2) DEFAULT 1.2,
  temp_optimal_min DECIMAL(5,2) DEFAULT 72,
  temp_optimal_max DECIMAL(5,2) DEFAULT 82,
  humidity_optimal_min DECIMAL(5,2) DEFAULT 50,
  humidity_optimal_max DECIMAL(5,2) DEFAULT 65,
  card_order JSONB, -- Array of controller IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE controllers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own controllers" ON controllers
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own controllers" ON controllers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own controllers" ON controllers
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "Users can delete own controllers" ON controllers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own readings" ON sensor_readings
  FOR SELECT USING (
    controller_id IN (SELECT id FROM controllers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
```

### Enable Realtime

```sql
-- Enable realtime for sensor readings
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE controllers;
```

---

## 2. Controller Integration APIs

### AC Infinity Controller 69

AC Infinity uses a cloud API. You'll need to reverse-engineer or use their unofficial API.

```typescript
// lib/controllers/ac-infinity.ts
interface ACInfinityConfig {
  email: string;
  password: string;
}

interface ACInfinityReading {
  temperature: number; // Celsius
  humidity: number;
  vpd: number;
}

export class ACInfinityController {
  private token: string | null = null;
  private baseUrl = 'https://api.acinfinity.com/api/v1';

  async authenticate(config: ACInfinityConfig): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.email,
        password: config.password,
      }),
    });
    
    if (!response.ok) throw new Error('AC Infinity authentication failed');
    const data = await response.json();
    this.token = data.token;
  }

  async getDevices(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return response.json();
  }

  async getReadings(deviceId: string): Promise<ACInfinityReading> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/readings`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const data = await response.json();
    
    // Convert Celsius to Fahrenheit
    const tempF = (data.temperature * 9/5) + 32;
    
    // Calculate VPD if not provided
    const vpd = this.calculateVPD(data.temperature, data.humidity);
    
    return {
      temperature: tempF,
      humidity: data.humidity,
      vpd,
    };
  }

  private calculateVPD(tempC: number, humidity: number): number {
    const svp = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    return svp * (1 - humidity / 100);
  }
}
```

### TrolMaster Hydro-X

TrolMaster has a local API accessible on your network.

```typescript
// lib/controllers/trolmaster.ts
interface TrolMasterConfig {
  ipAddress: string;
  port?: number;
}

export class TrolMasterController {
  private baseUrl: string;

  constructor(config: TrolMasterConfig) {
    this.baseUrl = `http://${config.ipAddress}:${config.port || 80}`;
  }

  async getReadings(): Promise<{
    temperature: number;
    humidity: number;
    co2: number;
    vpd: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/sensors`);
    const data = await response.json();
    
    // TrolMaster typically reports in Fahrenheit
    return {
      temperature: data.temp,
      humidity: data.humidity,
      co2: data.co2 || null,
      vpd: data.vpd || this.calculateVPD(data.temp, data.humidity),
    };
  }

  private calculateVPD(tempF: number, humidity: number): number {
    const tempC = (tempF - 32) * 5/9;
    const svp = 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    return svp * (1 - humidity / 100);
  }
}
```

### Pulse Pro

Pulse has a cloud API with OAuth.

```typescript
// lib/controllers/pulse.ts
export class PulseController {
  private accessToken: string;
  private baseUrl = 'https://api.pulsegrow.com/v1';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getDevices(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    return response.json();
  }

  async getReadings(deviceId: string): Promise<{
    temperature: number;
    humidity: number;
    vpd: number;
    co2?: number;
  }> {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/current`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    return response.json();
  }
}
```

---

## 3. Supabase Edge Functions

### Polling Function (runs on schedule)

```typescript
// supabase/functions/poll-controllers/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all active controllers
  const { data: controllers, error } = await supabase
    .from('controllers')
    .select('*')
    .eq('is_active', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];

  for (const controller of controllers) {
    try {
      let reading;

      switch (controller.controller_type) {
        case 'ac_infinity':
          reading = await pollACInfinity(controller);
          break;
        case 'trolmaster':
          reading = await pollTrolMaster(controller);
          break;
        case 'pulse':
          reading = await pollPulse(controller);
          break;
        default:
          continue;
      }

      // Insert reading into database
      const { error: insertError } = await supabase
        .from('sensor_readings')
        .insert({
          controller_id: controller.id,
          temperature: reading.temperature,
          humidity: reading.humidity,
          vpd: reading.vpd,
          co2: reading.co2 || null,
        });

      if (insertError) throw insertError;

      // Update last_seen_at
      await supabase
        .from('controllers')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', controller.id);

      results.push({ controller_id: controller.id, success: true });
    } catch (err) {
      results.push({ controller_id: controller.id, success: false, error: err.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// Controller-specific polling functions
async function pollACInfinity(controller: any) {
  // Implementation from above
}

async function pollTrolMaster(controller: any) {
  const response = await fetch(`http://${controller.api_endpoint}/api/sensors`);
  return response.json();
}

async function pollPulse(controller: any) {
  // Implementation from above
}
```

### Schedule the Function (pg_cron)

```sql
-- Run every minute
SELECT cron.schedule(
  'poll-controllers',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/poll-controllers',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

## 4. Frontend Integration

### Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Real-time Hook

```typescript
// hooks/useRealtimeSensors.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface SensorReading {
  id: string;
  controller_id: string;
  temperature: number;
  humidity: number;
  vpd: number;
  co2: number | null;
  recorded_at: string;
}

export function useRealtimeSensors(controllerIds: string[]) {
  const [readings, setReadings] = useState<Record<string, SensorReading[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    // Fetch initial historical data
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .in('controller_id', controllerIds)
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: true });

      if (data) {
        const grouped = data.reduce((acc, reading) => {
          if (!acc[reading.controller_id]) acc[reading.controller_id] = [];
          acc[reading.controller_id].push(reading);
          return acc;
        }, {} as Record<string, SensorReading[]>);
        setReadings(grouped);
      }
    };

    fetchHistory();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('sensor-readings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `controller_id=in.(${controllerIds.join(',')})`,
        },
        (payload) => {
          const newReading = payload.new as SensorReading;
          setReadings((prev) => ({
            ...prev,
            [newReading.controller_id]: [
              ...(prev[newReading.controller_id] || []).slice(-47), // Keep last 48 readings
              newReading,
            ],
          }));
        }
      )
      .subscribe((status) => {
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'connecting');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [controllerIds.join(',')]);

  return { readings, connectionStatus };
}
```

### Controllers Hook

```typescript
// hooks/useControllers.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Controller {
  id: string;
  name: string;
  room_name: string;
  controller_type: string;
  is_active: boolean;
  last_seen_at: string;
}

export function useControllers() {
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchControllers = async () => {
      const { data, error } = await supabase
        .from('controllers')
        .select('*')
        .order('room_name');

      if (data) setControllers(data);
      setLoading(false);
    };

    fetchControllers();

    // Subscribe to controller updates
    const channel = supabase
      .channel('controllers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'controllers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setControllers((prev) => [...prev, payload.new as Controller]);
          } else if (payload.eventType === 'UPDATE') {
            setControllers((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as Controller) : c))
            );
          } else if (payload.eventType === 'DELETE') {
            setControllers((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { controllers, loading };
}
```

### Updated Dashboard Integration

```typescript
// In your Dashboard component, replace the demo data with real data:

import { useControllers } from '@/hooks/useControllers';
import { useRealtimeSensors } from '@/hooks/useRealtimeSensors';

const Dashboard = () => {
  const { controllers, loading: controllersLoading } = useControllers();
  const controllerIds = controllers.map(c => c.id);
  const { readings, connectionStatus } = useRealtimeSensors(controllerIds);

  // Transform data for the existing room cards
  const rooms = controllers.map(controller => ({
    id: controller.id,
    name: controller.room_name,
    controller: controller.name,
    data: (readings[controller.id] || []).map(r => ({
      time: new Date(r.recorded_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date(r.recorded_at).getTime(),
      temperature: r.temperature,
      humidity: r.humidity,
      vpd: r.vpd,
      co2: r.co2,
    })),
  }));

  // If no controllers yet, show demo mode
  if (controllersLoading) {
    return <LoadingSpinner />;
  }

  if (controllers.length === 0) {
    // Fall back to demo data (existing behavior)
    return <DemoModeDashboard />;
  }

  // Render with real data
  return (
    <div>
      {/* Connection status indicator */}
      <ConnectionStatus status={connectionStatus} />
      
      {/* Room cards with real data */}
      {rooms.map(room => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
};
```

---

## 5. Environment Variables

### Frontend (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (Supabase Edge Functions)

```bash
# Set via Supabase CLI or Dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 6. Adding a New Controller

### API Endpoint (Edge Function)

```typescript
// supabase/functions/add-controller/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get user from JWT
  const authHeader = req.headers.get('Authorization')!;
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json();

  // Validate the controller connection
  let isValid = false;
  try {
    switch (body.controller_type) {
      case 'ac_infinity':
        isValid = await validateACInfinity(body.credentials);
        break;
      case 'trolmaster':
        isValid = await validateTrolMaster(body.api_endpoint);
        break;
      case 'pulse':
        isValid = await validatePulse(body.credentials);
        break;
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to connect to controller', details: err.message }),
      { status: 400 }
    );
  }

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid controller credentials' }),
      { status: 400 }
    );
  }

  // Save controller
  const { data, error } = await supabase
    .from('controllers')
    .insert({
      user_id: user.id,
      name: body.name,
      room_name: body.room_name,
      controller_type: body.controller_type,
      api_endpoint: body.api_endpoint,
      api_key: body.api_key, // Should be encrypted
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ controller: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 7. Quick Start Checklist

### Backend Setup

- [ ] Create Supabase project
- [ ] Run database schema SQL
- [ ] Enable Realtime on tables
- [ ] Deploy Edge Functions
- [ ] Set up pg_cron for polling
- [ ] Configure environment variables

### Frontend Setup

- [ ] Install Supabase client (`npm install @supabase/supabase-js`)
- [ ] Add environment variables
- [ ] Integrate hooks into Dashboard component
- [ ] Add "Add Controller" UI flow
- [ ] Test real-time updates

### Testing

- [ ] Verify WebSocket connection (check Network tab)
- [ ] Confirm sensor data inserts trigger UI updates
- [ ] Test controller offline handling
- [ ] Validate 24-hour historical data loading

---

## 8. Troubleshooting

### WebSocket Not Connecting

```typescript
// Check Supabase Realtime status
const channel = supabase.channel('test').subscribe((status, err) => {
  console.log('Realtime status:', status);
  if (err) console.error('Realtime error:', err);
});
```

### Data Not Updating

1. Check Edge Function logs in Supabase Dashboard
2. Verify pg_cron job is running
3. Confirm RLS policies allow SELECT

### Controller Connection Fails

1. Check network connectivity (TrolMaster requires local network)
2. Verify API credentials
3. Check rate limits on controller APIs

---

## Support

For issues specific to controller APIs:
- AC Infinity: Check their community forums
- TrolMaster: Local API docs in device admin panel
- Pulse: developer.pulsegrow.com

For EnviroFlow-specific issues, check the GitHub repository.