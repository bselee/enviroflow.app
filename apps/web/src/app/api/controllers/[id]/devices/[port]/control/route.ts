/**
 * Device Control API Route
 *
 * POST /api/controllers/[id]/devices/[port]/control - Send control command to device
 *
 * Body: { action: 'set_level' | 'turn_on' | 'turn_off' | 'toggle', value?: 0-100 }
 * Response: { success: boolean, actualValue?: number, error?: string }
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { decryptCredentials } from '@/lib/server-encryption'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { safeError } from '@/lib/sanitize-log'

import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type DeviceCommand,
  type CommandType,
} from '@enviroflow/automation-engine/adapters'

// ============================================
// Types
// ============================================

type SupabaseClient = ReturnType<typeof createClient<never>>

interface RouteParams {
  params: Promise<{ id: string; port: string }>
}

interface ControlRequest {
  action: 'set_level' | 'turn_on' | 'turn_off' | 'toggle'
  value?: number // 0-100 for set_level
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
  credentials: { email?: string; password?: string; type?: string }
): ACInfinityCredentials | InkbirdCredentials | CSVUploadCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: credentials.email || '',
        password: credentials.password || '',
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
// Activity Log Helper
// ============================================

async function logActivity(
  client: SupabaseClient,
  userId: string,
  controllerId: string,
  port: number,
  action: string,
  result: 'success' | 'failed',
  errorMessage?: string
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('activity_logs').insert({
      user_id: userId,
      controller_id: controllerId,
      action_type: 'device_controlled',
      action_data: { port, action },
      result,
      error_message: errorMessage || null,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[Device Control] Failed to log activity:', err)
  }
}

// ============================================
// POST /api/controllers/[id]/devices/[port]/control
// ============================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id, port: portStr } = await params
    const port = parseInt(portStr, 10)

    if (isNaN(port) || port < 1 || port > 8) {
      return NextResponse.json(
        { error: 'Invalid port number. Must be between 1 and 8.' },
        { status: 400 }
      )
    }

    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting: 10 commands per minute per user
    const rateLimitResult = checkRateLimit(userId, {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: 'device-control'
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many control commands. Please try again later.',
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

    // Parse request body
    let body: ControlRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { action, value } = body

    // Validate action
    if (!['set_level', 'turn_on', 'turn_off', 'toggle'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: set_level, turn_on, turn_off, toggle' },
        { status: 400 }
      )
    }

    // Validate value for set_level
    if (action === 'set_level') {
      if (value === undefined || value < 0 || value > 100) {
        return NextResponse.json(
          { error: 'Invalid value. Must be between 0 and 100 for set_level action.' },
          { status: 400 }
        )
      }
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
        success: false,
        error: 'CSV Upload controllers do not support device control'
      }, { status: 400 })
    }

    try {
      const adapter = getAdapter(brand)

      // Decrypt stored credentials
      const decryptResult = decryptCredentials(controller.credentials)

      if (!decryptResult.success) {
        safeError('[Device Control] Credential decryption failed:', decryptResult.error)
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
          await logActivity(client, userId, id, port, action, 'failed', 'Invalid credentials')
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
      const adapterCredentials = buildAdapterCredentials(brand, {
        email: storedCredentials.email as string,
        password: storedCredentials.password as string,
        type: brand,
      })

      // Connect to controller
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        await logActivity(client, userId, id, port, action, 'failed', connectionResult.error)
        return NextResponse.json({
          success: false,
          error: connectionResult.error || 'Failed to connect to controller'
        }, { status: 503 })
      }

      // Build device command
      const command: DeviceCommand = {
        type: action as CommandType,
        value: action === 'set_level' ? value : undefined,
      }

      // Execute command
      const controllerId = connectionResult.controllerId || id
      const commandResult = await adapter.controlDevice(controllerId, port, command)

      // Disconnect after command
      try {
        await adapter.disconnect(controllerId)
      } catch (disconnectErr) {
        console.warn('[Device Control] Error during disconnect:', disconnectErr)
      }

      // Log activity
      await logActivity(
        client,
        userId,
        id,
        port,
        action,
        commandResult.success ? 'success' : 'failed',
        commandResult.error
      )

      if (!commandResult.success) {
        return NextResponse.json({
          success: false,
          error: commandResult.error || 'Command failed'
        }, {
          status: 500,
          headers: createRateLimitHeaders(rateLimitResult)
        })
      }

      return NextResponse.json({
        success: true,
        actualValue: commandResult.actualValue,
        previousValue: commandResult.previousValue,
        timestamp: commandResult.timestamp.toISOString(),
      }, {
        headers: createRateLimitHeaders(rateLimitResult)
      })

    } catch (adapterError) {
      safeError('[Device Control] Adapter error:', adapterError)

      const errorMessage =
        adapterError instanceof Error ? adapterError.message : 'Unknown adapter error'

      await logActivity(client, userId, id, port, action, 'failed', errorMessage)

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to control device. The controller may be offline or unreachable.',
        },
        { status: 503 }
      )
    }
  } catch (error) {
    safeError('[Device Control] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
