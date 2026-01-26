/**
 * Controller Capabilities API Route
 *
 * GET /api/controllers/[id]/capabilities - Fetch comprehensive controller I/O capabilities
 *
 * Returns unified view of all sensors and devices available for a controller,
 * formatted specifically for workflow builder UI consumption.
 *
 * Response Format:
 * {
 *   success: boolean
 *   controller_id: string
 *   controller_name: string
 *   brand: string
 *   status: 'online' | 'offline' | 'error'
 *   sensors: Array<{
 *     type: string
 *     name: string
 *     port?: number
 *     currentValue?: number
 *     unit: string
 *     isStale: boolean
 *   }>
 *   devices: Array<{
 *     port: number
 *     type: string
 *     name: string
 *     isOn: boolean
 *     level: number
 *     supportsDimming: boolean
 *     isOnline: boolean
 *   }>
 *   metadata: {
 *     model: string
 *     firmwareVersion?: string
 *     lastSeen?: string
 *   }
 *   timestamp: string
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { safeError } from '@/lib/sanitize-log'

// ============================================
// Types
// ============================================

type SupabaseClient = ReturnType<typeof createClient<never>>

interface RouteParams {
  params: Promise<{ id: string }>
}

interface SensorCapability {
  type: string
  name: string
  port?: number
  currentValue?: number
  unit: string
  isStale: boolean
  timestamp?: string
}

interface DeviceCapability {
  port: number
  type: string
  name: string
  isOn: boolean
  level: number
  supportsDimming: boolean
  isOnline: boolean
  portType?: number
  devType?: number
}

interface ControllerCapabilitiesResponse {
  success: boolean
  controller_id: string
  controller_name: string
  brand: string
  status: 'online' | 'offline' | 'error' | 'initializing'
  sensors: SensorCapability[]
  devices: DeviceCapability[]
  metadata: {
    model: string
    firmwareVersion?: string
    lastSeen?: string
  }
  timestamp: string
  cached?: boolean
  error?: string
}

// ============================================
// Supabase Client (Service Role)
// ============================================

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error(
        'Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      )
    }

    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabase
}

// ============================================
// Authentication Helper
// ============================================

async function getUserId(request: NextRequest, client: SupabaseClient): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const {
      data: { user },
    } = await client.auth.getUser(token)
    if (user?.id) return user.id
  }

  return null
}

// ============================================
// GET /api/controllers/[id]/capabilities
// ============================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting: 30 requests per minute per user
    const rateLimitResult = checkRateLimit(userId, {
      maxRequests: 30,
      windowMs: 60 * 1000,
      keyPrefix: 'capabilities'
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many capabilities requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get controller basic info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: controller, error: fetchError } = await (client as any)
      .from('controllers')
      .select('id, name, brand, status, model, firmware_version, last_seen')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    const response: ControllerCapabilitiesResponse = {
      success: true,
      controller_id: id,
      controller_name: controller.name,
      brand: controller.brand,
      status: controller.status || 'initializing',
      sensors: [],
      devices: [],
      metadata: {
        model: controller.model || 'Unknown',
        firmwareVersion: controller.firmware_version || undefined,
        lastSeen: controller.last_seen || undefined,
      },
      timestamp: new Date().toISOString(),
    }

    // Fetch sensor capabilities from recent readings
    // Get the most recent reading for each sensor type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sensorReadings } = await (client as any)
      .from('sensor_readings')
      .select('sensor_type, value, unit, port, recorded_at, is_stale')
      .eq('controller_id', id)
      .order('recorded_at', { ascending: false })
      .limit(100) // Get recent readings to find all sensor types

    if (sensorReadings && sensorReadings.length > 0) {
      // Group by sensor_type + port to get unique sensors
      const sensorMap = new Map<string, SensorCapability>()

      for (const reading of sensorReadings) {
        const key = `${reading.sensor_type}-${reading.port || 0}`

        // Only add if not already in map (we want most recent due to ORDER BY)
        if (!sensorMap.has(key)) {
          // Create human-readable name
          const sensorTypeName = reading.sensor_type
            .split('_')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

          const name = reading.port
            ? `${sensorTypeName} (Port ${reading.port})`
            : sensorTypeName

          sensorMap.set(key, {
            type: reading.sensor_type,
            name,
            port: reading.port || undefined,
            currentValue: reading.value,
            unit: reading.unit,
            isStale: reading.is_stale || false,
            timestamp: reading.recorded_at,
          })
        }
      }

      response.sensors = Array.from(sensorMap.values())
    }

    // Fetch device capabilities from controller_ports table or capabilities column
    // Try database cache first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ports } = await (client as any)
      .from('controller_ports')
      .select('*')
      .eq('controller_id', id)
      .order('port_number', { ascending: true })

    if (ports && ports.length > 0) {
      response.devices = ports.map((p: Record<string, unknown>) => ({
        port: p.port_number as number,
        type: p.device_type as string || 'unknown',
        name: p.port_name as string || `Port ${p.port_number}`,
        isOn: p.is_on as boolean || false,
        level: (p.power_level as number || 0) * 10, // Convert 0-10 to 0-100
        supportsDimming: p.supports_dimming as boolean || false,
        isOnline: p.is_online as boolean !== false,
        portType: p.port_type as number | undefined,
        devType: p.dev_type as number | undefined,
      }))
      response.cached = true
    } else {
      // No cached port data - check capabilities field
      const capabilities = controller.capabilities as { devices?: Array<{ type: string; port?: number }> } | null

      if (capabilities?.devices && capabilities.devices.length > 0) {
        // Build basic device list from capabilities
        response.devices = capabilities.devices.map((device, index) => ({
          port: device.port || index + 1,
          type: device.type,
          name: `${device.type.charAt(0).toUpperCase() + device.type.slice(1)} ${device.port || index + 1}`,
          isOn: false,
          level: 0,
          supportsDimming: device.type === 'light' || device.type === 'fan',
          isOnline: controller.status === 'online',
        }))
      }
    }

    return NextResponse.json(response, {
      headers: createRateLimitHeaders(rateLimitResult)
    })

  } catch (error) {
    safeError('[Capabilities GET] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
