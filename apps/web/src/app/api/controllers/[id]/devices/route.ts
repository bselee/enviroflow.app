/**
 * Controller Devices API Route
 *
 * GET /api/controllers/[id]/devices - Fetch device information for all ports
 *
 * Returns structured port information with device types, capabilities, and current state.
 *
 * IMPORTANT: This route reads CACHED data from the controller_ports table,
 * which is populated by the sensor polling cron job. This prevents excessive
 * API calls to AC Infinity (which causes rate limiting / 429 errors).
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { safeError } from '@/lib/sanitize-log'

import {
  type ControllerBrand,
} from '@enviroflow/automation-engine/adapters'

// ============================================
// Types
// ============================================

type SupabaseClient = ReturnType<typeof createClient<never>>

interface RouteParams {
  params: Promise<{ id: string }>
}

interface DevicePortInfo {
  port: number
  deviceType: string
  name: string
  isOn: boolean
  level: number // 0-100
  supportsDimming: boolean
  minLevel: number
  maxLevel: number
}

interface CachedPort {
  port_number: number
  port_name: string | null
  device_type: string | null
  is_on: boolean
  power_level: number | null
  surplus: number | null
  supports_dimming: boolean
  updated_at: string
  dev_type: number | null
  port_type: number | null
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
// Device Type Mapper
// ============================================

function mapDeviceType(deviceType: string | null, portType: number | null): string {
  // Map from database device_type or port_type to display type
  if (deviceType) {
    return deviceType
  }

  // Fall back to port_type mapping (AC Infinity specific)
  switch (portType) {
    case 1: return 'fan'
    case 2: return 'fan'
    case 3: return 'fan'
    case 4: return 'light'
    case 5: return 'outlet'
    case 6: return 'pump'
    case 7: return 'sensor'
    case 8: return 'sensor'
    case 9: return 'heater'
    case 10: return 'sensor'
    default: return 'outlet'
  }
}

// ============================================
// GET /api/controllers/[id]/devices
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

    // Rate limiting: 20 requests per minute per user
    const rateLimitResult = checkRateLimit(userId, {
      maxRequests: 20,
      windowMs: 60 * 1000,
      keyPrefix: 'device-list'
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many device list requests. Please try again later.',
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

    // Get controller with credentials
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: controller, error: fetchError } = await (client as any)
      .from('controllers')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    const brand = controller.brand as ControllerBrand

    // CSV Upload adapters don't support device control
    if (brand === 'csv_upload') {
      return NextResponse.json({
        success: true,
        controller_id: id,
        ports: [],
        cached: true,
        message: 'CSV Upload controllers do not support device control'
      }, {
        headers: createRateLimitHeaders(rateLimitResult)
      })
    }

    // Read cached port data from controller_ports table
    // This data is populated by the sensor polling cron job
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cachedPorts, error: portsError } = await (client as any)
      .from('controller_ports')
      .select('port_number, port_name, device_type, is_on, power_level, surplus, supports_dimming, updated_at, dev_type, port_type')
      .eq('controller_id', id)
      .order('port_number', { ascending: true })

    if (portsError) {
      safeError('[Devices GET] Error fetching cached ports:', portsError)
      return NextResponse.json(
        {
          success: false,
          controller_id: id,
          ports: [],
          error: 'Failed to retrieve cached device information.',
        },
        { status: 500 }
      )
    }

    // Filter out sensor ports (devType 10 or portType 10 are sensors, not controllable devices)
    const controllablePorts = (cachedPorts || []).filter((port: CachedPort) => {
      const isSensorPort = port.dev_type === 10 || port.port_type === 10
      return !isSensorPort
    })

    // Map cached ports to device port info
    const ports: DevicePortInfo[] = controllablePorts.map((port: CachedPort) => ({
      port: port.port_number,
      deviceType: mapDeviceType(port.device_type, port.port_type),
      name: port.port_name || `Port ${port.port_number}`,
      isOn: port.is_on || false,
      // power_level is 0-10 in DB, convert to 0-100 for display
      level: port.power_level !== null ? port.power_level * 10 : (port.surplus !== null ? port.surplus * 10 : 0),
      supportsDimming: port.supports_dimming || false,
      minLevel: 0,
      maxLevel: 100,
    }))

    // Get the most recent update timestamp
    const lastUpdated = cachedPorts && cachedPorts.length > 0
      ? cachedPorts.reduce((latest: string | null, port: CachedPort) => {
          if (!latest || (port.updated_at && port.updated_at > latest)) {
            return port.updated_at
          }
          return latest
        }, null)
      : controller.last_seen

    console.log('[Devices GET] Returning cached data:', {
      controllerId: id,
      portCount: ports.length,
      lastUpdated,
    })

    return NextResponse.json({
      success: true,
      controller_id: id,
      controller_name: controller.name,
      brand: controller.brand,
      ports,
      port_count: ports.length,
      cached: true,
      lastUpdated,
      timestamp: new Date().toISOString(),
    }, {
      headers: createRateLimitHeaders(rateLimitResult)
    })
  } catch (error) {
    safeError('[Devices GET] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
