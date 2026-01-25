/**
 * Sensor Polling Cron Endpoint
 *
 * GET /api/cron/poll-sensors - Fetch sensor readings from all online controllers
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/poll-sensors",
 *     "schedule": "0,5,10,15,20,25,30,35,40,45,50,55 * * * *"
 *   }]
 * }
 * (Runs every 5 minutes)
 *
 * This endpoint:
 * 1. Fetches all controllers with status 'online' or recently seen
 * 2. For each controller, connects via the adapter and reads sensors
 * 3. Stores readings in sensor_readings table
 * 4. Updates controller last_seen and status
 * 5. Handles errors gracefully with circuit breaker pattern
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { pollController, type PollResult } from '@/lib/poll-sensors'

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

interface DBController {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: string | Record<string, unknown>
  status: 'online' | 'offline' | 'error' | 'initializing'
  last_seen: string | null
  last_error: string | null
  room_id: string | null
}

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[SensorPollCron][${timestamp}]`

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
 * GET /api/cron/poll-sensors
 * Fetch sensor readings from all controllers
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const results: PollResult[] = []

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

    // Calculate cutoff time - consider controllers that were seen in last 30 minutes
    // even if marked offline (they might just have a temporary network issue)
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    // Fetch all controllers that are:
    // - Online (status = 'online'), OR
    // - Were seen recently (last_seen within cutoff), OR
    // - Have never errored and were created recently
    const { data: controllers, error: fetchError } = await supabase
      .from('controllers')
      .select('*')
      .or(`status.eq.online,last_seen.gt.${cutoffTime},last_error.is.null`)

    if (fetchError) {
      log('error', 'Failed to fetch controllers', { error: fetchError.message })
      return NextResponse.json({
        error: 'Failed to fetch controllers',
        details: fetchError.message
      }, { status: 500 })
    }

    if (!controllers || controllers.length === 0) {
      return NextResponse.json({
        message: 'No controllers to poll',
        polled: 0,
        duration: Date.now() - startTime
      })
    }

    log('info', `Polling ${controllers.length} controllers`)

    // Process controllers in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 5
    const controllerBatches: DBController[][] = []

    for (let i = 0; i < controllers.length; i += CONCURRENCY_LIMIT) {
      controllerBatches.push(controllers.slice(i, i + CONCURRENCY_LIMIT) as DBController[])
    }

    for (const batch of controllerBatches) {
      const batchResults = await Promise.allSettled(
        batch.map(controller => pollController(supabase, controller))
      )

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        const controller = batch[i]

        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          log('error', `Controller ${controller.id} poll failed`, { error: result.reason })
          results.push({
            controllerId: controller.id,
            controllerName: controller.name,
            brand: controller.brand,
            status: 'failed',
            readingsCount: 0,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          })
        }
      }
    }

    // Calculate statistics
    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    const totalReadings = results.reduce((sum, r) => sum + r.readingsCount, 0)

    log('info', `Poll complete`, {
      total: controllers.length,
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
      readings: totalReadings
    })

    return NextResponse.json({
      message: `Polled ${controllers.length} controllers`,
      results: {
        total: controllers.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        totalReadings
      },
      details: results,
      duration: Date.now() - startTime
    })

  } catch (error) {
    log('error', 'Cron execution error', { error })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      results,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}
