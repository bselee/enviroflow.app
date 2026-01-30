# AC Infinity Mode Programming API

**Status:** ✅ Implementation Complete
**Date:** 2026-01-25
**API Version:** v1.0

## Overview

This document describes the API endpoints for programming AC Infinity controller modes. The API allows users to view and configure device automation modes (OFF, ON, AUTO, VPD, TIMER, CYCLE, SCHEDULE) for each port on their AC Infinity controllers.

## Architecture

### Components Created

1. **Type Definitions** (`/apps/web/src/types/index.ts`)
   - `ModeConfiguration` - Complete mode configuration interface
   - `PortModeResponse` - Port mode information with current config
   - `ModesListResponse` - Response for all ports
   - `UpdatePortModeInput` - Input for mode updates

2. **API Routes**
   - `/api/controllers/[id]/modes` - All ports mode management
   - `/api/controllers/[id]/ports/[port]/mode` - Single port mode management

3. **Adapter Enhancement** (`/apps/automation-engine/lib/adapters/ACInfinityAdapter.ts`)
   - `setPortMode()` - New method to update port mode configurations
   - Maps EnviroFlow mode types to AC Infinity API format

## API Endpoints

### 1. GET /api/controllers/[id]/modes

Fetch current mode settings for all ports on a controller.

#### Request

```http
GET /api/controllers/{controller_id}/modes
Authorization: Bearer {token}
```

#### Response

```json
{
  "success": true,
  "controller_id": "uuid",
  "controller_name": "My AC Infinity Controller",
  "ports": [
    {
      "port": 1,
      "portName": "Exhaust Fan",
      "deviceType": "fan",
      "currentMode": {
        "mode": "auto",
        "tempTriggerHigh": 80,
        "tempTriggerLow": 70,
        "humidityTriggerHigh": 65,
        "humidityTriggerLow": 50,
        "deviceBehavior": "cooling",
        "maxLevel": 10,
        "minLevel": 3,
        "transitionEnabled": true,
        "transitionSpeed": 5,
        "bufferEnabled": true,
        "bufferValue": 2
      },
      "supportedModes": ["off", "on", "auto", "vpd", "timer", "cycle", "schedule"]
    },
    {
      "port": 2,
      "portName": "LED Light",
      "deviceType": "light",
      "currentMode": {
        "mode": "schedule",
        "scheduleStartTime": "06:00",
        "scheduleEndTime": "22:00",
        "scheduleDays": [1, 2, 3, 4, 5]
      },
      "supportedModes": ["off", "on", "timer", "schedule"]
    }
  ]
}
```

#### Rate Limits
- 20 requests per minute per user

---

### 2. POST /api/controllers/[id]/modes

Update mode configuration for a specific port.

#### Request

```http
POST /api/controllers/{controller_id}/modes
Authorization: Bearer {token}
Content-Type: application/json

{
  "port": 1,
  "mode": {
    "mode": "auto",
    "tempTriggerHigh": 80,
    "tempTriggerLow": 70,
    "deviceBehavior": "cooling",
    "maxLevel": 10,
    "minLevel": 3
  }
}
```

#### Response

```json
{
  "success": true,
  "controller_id": "uuid",
  "port": 1,
  "mode": {
    "mode": "auto",
    "tempTriggerHigh": 80,
    "tempTriggerLow": 70,
    "deviceBehavior": "cooling",
    "maxLevel": 10,
    "minLevel": 3
  },
  "message": "Port mode updated successfully"
}
```

#### Rate Limits
- 10 requests per minute per user

---

### 3. GET /api/controllers/[id]/ports/[port]/mode

Get mode configuration for a specific port.

#### Request

```http
GET /api/controllers/{controller_id}/ports/{port}/mode
Authorization: Bearer {token}
```

#### Response

```json
{
  "port": 1,
  "portName": "Exhaust Fan",
  "deviceType": "fan",
  "currentMode": {
    "mode": "vpd",
    "vpdTriggerHigh": 1.5,
    "vpdTriggerLow": 0.8,
    "leafTempOffset": -2,
    "maxLevel": 10,
    "minLevel": 2,
    "transitionEnabled": true,
    "transitionSpeed": 10
  },
  "supportedModes": ["off", "on", "auto", "vpd", "timer", "cycle", "schedule"]
}
```

#### Rate Limits
- 20 requests per minute per user

---

### 4. PUT /api/controllers/[id]/ports/[port]/mode

Update mode configuration for a specific port (alternative endpoint).

#### Request

```http
PUT /api/controllers/{controller_id}/ports/{port}/mode
Authorization: Bearer {token}
Content-Type: application/json

{
  "mode": "timer",
  "timerType": "on",
  "timerDuration": 3600
}
```

#### Response

```json
{
  "success": true,
  "controller_id": "uuid",
  "port": 1,
  "mode": {
    "mode": "timer",
    "timerType": "on",
    "timerDuration": 3600
  },
  "message": "Port 1 mode updated to timer"
}
```

#### Rate Limits
- 10 requests per minute per user

---

## Mode Configuration Types

### Mode: OFF

Turns the device off completely.

```typescript
{
  "mode": "off"
}
```

---

### Mode: ON

Sets device to constant power level (0-10).

```typescript
{
  "mode": "on",
  "level": 7  // 0-10 scale
}
```

---

### Mode: AUTO

Triggers device based on temperature and/or humidity thresholds.

```typescript
{
  "mode": "auto",

  // Temperature triggers (Fahrenheit)
  "tempTriggerHigh": 80,
  "tempTriggerLow": 70,

  // Humidity triggers (percentage)
  "humidityTriggerHigh": 65,
  "humidityTriggerLow": 50,

  // Device behavior
  "deviceBehavior": "cooling" | "heating" | "humidify" | "dehumidify",

  // Power level range
  "maxLevel": 10,  // 0-10
  "minLevel": 3,   // 0-10

  // Transition settings
  "transitionEnabled": true,
  "transitionSpeed": 5,  // seconds

  // Buffer zone (hysteresis)
  "bufferEnabled": true,
  "bufferValue": 2  // degrees/percentage
}
```

---

### Mode: VPD

Triggers device based on Vapor Pressure Deficit (VPD) calculations.

```typescript
{
  "mode": "vpd",

  // VPD triggers (kPa)
  "vpdTriggerHigh": 1.5,
  "vpdTriggerLow": 0.8,

  // Leaf temperature offset (Fahrenheit)
  "leafTempOffset": -2,

  // Power level range
  "maxLevel": 10,
  "minLevel": 2,

  // Transition settings
  "transitionEnabled": true,
  "transitionSpeed": 10
}
```

---

### Mode: TIMER

Runs device for a specific duration.

```typescript
{
  "mode": "timer",

  // Timer type
  "timerType": "on" | "off",

  // Duration in seconds
  "timerDuration": 3600  // 1 hour
}
```

---

### Mode: CYCLE

Cycles device on/off with specified durations.

```typescript
{
  "mode": "cycle",

  // Cycle durations (seconds)
  "cycleOnDuration": 900,   // 15 minutes on
  "cycleOffDuration": 300   // 5 minutes off
}
```

---

### Mode: SCHEDULE

Runs device on a daily schedule with specific days.

```typescript
{
  "mode": "schedule",

  // Time range (HH:MM format, 24-hour)
  "scheduleStartTime": "06:00",
  "scheduleEndTime": "22:00",

  // Days of week (0=Sunday, 6=Saturday)
  "scheduleDays": [1, 2, 3, 4, 5]  // Monday-Friday
}
```

---

## Supported Modes by Device Type

| Device Type | Supported Modes |
|-------------|----------------|
| **Fan** | off, on, auto, vpd, timer, cycle, schedule |
| **Outlet** | off, on, auto, vpd, timer, cycle, schedule |
| **Light** | off, on, timer, schedule |
| **Heater** | off, on, auto |
| **Cooler** | off, on, auto |
| **Humidifier** | off, on, auto |
| **Dehumidifier** | off, on, auto |

---

## Error Responses

### 400 Bad Request

Invalid input or unsupported operation.

```json
{
  "error": "Mode programming is only supported for AC Infinity controllers",
  "brand": "inkbird"
}
```

### 401 Unauthorized

Missing or invalid authentication token.

```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found

Controller or port not found.

```json
{
  "error": "Controller not found or access denied"
}
```

### 429 Too Many Requests

Rate limit exceeded.

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many mode update requests. Please try again later.",
  "retryAfter": 45
}
```

### 500 Internal Server Error

Credential decryption failure or server error.

```json
{
  "success": false,
  "error": "Failed to access controller credentials. Please re-add the controller."
}
```

### 503 Service Unavailable

Controller offline or unreachable.

```json
{
  "success": false,
  "error": "Failed to connect to controller: Network timeout"
}
```

---

## Implementation Details

### AC Infinity API Mapping

The adapter translates EnviroFlow mode configurations to AC Infinity's cloud API format:

| EnviroFlow | AC Infinity API | Notes |
|------------|----------------|-------|
| `mode: "off"` | `mode: 0` | |
| `mode: "on"` | `mode: 1` | |
| `mode: "auto"` | `mode: 2` | |
| `mode: "timer"` | `mode: 3` | |
| `mode: "cycle"` | `mode: 4` | |
| `mode: "schedule"` | `mode: 5` | |
| `mode: "vpd"` | `mode: 6` | |
| `level: 7` | `speak: 7` | 0-10 scale |
| `tempTriggerHigh: 80` | `tempTriggerHigh: 8000` | F × 100 |
| `humidityTriggerHigh: 65` | `humidityTriggerHigh: 6500` | % × 100 |
| `vpdTriggerHigh: 1.5` | `vpdTriggerHigh: 150` | kPa × 100 |
| `scheduleDays: [0,1,2]` | `scheduleDays: 7` | Bitmask |

### Authentication Flow

1. API validates Bearer token via Supabase Auth
2. API retrieves controller record from database
3. API decrypts stored AC Infinity credentials (AES-256-GCM)
4. Adapter connects to AC Infinity cloud API with credentials
5. Adapter performs operation and returns result
6. API logs activity to `activity_logs` table

### Security

- All credentials are encrypted at rest using AES-256-GCM
- Rate limiting prevents abuse
- Row-Level Security (RLS) enforces user ownership
- Activity logging tracks all mode changes
- Tokens expire after 24 hours

---

## Usage Examples

### Example 1: Set Fan to AUTO Mode

```javascript
const response = await fetch(`/api/controllers/${controllerId}/modes`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    port: 1,
    mode: {
      mode: 'auto',
      tempTriggerHigh: 78,
      tempTriggerLow: 72,
      deviceBehavior: 'cooling',
      maxLevel: 10,
      minLevel: 4,
      transitionEnabled: true,
      transitionSpeed: 8,
      bufferEnabled: true,
      bufferValue: 2
    }
  })
})

const result = await response.json()
console.log(result.success) // true
```

### Example 2: Set Light to Schedule Mode

```javascript
const response = await fetch(`/api/controllers/${controllerId}/ports/2/mode`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mode: 'schedule',
    scheduleStartTime: '07:00',
    scheduleEndTime: '21:00',
    scheduleDays: [1, 2, 3, 4, 5, 6, 7] // Every day
  })
})

const result = await response.json()
console.log(result.message) // "Port 2 mode updated to schedule"
```

### Example 3: Get All Port Modes

```javascript
const response = await fetch(`/api/controllers/${controllerId}/modes`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const result = await response.json()
result.ports.forEach(port => {
  console.log(`Port ${port.port} (${port.portName}): ${port.currentMode.mode}`)
})
```

---

## Testing

### Manual Testing Checklist

- [ ] GET /api/controllers/[id]/modes returns all port modes
- [ ] POST /api/controllers/[id]/modes updates port mode
- [ ] GET /api/controllers/[id]/ports/[port]/mode returns single port mode
- [ ] PUT /api/controllers/[id]/ports/[port]/mode updates single port mode
- [ ] Rate limiting works (returns 429 after threshold)
- [ ] Invalid controller ID returns 404
- [ ] Non-AC Infinity controller returns 400
- [ ] Invalid port number returns 400
- [ ] Unauthorized request returns 401
- [ ] Activity logging works for mode updates
- [ ] Each mode type (OFF, ON, AUTO, VPD, TIMER, CYCLE, SCHEDULE) works correctly

### Integration Testing

Test with actual AC Infinity controller to verify:
- Mode changes are applied correctly
- Device responds to mode triggers
- Transition settings work as expected
- Schedule executes at correct times
- VPD calculations are accurate

---

## Future Enhancements

1. **Bulk Mode Updates**
   - Update multiple ports in a single request
   - Template-based mode configurations

2. **Mode Presets**
   - Save/load mode configurations as presets
   - Share presets between controllers

3. **Mode History**
   - Track mode change history
   - Analytics on mode performance

4. **Advanced Scheduling**
   - Seasonal schedules
   - Growth stage-specific modes
   - Astronomical time (sunrise/sunset)

5. **Mode Testing**
   - Dry-run mode changes
   - Simulate mode behavior before applying

---

## Files Modified/Created

### Created Files
1. `/apps/web/src/app/api/controllers/[id]/modes/route.ts` (GET, POST)
2. `/apps/web/src/app/api/controllers/[id]/ports/[port]/mode/route.ts` (GET, PUT)

### Modified Files
1. `/apps/web/src/types/index.ts` - Added mode configuration types
2. `/apps/automation-engine/lib/adapters/types.ts` - Added ModeConfiguration interface
3. `/apps/automation-engine/lib/adapters/ACInfinityAdapter.ts` - Added setPortMode() method

---

## References

- [AC Infinity API Documentation](https://github.com/dalinicus/homeassistant-acinfinity) (reverse-engineered)
- [EnviroFlow MVP Spec v2.0](/docs/spec/EnviroFlow_MVP_Spec_v2.0.md)
- [Controller Adapter Pattern](/apps/automation-engine/lib/adapters/README.md)

---

**Last Updated:** 2026-01-25
**Maintainer:** EnviroFlow Development Team
