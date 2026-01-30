/**
 * Port-Specific Mode API Route
 *
 * GET /api/controllers/[id]/ports/[port]/mode - Get mode config for specific port
 * PUT /api/controllers/[id]/ports/[port]/mode - Update mode config for specific port
 *
 * Flow:
 * 1. Verify user owns the controller
 * 2. Get adapter based on brand
 * 3. Call adapter methods to get/set mode for specific port
 * 4. Return mode configuration
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  decryptCredentials as decryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { safeError } from '@/lib/sanitize-log'

// Import adapter factory
import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
} from '@enviroflow/automation-engine/adapters'

// Import types
import type {
  ModeConfiguration,
  PortModeResponse,
} from '@/types'

// ============================================
// Types
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

interface RouteParams {
  params: Promise<{ id: string; port: string }>
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
// Credential Decryption
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
      safeError('[Port Mode] Failed to decrypt credentials:', error.message)
      return {
        success: false,
        credentials: {},
        error: 'Failed to decrypt stored credentials. The encryption key may have changed.',
      }
    }
    safeError('[Port Mode] Unexpected error:', error)
    return {
      success: false,
      credentials: {},
      error: 'Unexpected error decrypting credentials.',
    }
  }
}

// ============================================
// Helper Functions
// ============================================

function buildACInfinityCredentials(
  credentials: Record<string, unknown>
): ACInfinityCredentials {
  return {
    type: 'ac_infinity',
    email: credentials.email as string || '',
    password: credentials.password as string || '',
  }
}

function mapACInfinityModeToConfig(modeData: Record<string, unknown>): ModeConfiguration {
  const modeMap: Record<number, ModeConfiguration['mode']> = {
    0: 'off',
    1: 'on',
    2: 'auto',
    3: 'timer',
    4: 'cycle',
    5: 'schedule',
    6: 'vpd',
  }

  const mode = modeMap[modeData.mode as number] || 'off'

  const config: ModeConfiguration = {
    mode,
  }

  if (mode === 'on') {
    config.level = modeData.level as number || 0
  }

  if (mode === 'auto') {
    config.tempTriggerHigh = modeData.tempTriggerHigh as number
    config.tempTriggerLow = modeData.tempTriggerLow as number
    config.humidityTriggerHigh = modeData.humidityTriggerHigh as number
    config.humidityTriggerLow = modeData.humidityTriggerLow as number
    config.deviceBehavior = modeData.deviceBehavior as ModeConfiguration['deviceBehavior']
    config.maxLevel = modeData.maxLevel as number
    config.minLevel = modeData.minLevel as number
    config.transitionEnabled = modeData.transitionEnabled as boolean
    config.transitionSpeed = modeData.transitionSpeed as number
    config.bufferEnabled = modeData.bufferEnabled as boolean
    config.bufferValue = modeData.bufferValue as number
  }

  if (mode === 'vpd') {
    config.vpdTriggerHigh = modeData.vpdTriggerHigh as number
    config.vpdTriggerLow = modeData.vpdTriggerLow as number
    config.leafTempOffset = modeData.leafTempOffset as number
    config.maxLevel = modeData.maxLevel as number
    config.minLevel = modeData.minLevel as number
    config.transitionEnabled = modeData.transitionEnabled as boolean
    config.transitionSpeed = modeData.transitionSpeed as number
  }

  if (mode === 'timer') {
    config.timerType = modeData.timerType as ModeConfiguration['timerType']
    config.timerDuration = modeData.timerDuration as number
  }

  if (mode === 'cycle') {
    config.cycleOnDuration = modeData.cycleOnDuration as number
    config.cycleOffDuration = modeData.cycleOffDuration as number
  }

  if (mode === 'schedule') {
    config.scheduleStartTime = modeData.scheduleStartTime as string
    config.scheduleEndTime = modeData.scheduleEndTime as string
    config.scheduleDays = modeData.scheduleDays as number[]
  }

  return config
}

function getSupportedModes(deviceType: string): ModeConfiguration['mode'][] {
  const baseModes: ModeConfiguration['mode'][] = ['off', 'on', 'auto']

  if (deviceType === 'fan' || deviceType === 'outlet') {
    return ['off', 'on', 'auto', 'vpd', 'timer', 'cycle', 'schedule']
  }

  if (deviceType === 'light') {
    return ['off', 'on', 'timer', 'schedule']
  }

  return baseModes
}

// ============================================
// GET /api/controllers/[id]/ports/[port]/mode
// ============================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id, port: portStr } = await params
    const port = parseInt(portStr, 10)

    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate port number
    if (isNaN(port) || port < 1 || port > 8) {
      return NextResponse.json(
        { error: 'Invalid port number. Must be between 1 and 8.' },
        { status: 400 }
      )
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(userId, {
      maxRequests: 20,
      windowMs: 60 * 1000,
      keyPrefix: 'port-mode-read'
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get controller
    const { data: controller, error: fetchError } = await client
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

    if (controller.brand !== 'ac_infinity') {
      return NextResponse.json(
        {
          error: 'Mode programming is only supported for AC Infinity controllers',
          brand: controller.brand
        },
        { status: 400 }
      )
    }

    const brand = controller.brand as ControllerBrand

    try {
      const adapter = getAdapter(brand)

      // Decrypt credentials
      const decryptResult = decryptCredentials(controller.credentials)

      if (!decryptResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to access controller credentials.',
          },
          { status: 500 }
        )
      }

      const storedCredentials = decryptResult.credentials
      const adapterCredentials = buildACInfinityCredentials(storedCredentials)

      // Connect
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to connect: ${connectionResult.error}`,
          },
          { status: 503 }
        )
      }

      const controllerId = connectionResult.controllerId || id

      // Get modes for this port
      const modes = await (adapter as { getDeviceModes: (id: string) => Promise<Array<{ port: number; [key: string]: unknown }>> }).getDeviceModes(controllerId)
      const portMode = modes.find((m) => m.port === port)

      // Find device info for this port
      const device = connectionResult.metadata.capabilities.devices.find(
        (d) => d.port === port
      )

      if (!device) {
        await adapter.disconnect(controllerId)
        return NextResponse.json(
          { error: `Port ${port} not found on this controller` },
          { status: 404 }
        )
      }

      const response: PortModeResponse = {
        port,
        portName: device.name || `Port ${port}`,
        deviceType: device.type,
        currentMode: mapACInfinityModeToConfig(portMode || {}),
        supportedModes: getSupportedModes(device.type),
      }

      // Disconnect
      try {
        await adapter.disconnect(controllerId)
      } catch (disconnectErr) {
        console.warn('[Port Mode GET] Disconnect error:', disconnectErr)
      }

      return NextResponse.json(response, {
        headers: createRateLimitHeaders(rateLimitResult)
      })

    } catch (adapterError) {
      safeError('[Port Mode GET] Adapter error:', adapterError)

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve mode settings',
        },
        { status: 503 }
      )
    }

  } catch (error) {
    safeError('[Port Mode GET] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// ============================================
// PUT /api/controllers/[id]/ports/[port]/mode
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id, port: portStr } = await params
    const port = parseInt(portStr, 10)

    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate port number
    if (isNaN(port) || port < 1 || port > 8) {
      return NextResponse.json(
        { error: 'Invalid port number. Must be between 1 and 8.' },
        { status: 400 }
      )
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(userId, {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: 'port-mode-write'
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Parse body
    const body: ModeConfiguration = await request.json()

    if (!body.mode) {
      return NextResponse.json(
        { error: 'Mode configuration is required' },
        { status: 400 }
      )
    }

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get controller
    const { data: controller, error: fetchError } = await client
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

    if (controller.brand !== 'ac_infinity') {
      return NextResponse.json(
        {
          error: 'Mode programming is only supported for AC Infinity controllers',
          brand: controller.brand
        },
        { status: 400 }
      )
    }

    const brand = controller.brand as ControllerBrand

    try {
      const adapter = getAdapter(brand)

      // Decrypt credentials
      const decryptResult = decryptCredentials(controller.credentials)

      if (!decryptResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to access controller credentials.',
          },
          { status: 500 }
        )
      }

      const storedCredentials = decryptResult.credentials
      const adapterCredentials = buildACInfinityCredentials(storedCredentials)

      // Connect
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to connect: ${connectionResult.error}`,
          },
          { status: 503 }
        )
      }

      const controllerId = connectionResult.controllerId || id

      // Set port mode
      const result = await (adapter as any).setPortMode(controllerId, port, body)

      // Disconnect
      try {
        await adapter.disconnect(controllerId)
      } catch (disconnectErr) {
        console.warn('[Port Mode PUT] Disconnect error:', disconnectErr)
      }

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Failed to update port mode',
          },
          { status: 400 }
        )
      }

      // Log activity
      await client.from('activity_logs').insert({
        user_id: userId,
        controller_id: id,
        action_type: 'controller_updated',
        details: {
          action: 'port_mode_updated',
          port,
          mode: body.mode,
        },
        result: 'success',
      })

      return NextResponse.json(
        {
          success: true,
          controller_id: id,
          port,
          mode: body,
          message: `Port ${port} mode updated to ${body.mode}`,
        },
        {
          headers: createRateLimitHeaders(rateLimitResult)
        }
      )

    } catch (adapterError) {
      safeError('[Port Mode PUT] Adapter error:', adapterError)

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update mode settings',
        },
        { status: 503 }
      )
    }

  } catch (error) {
    safeError('[Port Mode PUT] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
