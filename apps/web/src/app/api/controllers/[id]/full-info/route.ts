/**
 * Controller Full Info API Route
 *
 * GET /api/controllers/[id]/full-info - Fetch comprehensive controller information
 *
 * Returns all available metadata including:
 * - Model, firmware, MAC address
 * - Active modes and schedules
 * - Port/device details with current state
 * - Sensor capabilities
 * - Controller status
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  decryptCredentials as decryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'
import { safeError } from '@/lib/sanitize-log'

// Import adapter factory
import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
} from '@enviroflow/automation-engine/adapters'

// ============================================
// Types
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

interface RouteParams {
  params: Promise<{ id: string }>
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
  // Bearer token authentication only
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
      safeError('[Full Info] Failed to decrypt credentials:', error.message)
      return {
        success: false,
        credentials: {},
        error: 'Failed to decrypt stored credentials. The encryption key may have changed.',
      }
    }
    safeError('[Full Info] Unexpected error:', error)
    return {
      success: false,
      credentials: {},
      error: 'Unexpected error decrypting credentials.',
    }
  }
}

// ============================================
// Build Adapter Credentials
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
// GET /api/controllers/[id]/full-info
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get controller with credentials
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

    const brand = controller.brand as ControllerBrand

    try {
      const adapter = getAdapter(brand)

      // Decrypt stored credentials
      const decryptResult = decryptCredentials(controller.credentials)

      if (!decryptResult.success) {
        safeError('[Full Info] Credential decryption failed:', decryptResult.error)
        return NextResponse.json(
          {
            success: false,
            controllerId: id,
            controllerName: controller.name,
            metadata: {
              brand,
              status: 'error',
            },
            timestamp: new Date().toISOString(),
            error: 'Failed to access controller credentials. Please re-add the controller.',
          },
          { status: 500 }
        )
      }

      const storedCredentials = decryptResult.credentials

      // Validate we have required credentials for cloud-connected brands
      if (brand === 'ac_infinity' || brand === 'inkbird') {
        const email = storedCredentials.email
        const password = storedCredentials.password

        if (typeof email !== 'string' || !email ||
            typeof password !== 'string' || !password) {
          const brandName = brand === 'ac_infinity' ? 'AC Infinity' : 'Inkbird'
          console.error(`[Full Info] Missing/invalid credentials for ${brandName} controller`)
          return NextResponse.json(
            {
              success: false,
              controllerId: id,
              controllerName: controller.name,
              metadata: {
                brand,
                status: 'error',
              },
              timestamp: new Date().toISOString(),
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

      // Connect to get fresh metadata
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        console.error('[Full Info] Connection failed:', connectionResult.error)

        // Update controller status
        await client
          .from('controllers')
          .update({
            status: 'offline',
            last_error: connectionResult.error || 'Connection failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        return NextResponse.json({
          success: true,
          controllerId: id,
          controllerName: controller.name,
          metadata: {
            brand,
            model: controller.model,
            firmwareVersion: controller.firmware_version,
            status: 'offline',
            capabilities: controller.capabilities,
          },
          timestamp: new Date().toISOString(),
          error: connectionResult.error,
        })
      }

      const controllerId = connectionResult.controllerId || id
      const metadata = connectionResult.metadata

      // Disconnect after getting metadata
      try {
        await adapter.disconnect(controllerId)
      } catch (disconnectErr) {
        console.warn('[Full Info] Error during disconnect:', disconnectErr)
      }

      // Update controller status
      await client
        .from('controllers')
        .update({
          status: 'online',
          last_seen: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
          // Update stored metadata
          firmware_version: metadata.firmwareVersion || controller.firmware_version,
          model: metadata.model || controller.model,
        })
        .eq('id', id)

      // Format response with comprehensive metadata
      return NextResponse.json({
        success: true,
        controllerId: id,
        controllerName: controller.name,
        metadata: {
          brand: metadata.brand,
          model: metadata.model,
          firmwareVersion: metadata.firmwareVersion,
          macAddress: metadata.macAddress,
          lastOnlineTime: metadata.lastOnlineTime?.toISOString(),
          status: 'online',
          capabilities: metadata.capabilities,
          modes: metadata.modes,
        },
        timestamp: new Date().toISOString(),
      })

    } catch (adapterError) {
      safeError('[Full Info] Adapter error:', adapterError)

      const errorMessage =
        adapterError instanceof Error ? adapterError.message : 'Unknown adapter error'

      // Update controller status
      await client
        .from('controllers')
        .update({
          status: 'error',
          last_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json(
        {
          success: false,
          controllerId: id,
          controllerName: controller.name,
          metadata: {
            brand,
            status: 'error',
          },
          timestamp: new Date().toISOString(),
          error: 'Failed to retrieve controller information. The controller may be offline or unreachable.',
        },
        { status: 503 }
      )
    }
  } catch (error) {
    safeError('[Full Info] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
