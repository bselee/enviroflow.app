/**
 * Controller Credential Update API Route
 *
 * PUT /api/controllers/[id]/credentials - Update and revalidate controller credentials
 *
 * Features:
 * - Rate limiting: max 5 attempts per hour per controller
 * - Re-tests connection with new credentials
 * - Updates encrypted credentials in database on success
 * - Resets controller status to 'online' on successful validation
 * - Creates audit log entry for security tracking
 * - Returns detailed error guidance
 *
 * Security:
 * - Verifies user owns the controller
 * - Credentials are encrypted with AES-256-GCM before storage
 * - Rate limiting prevents brute force attempts
 * - All attempts are logged for security auditing
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  encryptCredentials as encryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'
import { getAdapter } from '@enviroflow/automation-engine/adapters'
import type {
  ControllerBrand,
  ControllerCredentials,
} from '@enviroflow/automation-engine/adapters'

// ============================================
// Types
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

interface UpdateCredentialsRequest {
  email: string
  password: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================
// Constants
// ============================================

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_ATTEMPTS_PER_HOUR = 5

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
// Credential Encryption
// ============================================

function encryptCredentials(credentials: Record<string, unknown>): string {
  try {
    return encryptCredentialsAES(credentials)
  } catch (error) {
    if (error instanceof EncryptionError) {
      console.error('[Encryption] Configuration error - ensure ENCRYPTION_KEY is set')
    }
    throw new Error('Failed to encrypt credentials')
  }
}

// ============================================
// Rate Limiting
// ============================================

async function checkRateLimit(
  client: SupabaseClient,
  controllerId: string,
  userId: string
): Promise<{ allowed: boolean; remainingAttempts: number; error?: string }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()

  // Count recent credential update attempts
  const { data: recentAttempts, error } = await client
    .from('activity_logs')
    .select('id')
    .eq('controller_id', controllerId)
    .eq('user_id', userId)
    .eq('action_type', 'credential_update_attempt')
    .gte('timestamp', windowStart)

  if (error) {
    console.error('[RateLimit] Error checking attempts:', error)
    // Allow request on error to avoid blocking legitimate users
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS_PER_HOUR }
  }

  const attemptCount = recentAttempts?.length || 0
  const remainingAttempts = Math.max(0, MAX_ATTEMPTS_PER_HOUR - attemptCount)

  if (attemptCount >= MAX_ATTEMPTS_PER_HOUR) {
    return {
      allowed: false,
      remainingAttempts: 0,
      error: `Too many credential update attempts. Maximum ${MAX_ATTEMPTS_PER_HOUR} attempts per hour. Please try again later.`,
    }
  }

  return {
    allowed: true,
    remainingAttempts,
  }
}

// ============================================
// Ownership Verification
// ============================================

async function getOwnedController(
  client: SupabaseClient,
  controllerId: string,
  userId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from('controllers')
    .select('*')
    .eq('id', controllerId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data as Record<string, unknown>
}

// ============================================
// Log Activity
// ============================================

async function logCredentialUpdateAttempt(
  client: SupabaseClient,
  userId: string,
  controllerId: string,
  result: 'success' | 'failed',
  errorMessage?: string
): Promise<void> {
  const ipAddress = null // Could extract from request headers if needed
  const userAgent = null // Could extract from request headers if needed

  await client.from('activity_logs').insert({
    user_id: userId,
    controller_id: controllerId,
    action_type: 'credential_update_attempt',
    action_data: {
      timestamp: new Date().toISOString(),
    },
    result,
    error_message: errorMessage || null,
    ip_address: ipAddress,
    user_agent: userAgent,
    timestamp: new Date().toISOString(),
  })
}

// ============================================
// PUT /api/controllers/[id]/credentials
// ============================================

/**
 * Update controller credentials and revalidate connection.
 *
 * Request Body: {
 *   email: string
 *   password: string
 * }
 *
 * Response (Success): {
 *   success: true
 *   message: string
 *   controller: { id, name, status, ... }
 * }
 *
 * Response (Error): {
 *   success: false
 *   error: string
 *   details?: string
 *   remainingAttempts?: number
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get existing controller (verify ownership)
    const existingController = await getOwnedController(client, id, userId)

    if (!existingController) {
      return NextResponse.json(
        { success: false, error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    const brand = existingController.brand as ControllerBrand

    // Only support credential updates for brands that require credentials
    if (brand !== 'ac_infinity' && brand !== 'inkbird') {
      return NextResponse.json(
        {
          success: false,
          error: `Credential updates are not supported for ${brand}`,
        },
        { status: 400 }
      )
    }

    // Check rate limiting
    const rateLimitResult = await checkRateLimit(client, id, userId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.error || 'Too many attempts',
          remainingAttempts: rateLimitResult.remainingAttempts,
        },
        { status: 429 }
      )
    }

    // Parse request body
    let body: UpdateCredentialsRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
          requiredFields: ['email', 'password'],
        },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Test connection with new credentials
    let connectionResult
    try {
      const adapter = getAdapter(brand)
      const adapterCredentials: ControllerCredentials = {
        type: brand,
        email,
        password,
      }

      connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        // Log failed attempt
        await logCredentialUpdateAttempt(
          client,
          userId,
          id,
          'failed',
          connectionResult.error || 'Connection verification failed'
        )

        return NextResponse.json(
          {
            success: false,
            error: 'Failed to verify credentials',
            details: connectionResult.error || 'Connection rejected by controller service',
            remainingAttempts: rateLimitResult.remainingAttempts - 1,
          },
          { status: 400 }
        )
      }

      // Disconnect after verification
      if (connectionResult.controllerId) {
        await adapter.disconnect(connectionResult.controllerId)
      }
    } catch (adapterError) {
      console.error('[Credentials PUT] Adapter error:', adapterError)

      // Log failed attempt
      await logCredentialUpdateAttempt(
        client,
        userId,
        id,
        'failed',
        adapterError instanceof Error ? adapterError.message : 'Unknown adapter error'
      )

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify credentials',
          details: adapterError instanceof Error ? adapterError.message : 'Unknown error',
          remainingAttempts: rateLimitResult.remainingAttempts - 1,
        },
        { status: 400 }
      )
    }

    // Encrypt new credentials
    const encryptedCredentials = encryptCredentials({
      type: brand,
      email,
      password,
    })

    // Build update object
    const updates: Record<string, unknown> = {
      credentials: encryptedCredentials,
      status: 'online',
      last_seen: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }

    // Update controller_id and metadata from new connection
    if (connectionResult.controllerId) {
      updates.controller_id = connectionResult.controllerId
    }
    if (connectionResult.metadata) {
      updates.capabilities = connectionResult.metadata.capabilities
      updates.model = connectionResult.metadata.model
      updates.firmware_version = connectionResult.metadata.firmwareVersion
    }

    // Perform database update
    const { data: updatedController, error: updateError } = await client
      .from('controllers')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(
        `
        id,
        brand,
        controller_id,
        name,
        capabilities,
        status,
        last_seen,
        last_error,
        firmware_version,
        model,
        room_id,
        created_at,
        updated_at
      `
      )
      .single()

    if (updateError) {
      console.error('[Credentials PUT] Database error:', updateError)

      // Log failed attempt
      await logCredentialUpdateAttempt(
        client,
        userId,
        id,
        'failed',
        'Database update failed'
      )

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update credentials in database',
          details: updateError.message,
        },
        { status: 500 }
      )
    }

    // Log successful credential update (security audit)
    await client.from('activity_logs').insert({
      user_id: userId,
      controller_id: id,
      action_type: 'credential_update_success',
      action_data: {
        controller_name: existingController.name,
        brand,
        previous_status: existingController.status,
        new_status: 'online',
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Credentials updated and verified successfully. Controller is now online.',
      controller: updatedController,
    })
  } catch (error) {
    console.error('[Credentials PUT] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
