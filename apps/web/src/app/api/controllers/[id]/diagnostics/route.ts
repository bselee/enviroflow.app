/**
 * Controller Diagnostics API Routes
 *
 * POST /api/controllers/[id]/diagnostics - Run comprehensive diagnostics test
 * GET  /api/controllers/[id]/diagnostics - Get historical diagnostics data
 *
 * Diagnostic tests include:
 * - Response time measurement (ping via API)
 * - Packet loss calculation (multiple attempts)
 * - Sync lag calculation (time since last_seen)
 * - Success rate from activity logs
 */

import { createClient, PostgrestError } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
} from '@enviroflow/automation-engine/adapters'
import {
  decryptCredentials as decryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'
import type { DiagnosticMetrics, DiagnosticHistoryPoint } from '@/lib/diagnostic-utils'
import { calculateSyncLag } from '@/lib/diagnostic-utils'

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
      console.error('[Diagnostics] Failed to decrypt credentials:', error.message)
      return {
        success: false,
        credentials: {},
        error: 'Failed to decrypt stored credentials. The encryption key may have changed.',
      }
    }
    console.error('[Diagnostics] Unexpected decryption error:', error)
    return {
      success: false,
      credentials: {},
      error: 'Unexpected error decrypting credentials.',
    }
  }
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
// Types
// ============================================

type SupabaseClient = ReturnType<typeof createClient>

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
      throw new Error('Supabase credentials not configured')
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
// POST /api/controllers/[id]/diagnostics
// Run Comprehensive Diagnostics Test
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
      .single() as { data: Record<string, unknown> | null; error: PostgrestError | null }

    if (fetchError || !controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    // Calculate sync lag
    const syncLag = calculateSyncLag(controller.last_seen)

    // Calculate success rate from activity logs (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: activityLogs } = (await client
      .from('activity_logs')
      .select('result')
      .eq('controller_id', id)
      .gte('timestamp', twentyFourHoursAgo)) as { data: Array<{ result: string }> | null }

    let successRate = 100
    if (activityLogs && activityLogs.length > 0) {
      const successCount = activityLogs.filter((log) => log.result === 'success').length
      successRate = (successCount / activityLogs.length) * 100
    }

    // For CSV upload controllers, skip connection test
    if (controller.brand === 'csv_upload') {
      const metrics: DiagnosticMetrics = {
        responseTime: 0,
        packetLoss: 0,
        syncLag,
        successRate,
        lastChecked: new Date().toISOString(),
        details: {
          totalAttempts: 0,
          successfulAttempts: 0,
          failedAttempts: 0,
          averageResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
        },
      }

      return NextResponse.json({
        success: true,
        metrics,
        message: 'CSV Upload controllers do not support connection testing',
      })
    }

    // Run connection tests (multiple attempts to calculate packet loss)
    const attempts = 5
    const responseTimes: number[] = []
    let successfulAttempts = 0
    let failedAttempts = 0
    let connectedControllerId: string | null = null

    try {
      // Decrypt credentials
      const decryptResult = decryptCredentials(controller.credentials)

      if (!decryptResult.success) {
        console.error('[Diagnostics] Credential decryption failed:', decryptResult.error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to access controller credentials. Please re-add the controller.',
          },
          { status: 500 }
        )
      }

      const storedCredentials = decryptResult.credentials as Record<string, unknown>

      // Validate credentials for brands that require them
      const brand = controller.brand as ControllerBrand
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
      const adapterCredentials = buildAdapterCredentials(brand, {
        email: storedCredentials.email as string,
        password: storedCredentials.password as string,
        type: brand,
      })

      // Get adapter and connect first
      const adapter = getAdapter(brand)
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        // Connection failed - all attempts count as failed
        failedAttempts = attempts
      } else {
        const activeControllerId = connectionResult.controllerId || controller.controller_id
        connectedControllerId = activeControllerId

        // Run multiple status checks to calculate packet loss
        for (let i = 0; i < attempts; i++) {
          const startTime = Date.now()

          try {
            const statusResult = await adapter.getStatus(activeControllerId)
            const endTime = Date.now()
            const responseTime = endTime - startTime

            if (statusResult.status !== 'error') {
              responseTimes.push(responseTime)
              successfulAttempts++
            } else {
              failedAttempts++
            }
          } catch (_error) {
            failedAttempts++
            // Continue with next attempt
          }
        }

        // Disconnect when done
        try {
          await adapter.disconnect(activeControllerId)
        } catch (disconnectErr) {
          console.warn('[Diagnostics] Error during disconnect:', disconnectErr)
        }
      }
    } catch (error) {
      console.error('[Diagnostics] Connection test error:', error)
      // If all attempts fail, return error metrics
      failedAttempts = attempts
    }

    // Calculate metrics
    const packetLoss = (failedAttempts / attempts) * 100
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0

    const metrics: DiagnosticMetrics = {
      responseTime: Math.round(averageResponseTime),
      packetLoss: Math.round(packetLoss * 10) / 10,
      syncLag,
      successRate: Math.round(successRate * 10) / 10,
      lastChecked: new Date().toISOString(),
      details: {
        totalAttempts: attempts,
        successfulAttempts,
        failedAttempts,
        averageResponseTime: Math.round(averageResponseTime),
        minResponseTime: Math.round(minResponseTime),
        maxResponseTime: Math.round(maxResponseTime),
      },
    }

    // Update controller with latest diagnostic timestamp
    const updatePayload = {
      last_seen: successfulAttempts > 0 ? new Date().toISOString() : controller.last_seen,
      status: successfulAttempts > 0 ? ('online' as const) : ('offline' as const),
      updated_at: new Date().toISOString(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any)
      .from('controllers')
      .update(updatePayload)
      .eq('id', id)

    // Log diagnostic activity
    await client.from('activity_logs').insert({
      user_id: userId,
      controller_id: id,
      action_type: 'diagnostics_run',
      action_data: {
        metrics,
        attempts,
        successfulAttempts,
        failedAttempts,
      },
      result: successfulAttempts > 0 ? ('success' as const) : ('failed' as const),
      timestamp: new Date().toISOString(),
    } as any)

    return NextResponse.json({
      success: true,
      metrics,
      message: `Diagnostics completed: ${successfulAttempts}/${attempts} successful`,
    })
  } catch (error) {
    console.error('[Diagnostics POST] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================
// GET /api/controllers/[id]/diagnostics
// Get Historical Diagnostics Data
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
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: controller, error: fetchError } = (await client
      .from('controllers')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()) as { data: { id: string } | null; error: PostgrestError | null }

    if (fetchError || !controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    // Get diagnostic history from activity logs (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: diagnosticLogs, error: logsError } = (await client
      .from('activity_logs')
      .select('timestamp, action_data, result')
      .eq('controller_id', id)
      .eq('action_type', 'diagnostics_run')
      .gte('timestamp', sevenDaysAgo)
      .order('timestamp', { ascending: true })) as { data: Array<{ timestamp: string; action_data: unknown; result: string }> | null; error: PostgrestError | null }

    if (logsError) {
      console.error('[Diagnostics GET] Error fetching logs:', logsError)
      return NextResponse.json(
        { error: 'Failed to fetch diagnostic history' },
        { status: 500 }
      )
    }

    // Transform logs into history points
    const history: DiagnosticHistoryPoint[] = (diagnosticLogs || []).map((log) => {
      const metrics = log.action_data?.metrics as DiagnosticMetrics | undefined

      return {
        timestamp: log.timestamp,
        responseTime: metrics?.responseTime || 0,
        packetLoss: metrics?.packetLoss || 0,
        syncLag: metrics?.syncLag || 0,
        successRate: metrics?.successRate || 0,
      }
    })

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    })
  } catch (error) {
    console.error('[Diagnostics GET] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
