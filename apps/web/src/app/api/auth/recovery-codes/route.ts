/**
 * Recovery Codes API Route
 *
 * POST /api/auth/recovery-codes - Generate cryptographically secure recovery codes
 *
 * This endpoint generates recovery codes server-side using crypto.randomBytes
 * for secure random number generation. These codes can be used as backup
 * authentication when the user loses access to their authenticator app.
 *
 * SECURITY NOTES:
 * - Uses crypto.randomBytes for cryptographically secure random generation
 * - Codes are generated server-side only (never client-side)
 * - Each code can only be used once (usage tracking handled by Supabase Auth)
 * - Codes should be displayed once and never stored in plain text after initial display
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { generateRecoveryCodes } from '@/lib/server-encryption'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

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

/**
 * Extract and validate user ID from request.
 * Uses Bearer token authentication only.
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
// POST /api/auth/recovery-codes
// ============================================

/**
 * Generate cryptographically secure recovery codes.
 *
 * Request body (optional):
 * {
 *   count?: number      // Number of codes to generate (default: 8, max: 16)
 *   length?: number     // Length of each code segment (default: 4, max: 6)
 *   segments?: number   // Number of segments per code (default: 2, max: 4)
 * }
 *
 * Response:
 * {
 *   success: true
 *   codes: string[]     // Array of recovery codes in format "XXXX-XXXX"
 *   generated_at: string
 *   warning: string     // Reminder to store codes securely
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. You must be logged in to generate recovery codes.' },
        { status: 401 }
      )
    }

    // Parse optional parameters from request body
    let count = 8
    let length = 4
    let segments = 2

    try {
      const body = await request.json().catch(() => ({}))

      // Validate and apply custom parameters with reasonable limits
      if (typeof body.count === 'number' && body.count >= 4 && body.count <= 16) {
        count = body.count
      }
      if (typeof body.length === 'number' && body.length >= 3 && body.length <= 6) {
        length = body.length
      }
      if (typeof body.segments === 'number' && body.segments >= 1 && body.segments <= 4) {
        segments = body.segments
      }
    } catch {
      // Use defaults if parsing fails
    }

    // Generate cryptographically secure recovery codes
    const codes = generateRecoveryCodes(count, length, segments)

    // Log activity (without the actual codes)
    await client.from('activity_logs').insert({
      user_id: userId,
      action_type: 'recovery_codes_generated',
      action_data: {
        count,
        timestamp: new Date().toISOString(),
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      codes,
      generated_at: new Date().toISOString(),
      warning:
        'Store these codes in a secure location. Each code can only be used once. ' +
        'You will not be able to see these codes again after closing this dialog.',
    })
  } catch (error) {
    console.error('[Recovery Codes POST] Error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      {
        error: 'Failed to generate recovery codes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
