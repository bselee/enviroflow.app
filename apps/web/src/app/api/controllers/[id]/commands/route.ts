/**
 * Command History API Route
 *
 * GET /api/controllers/[id]/commands - Get command history with audit trail
 *
 * Query Parameters:
 * - limit: Number of commands to return (default 50, max 200)
 * - offset: Offset for pagination (default 0)
 * - port: Filter by port number
 * - success: Filter by success status (true/false)
 * - startDate: Filter commands after this date (ISO 8601)
 * - endDate: Filter commands before this date (ISO 8601)
 *
 * Response:
 * {
 *   success: boolean
 *   commands: CommandHistoryEntry[]
 *   pagination: {
 *     total: number
 *     limit: number
 *     offset: number
 *     hasMore: boolean
 *   }
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { safeError } from '@/lib/sanitize-log'

// ============================================
// Types
// ============================================

type SupabaseClient = ReturnType<typeof createClient<never>>

interface RouteParams {
  params: Promise<{ id: string }>
}

interface CommandHistoryEntry {
  commandId: string
  port: number
  commandType: string
  targetValue?: number
  stateBefore: Record<string, unknown>
  stateAfter?: Record<string, unknown>
  success: boolean
  verificationPassed?: boolean
  verificationAttempts: number
  rollbackAttempted: boolean
  rollbackSuccess?: boolean
  errorMessage?: string
  source: string
  metrics: {
    executionDurationMs: number
    verificationDurationMs?: number
    totalDurationMs: number
    apiCallCount: number
  }
  executedAt: string
  completedAt?: string
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
// GET /api/controllers/[id]/commands
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

    // Rate limiting: 60 requests per minute per user
    const rateLimitResult = checkRateLimit(userId, {
      maxRequests: 60,
      windowMs: 60 * 1000,
      keyPrefix: 'command-history'
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
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

    // Verify controller ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: controller, error: controllerError } = await (client as any)
      .from('controllers')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (controllerError || !controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)
    const portFilter = url.searchParams.get('port')
    const successFilter = url.searchParams.get('success')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (client as any)
      .from('command_history')
      .select('*', { count: 'exact' })
      .eq('controller_id', id)
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (portFilter) {
      query = query.eq('port', parseInt(portFilter, 10))
    }
    if (successFilter !== null) {
      query = query.eq('success', successFilter === 'true')
    }
    if (startDate) {
      query = query.gte('executed_at', startDate)
    }
    if (endDate) {
      query = query.lte('executed_at', endDate)
    }

    const { data: commands, error: queryError, count } = await query

    if (queryError) {
      safeError('[Commands] Query error:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch command history' },
        { status: 500 }
      )
    }

    // Transform to response format
    const commandEntries: CommandHistoryEntry[] = (commands || []).map((cmd: Record<string, unknown>) => ({
      commandId: cmd.command_id as string,
      port: cmd.port as number,
      commandType: cmd.command_type as string,
      targetValue: cmd.target_value as number | undefined,
      stateBefore: cmd.state_before as Record<string, unknown>,
      stateAfter: cmd.state_after as Record<string, unknown> | undefined,
      success: cmd.success as boolean,
      verificationPassed: cmd.verification_passed as boolean | undefined,
      verificationAttempts: cmd.verification_attempts as number || 0,
      rollbackAttempted: cmd.rollback_attempted as boolean || false,
      rollbackSuccess: cmd.rollback_success as boolean | undefined,
      errorMessage: cmd.error_message as string | undefined,
      source: cmd.source as string || 'user',
      metrics: {
        executionDurationMs: cmd.execution_duration_ms as number || 0,
        verificationDurationMs: cmd.verification_duration_ms as number | undefined,
        totalDurationMs: cmd.total_duration_ms as number || 0,
        apiCallCount: cmd.api_call_count as number || 1,
      },
      executedAt: cmd.executed_at as string,
      completedAt: cmd.completed_at as string | undefined,
    }))

    return NextResponse.json({
      success: true,
      commands: commandEntries,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    }, {
      headers: createRateLimitHeaders(rateLimitResult)
    })

  } catch (error) {
    safeError('[Commands] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
