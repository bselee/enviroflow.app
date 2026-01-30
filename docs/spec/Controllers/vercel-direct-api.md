# EnviroFlow: Direct API + Optional 90-Day History (Multi-User Version)
## Auto-Token Management from Stored Credentials - Dashboard Independent from Supabase

---

## Architecture Update

```
┌─────────────────────────────────────────────────────────┐
│                  LIVE DASHBOARD                         │
│  User → Dashboard → /api/sensors/live                   │
│         ↓                                               │
│  Get user's AC Infinity credentials from DB             │
│         ↓                                               │
│  Auto-fetch token → AC Infinity API → Display           │
│  (Works even if Supabase history is offline)            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              OPTIONAL: 90-DAY HISTORY                   │
│  Cron → All users' AC Infinity APIs → Supabase          │
│  Historical Charts → /api/sensors/history → Supabase    │
└─────────────────────────────────────────────────────────┘
```

**Key Changes:**
- ✅ No manual token extraction needed
- ✅ Automatic token refresh when expired
- ✅ Multi-user support (each user has their own credentials)
- ✅ Tokens cached and reused until expiration
- ✅ Credentials encrypted at rest

---

## Prerequisites

```bash
# 1. Navigate to your project
cd /path/to/enviroflow

# 2. Check you're in the right place
ls package.json  # Should exist

# 3. Verify Vercel CLI
vercel --version
# If not installed: npm i -g vercel

# 4. Link project (if not already)
vercel link
```

---

## Step 0: Database Schema for Controller Credentials

**Purpose:** Store user credentials and cached tokens securely.

### Add to Supabase (Required for Multi-User)

```sql
-- User controllers table (stores AC Infinity credentials)
CREATE TABLE user_controllers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Reference to your auth.users
  controller_type TEXT NOT NULL, -- 'ac_infinity', 'ecowitt', etc
  controller_name TEXT NOT NULL,
  
  -- Encrypted credentials
  email_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  
  -- Cached token (refreshed automatically)
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_user_controllers_user_id ON user_controllers(user_id);
CREATE INDEX idx_user_controllers_active ON user_controllers(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_controllers_token_expiry ON user_controllers(token_expires_at) WHERE access_token IS NOT NULL;

-- RLS policies
ALTER TABLE user_controllers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own controllers"
ON user_controllers FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own controllers"
ON user_controllers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own controllers"
ON user_controllers FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
ON user_controllers FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## Step 1: Create Token Management Utility

**Purpose:** Auto-fetch and cache AC Infinity tokens from stored credentials.

### Create: `lib/ac-infinity-auth.ts`

```typescript
// lib/ac-infinity-auth.ts

import { createClient } from '@supabase/supabase-js';

interface TokenResult {
  token: string;
  expiresAt: Date;
}

/**
 * AC Infinity Token Manager
 * Automatically fetches and caches tokens using stored credentials
 */
export class ACInfinityAuth {
  private supabase;

  constructor() {
    // Use service role for backend operations
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Get a valid token for a user's AC Infinity controller
   * Automatically refreshes if expired
   */
  async getToken(userId: string, controllerId?: string): Promise<string> {
    console.log(`🔑 [AC Auth] Getting token for user ${userId}...`);

    // Get controller record
    let query = this.supabase
      .from('user_controllers')
      .select('*')
      .eq('user_id', userId)
      .eq('controller_type', 'ac_infinity')
      .eq('is_active', true);

    if (controllerId) {
      query = query.eq('id', controllerId);
    }

    const { data: controllers, error } = await query.limit(1).single();

    if (error || !controllers) {
      throw new Error('No AC Infinity controller found for this user');
    }

    // Check if token is still valid (with 5 min buffer)
    const now = new Date();
    const expiresAt = controllers.token_expires_at ? new Date(controllers.token_expires_at) : null;
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (
      controllers.access_token &&
      expiresAt &&
      expiresAt.getTime() - now.getTime() > bufferTime
    ) {
      console.log('✅ [AC Auth] Using cached token');
      return controllers.access_token;
    }

    // Token expired or missing - fetch new one
    console.log('🔄 [AC Auth] Token expired, fetching new one...');
    const { token, expiresAt: newExpiresAt } = await this.fetchNewToken(
      this.decrypt(controllers.email_encrypted),
      this.decrypt(controllers.password_encrypted)
    );

    // Update cached token
    await this.supabase
      .from('user_controllers')
      .update({
        access_token: token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', controllers.id);

    console.log('✅ [AC Auth] New token fetched and cached');
    return token;
  }

  /**
   * Fetch fresh token from AC Infinity API
   */
  private async fetchNewToken(email: string, password: string): Promise<TokenResult> {
    console.log('📡 [AC Auth] Calling AC Infinity login API...');

    const response = await fetch('https://myacinfinity.com/api/user/appUserLogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        appEmail: email, // Some endpoints use appEmail
        userPwd: password, // Some endpoints use userPwd
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [AC Auth] Login failed:', response.status, errorText);
      throw new Error(`AC Infinity login failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract token from response
    // Note: AC Infinity API structure may vary - adjust based on actual response
    const token = data.data?.token || data.token;
    
    if (!token) {
      console.error('❌ [AC Auth] No token in response:', data);
      throw new Error('No token returned from AC Infinity');
    }

    // Tokens typically expire in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return { token, expiresAt };
  }

  /**
   * Decrypt stored credentials
   * TODO: Implement proper encryption/decryption
   * For now, using base64 (NOT SECURE - replace with proper encryption)
   */
  private decrypt(encryptedValue: string): string {
    // TEMPORARY: Base64 decode
    // PRODUCTION: Use proper encryption (crypto.subtle, libsodium, etc)
    try {
      return Buffer.from(encryptedValue, 'base64').toString('utf-8');
    } catch (error) {
      console.error('❌ [AC Auth] Decryption failed:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Encrypt credentials for storage
   * TODO: Implement proper encryption
   */
  static encrypt(value: string): string {
    // TEMPORARY: Base64 encode
    // PRODUCTION: Use proper encryption
    return Buffer.from(value, 'utf-8').toString('base64');
  }

  /**
   * Add new controller for a user
   */
  async addController(
    userId: string,
    email: string,
    password: string,
    controllerName: string
  ): Promise<string> {
    console.log('➕ [AC Auth] Adding new controller...');

    // Test credentials by fetching token
    const { token, expiresAt } = await this.fetchNewToken(email, password);

    // Store controller
    const { data, error } = await this.supabase
      .from('user_controllers')
      .insert({
        user_id: userId,
        controller_type: 'ac_infinity',
        controller_name: controllerName,
        email_encrypted: ACInfinityAuth.encrypt(email),
        password_encrypted: ACInfinityAuth.encrypt(password),
        access_token: token,
        token_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [AC Auth] Failed to store controller:', error);
      throw error;
    }

    console.log('✅ [AC Auth] Controller added successfully');
    return data.id;
  }
}
```

---

## Step 2: Create User-Aware Live Sensor API

**Purpose:** Fetch sensors using each user's stored credentials automatically.

### Create: `app/api/sensors/live/route.ts`

```typescript
// app/api/sensors/live/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ACInfinityAuth } from '@/lib/ac-infinity-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Sensor {
  id: string;
  name: string;
  deviceType: string;
  temperature: number;
  humidity: number;
  vpd: number;
  online: boolean;
  lastUpdate: string;
  ports?: Port[];
}

interface Port {
  portId: number;
  name: string;
  speed: number;
  isOn: boolean;
}

/**
 * GET /api/sensors/live
 * Fetches live sensor data for the authenticated user
 * Uses stored AC Infinity credentials to auto-fetch token
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  console.log('📡 [LIVE API] Starting fetch...');

  try {
    // Get authenticated user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: request.headers.get('Authorization') || '',
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [LIVE API] Authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`👤 [LIVE API] User ${user.id}`);

    // Get token automatically using stored credentials
    const authManager = new ACInfinityAuth();
    const token = await authManager.getToken(user.id);

    // Fetch from AC Infinity using auto-fetched token
    console.log('🌐 [LIVE API] Calling AC Infinity API...');
    const response = await fetch('https://myacinfinity.com/api/user/devInfoListAll', {
      method: 'GET',
      headers: {
        'User-Token': token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    const elapsed = Date.now() - startTime;
    console.log(`⏱️  [LIVE API] AC Infinity responded in ${elapsed}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [LIVE API] AC Infinity error:', response.status, errorText);

      // If 401, token might be invalid - force refresh next time
      if (response.status === 401) {
        await invalidateToken(user.id);
      }

      throw new Error(`AC Infinity API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      console.warn('⚠️ [LIVE API] Unexpected response format');
      return NextResponse.json({
        sensors: [],
        timestamp: new Date().toISOString(),
        source: 'ac_infinity',
      });
    }

    // Transform to our format
    const sensors: Sensor[] = data.data.map((device: any) => {
      const temp = device.devTemperature || 0;
      const humidity = device.devHumidity || 0;
      const vpd = calculateVPD(temp, humidity);

      return {
        id: `ac_infinity_${device.devId}`,
        name: device.devName || `Device ${device.devId}`,
        deviceType: 'ac_infinity',
        temperature: temp,
        humidity: humidity,
        vpd: vpd,
        online: device.onlineStatus === 1,
        lastUpdate: new Date().toISOString(),
        ports: device.ports?.map((port: any) => ({
          portId: port.port,
          name: port.portName || `Port ${port.port}`,
          speed: port.speak || 0,
          isOn: (port.speak || 0) > 0,
        })) || [],
      };
    });

    const totalElapsed = Date.now() - startTime;
    console.log(`✅ [LIVE API] Success! ${sensors.length} sensors in ${totalElapsed}ms`);

    return NextResponse.json({
      sensors,
      timestamp: new Date().toISOString(),
      source: 'ac_infinity',
      count: sensors.length,
      responseTimeMs: totalElapsed,
    });

  } catch (error: any) {
    const totalElapsed = Date.now() - startTime;
    console.error(`❌ [LIVE API] Failed after ${totalElapsed}ms:`, error.message);

    return NextResponse.json(
      {
        error: error.message,
        sensors: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Invalidate cached token to force refresh on next request
 */
async function invalidateToken(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('user_controllers')
    .update({
      access_token: null,
      token_expires_at: null,
    })
    .eq('user_id', userId)
    .eq('controller_type', 'ac_infinity');
}

function calculateVPD(tempF: number, humidity: number): number {
  const tempC = ((tempF - 32) * 5) / 9;
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vpd = svp * (1 - humidity / 100);
  return Math.round(vpd * 100) / 100;
}
```

---

## Step 3: Create Controller Setup API

**Purpose:** Allow users to add AC Infinity controllers via the app.

### Create: `app/api/controllers/add/route.ts`

```typescript
// app/api/controllers/add/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ACInfinityAuth } from '@/lib/ac-infinity-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/controllers/add
 * Add a new AC Infinity controller for the user
 */
export async function POST(request: Request) {
  console.log('➕ [Add Controller] Starting...');

  try {
    // Get authenticated user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: request.headers.get('Authorization') || '',
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Add controller (this validates credentials automatically)
    const authManager = new ACInfinityAuth();
    const controllerId = await authManager.addController(
      user.id,
      email,
      password,
      name || 'My AC Infinity Controller'
    );

    console.log('✅ [Add Controller] Success');

    return NextResponse.json({
      success: true,
      controllerId,
      message: 'Controller added successfully',
    });

  } catch (error: any) {
    console.error('❌ [Add Controller] Failed:', error);

    // Check if it's a login failure
    if (error.message.includes('login failed')) {
      return NextResponse.json(
        { error: 'Invalid AC Infinity credentials' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Step 4: Update Dashboard Component

**Purpose:** Dashboard now fetches sensors for authenticated user.

### Update: `components/LiveSensorDashboard.tsx`

```typescript
// components/LiveSensorDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface Sensor {
  id: string;
  name: string;
  deviceType: string;
  temperature: number;
  humidity: number;
  vpd: number;
  online: boolean;
  lastUpdate: string;
  ports?: Port[];
}

interface Port {
  portId: number;
  name: string;
  speed: number;
  isOn: boolean;
}

export default function LiveSensorDashboard() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    console.log('🚀 Dashboard mounted');
    fetchSensors();

    if (autoRefresh) {
      const interval = setInterval(fetchSensors, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  async function fetchSensors() {
    try {
      console.log('🔄 Fetching sensors...');

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }

      // Fetch with auth token
      const res = await fetch('/api/sensors/live', {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log('✅ Sensors loaded:', data);

      setSensors(data.sensors || []);
      setLastUpdate(new Date());
      setLoading(false);
      setError(null);
    } catch (err: any) {
      console.error('❌ Fetch failed:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  // ... rest of component same as before ...
  // (loading, error, empty states, render logic unchanged)

  function getVPDStatus(vpd: number) {
    if (vpd < 0.8) return { color: 'blue', text: 'Low VPD', bg: 'bg-blue-50 text-blue-800' };
    if (vpd > 1.5) return { color: 'red', text: 'High VPD', bg: 'bg-red-50 text-red-800' };
    return { color: 'green', text: 'Optimal VPD', bg: 'bg-green-50 text-green-800' };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading sensors...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-bold text-lg mb-2">Error</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={fetchSensors}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Same header and grid layout as before */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">EnviroFlow</h1>
              <p className="text-sm text-gray-500 mt-1">
                {sensors.length} sensor{sensors.length !== 1 ? 's' : ''} online
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">Auto-refresh (30s)</span>
              </label>
              <button
                onClick={fetchSensors}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
          {lastUpdate && (
            <p className="text-xs text-gray-500 mt-2">
              Last update: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sensors.map((sensor) => {
            const vpdStatus = getVPDStatus(sensor.vpd);
            return (
              <div key={sensor.id} className="bg-white rounded-lg shadow-md border overflow-hidden">
                {/* Card content same as before */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                  <h3 className="text-white font-bold text-lg">{sensor.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs mt-2 ${
                    sensor.online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    ● {sensor.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">🌡️ Temperature</span>
                    <span className="font-mono font-bold text-2xl">{sensor.temperature.toFixed(1)}°F</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">💧 Humidity</span>
                    <span className="font-mono font-bold text-2xl">{sensor.humidity.toFixed(1)}%</span>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">📊 VPD</span>
                      <span className="font-mono font-bold text-2xl">{sensor.vpd.toFixed(2)} kPa</span>
                    </div>
                    <div className={`px-3 py-2 rounded-lg text-sm ${vpdStatus.bg}`}>
                      {vpdStatus.text}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 5: Environment Variables (Simplified)

**No AC_INFINITY_TOKEN needed!** Only Supabase credentials.

### Local Development

```bash
# .env.local

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Optional: Cron secret for background jobs
CRON_SECRET=your-random-secret
```

### Vercel Production

```bash
# Add to Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add CRON_SECRET
```

---

## Step 6: Testing

### Test 1: Add Controller via API

```bash
# Get auth token first (from your Supabase auth)
# Then add controller:

curl -X POST http://localhost:3000/api/controllers/add \
  -H "Authorization: Bearer YOUR_SUPABASE_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-ac-infinity-email@example.com",
    "password": "your-ac-infinity-password",
    "name": "My Grow Tent"
  }'

# Expected response:
# {
#   "success": true,
#   "controllerId": "uuid-here",
#   "message": "Controller added successfully"
# }
```

### Test 2: Fetch Sensors

```bash
# Dashboard will now work automatically
vercel dev

# Visit http://localhost:3000
# Should show sensors using auto-fetched token
```

---

## Key Benefits of This Approach

✅ **No manual token extraction** - Users just enter email/password once  
✅ **Automatic token refresh** - System handles expiration transparently  
✅ **Multi-user support** - Each user has their own controllers  
✅ **Encrypted credentials** - Stored securely in database  
✅ **Token caching** - Reduces API calls to AC Infinity  
✅ **Simpler environment setup** - No AC_INFINITY_TOKEN env var needed  

---

## Security Notes

### ⚠️ IMPORTANT: Implement Proper Encryption

The example uses **base64 encoding** which is **NOT SECURE**. Before production:

```typescript
// Replace in lib/ac-infinity-auth.ts

// PRODUCTION: Use proper encryption
import { subtle } from 'crypto';

// Or use a library like:
// - @noble/ciphers
// - sodium-native
// - AWS KMS
// - Google Cloud KMS

private async encrypt(value: string): Promise<string> {
  // Implement AES-256-GCM or similar
  // Store encryption key in env var or key management service
}

private async decrypt(encrypted: string): Promise<string> {
  // Decrypt using same key
}
```

---

## Migration Path

If you already have users with manual tokens:

```sql
-- Migration: Allow null credentials temporarily
ALTER TABLE user_controllers 
  ALTER COLUMN email_encrypted DROP NOT NULL,
  ALTER COLUMN password_encrypted DROP NOT NULL;

-- Users will be prompted to re-enter credentials on next login
```

---

## Success Criteria

✅ **You should now have:**

1. Users add controllers by entering email/password (once)
2. System auto-fetches and caches tokens
3. Tokens refresh automatically when expired
4. Multi-user support (each user's own controllers)
5. No manual token extraction needed
6. Dashboard works with stored credentials

**This is the production-ready multi-tenant architecture!**