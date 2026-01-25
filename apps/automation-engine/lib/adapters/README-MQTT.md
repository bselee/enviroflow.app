# MQTT Adapter

Production-ready MQTT adapter for connecting generic IoT devices to EnviroFlow.

## Overview

The MQTT adapter enables EnviroFlow to connect to any MQTT-compatible device, including:

- **Tasmota** devices (ESP8266/ESP32 running Tasmota firmware)
- **ESPHome** devices (custom ESP-based sensors and controllers)
- **Home Assistant** MQTT devices
- **Custom IoT sensors** publishing to MQTT

## Features

- Full MQTT 3.1.1 protocol support
- Native TCP and WebSocket connections
- TLS/SSL encryption support
- Automatic reconnection with exponential backoff
- Last Will and Testament (LWT) for device availability
- QoS levels 0, 1, and 2
- Message caching for serverless environments
- Multi-format sensor message parsing
- Device control via JSON commands

## Protocol Support

| Protocol | Port | Description | Use Case |
|----------|------|-------------|----------|
| `mqtt://` | 1883 | Standard MQTT over TCP | Local network, standard brokers |
| `mqtts://` | 8883 | MQTT over TLS | Secure connections, internet-facing |
| `ws://` | 8083 | MQTT over WebSocket | Browser clients, NAT traversal |
| `wss://` | 9001 | MQTT over secure WebSocket | Secure browser clients |

## Configuration

### MQTTCredentials

```typescript
interface MQTTCredentials {
  type: 'mqtt'
  brokerUrl: string      // Broker hostname (e.g., mqtt://broker.example.com)
  port: number           // Port number (1883, 8883, 8083, 9001)
  topicPrefix: string    // Base topic prefix (e.g., enviroflow/sensors)
  useTls: boolean        // Enable TLS/SSL encryption
  username?: string      // Optional: MQTT username
  password?: string      // Optional: MQTT password
  clientId?: string      // Optional: Custom client ID
}
```

### Example Configuration

```typescript
// Local Mosquitto broker (no auth)
const localConfig: MQTTCredentials = {
  type: 'mqtt',
  brokerUrl: 'mqtt://192.168.1.100',
  port: 1883,
  topicPrefix: 'enviroflow/greenhouse',
  useTls: false
}

// Cloud MQTT broker (with auth and TLS)
const cloudConfig: MQTTCredentials = {
  type: 'mqtt',
  brokerUrl: 'mqtts://mqtt.cloud.com',
  port: 8883,
  topicPrefix: 'enviroflow/user123',
  useTls: true,
  username: 'user123',
  password: 'secret_password'
}

// WebSocket broker (for browser clients)
const wsConfig: MQTTCredentials = {
  type: 'mqtt',
  brokerUrl: 'ws://broker.example.com',
  port: 8083,
  topicPrefix: 'enviroflow/devices',
  useTls: false
}
```

## Message Formats

The adapter supports multiple sensor message formats:

### Format 1: Direct Sensor Fields

```json
{
  "sensor_type": "temperature",
  "value": 72.5,
  "unit": "F",
  "port": 1
}
```

### Format 2: Tasmota-Style Nested

```json
{
  "Time": "2024-01-21T10:30:00",
  "AM2301": {
    "Temperature": 72.5,
    "Humidity": 55.2
  }
}
```

### Format 3: Flat Object

```json
{
  "temperature": 70.1,
  "humidity": 60,
  "co2": 850,
  "light": 500
}
```

## Topic Structure

### Sensor Topics (Subscribed)

The adapter subscribes to multiple topic patterns:

```
{topicPrefix}/+/sensors/#          - Generic sensor readings
{topicPrefix}/sensors/#             - Direct sensor readings
{topicPrefix}/tele/+/SENSOR         - Tasmota telemetry
{topicPrefix}/stat/+/STATUS         - Tasmota status
```

### Device Control Topics (Published)

Commands are published to:

```
{topicPrefix}/{controllerId}/devices/{port}/command
```

### Status Topics

```
{topicPrefix}/status                - Controller online/offline (LWT)
```

## Device Commands

### Turn On

```typescript
await adapter.controlDevice(controllerId, port, {
  type: 'turn_on'
})
```

Published payload:
```json
{
  "command": "turn_on",
  "state": "ON",
  "power": true,
  "timestamp": "2024-01-21T10:30:00.000Z"
}
```

### Turn Off

```typescript
await adapter.controlDevice(controllerId, port, {
  type: 'turn_off'
})
```

Published payload:
```json
{
  "command": "turn_off",
  "state": "OFF",
  "power": false,
  "timestamp": "2024-01-21T10:30:00.000Z"
}
```

### Set Level (Dimming)

```typescript
await adapter.controlDevice(controllerId, port, {
  type: 'set_level',
  value: 75  // 0-100
})
```

Published payload:
```json
{
  "command": "set_level",
  "state": "ON",
  "level": 75,
  "dimmer": 75,
  "timestamp": "2024-01-21T10:30:00.000Z"
}
```

## Usage Example

```typescript
import { MQTTAdapter } from '@enviroflow/automation-engine/adapters'

const adapter = new MQTTAdapter()

// Connect to broker
const credentials: MQTTCredentials = {
  type: 'mqtt',
  brokerUrl: 'mqtt://test.mosquitto.org',
  port: 1883,
  topicPrefix: 'enviroflow/demo',
  useTls: false
}

const result = await adapter.connect(credentials)

if (result.success) {
  console.log('Connected:', result.controllerId)

  // Read sensor data
  const readings = await adapter.readSensors(result.controllerId)
  console.log('Sensor readings:', readings)

  // Control device
  await adapter.controlDevice(result.controllerId, 1, {
    type: 'turn_on'
  })

  // Check status
  const status = await adapter.getStatus(result.controllerId)
  console.log('Status:', status.status)

  // Disconnect
  await adapter.disconnect(result.controllerId)
}
```

## Supported Sensor Types

- `temperature` - Temperature (F)
- `humidity` - Relative humidity (%)
- `vpd` - Vapor Pressure Deficit (kPa)
- `co2` - Carbon dioxide (ppm)
- `light` - Light intensity (lux)
- `ph` - pH level
- `ec` - Electrical conductivity (mS/cm)
- `soil_moisture` - Soil moisture (%)
- `pressure` - Atmospheric pressure (hPa)
- `water_level` - Water level
- `wind_speed` - Wind speed
- `pm25` - Particulate matter 2.5
- `uv` - UV index
- `solar_radiation` - Solar radiation
- `rain` - Rainfall

## Supported Device Types

- `fan` - Fans and blowers
- `light` - Lights and grow lights (with dimming support)
- `heater` - Heaters
- `cooler` - Coolers
- `humidifier` - Humidifiers
- `dehumidifier` - Dehumidifiers
- `outlet` - Smart outlets and relays
- `pump` - Water pumps
- `valve` - Solenoid valves

## Error Handling

The adapter handles common MQTT errors:

### Broker Offline
```typescript
const result = await adapter.connect(credentials)
if (!result.success) {
  console.error('Connection failed:', result.error)
  // Error: "Failed to connect to MQTT broker..."
}
```

### Authentication Failed
```typescript
// Error: "Connection refused: Not authorized"
```

### Malformed Messages
```typescript
// Invalid JSON messages are logged and skipped
// No error thrown, returns empty readings array
```

### Connection Lost
- Automatic reconnection with 5-second period
- Last Will and Testament published on unexpected disconnect
- Status changes to 'offline'

## Message Staleness

Messages older than 5 minutes are marked as `isStale: true` in sensor readings.

```typescript
const readings = await adapter.readSensors(controllerId)
readings.forEach(reading => {
  if (reading.isStale) {
    console.warn('Stale reading:', reading.type, reading.timestamp)
  }
})
```

## Webhook Integration

For serverless environments, use the `handleMQTTMessage` utility to inject messages:

```typescript
import { handleMQTTMessage } from '@enviroflow/automation-engine/adapters'

// In your webhook handler
export async function POST(request: Request) {
  const { controllerId, topic, payload } = await request.json()

  handleMQTTMessage(controllerId, topic, payload)

  return Response.json({ success: true })
}
```

## Testing

Run the test suite:

```bash
npm test apps/automation-engine/lib/adapters/__tests__/MQTTAdapter.test.ts
```

## Popular MQTT Brokers

### Local/Self-Hosted
- **Mosquitto** - Lightweight, standard MQTT broker
- **EMQX** - Scalable, enterprise MQTT broker
- **HiveMQ** - Enterprise MQTT platform

### Cloud Services
- **HiveMQ Cloud** - Managed MQTT broker
- **CloudMQTT** - Hosted Mosquitto instances
- **AWS IoT Core** - AWS managed MQTT service
- **Azure IoT Hub** - Azure managed MQTT service

## Tasmota Integration

For Tasmota devices, use these settings:

1. Configure MQTT in Tasmota web UI
2. Set topic to match your `topicPrefix`
3. Enable telemetry: `TelePeriod 60` (60 seconds)
4. Sensor data will appear in `tele/{topic}/SENSOR`

## ESPHome Integration

Add MQTT to your ESPHome YAML:

```yaml
mqtt:
  broker: mqtt://broker.example.com
  port: 1883
  username: !secret mqtt_username
  password: !secret mqtt_password
  topic_prefix: enviroflow/esp_device

sensor:
  - platform: dht
    pin: D4
    temperature:
      name: "Temperature"
    humidity:
      name: "Humidity"
```

## Security Best Practices

1. **Always use TLS in production** (`useTls: true`)
2. **Use strong passwords** for MQTT authentication
3. **Restrict topic access** with ACLs on broker
4. **Use unique client IDs** to prevent connection conflicts
5. **Enable authentication** on your MQTT broker
6. **Firewall** - Restrict broker port access
7. **Rotate credentials** regularly

## Troubleshooting

### Connection Fails

1. Check broker URL and port
2. Verify broker is running: `mosquitto -v`
3. Test with mosquitto_sub: `mosquitto_sub -h broker -t '#' -v`
4. Check firewall rules
5. Verify credentials

### No Sensor Readings

1. Verify devices are publishing to correct topics
2. Check topic subscription patterns
3. Use `mosquitto_sub` to monitor topics
4. Validate JSON message format
5. Check message staleness

### Commands Not Working

1. Verify device subscribes to command topic
2. Check QoS settings on device
3. Monitor published messages with `mosquitto_sub`
4. Validate command payload format

## License

Part of EnviroFlow - Universal Environmental Automation Platform
