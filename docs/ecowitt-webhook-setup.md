# Ecowitt Push Webhook Integration

This document explains how to configure your Ecowitt gateway to push sensor data to EnviroFlow using the Custom HTTP upload feature.

## Overview

The Ecowitt push webhook (`/api/ecowitt/report`) receives real-time sensor data from Ecowitt gateways via HTTP POST requests. This is the **recommended** method for integrating Ecowitt devices because:

- **Low latency**: Data is pushed immediately (every 16-60 seconds)
- **No polling overhead**: Gateway initiates the connection
- **Works with all Ecowitt gateways**: GW1100, GW2000, GW3000, and display consoles
- **Reliable**: Uses the official Ecowitt protocol

## Supported Gateways

- GW1100 WiFi Gateway
- GW2000/GW3000 Advanced Gateways
- Display Consoles (WS2320_C, HP2560_C, etc.)
- Any Ecowitt gateway with Custom Upload support

## Supported Sensors

The webhook automatically parses data from:

- **Temperature sensors**: Indoor, outdoor, and multi-channel (WH31)
- **Humidity sensors**: Indoor, outdoor, and multi-channel
- **Barometric pressure**: Absolute and relative
- **Soil moisture**: Up to 8 channels (WH51)
- **UV index**: From outdoor sensors
- **Solar radiation**: From solar radiation sensors
- **Air quality**: PM2.5 sensors (up to 4 channels)
- **CO2**: From WH45 sensors (if available)
- **Wind**: Speed and direction

## Gateway Configuration

### Step 1: Register Your Controller in EnviroFlow

Before configuring the gateway, you must add your Ecowitt controller to EnviroFlow:

1. Go to **Controllers** page
2. Click **Add Controller**
3. Select **Ecowitt**
4. Choose connection method: **Push (Recommended)**
5. Enter your gateway's MAC address (PASSKEY)
6. Save the controller

### Step 2: Configure Gateway Custom Upload

#### Via WS View App (Mobile)

1. Open **WS View** app
2. Select your gateway device
3. Tap **Menu** → **Weather Services**
4. Scroll to **Customized**
5. Configure:
   - **Protocol**: Ecowitt
   - **Server**: `enviroflow.app` (or your custom domain)
   - **Path**: `/api/ecowitt/report`
   - **Port**: `443` (HTTPS)
   - **Upload Interval**: `60` (seconds, recommended)
6. Save settings

#### Via Web UI (Desktop)

1. Open gateway web interface: `http://[GATEWAY_IP]`
2. Navigate to **Weather Services** → **Customized**
3. Configure:
   - **Protocol Type**: Ecowitt
   - **Server IP / Hostname**: `enviroflow.app`
   - **Path**: `/api/ecowitt/report`
   - **Port**: `443`
   - **Upload Interval**: `60` seconds
4. Click **Save**

### Step 3: Verify Data Flow

1. Wait 60 seconds for the first data push
2. Check **Dashboard** in EnviroFlow
3. You should see sensor readings appear in real-time
4. Controller status should show **Online**

## Webhook Endpoint Details

### Endpoint

```
POST https://enviroflow.app/api/ecowitt/report
```

### Authentication

**None required.** The gateway pushes data anonymously. EnviroFlow identifies the controller by the MAC address (PASSKEY field) in the payload.

### Request Format

The gateway sends data as **form-encoded** POST request:

```
Content-Type: application/x-www-form-urlencoded

PASSKEY=A1B2C3D4E5F6&stationtype=GW2000&dateutc=2026-01-24+12:30:45&tempinf=72.5&humidityin=45&tempf=68.2&humidity=52&baromabsin=29.92&...
```

### Key Fields

| Field | Description | Example |
|-------|-------------|---------|
| `PASSKEY` or `mac` | Gateway MAC address (controller identifier) | `A1B2C3D4E5F6` |
| `stationtype` | Gateway model | `GW2000` |
| `dateutc` | Timestamp (UTC) | `2026-01-24 12:30:45` |
| `tempinf` | Indoor temperature (°F) | `72.5` |
| `humidityin` | Indoor humidity (%) | `45` |
| `tempf` | Outdoor temperature (°F) | `68.2` |
| `humidity` | Outdoor humidity (%) | `52` |
| `baromabsin` | Absolute pressure (inHg) | `29.92` |
| `soilmoisture1-8` | Soil moisture channels (%) | `35` |
| `temp1f-temp8f` | Extra temp channels (°F) | `70.1` |
| `humidity1-8` | Extra humidity channels (%) | `48` |
| `uv` | UV index | `3` |
| `solarradiation` | Solar radiation (W/m²) | `450` |
| `pm25_ch1-4` | PM2.5 air quality (µg/m³) | `12.5` |

### Response

The endpoint always returns `200 OK` with body `success`:

```
HTTP/1.1 200 OK
Content-Type: text/plain

success
```

**Note**: The endpoint returns success even if the controller is not registered in EnviroFlow. This prevents the gateway from retrying indefinitely on registration errors.

## Data Flow

```
┌──────────────┐
│   Ecowitt    │
│   Gateway    │
│  (GW2000)    │
└──────┬───────┘
       │ Every 60s
       │ HTTP POST
       ▼
┌──────────────────┐
│  EnviroFlow API  │
│  /api/ecowitt/   │
│     report       │
└──────┬───────────┘
       │
       ├─► Look up controller by MAC
       │
       ├─► Parse sensor data
       │
       ├─► Insert readings to database
       │
       └─► Update controller status
```

## Troubleshooting

### Controller shows Offline

**Symptoms**: Controller status is "Offline" despite gateway configuration

**Solutions**:
1. Verify MAC address in EnviroFlow matches gateway PASSKEY
2. Check gateway Custom Upload settings (server, path, port)
3. Ensure gateway has internet connectivity
4. Check firewall/router allows outbound HTTPS on port 443
5. Review gateway logs for upload errors

### No sensor data appearing

**Symptoms**: Controller is Online but no readings in dashboard

**Solutions**:
1. Wait 60 seconds after configuration (initial upload interval)
2. Check that sensors are properly paired with gateway
3. Verify sensor batteries are not low
4. Check sensor type is supported by EnviroFlow
5. Review API logs for parsing errors

### Wrong sensor values

**Symptoms**: Sensor readings are incorrect or in wrong units

**Solutions**:
1. Verify gateway is set to **Ecowitt protocol** (not Wunderground)
2. Check sensor placement (indoor vs outdoor)
3. Ensure temperature sensors are not in direct sunlight
4. Calibrate sensors in WS View app if needed
5. Check unit conversions (gateway should send °F)

### Data arrives but disappears

**Symptoms**: Sensor readings appear briefly then vanish

**Solutions**:
1. Check database retention policy (default: 30 days)
2. Verify timestamp parsing is correct (check server timezone)
3. Review database insert errors in API logs
4. Ensure `is_stale` flag is not being set incorrectly

## Security Considerations

### No Authentication Required

The webhook endpoint does NOT require authentication because:

1. Gateways cannot send custom headers for auth tokens
2. MAC address serves as identifier (low-value target)
3. Sensor data is not sensitive (environmental readings)
4. Malicious data would only affect the sender's own controller

### MAC Address Privacy

The MAC address is stored in the `controller_id` field and is:

- Not exposed in public APIs
- Only visible to the controller owner
- Used solely for data routing

### Rate Limiting

To prevent abuse:

- Gateways typically upload every 60 seconds (max ~1440 requests/day per gateway)
- EnviroFlow does not currently implement rate limiting on this endpoint
- Future enhancement: Consider rate limiting by IP or MAC address

## Advanced Configuration

### Custom Upload Interval

The default 60-second interval is recommended, but you can configure:

- **Minimum**: 16 seconds (high-frequency monitoring)
- **Maximum**: 3600 seconds (hourly updates)

**Trade-offs**:
- Shorter intervals = more real-time data, higher server load
- Longer intervals = less server load, delayed automation triggers

### Multiple Gateways

You can configure multiple Ecowitt gateways:

1. Each gateway must have a unique MAC address
2. Register each gateway as a separate controller in EnviroFlow
3. Configure each gateway to push to the same webhook endpoint
4. EnviroFlow automatically routes data based on MAC address

### Fallback Methods

If push webhook fails, consider:

1. **TCP API** (GW1000/GW2000/GW3000 only): Direct polling via port 45000
2. **Cloud API**: Fetch data from Ecowitt cloud (requires API key)
3. **Local HTTP**: Undocumented local API (may break in updates)

## API Logs

The webhook logs detailed information for debugging:

```json
{
  "timestamp": "2026-01-24T12:30:45.123Z",
  "mac": "A1B2C3D4E5F6",
  "stationtype": "GW2000",
  "source": "192.168.1.100",
  "controller_id": "ecowitt-push-A1B2C3D4E5F6",
  "readingCount": 12,
  "types": ["temperature", "humidity", "pressure", "soil_moisture"]
}
```

Access logs via:
- **Development**: Check terminal console output
- **Production**: View Vercel function logs or Supabase logs

## Related Documentation

- [Ecowitt Adapter Implementation](../apps/automation-engine/lib/adapters/EcowittAdapter.ts)
- [Ecowitt Integration Spec](./spec/Controllers/ecowitt.md)
- [Controller API Routes](../apps/web/src/app/api/controllers/route.ts)
- [Sensor Readings Database Schema](../apps/automation-engine/supabase/migrations/20260121_complete_schema.sql)

## Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section above
2. Review API logs for error messages
3. Verify gateway firmware is up to date
4. Test with Ecowitt's official upload services first
5. Open an issue on GitHub with logs and configuration details
