# Home Assistant MQTT Bridge Setup Guide

This guide walks you through setting up the EnviroFlow Home Assistant MQTT Bridge to integrate your EnviroFlow controllers with Home Assistant.

## Overview

The EnviroFlow Home Assistant MQTT Bridge provides:

- **Auto-discovery**: EnviroFlow entities automatically appear in Home Assistant
- **Two-way sync**: Control devices from either EnviroFlow or Home Assistant
- **Real-time updates**: Sensor readings update in real-time
- **Conflict resolution**: Last-write-wins ensures consistency

## Prerequisites

1. **MQTT Broker**: You need an MQTT broker running (Mosquitto recommended)
2. **Home Assistant**: Version 2023.1 or later
3. **EnviroFlow**: Running instance with at least one controller configured

## Step 1: Install MQTT Broker

### Option A: Mosquitto on Home Assistant OS

1. Open Home Assistant
2. Go to **Settings** → **Add-ons** → **Add-on Store**
3. Search for "Mosquitto broker"
4. Click **Install**
5. Configure the add-on:

```yaml
logins:
  - username: enviroflow
    password: your-secure-password
require_certificate: false
certfile: fullchain.pem
keyfile: privkey.pem
```

6. Start the add-on
7. Enable "Start on boot" and "Watchdog"

### Option B: Standalone Mosquitto

If running Mosquitto separately:

```bash
# Install Mosquitto
sudo apt-get install mosquitto mosquitto-clients

# Create password file
sudo mosquitto_passwd -c /etc/mosquitto/passwd enviroflow

# Configure Mosquitto
sudo nano /etc/mosquitto/mosquitto.conf
```

Add to configuration:

```conf
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd
```

Restart Mosquitto:

```bash
sudo systemctl restart mosquitto
sudo systemctl enable mosquitto
```

## Step 2: Configure Home Assistant MQTT Integration

1. In Home Assistant, go to **Settings** → **Devices & Services**
2. Click **+ Add Integration**
3. Search for "MQTT"
4. Enter your broker details:
   - **Broker**: `localhost` (or your broker IP)
   - **Port**: `1883`
   - **Username**: `enviroflow`
   - **Password**: (your password)
5. Click **Submit**

Verify MQTT is working:

```bash
# Subscribe to test topic
mosquitto_sub -h localhost -t test/topic -u enviroflow -P your-password

# Publish test message (in another terminal)
mosquitto_pub -h localhost -t test/topic -m "Hello" -u enviroflow -P your-password
```

## Step 3: Configure EnviroFlow MQTT Bridge

### Add MQTT Configuration to EnviroFlow

Add the following environment variables to your EnviroFlow `.env.local`:

```bash
# MQTT Broker Configuration
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=enviroflow
MQTT_PASSWORD=your-secure-password

# Optional: Customize MQTT topics
MQTT_DISCOVERY_PREFIX=homeassistant
MQTT_STATE_PREFIX=enviroflow
MQTT_UPDATE_INTERVAL=30000
```

### Enable the Bridge

Create or update `/apps/web/src/config/homeassistant.ts`:

```typescript
import type { HomeAssistantBridgeConfig } from '@/lib/homeassistant-bridge'

export const homeAssistantConfig: HomeAssistantBridgeConfig = {
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    port: parseInt(process.env.MQTT_PORT || '1883', 10),
    useTLS: process.env.MQTT_USE_TLS === 'true',
  },
  enabled: process.env.ENABLE_HA_BRIDGE === 'true',
  discoveryPrefix: process.env.MQTT_DISCOVERY_PREFIX || 'homeassistant',
  statePrefix: process.env.MQTT_STATE_PREFIX || 'enviroflow',
  updateInterval: parseInt(process.env.MQTT_UPDATE_INTERVAL || '30000', 10),
}
```

## Step 4: Verify Integration

### Check MQTT Topics

Subscribe to Home Assistant discovery topics:

```bash
mosquitto_sub -h localhost -t "homeassistant/#" -u enviroflow -P your-password -v
```

You should see discovery messages like:

```
homeassistant/sensor/enviroflow_abc123_temperature/config
homeassistant/sensor/enviroflow_abc123_humidity/config
homeassistant/fan/enviroflow_abc123_fan_1/config
```

### Check Home Assistant

1. Go to **Settings** → **Devices & Services** → **MQTT**
2. You should see EnviroFlow devices listed
3. Click on a device to see all entities

### Test Sensor Data

Subscribe to state topics:

```bash
mosquitto_sub -h localhost -t "enviroflow/+/sensors/#" -u enviroflow -P your-password -v
```

You should see sensor readings:

```
enviroflow/abc123/sensors/temperature/1 72.5
enviroflow/abc123/sensors/humidity/1 55.2
```

## Step 5: Test Two-Way Control

### Control from Home Assistant

1. In Home Assistant, find an EnviroFlow fan entity
2. Turn it on/off or adjust speed
3. Verify the change appears in EnviroFlow dashboard

Monitor command topics:

```bash
mosquitto_sub -h localhost -t "enviroflow/+/devices/+/set" -u enviroflow -P your-password -v
```

### Control from EnviroFlow

1. In EnviroFlow, control a device
2. Verify the change appears in Home Assistant

## Entity Mapping

### Sensors

EnviroFlow sensors appear as Home Assistant sensor entities:

| EnviroFlow Type | HA Entity Type | Device Class |
|----------------|----------------|--------------|
| Temperature | `sensor` | `temperature` |
| Humidity | `sensor` | `humidity` |
| VPD | `sensor` | (none) |
| CO2 | `sensor` | (custom) |
| Light | `sensor` | `illuminance` |

### Devices

EnviroFlow devices appear as Home Assistant entities:

| EnviroFlow Type | HA Entity Type | Features |
|----------------|----------------|----------|
| Fan | `fan` | On/Off, Speed (if dimming supported) |
| Light | `light` | On/Off, Brightness (if dimming supported) |
| Outlet | `switch` | On/Off |
| Heater | `climate` | On/Off, Temperature |
| Humidifier | `humidifier` | On/Off, Humidity |

## MQTT Topic Structure

### Discovery Topics

Format: `homeassistant/<component>/enviroflow_<controller_id>_<entity>/config`

Example:
```
homeassistant/sensor/enviroflow_abc123_temperature_1/config
```

Payload:
```json
{
  "name": "Grow Room Temperature",
  "unique_id": "enviroflow_abc123_temperature_1",
  "state_topic": "enviroflow/abc123/sensors/temperature/1",
  "device_class": "temperature",
  "unit_of_measurement": "°F",
  "device": {
    "identifiers": ["enviroflow_abc123"],
    "name": "Grow Room Controller",
    "manufacturer": "EnviroFlow"
  }
}
```

### State Topics

**Sensors**: `enviroflow/<controller_id>/sensors/<sensor_type>/<port>`

Example:
```
enviroflow/abc123/sensors/temperature/1 → "72.5"
```

**Devices**: `enviroflow/<controller_id>/devices/<port>/state`

Example:
```json
enviroflow/abc123/devices/1/state → {"state": "ON", "brightness": 75}
```

### Command Topics

**Devices**: `enviroflow/<controller_id>/devices/<port>/set`

Example commands:
```
enviroflow/abc123/devices/1/set ← "ON"
enviroflow/abc123/devices/1/set ← "OFF"
enviroflow/abc123/devices/1/set ← {"state": "ON", "brightness": 50}
```

### Availability Topics

Format: `enviroflow/<controller_id>/availability`

Payloads:
- `online` - Controller is online
- `offline` - Controller is offline

## Automations in Home Assistant

### Example 1: Turn on fan when temperature is high

```yaml
automation:
  - alias: "Grow Room - High Temperature Fan"
    trigger:
      - platform: numeric_state
        entity_id: sensor.enviroflow_abc123_temperature_1
        above: 80
    action:
      - service: fan.turn_on
        target:
          entity_id: fan.enviroflow_abc123_fan_1
      - service: fan.set_percentage
        target:
          entity_id: fan.enviroflow_abc123_fan_1
        data:
          percentage: 100
```

### Example 2: Sunset dimming

```yaml
automation:
  - alias: "Grow Room - Sunset Dimming"
    trigger:
      - platform: time
        at: "18:00:00"
    action:
      - service: light.turn_on
        target:
          entity_id: light.enviroflow_abc123_light_1
        data:
          brightness_pct: 100
      - delay: "01:00:00"
      - service: light.turn_on
        target:
          entity_id: light.enviroflow_abc123_light_1
        data:
          brightness_pct: 50
      - delay: "01:00:00"
      - service: light.turn_off
        target:
          entity_id: light.enviroflow_abc123_light_1
```

### Example 3: VPD Alert

```yaml
automation:
  - alias: "Grow Room - VPD Alert"
    trigger:
      - platform: numeric_state
        entity_id: sensor.enviroflow_abc123_vpd_1
        below: 0.4
        for: "00:05:00"
    action:
      - service: notify.mobile_app_iphone
        data:
          title: "VPD Too Low"
          message: "VPD is {{ states('sensor.enviroflow_abc123_vpd_1') }} kPa - increase temperature or humidity"
```

## Conflict Resolution

The bridge uses **last-write-wins** conflict resolution:

1. Each state change includes a timestamp
2. If both EnviroFlow and HA change a device within 1 second, the most recent change wins
3. Changes more than 1 second apart are treated as sequential

Example:
- 10:00:00.000 - HA turns fan ON
- 10:00:00.500 - EnviroFlow turns fan OFF (wins, more recent)
- Result: Fan is OFF

## Troubleshooting

### Entities not appearing in Home Assistant

1. Check MQTT broker is running:
   ```bash
   mosquitto_sub -h localhost -t '#' -v -u enviroflow -P your-password
   ```

2. Verify EnviroFlow is publishing discovery messages:
   ```bash
   mosquitto_sub -h localhost -t 'homeassistant/#' -v -u enviroflow -P your-password
   ```

3. Check Home Assistant logs:
   ```
   Settings → System → Logs
   ```

### State not updating

1. Check sensor readings are being published:
   ```bash
   mosquitto_sub -h localhost -t 'enviroflow/+/sensors/#' -v -u enviroflow -P your-password
   ```

2. Verify availability topic shows "online":
   ```bash
   mosquitto_sub -h localhost -t 'enviroflow/+/availability' -v -u enviroflow -P your-password
   ```

3. Check `expire_after` setting (default 600 seconds)

### Commands not working

1. Monitor command topics:
   ```bash
   mosquitto_sub -h localhost -t 'enviroflow/+/devices/+/set' -v -u enviroflow -P your-password
   ```

2. Verify EnviroFlow is subscribed to command topics
3. Check EnviroFlow logs for command processing errors

### High latency

1. Reduce `MQTT_UPDATE_INTERVAL` in EnviroFlow config
2. Use QoS 0 for non-critical updates
3. Check network latency to MQTT broker
4. Consider running MQTT broker on same machine as EnviroFlow

## Security Best Practices

1. **Use TLS**: Enable TLS for production deployments
   ```bash
   MQTT_BROKER_URL=mqtts://broker.example.com:8883
   MQTT_USE_TLS=true
   ```

2. **Strong passwords**: Use long, random passwords for MQTT
   ```bash
   openssl rand -base64 32
   ```

3. **Access Control Lists**: Restrict topic access in Mosquitto
   ```conf
   # /etc/mosquitto/acl
   user enviroflow
   topic readwrite enviroflow/#
   topic readwrite homeassistant/#
   ```

4. **Firewall**: Block MQTT port (1883) from external access
   ```bash
   sudo ufw allow from 192.168.1.0/24 to any port 1883
   ```

## Advanced Configuration

### Custom Discovery Prefix

If you have multiple instances:

```bash
MQTT_DISCOVERY_PREFIX=homeassistant_growroom1
MQTT_STATE_PREFIX=enviroflow_growroom1
```

### QoS and Retain Settings

Customize MQTT QoS levels in bridge configuration:

```typescript
export const mqttOptions = {
  qos: {
    discovery: 1,    // Discovery messages (retained)
    state: 0,        // State updates (not retained)
    command: 1,      // Commands (not retained)
    availability: 1, // Availability (retained)
  },
  retain: {
    discovery: true,
    state: false,
    availability: true,
  },
}
```

### Multiple Brokers

For high availability:

```bash
MQTT_BROKER_URL=mqtt://broker1.local:1883,mqtt://broker2.local:1883
```

## Performance Tips

1. **Batch updates**: Group sensor readings into single MQTT message
2. **Use wildcards**: Subscribe to `enviroflow/+/sensors/#` instead of individual topics
3. **Compression**: Enable compression for large payloads
4. **Local broker**: Run MQTT broker on same host as EnviroFlow

## Support

For issues or questions:

- **Documentation**: [docs.enviroflow.app](https://docs.enviroflow.app)
- **GitHub Issues**: [github.com/enviroflow/enviroflow](https://github.com/enviroflow/enviroflow)
- **Home Assistant Community**: [community.home-assistant.io](https://community.home-assistant.io)

## License

This integration is part of EnviroFlow and licensed under the MIT License.
