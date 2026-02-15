/**
 * Individual Diary Cycle API Routes
 *
 * GET    /api/diaries/[id]  - Get a single diary cycle with details
 * PATCH  /api/diaries/[id]  - Update a diary cycle
 * DELETE /api/diaries/[id]  - Delete a diary cycle
 *
 * All operations require authentication and user ownership.
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

const UpdateDiaryCycleSchema = z.object({
  name: z
    .string()
    .transform(sanitizeName)
    .pipe(z.string().min(1, 'Cycle name is required').max(100, 'Cycle name must be 100 characters or less'))
    .optional(),
  description: z
    .string()
    .transform(sanitizeDescription)
    .pipe(z.string().max(1000, 'Description must be 1000 characters or less'))
    .optional()
    .nullable(),
  ended_at: z.string().datetime().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  controller_ids: z.array(z.string().uuid()).optional(),
  current_stage: z.enum(DiaryCycleStages).optional(),
  status: z.enum(DiaryCycleStatuses).optional(),
  enable_device_logging: z.boolean().optional(),
  enable_sensor_logging: z.boolean().optional()
})

type UpdateDiaryCycleInput = z.infer<typeof UpdateDiaryCycleSchema>

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
// GET /api/diaries/[id]
// ============================================

/**
 * Get a single diary cycle with room details and entry/photo counts
 *
 * Response:
 * {
 *   cycle: DiaryCycleWithCounts
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Fetch the cycle with room details
    const { data: cycle, error: cycleError } = await supabase
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
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (cycleError || !cycle) {
      console.error('Failed to fetch diary cycle:', cycleError)
      return NextResponse.json(
        { error: 'Diary cycle not found' },
        { status: 404 }
      )
    }

    // Get entry count
    const { count: entryCount } = await supabase
      .from('diary_entries')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', id)

    // Get photo count via entries
    const { data: photos } = await supabase
      .from('diary_photos')
      .select('id, diary_entries!inner(cycle_id)')
      .eq('diary_entries.cycle_id', id)

    const enrichedCycle = {
      ...cycle,
      room: cycle.rooms,
      entry_count: entryCount || 0,
      photo_count: photos?.length || 0
    }

    return NextResponse.json({ cycle: enrichedCycle })

  } catch (error) {
    console.error('Diary cycle GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH /api/diaries/[id]
// ============================================

/**
 * Update a diary cycle
 *
 * Auto-sets ended_at when status changes to 'completed'
 * Logs stage changes to activity_logs
 *
 * Request body: UpdateDiaryCycleInput
 *
 * Response:
 * {
 *   cycle: DiaryCycle,
 *   message: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Verify cycle exists and belongs to user
    const { data: existingCycle, error: fetchError } = await supabase
      .from('grow_cycles')
      .select('id, current_stage, status, name, room_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingCycle) {
      return NextResponse.json(
        { error: 'Diary cycle not found' },
        { status: 404 }
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

    const validationResult = UpdateDiaryCycleSchema.safeParse(body)

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

    const input: UpdateDiaryCycleInput = validationResult.data

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (input.name !== undefined) {
      updateData.name = input.name
    }
    if (input.description !== undefined) {
      updateData.description = input.description
    }
    if (input.ended_at !== undefined) {
      updateData.ended_at = input.ended_at
    }
    if (input.room_id !== undefined) {
      updateData.room_id = input.room_id
    }
    if (input.controller_ids !== undefined) {
      updateData.controller_ids = input.controller_ids
    }
    if (input.current_stage !== undefined) {
      updateData.current_stage = input.current_stage
    }
    if (input.status !== undefined) {
      updateData.status = input.status
    }
    if (input.enable_device_logging !== undefined) {
      updateData.enable_device_logging = input.enable_device_logging
    }
    if (input.enable_sensor_logging !== undefined) {
      updateData.enable_sensor_logging = input.enable_sensor_logging
    }

    // Auto-set ended_at when status changes to 'completed'
    if (input.status === 'completed' && existingCycle.status !== 'completed') {
      updateData.ended_at = new Date().toISOString()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
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
    if (input.controller_ids && input.controller_ids.length > 0) {
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

    // Update the cycle
    const { data: cycle, error: updateError } = await supabase
      .from('grow_cycles')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        rooms (
          id,
          name
        )
      `)
      .single()

    if (updateError) {
      console.error('Failed to update diary cycle:', updateError)
      return NextResponse.json(
        { error: 'Failed to update diary cycle', details: updateError.message },
        { status: 500 }
      )
    }

    // Log stage change to activity_logs
    if (input.current_stage && input.current_stage !== existingCycle.current_stage) {
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          room_id: existingCycle.room_id || null,
          action_type: 'diary_stage_changed',
          details: {
            cycle_id: id,
            cycle_name: existingCycle.name,
            previous_stage: existingCycle.current_stage,
            new_stage: input.current_stage
          },
          result: 'success'
        })
    }

    // Log status change to activity_logs
    if (input.status && input.status !== existingCycle.status) {
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          room_id: existingCycle.room_id || null,
          action_type: 'diary_cycle_status_changed',
          details: {
            cycle_id: id,
            cycle_name: existingCycle.name,
            previous_status: existingCycle.status,
            new_status: input.status
          },
          result: 'success'
        })
    }

    return NextResponse.json(
      {
        cycle: {
          ...cycle,
          room: cycle.rooms
        },
        message: `Diary cycle "${cycle.name}" updated successfully`
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Diary cycle PATCH error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/diaries/[id]
// ============================================

/**
 * Delete a diary cycle
 *
 * Cascade deletes all entries and photos (handled by DB)
 * Logs deletion to activity_logs
 *
 * Response:
 * {
 *   message: string
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // Verify cycle exists and belongs to user
    const { data: existingCycle, error: fetchError } = await supabase
      .from('grow_cycles')
      .select('id, name, room_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingCycle) {
      return NextResponse.json(
        { error: 'Diary cycle not found' },
        { status: 404 }
      )
    }

    // Before deleting the cycle, get all associated photos and delete them from Storage
    const { data: entries } = await supabase
      .from('diary_entries')
      .select('id')
      .eq('cycle_id', id)

    if (entries && entries.length > 0) {
      const entryIds = entries.map(e => e.id)

      const { data: photos } = await supabase
        .from('diary_photos')
        .select('storage_path, thumbnail_path')
        .in('entry_id', entryIds)

      if (photos && photos.length > 0) {
        const filesToDelete = photos.flatMap(p =>
          [p.storage_path, p.thumbnail_path].filter(Boolean)
        ) as string[]

        if (filesToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('diary-photos')
            .remove(filesToDelete)

          if (storageError) {
            console.error('Failed to delete photos from storage:', storageError)
            // Continue with cycle deletion even if storage cleanup fails
          }
        }
      }
    }

    // Delete the cycle (cascade will handle entries and photos in DB)
    const { error: deleteError } = await supabase
      .from('grow_cycles')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Failed to delete diary cycle:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete diary cycle', details: deleteError.message },
        { status: 500 }
      )
    }

    // Log the deletion
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        room_id: existingCycle.room_id || null,
        action_type: 'diary_cycle_deleted',
        details: {
          cycle_id: id,
          cycle_name: existingCycle.name
        },
        result: 'success'
      })

    return NextResponse.json(
      {
        message: `Diary cycle "${existingCycle.name}" deleted successfully`
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Diary cycle DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
