# EnviroFlow Architecture (AUTHORITATIVE)

> ⚠️ **AI CODERS: This is the ONLY architecture document to follow.**
> All other architecture docs in `/docs/spec/Controllers/` are **ARCHIVED**.
> If you see conflicting patterns, follow THIS document.

## Executive Summary

EnviroFlow uses **Direct API Polling** (like Home Assistant) for sensor data.
- ✅ Supabase = **storage only** (credentials, history, user config)
- ❌ Supabase ≠ real-time subscriptions for sensor data
- ✅ Frontend polls `/api/sensors/live` every 10-30 seconds
- ✅ API route calls AC Infinity cloud API directly

## Proven Architecture (Tested 2026-02-02)

```
┌─────────────────────┐     polls every 30s      ┌─────────────────────┐
│  LiveSensorDashboard│ ────────────────────────▶│  /api/sensors/live  │
│  (React + useState) │                          │  (Next.js API Route)│
│                     │ ◀────────────────────────│                     │
└─────────────────────┘     returns JSON         └──────────┬──────────┘
                                                            │
                                                    calls directly
                                                            │
                                                            ▼
                                                 ┌─────────────────────┐
                                                 │  AC Infinity Cloud  │
                                                 │  acinfinityserver.com│
                                                 └─────────────────────┘
```

## Why This Architecture (Proof)

### Home Assistant Success
Home Assistant's AC Infinity integration has worked reliably for 3+ years because:
- **Polls every 5 seconds** (not waiting for push notifications)
- **Stores state in memory** (not external database)
- **Simple auth** (email/password → token)
- **No WebSocket subscriptions** (polling is more reliable for IoT)

### EnviroFlow Proof (2026-02-02)
```bash
# This command returns real sensor data:
curl http://localhost:3000/api/sensors/live

# Response:
{
  "sensors": [
    {"id": "1424979258063370322", "name": "Red Room", "temperature": 21.45, "humidity": 48.88, "vpd": 1.3},
    {"id": "1424979258063418108", "name": "Lil Dry Guy", "temperature": 17.76, "humidity": 50.96, "vpd": 0.99},
    {"id": "1424979258063365808", "name": "Biggie", "temperature": 25.24, "humidity": 52.56, "vpd": 1.52}
  ],
  "count": 3,
  "responseTimeMs": 272
}
```

## Supabase Role: STORAGE ONLY

| ✅ Use Supabase For | ❌ NEVER Use Supabase For |
|---------------------|---------------------------|
| User authentication (login/signup) | Live sensor data subscriptions |
| Storing AC Infinity credentials (encrypted) | "Single source of truth" for live data |
| 90-day sensor history (for charts) | Complex RLS with JOINs for sensor reads |
| Room/controller configuration | Real-time channels for sensor_readings |
| User preferences | State management |

## Required Code Patterns

### ✅ CORRECT: Direct API Polling (LiveSensorDashboard pattern)

```typescript
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export function SensorDashboard() {
  const [sensors, setSensors] = useState<LiveSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSensors = useCallback(async () => {
    try {
      const response = await fetch('/api/sensors/live');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSensors(data.sensors);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSensors(); // Initial fetch
    
    // Poll every 30 seconds
    intervalRef.current = setInterval(fetchSensors, 30000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSensors]);

  // Render sensors...
}
```

### ❌ FORBIDDEN: Supabase Realtime Subscriptions for Sensors

```typescript
// ❌ NEVER DO THIS - causes "data appears then disappears"
const channel = supabase
  .channel('sensor-updates')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'sensor_readings' 
  }, callback)
  .subscribe();

// Why it fails:
// 1. RLS policies require complex JOINs that fail in Realtime context
// 2. ChannelRateLimitReached errors when many sensors update
// 3. Connection drops cause data to disappear
// 4. Adds unnecessary complexity vs simple polling
```

### ✅ CORRECT: API Route Pattern

```typescript
// /api/sensors/live/route.ts
export async function GET(request: NextRequest) {
  // 1. Get token (env vars first, then database)
  const token = await getACInfinityToken();
  
  // 2. Call AC Infinity API DIRECTLY
  const response = await fetch('http://www.acinfinityserver.com/api/user/devInfoListAll', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'token': token,
      'User-Agent': 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
    },
    body: new URLSearchParams({ userId: token }).toString(),
  });
  
  // 3. Parse and return
  const data = await response.json();
  return NextResponse.json({ sensors: transformDevices(data.data) });
}
```

## Authentication Priority

Token acquisition follows this order (first success wins):

1. **`AC_INFINITY_TOKEN` env var** - Manual token (for testing)
2. **`AC_INFINITY_EMAIL` + `AC_INFINITY_PASSWORD` env vars** - Direct login
3. **Database credentials** - From `controllers` table (multi-user)

### Environment Variables Required

```env
# Option A: Direct credentials (simplest, single-user)
AC_INFINITY_EMAIL=your-email@example.com
AC_INFINITY_PASSWORD=your-password

# Option B: Manual token (for testing)
AC_INFINITY_TOKEN=1705551813000794113

# Supabase (for storage, optional for live data)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Data Flow Diagrams

### Live Dashboard (Real-time Monitoring)

```
User opens Dashboard
        │
        ▼
LiveSensorDashboard mounts
        │
        ▼
useEffect calls fetchSensors()
        │
        ▼
fetch('/api/sensors/live')
        │
        ▼
API route: getACInfinityToken()
        │
        ├── Check AC_INFINITY_TOKEN env var
        ├── Check AC_INFINITY_EMAIL/PASSWORD env vars
        └── Check database controllers table
        │
        ▼
API route: fetch(acinfinityserver.com)
        │
        ▼
Parse deviceInfo.temperature, humidity, vpdnums
        │
        ▼
Return JSON to frontend
        │
        ▼
setSensors(data.sensors)
        │
        ▼
React re-renders with real data
        │
        ▼
setInterval(fetchSensors, 30000) keeps polling
```

### Device Control (Future)

```
User clicks "Set Fan Speed 7"
        │
        ▼
POST /api/devices/[deviceId]/control
        │
        ▼
API route: getACInfinityToken()
        │
        ▼
API route: fetch(acinfinityserver.com/api/dev/setPortSetting)
        │
        ▼
Return success/failure
        │
        ▼
Optimistic UI update OR refetch sensors
```

## File Reference

### Core Files (Follow This Pattern)

| File | Purpose | Pattern |
|------|---------|---------|
| `components/LiveSensorDashboard.tsx` | Live sensor display | useState + setInterval + fetch |
| `app/api/sensors/live/route.ts` | Fetch from AC Infinity | Direct API call, no DB for live data |
| `lib/ac-infinity-token-manager.ts` | Token acquisition | Env vars first, then DB |

### Files Needing Migration (Use Polling Instead)

| File | Current Issue | Fix |
|------|---------------|-----|
| `hooks/useDashboardData.ts` | Uses Supabase Realtime | Use polling or one-time fetch |
| `hooks/use-sensor-readings.ts` | Realtime subscriptions | Already has polling fallback - make it primary |
| `hooks/use-rooms.ts` | Realtime subscriptions | One-time fetch (rooms don't change often) |

## Cron Jobs (For Historical Data Only)

Cron jobs write to Supabase for **historical charts**, NOT for live display:

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/poll-sensors", "schedule": "*/5 * * * *" }
  ]
}
```

The cron writes to `sensor_readings` table, which is used by:
- Historical charts (last 24h, 7d, 30d)
- Alert threshold checking
- NOT live dashboard (that uses direct API)

## Testing Checklist

Before deploying, verify:

- [ ] `curl http://localhost:3000/api/sensors/live` returns sensor data
- [ ] Dashboard shows sensors immediately on load
- [ ] Data persists (doesn't disappear after a few seconds)
- [ ] 30-second refresh updates values
- [ ] No "ChannelRateLimitReached" errors in console
- [ ] Works with only `AC_INFINITY_EMAIL/PASSWORD` env vars (no Supabase needed for live data)

## Archived Documents

These documents contain outdated or conflicting patterns:

- `docs/spec/Controllers/ha-acinfinity.md` - ARCHIVED
- `docs/spec/Controllers/vercel-direct-api.md` - ARCHIVED
- `docs/spec/Controllers/ACInfinity.md` - Reference only, not architecture

## Changelog

- **2026-02-02**: Initial authoritative architecture. Fixed `extractSensorData` to read from `deviceInfo` object. Verified with real AC Infinity devices.
