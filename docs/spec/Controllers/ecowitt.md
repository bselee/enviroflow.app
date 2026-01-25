I'll construct a comprehensive implementation plan for integrating Ecowitt environmental sensors into your EnviroFlow platform. Let me first examine their hardware options and API documentation.Based on my research, here's a **comprehensive implementation plan** for integrating Ecowitt environmental sensors into your EnviroFlow platform:

## **ECOWITT DATA ACCESS IMPLEMENTATION PLAN**

---

### **1. HARDWARE OPTIONS & CONNECTIVITY**

#### **Recommended Gateway Options**
1. **GW1100 WiFi Gateway** ($19.99) - Budget option
   - Built-in temp/humidity/barometric sensor
   - WiFi only, no display
   - Supports local API and custom upload
   
2. **GW2000/GW3000** - Advanced options
   - Built-in sensors
   - Ethernet + WiFi
   - Local web API support
   - Better for production environments

3. **Display Consoles** (WS2320_C, HP2560_C, etc.)
   - Built-in gateway functionality
   - Visual display for users
   - Note: Most consoles do NOT support local TCP API (GW1000/GW2000/GW3000 specific)

#### **Supported Sensors (via RF)**
- Multi-channel temp/humidity (WH31)
- Outdoor sensors (WH32, WH68)
- Soil moisture (WH51)
- Leak detectors (WH55)
- Lightning detector (WH57)
- Water valves (WFC01)
- Smart plugs (AC1100)

---

### **2. DATA ACCESS METHODS**

#### **Method A: Custom HTTP Upload (RECOMMENDED - Most Reliable)**

**How it works:**
- Gateway pushes data to your server via HTTP POST
- Configure via WS View app or Web UI
- Choose between Ecowitt or Wunderground protocol format
- Data pushed every 16-60 seconds (configurable)

**Implementation:**
```javascript
// Next.js API Route: /api/ecowitt/report
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  
  // Parse incoming data
  const sensorData = {
    timestamp: new Date(),
    deviceId: formData.get('PASSKEY') || formData.get('stationtype'),
    temperature: {
      indoor: parseFloat(formData.get('tempinf')),
      outdoor: parseFloat(formData.get('tempf')),
      channels: {} // Parse temp1f, temp2f, etc.
    },
    humidity: {
      indoor: parseFloat(formData.get('humidityin')),
      outdoor: parseFloat(formData.get('humidity'))
    },
    pressure: parseFloat(formData.get('baromabsin')),
    // Additional sensors
    soilMoisture: parseFloat(formData.get('soilmoisture1')),
    uvIndex: parseFloat(formData.get('uv')),
    solarRadiation: parseFloat(formData.get('solarradiation')),
    battery: {
      // Parse batt_co2, wh65batt, etc.
    }
  };

  // Store in Supabase
  await supabase.from('sensor_readings').insert(sensorData);
  
  // Trigger automations if needed
  await checkAutomationTriggers(sensorData);
  
  return NextResponse.json({ success: true }, { status: 200 });
}
```

**Gateway Configuration:**
```
Protocol: Ecowitt
Server: your-enviroflow-domain.com (or local IP)
Path: /api/ecowitt/report
Port: 443 (HTTPS) or 80 (HTTP)
Interval: 30 seconds
```

**Ecowitt Protocol Data Fields:**
```
PASSKEY, stationtype, dateutc, tempinf, humidityin, baromrelin, 
baromabsin, tempf, humidity, winddir, windspeedmph, windgustmph,
maxdailygust, solarradiation, uv, rainratein, eventrainin,
hourlyrainin, dailyrainin, weeklyrainin, monthlyrainin,
temp1f-temp8f, humidity1-8, soilmoisture1-8, pm25_ch1-4,
leak_ch1-4, lightning_num, lightning, wh65batt, wh68batt, etc.
```

---

#### **Method B: Local TCP API (GW1000/GW2000/GW3000 Only)**

**How it works:**
- Direct TCP connection to gateway on local network
- Poll for data on-demand
- Binary protocol with structured commands

**Implementation:**
```javascript
// lib/ecowitt-tcp.ts
import net from 'net';

class EcowittTCPClient {
  private host: string;
  private port: number = 45000; // Default Ecowitt port
  
  constructor(host: string) {
    this.host = host;
  }
  
  async getLiveData(): Promise<any> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection({ host: this.host, port: this.port }, () => {
        // CMD_READ_LIVEDATA command
        const command = Buffer.from([
          0xFF, 0xFF, // Fixed header
          0x0B,       // Command: Read live data
          0x00, 0x00  // Size
        ]);
        
        // Calculate checksum
        const checksum = this.calculateChecksum(command);
        const fullCommand = Buffer.concat([command, Buffer.from([checksum])]);
        
        client.write(fullCommand);
      });
      
      let responseData = Buffer.alloc(0);
      
      client.on('data', (data) => {
        responseData = Buffer.concat([responseData, data]);
      });
      
      client.on('end', () => {
        const parsed = this.parseResponse(responseData);
        resolve(parsed);
      });
      
      client.on('error', reject);
    });
  }
  
  private parseResponse(buffer: Buffer): any {
    // Parse binary protocol (see documentation)
    // First 5 bytes: header + command + size
    // Last byte: checksum
    // Middle bytes: sensor data
    
    const readings: any = {};
    let offset = 5; // Skip header
    
    while (offset < buffer.length - 1) {
      const dataType = buffer[offset];
      offset++;
      
      switch(dataType) {
        case 0x01: // Indoor temperature
          readings.indoorTemp = buffer.readInt16BE(offset) / 10;
          offset += 2;
          break;
        case 0x02: // Outdoor temperature
          readings.outdoorTemp = buffer.readInt16BE(offset) / 10;
          offset += 2;
          break;
        case 0x06: // Indoor humidity
          readings.indoorHumidity = buffer.readUInt8(offset);
          offset += 1;
          break;
        // Add more sensor type parsers...
      }
    }
    
    return readings;
  }
  
  private calculateChecksum(buffer: Buffer): number {
    let sum = 0;
    for (let i = 2; i < buffer.length; i++) {
      sum += buffer[i];
    }
    return sum & 0xFF;
  }
}

export default EcowittTCPClient;
```

---

#### **Method C: Undocumented Local HTTP API**

**How it works:**
- Some gateways support HTTP GET requests
- Not officially documented (use at own risk)
- Simpler than TCP but may break in firmware updates

**Implementation:**
```javascript
// lib/ecowitt-http.ts
async function getLocalLiveData(gatewayIP: string): Promise<any> {
  try {
    // Undocumented endpoint
    const response = await fetch(`http://${gatewayIP}/get_livedata_info`);
    const data = await response.json();
    
    // Parse the response
    return {
      indoorTemp: data.indoor?.temperature?.value,
      indoorHumidity: data.indoor?.humidity?.value,
      outdoorTemp: data.outdoor?.temperature?.value,
      pressure: data.pressure?.absolute?.value,
      // Map other fields
    };
  } catch (error) {
    console.error('Failed to fetch from local API:', error);
    throw error;
  }
}
```

---

#### **Method D: Ecowitt Cloud API**

**How it works:**
- Data accessible via Ecowitt's cloud servers
- Requires API key and station MAC address
- Good for remote access, but adds latency

**Implementation:**
```javascript
// lib/ecowitt-cloud.ts
async function getCloudData(apiKey: string, applicationKey: string, mac: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  const response = await fetch('https://api.ecowitt.net/api/v3/device/real_time', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      application_key: applicationKey,
      api_key: apiKey,
      mac: mac,
      call_back: 'all', // or specific parameters
      temp_unitid: 1, // 1=°F, 2=°C
      pressure_unitid: 3, // 3=inHg
      wind_speed_unitid: 5, // 5=mph
      rainfall_unitid: 12, // 12=in
      solar_irradiance_unitid: 16 // 16=W/m²
    })
  });
  
  return await response.json();
}
```

---

### **3. IOT DEVICE CONTROL (Valves & Plugs)**

For **WFC01 (water valves)** and **AC1100 (smart plugs)**:

```javascript
// lib/ecowitt-iot-control.ts
async function controlDevice(
  gatewayIP: string,
  deviceId: number,
  model: 1 | 2, // 1=WFC01, 2=AC1100
  action: 'on' | 'off' | 'status'
): Promise<any> {
  const url = `http://${gatewayIP}/parse_quick_cmd_iot`;
  
  let command: any;
  
  if (action === 'on') {
    command = {
      command: [{
        cmd: 'quick_run',
        on_type: 0,
        off_type: 0,
        always_on: 1, // Always on mode
        on_time: 0,
        off_time: 0,
        val_type: 0,
        val: 0,
        id: deviceId,
        model: model
      }]
    };
  } else if (action === 'off') {
    command = {
      command: [{
        cmd: 'quick_stop',
        id: deviceId,
        model: model
      }]
    };
  } else if (action === 'status') {
    command = {
      command: [{
        cmd: 'read_device',
        id: deviceId,
        model: model
      }]
    };
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  
  return await response.json();
}

// Get list of connected IoT devices
async function getIoTDeviceList(gatewayIP: string): Promise<any> {
  const response = await fetch(`http://${gatewayIP}/get_iot_device_list`);
  return await response.json();
}
```

---

### **4. ENVIROFLOW INTEGRATION ARCHITECTURE**

#### **Database Schema (Supabase)**

```sql
-- Ecowitt devices table
CREATE TABLE ecowitt_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  device_mac VARCHAR(17) UNIQUE NOT NULL,
  device_name VARCHAR(100),
  device_type VARCHAR(50), -- 'GW1100', 'GW2000', etc.
  local_ip INET,
  firmware_version VARCHAR(20),
  connection_method VARCHAR(20), -- 'push', 'tcp', 'cloud'
  api_credentials JSONB, -- For cloud API
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ,
  settings JSONB
);

-- Sensor readings table
CREATE TABLE ecowitt_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID REFERENCES ecowitt_devices(id),
  timestamp TIMESTAMPTZ NOT NULL,
  indoor_temp DECIMAL(5,2),
  indoor_humidity DECIMAL(5,2),
  outdoor_temp DECIMAL(5,2),
  outdoor_humidity DECIMAL(5,2),
  pressure DECIMAL(6,2),
  soil_moisture JSONB, -- Array of readings
  channel_temps JSONB, -- Multi-channel temps
  battery_status JSONB,
  raw_data JSONB, -- Store full payload
  INDEX idx_device_timestamp (device_id, timestamp DESC)
);

-- IoT devices (valves, plugs)
CREATE TABLE ecowitt_iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id UUID REFERENCES ecowitt_devices(id),
  device_id INTEGER NOT NULL, -- Ecowitt device ID
  model INTEGER NOT NULL, -- 1=WFC01, 2=AC1100
  nickname VARCHAR(100),
  device_type VARCHAR(20), -- 'valve', 'plug'
  status JSONB,
  last_action TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation rules
CREATE TABLE ecowitt_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(100) NOT NULL,
  device_id UUID REFERENCES ecowitt_devices(id),
  trigger_conditions JSONB, -- {temp: {above: 85}, humidity: {below: 40}}
  actions JSONB, -- [{type: 'control_device', device_id: xxx, action: 'on'}]
  enabled BOOLEAN DEFAULT true,
  cooldown_minutes INTEGER DEFAULT 30,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Real-time Data Flow**

```typescript
// app/api/ecowitt/report/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const formData = await req.formData();
  const supabase = createClient();
  
  // Parse sensor data
  const mac = formData.get('PASSKEY') as string;
  const readings = parseSensorData(formData);
  
  // Store in database
  const { data: device } = await supabase
    .from('ecowitt_devices')
    .select('id')
    .eq('device_mac', mac)
    .single();
    
  if (device) {
    // Insert reading
    await supabase.from('ecowitt_readings').insert({
      device_id: device.id,
      timestamp: new Date(),
      ...readings
    });
    
    // Update last_seen
    await supabase
      .from('ecowitt_devices')
      .update({ last_seen: new Date() })
      .eq('id', device.id);
    
    // Check automation triggers
    await processAutomations(device.id, readings);
  }
  
  return new Response('success', { status: 200 });
}

async function processAutomations(deviceId: string, readings: any) {
  const supabase = createClient();
  
  const { data: automations } = await supabase
    .from('ecowitt_automations')
    .select('*')
    .eq('device_id', deviceId)
    .eq('enabled', true);
    
  for (const automation of automations || []) {
    // Check cooldown
    if (automation.last_triggered) {
      const cooldownEnd = new Date(automation.last_triggered);
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + automation.cooldown_minutes);
      if (new Date() < cooldownEnd) continue;
    }
    
    // Evaluate conditions
    if (evaluateConditions(automation.trigger_conditions, readings)) {
      // Execute actions
      for (const action of automation.actions) {
        await executeAction(action);
      }
      
      // Update last_triggered
      await supabase
        .from('ecowitt_automations')
        .update({ last_triggered: new Date() })
        .eq('id', automation.id);
    }
  }
}
```

---

### **5. DASHBOARD COMPONENTS**

#### **Real-time Sensor Display**

```typescript
// components/EcowittDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function EcowittDashboard({ deviceId }: { deviceId: string }) {
  const [latestReading, setLatestReading] = useState<any>(null);
  const supabase = createClient();
  
  useEffect(() => {
    // Subscribe to real-time updates
    const channel = supabase
      .channel('ecowitt-readings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ecowitt_readings',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          setLatestReading(payload.new);
        }
      )
      .subscribe();
      
    // Load initial data
    loadLatestReading();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);
  
  async function loadLatestReading() {
    const { data } = await supabase
      .from('ecowitt_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
      
    if (data) setLatestReading(data);
  }
  
  if (!latestReading) return <div>Loading...</div>;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SensorCard
        title="Indoor Temp"
        value={`${latestReading.indoor_temp}°F`}
        icon="thermometer"
      />
      <SensorCard
        title="Indoor Humidity"
        value={`${latestReading.indoor_humidity}%`}
        icon="droplet"
      />
      <SensorCard
        title="Outdoor Temp"
        value={`${latestReading.outdoor_temp}°F`}
        icon="thermometer"
      />
      <SensorCard
        title="Pressure"
        value={`${latestReading.pressure} inHg`}
        icon="gauge"
      />
    </div>
  );
}
```

#### **IoT Device Controls**

```typescript
// components/EcowittDeviceControl.tsx
'use client';

export function DeviceControl({ device }: { device: any }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(device.status);
  
  async function toggleDevice(action: 'on' | 'off') {
    setLoading(true);
    try {
      const response = await fetch('/api/ecowitt/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayId: device.gateway_id,
          deviceId: device.device_id,
          model: device.model,
          action
        })
      });
      
      const result = await response.json();
      setStatus(result.status);
    } catch (error) {
      console.error('Failed to control device:', error);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{device.nickname}</h3>
      <p className="text-sm text-gray-500">
        {device.device_type === 'valve' ? 'Water Valve' : 'Smart Plug'}
      </p>
      
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => toggleDevice('on')}
          disabled={loading || status?.ac_status === 1}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Turn On
        </button>
        <button
          onClick={() => toggleDevice('off')}
          disabled={loading || status?.ac_status === 0}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          Turn Off
        </button>
      </div>
      
      {status && (
        <div className="mt-2 text-sm">
          <p>Status: {status.ac_status === 1 ? 'On' : 'Off'}</p>
          <p>Power: {status.realtime_power}W</p>
          <p>Voltage: {status.ac_voltage}V</p>
        </div>
      )}
    </div>
  );
}
```

---

### **6. IMPLEMENTATION ROADMAP**

#### **Phase 1: Core Data Ingestion (Week 1-2)**
- [ ] Set up custom HTTP endpoint for Ecowitt push data
- [ ] Create database schema in Supabase
- [ ] Build data parser for Ecowitt protocol format
- [ ] Implement device registration flow
- [ ] Test with GW1100 gateway

#### **Phase 2: Dashboard Display (Week 3)**
- [ ] Build real-time sensor cards
- [ ] Add historical data charts (using Recharts)
- [ ] Create device management interface
- [ ] Implement battery status monitoring
- [ ] Add alerts for low batteries or offline devices

#### **Phase 3: Automation Engine (Week 4-5)**
- [ ] Build condition evaluator
- [ ] Create automation rule builder UI
- [ ] Implement cooldown logic
- [ ] Add notification system (email/SMS/push)
- [ ] Test automation triggers

#### **Phase 4: IoT Control (Week 6)**
- [ ] Implement local HTTP control API
- [ ] Build device discovery system
- [ ] Create control interface components
- [ ] Add scheduling for automated actions
- [ ] Test with WFC01 valve and AC1100 plug

#### **Phase 5: Advanced Features (Week 7-8)**
- [ ] Add TCP API support for polling
- [ ] Implement cloud API fallback
- [ ] Build data export functionality
- [ ] Create mobile-responsive views
- [ ] Add multi-location support

#### **Phase 6: Polish & Documentation (Week 9)**
- [ ] Write integration docs
- [ ] Create setup wizard
- [ ] Add troubleshooting guides
- [ ] Implement error recovery
- [ ] Load testing

---

### **7. RECOMMENDED APPROACH**

**For EnviroFlow, I recommend:**

1. **Primary: Custom HTTP Push** (Method A)
   - Most reliable and officially supported
   - Lowest latency (data pushed immediately)
   - No polling overhead
   - Works with all Ecowitt gateways

2. **Secondary: Local TCP API** (Method B)
   - Use for on-demand data refresh
   - Good for status checks
   - Only works with GW1000/GW2000/GW3000

3. **Backup: Cloud API** (Method D)
   - Fallback for remote access
   - When local network not available
   - User can check from anywhere

This multi-method approach gives you the **hardware-agnostic flexibility** that aligns with EnviroFlow's core mission while ensuring reliable data access.

---

### **8. HARDWARE RECOMMENDATIONS FOR TESTING**

**Starter Kit:**
- **GW2000** (WiFi + Ethernet gateway) - $50-70
- **WH31 Multi-channel** sensor (2-pack) - $30
- **WH51 Soil moisture** sensor - $25
- **WFC01 Water valve** (for automation testing) - $40

**Total: ~$145-165**

This gives you all sensor types to test and validate the complete data pipeline.

---
