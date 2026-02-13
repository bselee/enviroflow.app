/**
 * Advance Automations API Route
 *
 * GET /api/controllers/[id]/automations - Get all automations for a controller
 * POST /api/controllers/[id]/automations - Create a new automation
 *
 * Automations are time-windowed mode overrides that allow scheduling
 * different modes for different times of day.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { decryptCredentials, EncryptionError } from '@/lib/server-encryption'
import { safeError } from '@/lib/sanitize-log'

import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
} from '@enviroflow/automation-engine/adapters'

// ============================================
// Types
// ============================================

type SupabaseClient = ReturnType<typeof createClient<never>>

interface RouteParams {
  params: Promise<{ id: string }>
}

interface CreateAutomationRequest {
  port: number
  name: string
  enabled: boolean
  startTime: string // HH:MM
  endTime: string // HH:MM
  days?: number[] // 0-6, 0=Sunday
  mode: number // 0=OFF, 1=ON, 2=AUTO, 4=CYCLE
  modeSettings?: Record<string, unknown>
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
// GET /api/controllers/[id]/automations
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid controller ID format' }, { status: 400 })
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

    // Only AC Infinity supports advance automations
    if (brand !== 'ac_infinity') {
      return NextResponse.json({
        success: true,
        automations: [],
        message: 'Advance automations are only supported for AC Infinity controllers'
      })
    }

    try {
      const adapter = getAdapter(brand)

      // Decrypt stored credentials
      let storedCredentials: Record<string, unknown>
      try {
        storedCredentials = decryptCredentials(controller.credentials)
      } catch (decryptError) {
        if (decryptError instanceof EncryptionError) {
          safeError('[Automations] Credential decryption failed:', decryptError.message)
        }
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to access controller credentials. Please re-add the controller.',
          },
          { status: 500 }
        )
      }

      // Build credentials
      const adapterCredentials: ACInfinityCredentials = {
        type: 'ac_infinity',
        email: storedCredentials.email as string,
        password: storedCredentials.password as string,
      }

      // Connect to controller
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        return NextResponse.json({
          success: false,
          error: connectionResult.error || 'Failed to connect to controller'
        }, { status: 503 })
      }

      // Get automations - check if adapter has the method
      const acAdapter = adapter as any
      if (typeof acAdapter.getAdvanceAutomations !== 'function') {
        return NextResponse.json({
          success: true,
          automations: [],
          message: 'Advance automations API not available'
        })
      }

      const controllerId = connectionResult.controllerId || id
      const result = await acAdapter.getAdvanceAutomations(controllerId)

      // Disconnect
      try {
        await adapter.disconnect(controllerId)
      } catch (disconnectErr) {
        console.warn('[Automations] Error during disconnect:', disconnectErr)
      }

      return NextResponse.json({
        success: result.success,
        automations: result.automations || [],
        endpointUsed: result.endpointUsed,
        explorationResults: result.explorationResults,
        error: result.error
      })

    } catch (adapterError) {
      safeError('[Automations] Adapter error:', adapterError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch automations from controller'
        },
        { status: 503 }
      )
    }
  } catch (error) {
    safeError('[Automations] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/controllers/[id]/automations
// ============================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid controller ID format' }, { status: 400 })
    }

    // Parse request body
    let body: CreateAutomationRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate required fields
    if (!body.port || !body.name || !body.startTime || !body.endTime || body.mode === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: port, name, startTime, endTime, mode' },
        { status: 400 }
      )
    }

    // Validate port (1-4 for most AC Infinity controllers)
    if (!Number.isInteger(body.port) || body.port < 1 || body.port > 8) {
      return NextResponse.json(
        { error: 'Invalid port number. Must be 1-8.' },
        { status: 400 }
      )
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(body.startTime) || !timeRegex.test(body.endTime)) {
      return NextResponse.json(
        { error: 'Invalid time format. Use HH:MM (24-hour).' },
        { status: 400 }
      )
    }

    // Validate mode (0=OFF, 1=ON, 2=AUTO, 4=CYCLE are primary modes)
    const validModes = [0, 1, 2, 3, 4, 5, 6, 7]
    if (!validModes.includes(body.mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be 0-7.' },
        { status: 400 }
      )
    }

    // Validate days array if provided
    if (body.days && (!Array.isArray(body.days) || body.days.some((d: number) => d < 0 || d > 6))) {
      return NextResponse.json(
        { error: 'Invalid days array. Must contain values 0-6 (0=Sunday).' },
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

    // Only AC Infinity supports advance automations
    if (brand !== 'ac_infinity') {
      return NextResponse.json({
        success: false,
        error: 'Advance automations are only supported for AC Infinity controllers'
      }, { status: 400 })
    }

    try {
      const adapter = getAdapter(brand)

      // Decrypt stored credentials
      let storedCredentials: Record<string, unknown>
      try {
        storedCredentials = decryptCredentials(controller.credentials)
      } catch (decryptError) {
        if (decryptError instanceof EncryptionError) {
          safeError('[Automations] Credential decryption failed:', decryptError.message)
        }
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to access controller credentials. Please re-add the controller.',
          },
          { status: 500 }
        )
      }

      // Build credentials
      const adapterCredentials: ACInfinityCredentials = {
        type: 'ac_infinity',
        email: storedCredentials.email as string,
        password: storedCredentials.password as string,
      }

      // Connect to controller
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        return NextResponse.json({
          success: false,
          error: connectionResult.error || 'Failed to connect to controller'
        }, { status: 503 })
      }

      // Create automation - check if adapter has the method
      const acAdapter = adapter as any
      if (typeof acAdapter.setAdvanceAutomation !== 'function') {
        return NextResponse.json({
          success: false,
          error: 'Advance automations API not available'
        }, { status: 501 })
      }

      const controllerId = connectionResult.controllerId || id

      // Build automation object
      const automation = {
        autoName: body.name,
        devId: controllerId,
        port: body.port,
        isOpen: body.enabled ? 1 : 0,
        startTime: body.startTime,
        endTime: body.endTime,
        week: body.days ? body.days.map(d => d + 1).join(',') : '1,2,3,4,5,6,7', // AC Infinity uses 1-7
        devModeOne: body.mode,
        ...body.modeSettings
      }

      const result = await acAdapter.setAdvanceAutomation(controllerId, automation)

      // Disconnect
      try {
        await adapter.disconnect(controllerId)
      } catch (disconnectErr) {
        console.warn('[Automations] Error during disconnect:', disconnectErr)
      }

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || 'Failed to create automation'
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        automationId: result.automationId,
        endpointUsed: result.endpointUsed
      })

    } catch (adapterError) {
      safeError('[Automations] Adapter error:', adapterError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create automation on controller'
        },
        { status: 503 }
      )
    }
  } catch (error) {
    safeError('[Automations] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
