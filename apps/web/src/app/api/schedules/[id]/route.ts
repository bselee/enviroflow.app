/**
 * Individual Device Schedule API Routes
 *
 * GET    /api/schedules/[id]    - Get schedule details
 * PUT    /api/schedules/[id]    - Update schedule
 * DELETE /api/schedules/[id]    - Delete schedule
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { UpdateDeviceScheduleInput, ScheduleConfig } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// Lazy initialization of Supabase client
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

/**
 * Validate schedule configuration
 */
function validateScheduleConfig(config: ScheduleConfig): { valid: boolean; error?: string } {
  // Validate days array
  if (!Array.isArray(config.days) || config.days.length === 0) {
    return { valid: false, error: 'Schedule must specify at least one day' }
  }

  if (config.days.some(day => day < 0 || day > 6)) {
    return { valid: false, error: 'Days must be between 0 (Sunday) and 6 (Saturday)' }
  }

  // Validate start_time format
  if (!config.start_time || !/^\d{2}:\d{2}$/.test(config.start_time)) {
    return { valid: false, error: 'start_time must be in HH:MM format' }
  }

  // Validate end_time if provided
  if (config.end_time && !/^\d{2}:\d{2}$/.test(config.end_time)) {
    return { valid: false, error: 'end_time must be in HH:MM format' }
  }

  // Validate action
  if (!['on', 'off', 'set_level'].includes(config.action)) {
    return { valid: false, error: 'action must be one of: on, off, set_level' }
  }

  // Validate level if action is set_level
  if (config.action === 'set_level') {
    if (config.level === undefined || config.level < 0 || config.level > 100) {
      return { valid: false, error: 'level must be between 0 and 100 for set_level action' }
    }
  }

  return { valid: true }
}

/**
 * Calculate next execution time for a time-based schedule
 */
function calculateNextExecution(schedule: ScheduleConfig): string | null {
  if (!schedule.start_time || !schedule.days || schedule.days.length === 0) {
    return null
  }

  const now = new Date()
  const [hours, minutes] = schedule.start_time.split(':').map(Number)

  // Find next matching day
  for (let i = 0; i < 14; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i)

    const dayOfWeek = date.getDay()
    if (schedule.days.includes(dayOfWeek)) {
      const execution = new Date(date)
      execution.setHours(hours, minutes, 0, 0)

      if (execution > now) {
        return execution.toISOString()
      }
    }
  }

  return null
}

/**
 * GET /api/schedules/[id] - Get schedule details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase()
    const { id } = await params

    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch schedule with controller details
    const { data, error } = await supabase
      .from('device_schedules')
      .select(`
        *,
        controller:controllers(
          id,
          name,
          brand,
          status,
          capabilities
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/schedules/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/schedules/[id] - Update schedule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase()
    const { id } = await params

    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const input: UpdateDeviceScheduleInput = await request.json()

    // Verify schedule ownership
    const { data: existingSchedule, error: fetchError } = await supabase
      .from('device_schedules')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingSchedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {}

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'name cannot be empty' },
          { status: 400 }
        )
      }
      updates.name = input.name
    }

    if (input.description !== undefined) {
      updates.description = input.description
    }

    if (input.device_port !== undefined) {
      if (input.device_port < 1) {
        return NextResponse.json(
          { success: false, error: 'device_port must be a positive number' },
          { status: 400 }
        )
      }
      updates.device_port = input.device_port
    }

    if (input.trigger_type !== undefined) {
      if (!['time', 'sunrise', 'sunset', 'cron'].includes(input.trigger_type)) {
        return NextResponse.json(
          { success: false, error: 'trigger_type must be one of: time, sunrise, sunset, cron' },
          { status: 400 }
        )
      }
      updates.trigger_type = input.trigger_type
    }

    if (input.schedule !== undefined) {
      const validation = validateScheduleConfig(input.schedule)
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        )
      }
      updates.schedule = input.schedule

      // Recalculate next execution if schedule changes
      const triggerType = input.trigger_type || existingSchedule.trigger_type
      if (triggerType === 'time') {
        updates.next_execution = calculateNextExecution(input.schedule)
      }
    }

    if (input.is_active !== undefined) {
      updates.is_active = input.is_active
    }

    // Update schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('device_schedules')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating schedule:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedSchedule,
    })
  } catch (error) {
    console.error('Unexpected error in PUT /api/schedules/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/schedules/[id] - Delete schedule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase()
    const { id } = await params

    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete schedule
    const { error: deleteError } = await supabase
      .from('device_schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting schedule:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/schedules/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
