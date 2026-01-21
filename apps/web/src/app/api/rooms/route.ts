/**
 * Rooms API Routes
 *
 * GET  /api/rooms  - List all rooms for authenticated user with controller counts
 * POST /api/rooms  - Create a new room
 *
 * Rooms are logical groupings of controllers (e.g., "Grow Tent A", "Clone Room").
 * They support:
 * - Location-based sunrise/sunset calculations
 * - Growth stage tracking
 * - Custom settings per room
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// ============================================
// Validation Schemas
// ============================================

/**
 * Schema for creating a new room
 */
const CreateRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(100, 'Room name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  settings: z.record(z.unknown()).optional().default({}),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional()
    .nullable(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional()
    .nullable(),
  timezone: z
    .string()
    .max(50)
    .optional()
    .default('UTC'),
  current_stage: z.string().max(50).optional().nullable()
})

type CreateRoomInput = z.infer<typeof CreateRoomSchema>

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

/**
 * Extract and validate user ID from request.
 * Uses Bearer token authentication only.
 *
 * SECURITY: x-user-id header bypass has been removed. All authentication
 * must go through Supabase Auth with a valid Bearer token.
 */
async function getUserId(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  // Bearer token authentication only
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
// GET /api/rooms
// ============================================

/**
 * List all rooms for the authenticated user
 *
 * Query parameters:
 * - include_controllers: boolean - Include controller counts (default: true)
 * - include_sensor_summary: boolean - Include latest sensor readings summary (default: false)
 *
 * Response:
 * {
 *   rooms: Room[],
 *   count: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide Authorization header or x-user-id for testing.' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const includeControllers = searchParams.get('include_controllers') !== 'false'
    const includeSensorSummary = searchParams.get('include_sensor_summary') === 'true'

    // Fetch rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select(`
        id,
        name,
        description,
        settings,
        current_stage,
        stage_started_at,
        latitude,
        longitude,
        timezone,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (roomsError) {
      console.error('Failed to fetch rooms:', roomsError)
      return NextResponse.json(
        { error: 'Failed to fetch rooms', details: roomsError.message },
        { status: 500 }
      )
    }

    // Enrich rooms with controller counts if requested
    let enrichedRooms = rooms || []

    if (includeControllers && enrichedRooms.length > 0) {
      // Get controller counts per room
      const { data: controllerCounts, error: countsError } = await supabase
        .from('controllers')
        .select('room_id')
        .eq('user_id', userId)
        .not('room_id', 'is', null)

      if (!countsError && controllerCounts) {
        // Count controllers per room
        const countMap = new Map<string, number>()
        for (const controller of controllerCounts) {
          const count = countMap.get(controller.room_id) || 0
          countMap.set(controller.room_id, count + 1)
        }

        // Add counts to rooms
        enrichedRooms = enrichedRooms.map(room => ({
          ...room,
          controller_count: countMap.get(room.id) || 0
        }))
      }
    }

    // Include sensor summary if requested
    if (includeSensorSummary && enrichedRooms.length > 0) {
      // Get latest sensor readings for each room's controllers
      const roomIds = enrichedRooms.map(r => r.id)

      const { data: readings, error: readingsError } = await supabase
        .from('sensor_readings')
        .select(`
          sensor_type,
          value,
          unit,
          timestamp,
          controllers!inner (room_id)
        `)
        .in('controllers.room_id', roomIds)
        .order('timestamp', { ascending: false })
        .limit(100)

      if (!readingsError && readings) {
        // Group readings by room
        const readingsByRoom = new Map<string, Record<string, { value: number; unit: string }>>()

        for (const reading of readings) {
          // Handle both single object and array from Supabase join
          const controllers = reading.controllers as { room_id?: string } | { room_id?: string }[] | null
          const roomId = Array.isArray(controllers)
            ? controllers[0]?.room_id
            : controllers?.room_id
          if (!roomId) continue

          if (!readingsByRoom.has(roomId)) {
            readingsByRoom.set(roomId, {})
          }

          const roomReadings = readingsByRoom.get(roomId)!
          // Only keep the first (most recent) reading of each type
          if (!roomReadings[reading.sensor_type]) {
            roomReadings[reading.sensor_type] = {
              value: reading.value,
              unit: reading.unit
            }
          }
        }

        // Add sensor summary to rooms
        enrichedRooms = enrichedRooms.map(room => ({
          ...room,
          sensor_summary: readingsByRoom.get(room.id) || {}
        }))
      }
    }

    return NextResponse.json({
      rooms: enrichedRooms,
      count: enrichedRooms.length
    })

  } catch (error) {
    console.error('Rooms GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/rooms
// ============================================

/**
 * Create a new room
 *
 * Request body:
 * {
 *   name: string (required)
 *   description?: string
 *   settings?: object
 *   latitude?: number
 *   longitude?: number
 *   timezone?: string
 *   current_stage?: string
 * }
 *
 * Response:
 * {
 *   room: Room,
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

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationResult = CreateRoomSchema.safeParse(body)

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

    const input: CreateRoomInput = validationResult.data

    // Check for duplicate room name for this user
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', input.name)
      .single()

    if (existingRoom) {
      return NextResponse.json(
        { error: 'A room with this name already exists' },
        { status: 409 }
      )
    }

    // Check room limit (e.g., 20 rooms per user for free tier)
    const { count: roomCount, error: countError } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (!countError && roomCount !== null && roomCount >= 20) {
      return NextResponse.json(
        { error: 'Room limit reached. Maximum 20 rooms per account.' },
        { status: 403 }
      )
    }

    // Create the room
    const { data: room, error: insertError } = await supabase
      .from('rooms')
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description || null,
        settings: input.settings || {},
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        timezone: input.timezone || 'UTC',
        current_stage: input.current_stage || null,
        stage_started_at: input.current_stage ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create room:', insertError)

      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A room with this name already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create room', details: insertError.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        room_id: room.id,
        action_type: 'room_created',
        action_data: { name: input.name },
        result: 'success',
        timestamp: new Date().toISOString()
      })

    return NextResponse.json(
      {
        room: {
          ...room,
          controller_count: 0
        },
        message: `Room "${input.name}" created successfully`
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Rooms POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
