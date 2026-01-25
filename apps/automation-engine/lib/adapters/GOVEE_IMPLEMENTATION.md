# Govee Adapter Implementation

This document describes the implementation of the GoveeAdapter for EnviroFlow.

## Overview

The GoveeAdapter provides integration with Govee WiFi-enabled devices via the Govee Developer API.

**Status**: ✅ Complete and production-ready

**API Version**: v1
**Base URL**: https://developer-api.govee.com/v1
**Documentation**: https://govee-public.s3.amazonaws.com/developer-docs/GoveeDeveloperAPIReference.pdf

## Supported Devices

### Sensors
- **H5179** - WiFi Hygrometer Thermometer
- **H5075** - WiFi Hygrometer Thermometer
- **H5074** - WiFi Hygrometer Thermometer
- **H5101** - WiFi Hygrometer Thermometer
- **H5102** - WiFi Hygrometer Thermometer
- **H5177** - WiFi Hygrometer Thermometer

### Controllable Devices
- **H6159** - Smart LED Strip Lights
- **H6163** - Smart LED Strip Lights
- **Smart Plugs** - Various WiFi models
- **Smart Lights** - Various WiFi models

## Authentication

Govee uses API key authentication instead of email/password.

### Obtaining API Key
1. Open Govee Home app
2. Go to Account → About Us
3. Tap "Apply for API Key"
4. API key will be sent via email (typically within 24 hours)

### Credentials Type
```typescript
interface GoveeCredentials {
  type: 'govee'
  apiKey: string
  deviceId?: string  // Optional: specific device to connect to
}
```

## API Features

### Rate Limiting
- **Limit**: 60 requests per minute per device
- **Window**: Rolling 60-second window
- **Enforcement**: Client-side rate limiting implemented
- **Behavior**: Requests beyond limit throw error with "Rate limit exceeded" message

### Supported Operations

#### 1. Device Discovery
```typescript
discoverDevicesWithApiKey(apiKey: string): Promise<DiscoveryResult>
```
- Fetches all devices registered to the API key
- Returns device metadata, capabilities, and online status
- Does not require prior connection

#### 2. Connect
```typescript
connect(credentials: GoveeCredentials): Promise<ConnectionResult>
```
- Validates API key
- Fetches device list
- Connects to first device (or specified deviceId)
- Returns device capabilities

#### 3. Read Sensors
```typescript
readSensors(controllerId: string): Promise<SensorReading[]>
```
- Fetches device state
- Extracts temperature (Celsius → Fahrenheit) and humidity
- Returns timestamped readings
- Marks stale readings (implementation specific)

#### 4. Control Device
```typescript
controlDevice(controllerId: string, port: number, command: DeviceCommand): Promise<CommandResult>
```
Supported commands:
- `turn_on` - Turn device on
- `turn_off` - Turn device off
- `set_level` - Set brightness (0-100)
- `toggle` - Toggle power (treated as turn_on)

#### 5. Get Status
```typescript
getStatus(controllerId: string): Promise<ControllerStatus>
```
- Checks if device is online
- Returns last seen timestamp
- Handles devices that don't support state retrieval

#### 6. Disconnect
```typescript
disconnect(controllerId: string): Promise<void>
```
- Clears device from cache
- Cleanup operation

## Implementation Details

### Temperature Conversion
Govee API returns temperature in Celsius. The adapter converts to Fahrenheit:
```typescript
fahrenheit = (celsius * 9/5) + 32
```

### Brightness Mapping
- Govee API: 0-100 scale
- EnviroFlow: 0-100 scale (direct mapping)
- AC Infinity compatibility: 0-10 scale (requires conversion in workflow layer)

### Error Handling

The adapter implements comprehensive error handling with user-friendly messages:

| API Code | Error Message |
|----------|---------------|
| 400 | Bad request. Invalid request parameters. |
| 401 | Unauthorized. Invalid API key. |
| 403 | Forbidden. API key does not have access. |
| 404 | Device not found. May have been removed. |
| 429 | Rate limit exceeded. Please wait. |
| 500 | Govee server error. Try again later. |
| 503 | Service unavailable. Try again later. |

### Retry Logic

Uses the standard `adapterFetch` retry mechanism:
- **Max Retries**: 3
- **Initial Delay**: 1 second
- **Backoff**: Exponential with jitter
- **Timeout**: 15 seconds per request
- **Circuit Breaker**: Opens after 5 consecutive failures

### Caching

Device metadata is cached in memory:
```typescript
interface DeviceCache {
  deviceId: string
  model: string
  deviceName: string
  controllable: boolean
  retrievable: boolean
  apiKey: string
  lastUpdate: Date
  requestCount: number        // For rate limiting
  requestWindowStart: Date    // For rate limiting
}
```

## API Endpoints Used

### GET /v1/devices
Fetches list of all devices for the API key.

**Headers**:
```
Govee-API-Key: <api-key>
Content-Type: application/json
```

**Response**:
```json
{
  "data": {
    "devices": [
      {
        "device": "AA:BB:CC:DD:EE:FF:GG:HH",
        "model": "H5179",
        "deviceName": "Living Room",
        "controllable": true,
        "retrievable": true,
        "supportCmds": ["turn", "brightness", "color"]
      }
    ]
  },
  "message": "Success",
  "code": 200
}
```

### GET /v1/devices/state
Fetches current state of a specific device.

**Headers**:
```
Govee-API-Key: <api-key>
Content-Type: application/json
```

**Query Parameters**:
- `device`: Device MAC address
- `model`: Device model code

**Response**:
```json
{
  "data": {
    "device": "AA:BB:CC:DD:EE:FF:GG:HH",
    "model": "H5179",
    "properties": [
      {
        "online": true,
        "temperature": 23.5,
        "humidity": 65.0
      }
    ]
  },
  "message": "Success",
  "code": 200
}
```

### PUT /v1/devices/control
Sends control command to device.

**Headers**:
```
Govee-API-Key: <api-key>
Content-Type: application/json
```

**Body**:
```json
{
  "device": "AA:BB:CC:DD:EE:FF:GG:HH",
  "model": "H6159",
  "cmd": {
    "name": "turn",
    "value": "on"
  }
}
```

**Available Commands**:
- `{"name": "turn", "value": "on"}` - Turn on
- `{"name": "turn", "value": "off"}` - Turn off
- `{"name": "brightness", "value": 75}` - Set brightness (0-100)
- `{"name": "color", "value": {"r": 255, "g": 0, "b": 0}}` - Set RGB color
- `{"name": "colorTem", "value": 5000}` - Set color temperature (2000-9000K)

## Testing

Comprehensive test suite with 25 test cases covering:
- Connection flow (6 tests)
- Sensor reading (5 tests)
- Device control (6 tests)
- Status checking (4 tests)
- Disconnect (1 test)
- Discovery (2 tests)
- Rate limiting (1 test)

See `__tests__/GoveeAdapter.test.ts` for full test implementation.
See `__tests__/GoveeAdapter.TEST_PLAN.md` for detailed test documentation.

## Integration with EnviroFlow

### Registration
The adapter is registered in `/apps/automation-engine/lib/adapters/index.ts`:

```typescript
case 'govee':
  return new GoveeAdapter()
```

### Brand Metadata
```typescript
{
  id: 'govee',
  name: 'Govee',
  description: 'H5179 WiFi Hygrometer, Smart LED Lights, Smart Plugs',
  requiresCredentials: true,
  credentialFields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Get from Govee Home app: Account > About Us > Apply for API Key'
    }
  ],
  capabilities: {
    sensors: ['temperature', 'humidity'],
    devices: ['light', 'outlet'],
    supportsDimming: true
  },
  marketShare: '15%',
  status: 'available'
}
```

### Supported Brands List
Added to `isBrandSupported()` function.

## Known Limitations

1. **No BLE Support**: Only WiFi-enabled devices are supported. BLE-only devices require mobile app.
2. **No Schedule API**: Govee API doesn't support creating/editing schedules (must use mobile app).
3. **Rate Limits**: Strict 60 req/min limit can impact real-time control in high-frequency scenarios.
4. **Color Commands**: RGB and color temperature commands not yet implemented (can be added).
5. **Single Device**: Currently connects to first device. Multi-device support requires deviceId parameter.

## Future Enhancements

- [ ] RGB color control for lights
- [ ] Color temperature control
- [ ] Multi-device selection support
- [ ] Sensor reading caching to reduce API calls
- [ ] Support for scene/mode commands
- [ ] Metric system option (Celsius instead of Fahrenheit)
- [ ] WebSocket support for real-time updates (if Govee adds it)

## Performance Considerations

### API Call Optimization
- **Caching**: Device metadata cached in memory
- **Rate Limiting**: Client-side enforcement prevents wasted API calls
- **Batch Operations**: Not supported by Govee API
- **Retry Strategy**: Exponential backoff reduces server load

### Memory Usage
- Minimal: One cache entry per connected device
- Cache cleared on disconnect
- No persistent storage required

### Network Efficiency
- **HTTPS**: All requests use TLS
- **JSON Payload**: Lightweight request/response format
- **Timeouts**: 15-second default prevents hanging requests

## Security

### API Key Storage
- Stored encrypted in database (AES-256-GCM)
- Never logged or exposed in responses
- Transmitted via HTTPS only

### Rate Limiting
- Prevents API abuse
- Protects user's API key from being rate-limited by Govee

### Error Messages
- User-friendly messages
- No sensitive data in error responses
- API key masked in logs

## Migration Notes

### From Previous Implementation
The previous Govee stub required BLE and was mobile-only. This implementation:
- Uses cloud API instead of BLE
- Works on web (no mobile app required)
- Supports device control (not just read-only)
- Implements full adapter interface

### Breaking Changes
None - this is a new implementation replacing a non-functional stub.

## References

- [Govee Developer API Documentation](https://govee-public.s3.amazonaws.com/developer-docs/GoveeDeveloperAPIReference.pdf)
- [Govee Home App](https://apps.apple.com/us/app/govee-home/id1395696823)
- [EnviroFlow Adapter Pattern](./types.ts)
- [Retry Utilities](./retry.ts)

## Changelog

### 2026-01-24 - Initial Implementation
- ✅ Created GoveeAdapter.ts
- ✅ Implemented ControllerAdapter interface
- ✅ Implemented DiscoverableAdapter interface
- ✅ Added comprehensive error handling
- ✅ Added rate limiting (60 req/min)
- ✅ Created test suite (25 tests)
- ✅ Updated adapter factory
- ✅ Updated brand metadata
- ✅ Temperature conversion (C→F)
- ✅ Circuit breaker integration
- ✅ Logging for debugging

## Support

For issues with the Govee adapter:
1. Check API key is valid (test in Govee Home app)
2. Verify device is WiFi-enabled (not BLE-only)
3. Check rate limit hasn't been exceeded
4. Review logs for API error codes
5. Consult Govee API documentation

For Govee API issues:
- Contact Govee support: support@govee.com
- Check Govee API status
