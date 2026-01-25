# Error Guidance Examples

Visual examples of how errors are displayed with the new Error Guidance System.

## 1. Credentials Error

**API Response:**
```json
{
  "success": false,
  "error": "Invalid email or password",
  "errorType": "credentials",
  "retryable": false
}
```

**UI Display:**
```
┌─────────────────────────────────────────────────────┐
│ [🔑] Authentication Failed                          │
│                                                     │
│ Invalid email or password                          │
│                                                     │
│ ✓ Use the same email and password you use to      │
│   log into the AC Infinity app. If you recently   │
│   changed your password, use the new one.          │
│                                                     │
│ ▼ Show troubleshooting steps                       │
│                                                     │
│ [Update Credentials] [View Guide →]                │
└─────────────────────────────────────────────────────┘
```

**Expanded:**
```
┌─────────────────────────────────────────────────────┐
│ [🔑] Authentication Failed                          │
│                                                     │
│ Invalid email or password                          │
│                                                     │
│ ✓ Use the same email and password...              │
│                                                     │
│ ▲ Hide troubleshooting steps                       │
│ ─────────────────────────────────────────────────  │
│ 2. Double-check your email address is correct     │
│ 3. Verify your password (try logging into the     │
│    official app)                                   │
│ 4. If you recently changed your password, use     │
│    the new one                                     │
│ 5. Some brands require API keys instead of        │
│    passwords                                       │
│ 6. Reset your password if you've forgotten it     │
│                                                     │
│ [Get more help →]  Contact: support@enviroflow.app │
│                                                     │
│ [Update Credentials] [View Guide →]                │
└─────────────────────────────────────────────────────┘
```

## 2. Network Error

**API Response:**
```json
{
  "success": false,
  "error": "Failed to connect to API",
  "errorType": "network",
  "retryable": true,
  "retryAfter": 5
}
```

**UI Display:**
```
┌─────────────────────────────────────────────────────┐
│ [📡] Connection Problem                             │
│                                                     │
│ Failed to connect to API                           │
│                                                     │
│ ✓ Check your internet connection is working       │
│                                                     │
│ ▼ Show troubleshooting steps                       │
│                                                     │
│ Wait 5s before retrying               [Try Again]  │
└─────────────────────────────────────────────────────┘
```

## 3. Offline Device

**API Response:**
```json
{
  "success": false,
  "error": "Controller is offline",
  "errorType": "offline",
  "retryable": true,
  "retryAfter": 30
}
```

**UI Display:**
```
┌─────────────────────────────────────────────────────┐
│ [⚡] Device Offline                                 │
│                                                     │
│ Controller is offline                              │
│                                                     │
│ ✓ Check if the controller is powered on and       │
│   display is lit                                   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ Last seen: 2 hours ago                      │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ▼ Show troubleshooting steps                       │
│ ▼ Show connection diagnostics                      │
│                                                     │
│ Wait 30s before retrying          [Refresh Status] │
└─────────────────────────────────────────────────────┘
```

**With Diagnostics Expanded:**
```
┌─────────────────────────────────────────────────────┐
│ [⚡] Device Offline                                 │
│ ...                                                │
│                                                     │
│ ▲ Hide connection diagnostics                      │
│ ─────────────────────────────────────────────────  │
│ AC Infinity Connection Diagnostics                 │
│                                                     │
│ 1. Verify controller compatibility                │
│    Check if your controller model supports WiFi/  │
│    cloud features                                  │
│    ├─ Expected: Controller should be 69 WiFi,     │
│    │            69 Pro, 69 Pro+, or AI+ model     │
│    └─ Troubleshoot: Bluetooth-only controllers    │
│                     (67, base 69) are NOT         │
│                     supported. Upgrade to a       │
│                     WiFi-capable model.           │
│                                                     │
│ 2. Check WiFi connection                          │
│    Verify the controller is connected to your     │
│    2.4GHz WiFi network                            │
│    ├─ Expected: WiFi/cloud icon should be visible │
│    │            on the controller screen          │
│    └─ Troubleshoot: AC Infinity controllers only  │
│                     support 2.4GHz WiFi, not      │
│                     5GHz. Reconnect via the AC    │
│                     Infinity app.                 │
│ ...                                                │
└─────────────────────────────────────────────────────┘
```

## 4. Rate Limit Error

**API Response:**
```json
{
  "success": false,
  "error": "Too many requests",
  "errorType": "rate_limit",
  "retryable": true,
  "retryAfter": 60
}
```

**UI Display:**
```
┌─────────────────────────────────────────────────────┐
│ [⏰] Too Many Requests                              │
│                                                     │
│ Too many requests                                  │
│                                                     │
│ ✓ You've made too many requests in a short time   │
│                                                     │
│ ▼ Show troubleshooting steps                       │
│                                                     │
│ Wait 60s before retrying          [Wait & Retry]   │
└─────────────────────────────────────────────────────┘
```

## 5. Server Error

**API Response:**
```json
{
  "success": false,
  "error": "Internal server error",
  "errorType": "server",
  "retryable": true,
  "retryAfter": 30
}
```

**UI Display:**
```
┌─────────────────────────────────────────────────────┐
│ [🔧] Service Temporarily Unavailable                │
│                                                     │
│ Internal server error                              │
│                                                     │
│ ✓ The controller brand's servers are experiencing │
│   issues                                           │
│                                                     │
│ ▼ Show troubleshooting steps                       │
│                                                     │
│ Wait 30s before retrying              [Try Again]  │
└─────────────────────────────────────────────────────┘
```

## 6. Compact Mode (Inline)

**Usage:**
```tsx
<ErrorGuidance
  error="Connection failed"
  brand="ac_infinity"
  compact
  onRetry={handleRetry}
/>
```

**UI Display:**
```
┌──────────────────────────────────────────────────┐
│ [📡] Connection Problem                          │
│ Check your internet connection is working    [↻] │
└──────────────────────────────────────────────────┘
```

## 7. Connection Status Component

**Usage:**
```tsx
<ConnectionStatus
  status="offline"
  error="Controller not responding"
  lastSeen={controller.last_seen}
  brand={controller.brand}
  onRetry={handleRefresh}
/>
```

**UI Display:**
```
┌──────────────────────────────────────────────────┐
│ ● Offline  (Last seen: 2 hours ago)             │
│                                                  │
│ [⚡] Device Offline                              │
│ Check if the controller is powered on...    [↻] │
└──────────────────────────────────────────────────┘
```

## 8. Mobile Layout

All error guidance components are mobile-responsive:

```
Mobile (< 640px):
┌─────────────────────────┐
│ [🔑] Authentication     │
│     Failed              │
│                         │
│ Invalid credentials     │
│                         │
│ ✓ Double-check your    │
│   email...              │
│                         │
│ ▼ Show steps            │
│                         │
│ [Update Credentials]    │
│ [View Guide →]          │
└─────────────────────────┘

Compact on mobile:
┌─────────────────────────┐
│ [📡] Connection Problem │
│ Check internet... [↻]  │
└─────────────────────────┘
```

## Color Coding

- **Credentials:** Amber (⚠️)
- **Network:** Red (❌)
- **Offline:** Gray (⚫)
- **Rate Limit:** Amber (⚠️)
- **Server:** Red (❌)

## Icon Mapping

- Credentials: 🔑 (KeyRound)
- Network: 📡 (WifiOff)
- Offline: ⚡ (PowerOff)
- Rate Limit: ⏰ (Clock)
- Server: 🔧 (ServerCrash)

## Interaction Flow

```
User encounters error
    ↓
ErrorGuidance displays with:
  - Error icon + title
  - Plain language message
  - First troubleshooting step
  - Collapsed sections
    ↓
User clicks "Show troubleshooting steps"
    ↓
Reveals:
  - All troubleshooting steps
  - Help links
  - Support contact
    ↓
User clicks "Show connection diagnostics"
    ↓
Reveals:
  - Step-by-step verification
  - Expected results
  - Troubleshooting tips
    ↓
User clicks "Retry" or "Update Credentials"
    ↓
Action performed:
  - Retry → onRetry callback
  - Update Credentials → Navigate to edit page
  - Login → Navigate to login page
  - Refresh → Reload or retry
```

## Real-World Examples

### Controller Discovery Failed
```tsx
<ErrorGuidance
  error="No devices found"
  brand="ac_infinity"
  context="discovery"
  showDiagnostics
/>
```

Shows:
- "Make sure you have devices registered in the AC Infinity app"
- Connection diagnostics for AC Infinity
- Link to AC Infinity support

### Device Control Failed
```tsx
<ErrorGuidance
  error="Failed to turn on device"
  brand="ecowitt"
  context="device_control"
  controllerId={controller.id}
  compact
  onRetry={handleRetry}
/>
```

Shows:
- Inline compact error
- Retry button
- Ecowitt-specific guidance

### Sensor Reading Failed
```tsx
<ErrorGuidance
  error="Timeout reading sensors"
  brand="mqtt"
  context="sensors"
  controllerId={controller.id}
  onRetry={handleRefreshSensors}
/>
```

Shows:
- Network troubleshooting
- MQTT-specific steps
- Retry with 5s delay
