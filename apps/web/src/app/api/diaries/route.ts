/**
 * Diary Cycles API Routes
 *
 * GET  /api/diaries  - List all diary cycles for authenticated user
 * POST /api/diaries  - Create a new diary cycle
 *
 * Diary cycles are used to track growing periods with diary entries,
 * photos, and environmental data logging.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sanitizeName, sanitizeDescription } from '@/lib/sanitize-input'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// ============================================
// Validation Schemas
// ============================================

const DiaryCycleStages = [
  'germination',
  'seedling',
  'vegetative',
  'flowering',
  'harvest',
  'cure'
] as const

const DiaryCycleStatuses = ['active', 'completed', 'archived'] as const

const CreateDiaryCycleSchema = z.object({
  name: z
    .string()
    .transform(sanitizeName)
    .pipe(z.string().min(1, 'Cycle name is required').max(100, 'Cycle name must be 100 characters or less')),
  description: z
    .string()
    .transform(sanitizeDescription)
    .pipe(z.string().max(1000, 'Description must be 1000 characters or less'))
    .optional()
    .nullable(),
  started_at: z.string().datetime().optional(),
  room_id: z.string().uuid().optional().nullable(),
  controller_ids: z.array(z.string().uuid()).optional().default([]),
  current_stage: z.enum(DiaryCycleStages).optional().default('seedling'),
  enable_device_logging: z.boolean().optional().default(true),
  enable_sensor_logging: z.boolean().optional().default(true)
})

type CreateDiaryCycleInput = z.infer<typeof CreateDiaryCycleSchema>

// ============================================
// Supabase Client Setup
// ============================================

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }

    supabase = createClient(url, key)
  }
  return supabase
}

// ============================================
// Authentication Helper
// ============================================

async function getUserId(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      return user.id
    }
  }
  return null
}

// ============================================
// GET /api/diaries
// ============================================

/**
 * List all diary cycles for the authenticated user
 *
 * Query parameters:
 * - status: string - Filter by status (active, completed, archived)
 * - room_id: string - Filter by room ID
 * - include_counts: boolean - Include entry/photo counts (default: true)
 *
 * Response:
 * {
 *   cycles: DiaryCycleWithCounts[],
 *   count: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const roomId = searchParams.get('room_id')
    const includeCounts = searchParams.get('include_counts') !== 'false'

    // Build query
    let query = supabase
      .from('grow_cycles')
      .select(`
        id,
        user_id,
        name,
        description,
        started_at,
        ended_at,
        room_id,
        controller_ids,
        current_stage,
        status,
        enable_device_logging,
        enable_sensor_logging,
        created_at,
        updated_at,
        rooms (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    // Apply filters
    if (status && DiaryCycleStatuses.includes(status as typeof DiaryCycleStatuses[number])) {
      query = query.eq('status', status)
    }

    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    const { data: cycles, error: cyclesError } = await query

    if (cyclesError) {
      console.error('Failed to fetch diary cycles:', cyclesError)
      return NextResponse.json(
        { error: 'Failed to fetch diary cycles', details: cyclesError.message },
        { status: 500 }
      )
    }

    let enrichedCycles = cycles || []

    // Add entry and photo counts if requested
    if (includeCounts && enrichedCycles.length > 0) {
      const cycleIds = enrichedCycles.map(c => c.id)

      // Get entry counts
      const { data: entryCounts } = await supabase
        .from('diary_entries')
        .select('cycle_id')
        .in('cycle_id', cycleIds)

      // Get photo counts via entries
      const { data: photoCounts } = await supabase
        .from('diary_photos')
        .select('entry_id, diary_entries!inner(cycle_id)')
        .in('diary_entries.cycle_id', cycleIds)

      // Build count maps
      const entryCountMap = new Map<string, number>()
      for (const entry of entryCounts || []) {
        entryCountMap.set(entry.cycle_id, (entryCountMap.get(entry.cycle_id) || 0) + 1)
      }

      const photoCountMap = new Map<string, number>()
      for (const photo of photoCounts || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cycleId = (photo.diary_entries as any)?.cycle_id
        if (cycleId) {
          photoCountMap.set(cycleId, (photoCountMap.get(cycleId) || 0) + 1)
        }
      }

      enrichedCycles = enrichedCycles.map(cycle => ({
        ...cycle,
        room: cycle.rooms,
        entry_count: entryCountMap.get(cycle.id) || 0,
        photo_count: photoCountMap.get(cycle.id) || 0
      }))
    } else {
      // Add room alias
      enrichedCycles = enrichedCycles.map(cycle => ({
        ...cycle,
        room: cycle.rooms
      }))
    }

    return NextResponse.json({
      cycles: enrichedCycles,
      count: enrichedCycles.length
    })

  } catch (error) {
    console.error('Diary cycles GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/diaries
// ============================================

/**
 * Create a new diary cycle
 *
 * Request body:
 * {
 *   name: string (required)
 *   description?: string
 *   started_at?: string (ISO datetime)
 *   room_id?: string
 *   controller_ids?: string[]
 *   current_stage?: DiaryCycleStage
 *   enable_device_logging?: boolean
 *   enable_sensor_logging?: boolean
 * }
 *
 * Response:
 * {
 *   cycle: DiaryCycle,
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationResult = CreateDiaryCycleSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      )
    }

    const input: CreateDiaryCycleInput = validationResult.data

    // Check for duplicate cycle name for this user
    const { data: existingCycle } = await supabase
      .from('grow_cycles')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', input.name)
      .single()

    if (existingCycle) {
      return NextResponse.json(
        { error: 'A diary cycle with this name already exists' },
        { status: 409 }
      )
    }

    // Validate room_id if provided
    if (input.room_id) {
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', input.room_id)
        .eq('user_id', userId)
        .single()

      if (!room) {
        return NextResponse.json(
          { error: 'Room not found' },
          { status: 404 }
        )
      }
    }

    // Validate controller_ids if provided
    if (input.controller_ids.length > 0) {
      const { data: controllers } = await supabase
        .from('controllers')
        .select('id')
        .in('id', input.controller_ids)
        .eq('user_id', userId)

      if (!controllers || controllers.length !== input.controller_ids.length) {
        return NextResponse.json(
          { error: 'One or more controllers not found' },
          { status: 404 }
        )
      }
    }

    // Create the diary cycle
    const { data: cycle, error: insertError } = await supabase
      .from('grow_cycles')
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description || null,
        started_at: input.started_at || new Date().toISOString(),
        room_id: input.room_id || null,
        controller_ids: input.controller_ids,
        current_stage: input.current_stage,
        status: 'active',
        enable_device_logging: input.enable_device_logging,
        enable_sensor_logging: input.enable_sensor_logging
      })
      .select(`
        *,
        rooms (
          id,
          name
        )
      `)
      .single()

    if (insertError) {
      console.error('Failed to create diary cycle:', insertError)
      return NextResponse.json(
        { error: 'Failed to create diary cycle', details: insertError.message },
        { status: 500 }
      )
    }

    // Enable device state logging in user preferences if the cycle has it enabled
    if (input.enable_device_logging) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId)
        if (user) {
          const currentMetadata = user.user_metadata || {}
          const currentPrefs = currentMetadata.dashboard_preferences || {}

          // Only update if not already enabled
          if (!currentPrefs.enableDeviceStateLogging) {
            await supabase.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...currentMetadata,
                dashboard_preferences: {
                  ...currentPrefs,
                  enableDeviceStateLogging: true
                }
              }
            })
          }
        }
      } catch (err) {
        // Non-fatal: log but don't fail the cycle creation
        console.warn('Failed to enable device state logging in preferences:', err)
      }
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        room_id: input.room_id || null,
        action_type: 'diary_cycle_created',
        details: {
          name: input.name,
          cycle_id: cycle.id,
          stage: input.current_stage
        },
        result: 'success'
      })

    return NextResponse.json(
      {
        cycle: {
          ...cycle,
          room: cycle.rooms,
          entry_count: 0,
          photo_count: 0
        },
        message: `Diary cycle "${input.name}" created successfully`
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Diary cycles POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
