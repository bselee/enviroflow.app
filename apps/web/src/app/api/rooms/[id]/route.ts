/**
 * Room Detail API Routes
 *
 * GET    /api/rooms/[id]  - Get room details with controllers and sensor readings
 * PUT    /api/rooms/[id]  - Update room details
 * DELETE /api/rooms/[id]  - Delete room (controllers moved to unassigned)
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
 * Schema for updating a room
 */
const UpdateRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(100, 'Room name must be 100 characters or less')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  settings: z.record(z.unknown()).optional(),
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
  timezone: z.string().max(50).optional(),
  current_stage: z.string().max(50).optional().nullable()
})

type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>

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
 * Extract and validate user ID from request
 */
async function getUserId(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      return user.id
    }
  }

  // Fall back to x-user-id header for development
  const devUserId = request.headers.get('x-user-id')
  if (devUserId && process.env.NODE_ENV !== 'production') {
    return devUserId
  }

  return null
}

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// ============================================
// Route Context Type
// ============================================

interface RouteContext {
  params: Promise<{ id: string }>
}

// ============================================
// GET /api/rooms/[id]
// ============================================

/**
 * Get room details with associated controllers and latest sensor readings
 *
 * Query parameters:
 * - include_controllers: boolean - Include full controller details (default: true)
 * - include_sensors: boolean - Include latest sensor readings (default: true)
 * - include_workflows: boolean - Include associated workflows (default: false)
 *
 * Response:
 * {
 *   room: Room,
 *   controllers: Controller[],
 *   sensor_readings: SensorReading[],
 *   workflows?: Workflow[]
 * }
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)
    const { id: roomId } = await context.params

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate room ID format
    if (!isValidUUID(roomId)) {
      return NextResponse.json(
        { error: 'Invalid room ID format' },
        { status: 400 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const includeControllers = searchParams.get('include_controllers') !== 'false'
    const includeSensors = searchParams.get('include_sensors') !== 'false'
    const includeWorkflows = searchParams.get('include_workflows') === 'true'

    // Fetch room
    const { data: room, error: roomError } = await supabase
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
      .eq('id', roomId)
      .eq('user_id', userId)
      .single()

    if (roomError || !room) {
      if (roomError?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Room not found' },
          { status: 404 }
        )
      }
      console.error('Failed to fetch room:', roomError)
      return NextResponse.json(
        { error: 'Failed to fetch room', details: roomError?.message },
        { status: 500 }
      )
    }

    // Build response
    const response: Record<string, unknown> = { room }

    // Fetch controllers if requested
    if (includeControllers) {
      const { data: controllers, error: controllersError } = await supabase
        .from('controllers')
        .select(`
          id,
          brand,
          controller_id,
          name,
          capabilities,
          is_online,
          last_seen,
          last_error,
          firmware_version,
          model,
          created_at,
          updated_at
        `)
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!controllersError) {
        response.controllers = controllers || []
      }
    }

    // Fetch latest sensor readings if requested
    if (includeSensors) {
      // Get controller IDs for this room
      const { data: roomControllers } = await supabase
        .from('controllers')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)

      if (roomControllers && roomControllers.length > 0) {
        const controllerIds = roomControllers.map(c => c.id)

        // Fetch latest readings for each sensor type per controller
        const { data: readings, error: readingsError } = await supabase
          .from('sensor_readings')
          .select(`
            id,
            controller_id,
            port,
            sensor_type,
            value,
            unit,
            is_stale,
            timestamp
          `)
          .in('controller_id', controllerIds)
          .order('timestamp', { ascending: false })
          .limit(50)

        if (!readingsError) {
          // Deduplicate to keep only latest reading per controller+sensor_type
          const latestReadings = new Map<string, typeof readings[0]>()
          for (const reading of readings || []) {
            const key = `${reading.controller_id}-${reading.sensor_type}`
            if (!latestReadings.has(key)) {
              latestReadings.set(key, reading)
            }
          }
          response.sensor_readings = Array.from(latestReadings.values())
        }
      } else {
        response.sensor_readings = []
      }
    }

    // Fetch workflows if requested
    if (includeWorkflows) {
      const { data: workflows, error: workflowsError } = await supabase
        .from('workflows')
        .select(`
          id,
          name,
          description,
          is_active,
          last_run,
          run_count,
          dry_run_enabled,
          growth_stage,
          created_at
        `)
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!workflowsError) {
        response.workflows = workflows || []
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Room GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT /api/rooms/[id]
// ============================================

/**
 * Update room details
 *
 * Request body (all fields optional):
 * {
 *   name?: string
 *   description?: string | null
 *   settings?: object
 *   latitude?: number | null
 *   longitude?: number | null
 *   timezone?: string
 *   current_stage?: string | null
 * }
 *
 * Response:
 * {
 *   room: Room,
 *   message: string
 * }
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)
    const { id: roomId } = await context.params

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate room ID format
    if (!isValidUUID(roomId)) {
      return NextResponse.json(
        { error: 'Invalid room ID format' },
        { status: 400 }
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

    const validationResult = UpdateRoomSchema.safeParse(body)

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

    const input: UpdateRoomInput = validationResult.data

    // Check if room exists and belongs to user
    const { data: existingRoom, error: fetchError } = await supabase
      .from('rooms')
      .select('id, name, current_stage')
      .eq('id', roomId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name if name is being changed
    if (input.name && input.name.toLowerCase() !== existingRoom.name.toLowerCase()) {
      const { data: duplicateRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', input.name)
        .neq('id', roomId)
        .single()

      if (duplicateRoom) {
        return NextResponse.json(
          { error: 'A room with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Build update object (only include fields that were provided)
    const updateData: Record<string, unknown> = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.settings !== undefined) updateData.settings = input.settings
    if (input.latitude !== undefined) updateData.latitude = input.latitude
    if (input.longitude !== undefined) updateData.longitude = input.longitude
    if (input.timezone !== undefined) updateData.timezone = input.timezone

    // Handle growth stage change
    if (input.current_stage !== undefined) {
      updateData.current_stage = input.current_stage
      // Update stage_started_at if stage changed
      if (input.current_stage !== existingRoom.current_stage) {
        updateData.stage_started_at = input.current_stage ? new Date().toISOString() : null
      }
    }

    // Perform update
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', roomId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update room:', updateError)
      return NextResponse.json(
        { error: 'Failed to update room', details: updateError.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        room_id: roomId,
        action_type: 'room_updated',
        action_data: { fields: Object.keys(updateData) },
        result: 'success',
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      room: updatedRoom,
      message: 'Room updated successfully'
    })

  } catch (error) {
    console.error('Room PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/rooms/[id]
// ============================================

/**
 * Delete a room
 *
 * Controllers in this room will have their room_id set to null (moved to unassigned).
 * Workflows associated with this room will also have room_id set to null.
 *
 * Response:
 * {
 *   message: string,
 *   affected_controllers: number,
 *   affected_workflows: number
 * }
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)
    const { id: roomId } = await context.params

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate room ID format
    if (!isValidUUID(roomId)) {
      return NextResponse.json(
        { error: 'Invalid room ID format' },
        { status: 400 }
      )
    }

    // Check if room exists and belongs to user
    const { data: existingRoom, error: fetchError } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('id', roomId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Count affected controllers
    const { count: controllerCount } = await supabase
      .from('controllers')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)

    // Count affected workflows
    const { count: workflowCount } = await supabase
      .from('workflows')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)

    // Set room_id to null on controllers (handled by foreign key ON DELETE SET NULL)
    // Set room_id to null on workflows (handled by foreign key ON DELETE SET NULL)
    // Set room_id to null on dimmer_schedules (handled by foreign key ON DELETE SET NULL)

    // Delete the room
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Failed to delete room:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete room', details: deleteError.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action_type: 'room_deleted',
        action_data: {
          room_name: existingRoom.name,
          affected_controllers: controllerCount || 0,
          affected_workflows: workflowCount || 0
        },
        result: 'success',
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      message: `Room "${existingRoom.name}" deleted successfully`,
      affected_controllers: controllerCount || 0,
      affected_workflows: workflowCount || 0
    })

  } catch (error) {
    console.error('Room DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
