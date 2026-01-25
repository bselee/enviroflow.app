/**
 * Ecowitt IoT Device Control API Route
 *
 * POST /api/ecowitt/control
 *
 * Controls Ecowitt IoT devices (WFC01 water valves and AC1100 smart plugs)
 * via the Ecowitt gateway's local HTTP API.
 *
 * Security:
 * - Requires authenticated user
 * - Verifies user owns the controller
 * - Decrypts gateway IP from stored credentials
 * - Logs all control actions for audit trail
 *
 * Device Types:
 * - model: 1 = WFC01 Water Valve (4 valves max)
 * - model: 2 = AC1100 Smart Plug (2 plugs max)
 *
 * Actions:
 * - on: Turn device on (always-on mode for valves)
 * - off: Stop/turn off device
 * - status: Read current device state
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/server-encryption'
import type { Controller } from '@/types'

// ============================================
// Types
// ============================================

interface EcowittControlRequest {
  controllerId: string
  deviceId: number
  model: number
  action: 'on' | 'off' | 'status'
}

interface EcowittCommand {
  command: Array<{
    cmd: string
    id: number
    model: number
    on_type?: number
    off_type?: number
    always_on?: number
    on_time?: number
    off_time?: number
    val_type?: number
    val?: number
  }>
}

// ============================================
// Supabase Client (Service Role)
// ============================================

type SupabaseClient = ReturnType<typeof createClient>

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

/**
 * Extract and validate user ID from Bearer token.
 */
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
// Command Builder
// ============================================

/**
 * Build Ecowitt gateway command based on action and device type.
 */
function buildCommand(deviceId: number, model: number, action: string): EcowittCommand {
  if (action === 'on') {
    return {
      command: [
        {
          cmd: 'quick_run',
          on_type: 0,
          off_type: 0,
          always_on: 1,
          on_time: 0,
          off_time: 0,
          val_type: 0,
          val: 0,
          id: deviceId,
          model: model,
        },
      ],
    }
  } else if (action === 'off') {
    return {
      command: [
        {
          cmd: 'quick_stop',
          id: deviceId,
          model: model,
        },
      ],
    }
  } else {
    // status
    return {
      command: [
        {
          cmd: 'read_device',
          id: deviceId,
          model: model,
        },
      ],
    }
  }
}

// ============================================
// POST /api/ecowitt/control
// ============================================

/**
 * Control Ecowitt IoT devices via gateway local API.
 *
 * Request Body: {
 *   controllerId: string      - UUID of the Ecowitt controller
 *   deviceId: number         - Device ID (1-4 for valves, 1-2 for plugs)
 *   model: number            - 1 for WFC01 valve, 2 for AC1100 plug
 *   action: 'on'|'off'|'status'
 * }
 *
 * Response: {
 *   success: true
 *   result: <gateway response>
 *   message?: string
 * }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase()

    // Authenticate user
    const userId = await getUserId(req, client)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    let body: EcowittControlRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { controllerId, deviceId, model, action } = body

    // Validate required fields
    if (!controllerId || deviceId === undefined || model === undefined || !action) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['controllerId', 'deviceId', 'model', 'action'],
        },
        { status: 400 }
      )
    }

    // Validate action
    if (!['on', 'off', 'status'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: on, off, or status' },
        { status: 400 }
      )
    }

    // Validate model
    if (model !== 1 && model !== 2) {
      return NextResponse.json(
        { error: 'Invalid model. Must be 1 (WFC01 valve) or 2 (AC1100 plug)' },
        { status: 400 }
      )
    }

    // Validate deviceId range based on model
    if (model === 1 && (deviceId < 1 || deviceId > 4)) {
      return NextResponse.json(
        { error: 'Invalid deviceId for WFC01 valve. Must be 1-4' },
        { status: 400 }
      )
    }

    if (model === 2 && (deviceId < 1 || deviceId > 2)) {
      return NextResponse.json(
        { error: 'Invalid deviceId for AC1100 plug. Must be 1-2' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(controllerId)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get controller and verify ownership
    const { data: controller, error: controllerError } = await client
      .from('controllers')
      .select('*')
      .eq('id', controllerId)
      .eq('user_id', userId)
      .single<Controller>()

    if (controllerError || !controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    // Verify controller is Ecowitt brand
    if (controller.brand !== 'ecowitt') {
      return NextResponse.json(
        { error: 'Controller is not an Ecowitt device' },
        { status: 400 }
      )
    }

    // Decrypt credentials to get gateway IP
    if (!controller.credentials) {
      return NextResponse.json(
        { error: 'Controller has no credentials configured' },
        { status: 400 }
      )
    }

    let credentials: Record<string, unknown>
    try {
      credentials = decryptCredentials(controller.credentials)
    } catch (error) {
      console.error('[Ecowitt Control] Failed to decrypt credentials:', error)
      return NextResponse.json(
        { error: 'Failed to decrypt controller credentials' },
        { status: 500 }
      )
    }

    const gatewayIP = credentials.gatewayIP as string | undefined
    if (!gatewayIP) {
      return NextResponse.json(
        { error: 'Gateway IP not configured for this controller' },
        { status: 400 }
      )
    }

    // Build command for gateway
    const command = buildCommand(deviceId, model, action)

    // Send command to Ecowitt gateway
    let response: Response
    let result: unknown

    try {
      response = await fetch(`http://${gatewayIP}/parse_quick_cmd_iot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}: ${response.statusText}`)
      }

      result = await response.json()
    } catch (error) {
      console.error('[Ecowitt Control] Gateway communication error:', error)

      // Log failed attempt
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from('activity_logs') as any).insert({
        user_id: userId,
        controller_id: controllerId,
        action_type: 'ecowitt_control_failed',
        action_data: {
          deviceId,
          model,
          action,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        result: 'failure',
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        {
          error: 'Failed to communicate with Ecowitt gateway',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 502 }
      )
    }

    // Log successful control action
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from('activity_logs') as any).insert({
      user_id: userId,
      controller_id: controllerId,
      action_type: `ecowitt_control_${action}`,
      action_data: {
        deviceId,
        model,
        modelName: model === 1 ? 'WFC01' : 'AC1100',
        result,
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      result,
      message: `Device ${action} command sent successfully`,
    })
  } catch (error) {
    console.error('[Ecowitt Control] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
