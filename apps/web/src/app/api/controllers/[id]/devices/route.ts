/**
 * Controller Devices API Route
 *
 * GET /api/controllers/[id]/devices - Fetch device information for all ports
 *
 * Returns structured port information with device types, capabilities, and current state.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  decryptCredentials as decryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { safeError } from '@/lib/sanitize-log'

// ============================================
// Credential Decryption Wrapper
// ============================================

/**
 * Wrapper to handle credential decryption with proper error handling.
 * The underlying function throws EncryptionError on failure.
 */
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
      safeError('[Devices] Failed to decrypt credentials:', error.message)
      return {
        success: false,
        credentials: {},
        error: 'Failed to decrypt stored credentials. The encryption key may have changed.',
      }
    }
    safeError('[Devices] Unexpected decryption error:', error)
    return {
      success: false,
      credentials: {},
      error: 'Unexpected error decrypting credentials.',
    }
  }
}

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
  /** Current operating mode */
  mode?: string
  /** Brief summary of mode config */
  modeSummary?: string
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
// Credential Builder
// ============================================

function buildAdapterCredentials(
  brand: ControllerBrand,
  credentials: { email?: string; password?: string; type?: string },
  deviceId?: string
): ACInfinityCredentials | InkbirdCredentials | CSVUploadCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: credentials.email || '',
        password: credentials.password || '',
        deviceId: deviceId, // Pass the specific device ID
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
      throw new Error(`Cannot build credentials for unsupported brand: ${brand}`)
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
        message: 'CSV Upload controllers do not support device control'
      })
    }

    try {
      const adapter = getAdapter(brand)

      // Decrypt stored credentials
      const decryptResult = decryptCredentials(controller.credentials)

      if (!decryptResult.success) {
        safeError('[Devices GET] Credential decryption failed:', decryptResult.error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to access controller credentials. Please re-add the controller.',
          },
          { status: 500 }
        )
      }

      const storedCredentials = decryptResult.credentials as Record<string, unknown>

      // Validate credentials
      if (brand === 'ac_infinity' || brand === 'inkbird') {
        const email = storedCredentials.email
        const password = storedCredentials.password

        if (typeof email !== 'string' || !email ||
            typeof password !== 'string' || !password) {
          const brandName = brand === 'ac_infinity' ? 'AC Infinity' : 'Inkbird'
          return NextResponse.json(
            {
              success: false,
              error: `${brandName} credentials are incomplete or invalid`,
            },
            { status: 400 }
          )
        }
      }

      // Build properly typed credentials for the adapter
      // Pass controller_id (AC Infinity device ID) to connect to the specific device
      const adapterCredentials = buildAdapterCredentials(
        brand,
        {
          email: storedCredentials.email as string,
          password: storedCredentials.password as string,
          type: brand,
        },
        controller.controller_id // AC Infinity device ID
      )

      console.log('[Devices GET] Using device ID:', controller.controller_id, 'for controller:', controller.name)
      console.log('[Devices GET] Calling adapter.connect with credentials type:', brand)

      // Connect to get device capabilities
      const connectionResult = await adapter.connect(adapterCredentials)

      console.log('[Devices GET] Connection result:', {
        success: connectionResult.success,
        controllerId: connectionResult.controllerId,
        error: connectionResult.error,
        hasMetadata: !!connectionResult.metadata,
        hasCapabilities: !!connectionResult.metadata?.capabilities
      })

      if (!connectionResult.success) {
        // Return empty list if offline
        return NextResponse.json({
          success: true,
          controller_id: id,
          ports: [],
          status: 'offline',
          message: 'Controller is offline. Unable to retrieve device information.'
        }, {
          headers: createRateLimitHeaders(rateLimitResult)
        })
      }

      // Get device capabilities from metadata
      const capabilities = connectionResult.metadata.capabilities
      const devices = capabilities.devices || []

      console.log('[Devices GET] Connection result metadata:', JSON.stringify(connectionResult.metadata, null, 2))
      console.log('[Devices GET] Capabilities:', JSON.stringify(capabilities, null, 2))
      console.log('[Devices GET] Devices found:', devices.length)

      // Try to fetch mode information for AC Infinity controllers
      let modeMap: Map<number, { mode: string; summary: string }> = new Map()
      
      if (brand === 'ac_infinity') {
        try {
          const controllerId = connectionResult.controllerId || id
          const modes = await (adapter as { getDeviceModes: (id: string) => Promise<Array<{ port: number; modeId?: number; mode?: number; [key: string]: unknown }>> }).getDeviceModes(controllerId)
          
          const modeNames: Record<number, string> = {
            0: 'off',
            1: 'on',
            2: 'auto',
            3: 'timer',
            4: 'cycle',
            5: 'schedule',
            6: 'vpd',
          }
          
          for (const modeData of modes) {
            const modeId = (modeData.modeId ?? modeData.mode) as number
            const modeName = modeNames[modeId] || 'unknown'
            let summary = ''
            
            // Build summary based on mode
            if (modeName === 'auto' || modeName === 'vpd') {
              const parts: string[] = []
              if (modeData.tempTriggerLow || modeData.tempTriggerHigh) {
                parts.push(`${modeData.tempTriggerLow || '?'}-${modeData.tempTriggerHigh || '?'}°F`)
              }
              if (modeData.humidityTriggerLow || modeData.humidityTriggerHigh) {
                parts.push(`${modeData.humidityTriggerLow || '?'}-${modeData.humidityTriggerHigh || '?'}% RH`)
              }
              if (modeName === 'vpd' && (modeData.vpdTriggerLow || modeData.vpdTriggerHigh)) {
                parts.push(`${modeData.vpdTriggerLow || '?'}-${modeData.vpdTriggerHigh || '?'} kPa`)
              }
              summary = parts.join(', ')
            } else if (modeName === 'timer') {
              const duration = modeData.timerDuration as number
              if (duration) {
                const mins = Math.floor(duration / 60)
                summary = `${mins}m ${modeData.timerType || ''}`
              }
            } else if (modeName === 'cycle') {
              summary = `${modeData.cycleOnDuration || 0}s on / ${modeData.cycleOffDuration || 0}s off`
            } else if (modeName === 'schedule') {
              summary = `${modeData.scheduleStartTime || '?'} - ${modeData.scheduleEndTime || '?'}`
            } else if (modeName === 'on') {
              const level = modeData.level as number
              if (level !== undefined) summary = `Level ${level}`
            }
            
            modeMap.set(modeData.port, { mode: modeName, summary })
          }
        } catch (modeErr) {
          console.warn('[Devices GET] Failed to fetch modes:', modeErr)
          // Continue without mode info
        }
      }

      // Disconnect after getting capabilities
      const controllerId = connectionResult.controllerId || id
      try {
        await adapter.disconnect(controllerId)
      } catch (disconnectErr) {
        console.warn('[Devices GET] Error during disconnect:', disconnectErr)
      }

      // Map device capabilities to port info
      const ports: DevicePortInfo[] = devices.map((device: DeviceCapability) => {
        const modeInfo = modeMap.get(device.port)
        return {
          port: device.port,
          deviceType: device.type,
          name: device.name || `Port ${device.port}`,
          isOn: device.isOn || false,
          level: device.currentLevel ? Math.round(device.currentLevel * 10) : 0, // Convert 0-10 to 0-100
          supportsDimming: device.supportsDimming,
          minLevel: device.minLevel ? device.minLevel * 10 : 0,
          maxLevel: device.maxLevel ? device.maxLevel * 10 : 100,
          mode: modeInfo?.mode,
          modeSummary: modeInfo?.summary,
        }
      })

      return NextResponse.json({
        success: true,
        controller_id: id,
        controller_name: controller.name,
        brand: controller.brand,
        ports,
        port_count: ports.length,
        timestamp: new Date().toISOString(),
      }, {
        headers: createRateLimitHeaders(rateLimitResult)
      })

    } catch (adapterError) {
      safeError('[Devices GET] Adapter error:', adapterError)

      const _errorMessage =
        adapterError instanceof Error ? adapterError.message : 'Unknown adapter error'

      return NextResponse.json(
        {
          success: false,
          controller_id: id,
          ports: [],
          error: 'Failed to retrieve device information. The controller may be offline or unreachable.',
        },
        { status: 503 }
      )
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
