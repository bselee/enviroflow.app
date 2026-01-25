/**
 * Schedule Execution Cron Endpoint
 *
 * GET /api/cron/schedules - Execute due device schedules
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/schedules",
 *     "schedule": "* * * * *"
 *   }]
 * }
 * (Runs every minute)
 *
 * This endpoint:
 * 1. Fetches all active schedules
 * 2. Evaluates which schedules are due to execute
 * 3. For each due schedule, sends device command via adapter
 * 4. Handles sunrise/sunset dimming with curve calculations
 * 5. Logs execution results to activity_logs
 * 6. Updates schedule metadata (last_executed, execution_count)
 * 7. Implements retry logic with exponential backoff
 * 8. Enforces rate limiting (max 10 commands per controller per minute)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  shouldExecuteSchedule,
  executeSchedule,
  logScheduleExecution,
  updateScheduleMetadata,
  cleanupRateLimits,
} from '@/lib/schedule-executor'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// Lazy Supabase client
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
// Types
// ============================================

interface DeviceSchedule {
  id: string
  user_id: string
  controller_id: string
  room_id: string | null
  name: string
  description: string | null
  device_port: number
  trigger_type: 'time' | 'sunrise' | 'sunset' | 'cron'
  schedule: {
    days?: number[]
    start_time?: string
    end_time?: string
    action?: 'on' | 'off' | 'set_level'
    level?: number
    cron?: string
    offset_minutes?: number
    duration_minutes?: number
    start_intensity?: number
    target_intensity?: number
    curve?: 'linear' | 'sigmoid' | 'exponential' | 'logarithmic'
  }
  is_active: boolean
  last_executed: string | null
  next_execution: string | null
  execution_count: number
  created_at: string
  updated_at: string
}

interface DBController {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: string | Record<string, unknown>
  status: 'online' | 'offline' | 'error' | 'initializing'
  room_id: string | null
}

interface DBRoom {
  id: string
  latitude: number | null
  longitude: number | null
  timezone: string
}

interface ExecutionSummary {
  scheduleId: string
  scheduleName: string
  controllerId: string
  controllerName: string
  status: 'success' | 'failed' | 'skipped' | 'dry_run'
  action: string
  value?: number
  error?: string
}

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[ScheduleCron][${timestamp}]`

  if (level === 'error') {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

// ============================================
// Main Endpoint
// ============================================

/**
 * GET /api/cron/schedules
 * Execute due device schedules
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const results: ExecutionSummary[] = []

  try {
    // Verify cron secret (REQUIRED for security)
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      log('error', 'CRON_SECRET environment variable is not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      log('warn', 'Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()
    const now = new Date()

    // Clean up old rate limit entries
    cleanupRateLimits()

    // Fetch all active schedules
    const { data: schedules, error: fetchError } = await supabase
      .from('device_schedules')
      .select('*')
      .eq('is_active', true)

    if (fetchError) {
      log('error', 'Failed to fetch schedules', { error: fetchError.message })
      return NextResponse.json(
        {
          error: 'Failed to fetch schedules',
          details: fetchError.message,
        },
        { status: 500 }
      )
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({
        message: 'No active schedules to execute',
        executed: 0,
        duration: Date.now() - startTime,
      })
    }

    log('info', `Evaluating ${schedules.length} active schedules`)

    // Fetch all unique controllers and rooms needed
    const controllerIds = Array.from(new Set(schedules.map(s => s.controller_id)))
    const roomIds = Array.from(new Set(schedules.map(s => s.room_id).filter(Boolean)))

    const [controllersResult, roomsResult] = await Promise.all([
      supabase.from('controllers').select('*').in('id', controllerIds),
      roomIds.length > 0
        ? supabase.from('rooms').select('id, latitude, longitude, timezone').in('id', roomIds)
        : { data: [], error: null },
    ])

    if (controllersResult.error) {
      log('error', 'Failed to fetch controllers', {
        error: controllersResult.error.message,
      })
      return NextResponse.json(
        {
          error: 'Failed to fetch controllers',
          details: controllersResult.error.message,
        },
        { status: 500 }
      )
    }

    if (roomsResult.error) {
      log('error', 'Failed to fetch rooms', { error: roomsResult.error.message })
      return NextResponse.json(
        {
          error: 'Failed to fetch rooms',
          details: roomsResult.error.message,
        },
        { status: 500 }
      )
    }

    const controllers = new Map<string, DBController>()
    const rooms = new Map<string, DBRoom>()

    for (const controller of controllersResult.data as DBController[]) {
      controllers.set(controller.id, controller)
    }

    for (const room of roomsResult.data as DBRoom[]) {
      rooms.set(room.id, room)
    }

    // Filter schedules that should execute now
    const schedulesToExecute: DeviceSchedule[] = []

    for (const schedule of schedules as DeviceSchedule[]) {
      const room = schedule.room_id ? rooms.get(schedule.room_id) || null : null

      if (shouldExecuteSchedule(schedule, room, now)) {
        schedulesToExecute.push(schedule)
      }
    }

    if (schedulesToExecute.length === 0) {
      return NextResponse.json({
        message: 'No schedules due to execute at this time',
        evaluated: schedules.length,
        executed: 0,
        duration: Date.now() - startTime,
      })
    }

    log('info', `Executing ${schedulesToExecute.length} due schedules`)

    // Execute schedules (with concurrency limit to avoid overwhelming controllers)
    const CONCURRENCY_LIMIT = 3
    const scheduleBatches: DeviceSchedule[][] = []

    for (let i = 0; i < schedulesToExecute.length; i += CONCURRENCY_LIMIT) {
      scheduleBatches.push(schedulesToExecute.slice(i, i + CONCURRENCY_LIMIT))
    }

    for (const batch of scheduleBatches) {
      const batchResults = await Promise.allSettled(
        batch.map(async schedule => {
          const controller = controllers.get(schedule.controller_id)
          if (!controller) {
            throw new Error(`Controller ${schedule.controller_id} not found`)
          }

          const room = schedule.room_id ? rooms.get(schedule.room_id) || null : null

          // Execute the schedule
          const result = await executeSchedule(schedule, controller, room, supabase)

          // Log execution
          await logScheduleExecution(result, supabase, schedule.user_id, schedule.room_id)

          // Update schedule metadata
          await updateScheduleMetadata(schedule.id, result, supabase)

          return result
        })
      )

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        const schedule = batch[i]

        if (result.status === 'fulfilled') {
          results.push({
            scheduleId: result.value.scheduleId,
            scheduleName: result.value.scheduleName,
            controllerId: result.value.controllerId,
            controllerName: result.value.controllerName,
            status: result.value.status,
            action: result.value.action,
            value: result.value.value,
            error: result.value.error,
          })
        } else {
          log('error', `Schedule ${schedule.id} execution failed`, {
            error: result.reason,
          })
          results.push({
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            controllerId: schedule.controller_id,
            controllerName: 'Unknown',
            status: 'failed',
            action: 'unknown',
            error:
              result.reason instanceof Error
                ? result.reason.message
                : 'Unknown error',
          })
        }
      }
    }

    // Calculate statistics
    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    const dryRunCount = results.filter(r => r.status === 'dry_run').length

    log('info', 'Schedule execution complete', {
      evaluated: schedules.length,
      executed: schedulesToExecute.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      dryRun: dryRunCount,
    })

    return NextResponse.json({
      message: `Executed ${schedulesToExecute.length} schedules`,
      results: {
        evaluated: schedules.length,
        executed: schedulesToExecute.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        dryRun: dryRunCount,
      },
      details: results,
      duration: Date.now() - startTime,
    })
  } catch (error) {
    log('error', 'Cron execution error', { error })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        results,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
