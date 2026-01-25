/**
 * Device Schedules API Routes
 *
 * GET    /api/schedules         - List user's device schedules
 * POST   /api/schedules         - Create new device schedule
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type {
  CreateDeviceScheduleInput,
  ScheduleConfig,
} from '@/types'

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
 * GET /api/schedules - List user's device schedules
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const controllerId = searchParams.get('controller_id')

    // Build query
    let query = supabase
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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Filter by controller if specified
    if (controllerId) {
      query = query.eq('controller_id', controllerId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching schedules:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch schedules' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/schedules:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/schedules - Create new device schedule
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()

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
    const input: CreateDeviceScheduleInput = await request.json()

    // Validate required fields
    if (!input.controller_id) {
      return NextResponse.json(
        { success: false, error: 'controller_id is required' },
        { status: 400 }
      )
    }

    if (!input.name || input.name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      )
    }

    if (!input.device_port || input.device_port < 1) {
      return NextResponse.json(
        { success: false, error: 'device_port must be a positive number' },
        { status: 400 }
      )
    }

    if (!input.trigger_type || !['time', 'sunrise', 'sunset', 'cron'].includes(input.trigger_type)) {
      return NextResponse.json(
        { success: false, error: 'trigger_type must be one of: time, sunrise, sunset, cron' },
        { status: 400 }
      )
    }

    if (!input.schedule) {
      return NextResponse.json(
        { success: false, error: 'schedule configuration is required' },
        { status: 400 }
      )
    }

    // Validate schedule configuration
    const validation = validateScheduleConfig(input.schedule)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Verify controller ownership
    const { data: controller, error: controllerError } = await supabase
      .from('controllers')
      .select('id, user_id')
      .eq('id', input.controller_id)
      .single()

    if (controllerError || !controller) {
      return NextResponse.json(
        { success: false, error: 'Controller not found' },
        { status: 404 }
      )
    }

    if (controller.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to access this controller' },
        { status: 403 }
      )
    }

    // Calculate next execution for time-based schedules
    let nextExecution: string | null = null
    if (input.trigger_type === 'time') {
      nextExecution = calculateNextExecution(input.schedule)
    }

    // Create schedule
    const { data: newSchedule, error: createError } = await supabase
      .from('device_schedules')
      .insert({
        user_id: user.id,
        controller_id: input.controller_id,
        room_id: input.room_id || null,
        name: input.name,
        description: input.description || null,
        device_port: input.device_port,
        trigger_type: input.trigger_type,
        schedule: input.schedule,
        is_active: input.is_active !== undefined ? input.is_active : true,
        next_execution: nextExecution,
        execution_count: 0,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating schedule:', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newSchedule,
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST /api/schedules:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
