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
  decryptCredentials as decryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'

import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type DeviceCapability,
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
  dev_type: number | string | null // May be stored as string in DB
  port_type: number | string | null // May be stored as string in DB
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
// Credential Decryption Wrapper
// ============================================

function decryptCredentials(encrypted: string | Record<string, unknown>): {
  success: boolean
  credentials: Record<string, unknown>
  error?: string
} {
  try {
    const credentials = decryptCredentialsAES(encrypted)
    return { success: true, credentials }
  } catch (error) {
    if (error instanceof EncryptionError) {
      return {
        success: false,
        credentials: {},
        error: 'Failed to decrypt stored credentials.',
      }
    }
    return {
      success: false,
      credentials: {},
      error: 'Unexpected error decrypting credentials.',
    }
  }
}

// ============================================
// Credential Builder (for live API fallback)
// ============================================

function buildAdapterCredentials(
  brand: ControllerBrand,
  credentials: { email?: string; password?: string },
  deviceId?: string
): ACInfinityCredentials | InkbirdCredentials | CSVUploadCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: credentials.email || '',
        password: credentials.password || '',
        deviceId: deviceId,
      } satisfies ACInfinityCredentials
    case 'inkbird':
      return {
        type: 'inkbird',
        email: credentials.email || '',
        password: credentials.password || '',
      } satisfies InkbirdCredentials
    case 'csv_upload':
      return {
        type: 'csv_upload',
      } satisfies CSVUploadCredentials
    default:
      throw new Error(`Unsupported brand: ${brand}`)
  }
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
  console.log('========== DEVICES API CALLED ==========')
  try {
    const { id } = await params
    console.log('[Devices GET] Controller ID:', id)
    const client = getSupabase()
    const userId = await getUserId(request, client)
    console.log('[Devices GET] User ID:', userId)

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
      // Continue to fallback instead of returning error
    }

    console.log('[Devices GET] Cached ports from DB:', {
      controllerId: id,
      cachedPortsCount: cachedPorts?.length || 0,
      cachedPorts: cachedPorts?.map((p: CachedPort) => ({
        port: p.port_number,
        name: p.port_name,
        devType: p.dev_type,
        portType: p.port_type,
      })),
    })

    // Filter out sensor probes (devType 10 = sensor probe, not a controllable device)
    // Only filter on devType, NOT portType - portType indicates output type (fan, light, etc)
    // Handle both number and string types (database may have stored as string)
    const controllablePorts = (cachedPorts || []).filter((port: CachedPort) => {
      const devType = typeof port.dev_type === 'string' ? parseInt(port.dev_type, 10) : port.dev_type
      const isSensorProbe = devType === 10
      console.log(`[Devices GET] Port ${port.port_number}: devType=${devType}, isSensor=${isSensorProbe}`)
      return !isSensorProbe
    })

    console.log('[Devices GET] After filtering:', {
      controllerId: id,
      controllablePortsCount: controllablePorts.length,
    })

    // If we have cached data, return it
    if (controllablePorts.length > 0) {
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
      const lastUpdated = cachedPorts.reduce((latest: string | null, port: CachedPort) => {
        if (!latest || (port.updated_at && port.updated_at > latest)) {
          return port.updated_at
        }
        return latest
      }, null)

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
    }

    // FALLBACK: No cached data - fetch from live API
    // This happens when cron job hasn't run yet for this controller
    console.log('[Devices GET] No cached controllable ports, falling back to live API for:', controller.name, {
      cachedPortsCount: cachedPorts?.length || 0,
      controllablePortsCount: controllablePorts.length,
    })

    try {
      const adapter = getAdapter(brand)

      // Decrypt stored credentials
      const decryptResult = decryptCredentials(controller.credentials)
      if (!decryptResult.success) {
        return NextResponse.json({
          success: true,
          controller_id: id,
          ports: [],
          cached: false,
          message: 'Waiting for data - cron job will populate device information shortly.',
        }, {
          headers: createRateLimitHeaders(rateLimitResult)
        })
      }

      const storedCredentials = decryptResult.credentials
      const adapterCredentials = buildAdapterCredentials(
        brand,
        {
          email: storedCredentials.email as string,
          password: storedCredentials.password as string,
        },
        controller.controller_id
      )

      // Connect to get device capabilities
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        return NextResponse.json({
          success: true,
          controller_id: id,
          ports: [],
          cached: false,
          status: 'offline',
          message: 'Controller is offline. Unable to retrieve device information.',
        }, {
          headers: createRateLimitHeaders(rateLimitResult)
        })
      }

      // Get device capabilities from metadata
      const capabilities = connectionResult.metadata.capabilities
      const devices = capabilities.devices || []

      console.log('[Devices GET] Live API capabilities:', {
        controllerId: id,
        sensorsCount: capabilities.sensors?.length || 0,
        devicesCount: devices.length,
        devices: devices.map((d: DeviceCapability) => ({
          port: d.port,
          name: d.name,
          type: d.type,
        })),
      })

      // Disconnect after getting capabilities
      const controllerId = connectionResult.controllerId || id
      try {
        await adapter.disconnect(controllerId)
      } catch {
        // Ignore disconnect errors
      }

      // Map device capabilities to port info
      const ports: DevicePortInfo[] = devices.map((device: DeviceCapability) => ({
        port: device.port,
        deviceType: device.type,
        name: device.name || `Port ${device.port}`,
        isOn: device.isOn || false,
        level: device.currentLevel ? Math.round(device.currentLevel * 10) : 0,
        supportsDimming: device.supportsDimming,
        minLevel: device.minLevel ? device.minLevel * 10 : 0,
        maxLevel: device.maxLevel ? device.maxLevel * 10 : 100,
      }))

      console.log('[Devices GET] Returning live API data:', {
        controllerId: id,
        portCount: ports.length,
      })

      return NextResponse.json({
        success: true,
        controller_id: id,
        controller_name: controller.name,
        brand: controller.brand,
        ports,
        port_count: ports.length,
        cached: false,
        timestamp: new Date().toISOString(),
      }, {
        headers: createRateLimitHeaders(rateLimitResult)
      })

    } catch (adapterError) {
      console.error('[Devices GET] Fallback adapter error:', adapterError)
      safeError('[Devices GET] Fallback adapter error:', adapterError)
      return NextResponse.json({
        success: true,
        controller_id: id,
        ports: [],
        cached: false,
        message: 'Device data pending - will be available after cron job runs.',
        debug_error: adapterError instanceof Error ? adapterError.message : String(adapterError),
      }, {
        headers: createRateLimitHeaders(rateLimitResult)
      })
    }
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
