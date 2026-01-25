/**
 * Alert Checking Cron Endpoint
 *
 * GET /api/cron/check-alerts - Check all controllers for alert conditions
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-alerts",
 *     "schedule": "0,5,10,15,20,25,30,35,40,45,50,55 * * * *"
 *   }]
 * }
 * (Runs every 5 minutes)
 *
 * This endpoint:
 * 1. Fetches all controllers
 * 2. For each controller, checks alert conditions:
 *    - Offline > 30 minutes
 *    - 3+ failed commands in last hour
 *    - Health score < 50
 * 3. Creates alerts (with duplicate suppression)
 * 4. Auto-resolves alerts when conditions improve
 * 5. Reactivates snoozed alerts whose snooze period expired
 * 6. Sends notifications (push + in-app)
 *
 * Duplicate suppression: Max 1 alert per controller per type per hour
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  processControllerAlerts,
  reactivateSnoozedAlerts,
} from '@/lib/alerting'
import type { Controller } from '@/types'

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

interface AlertCheckResult {
  controllerId: string
  controllerName: string
  brand: string
  status: 'success' | 'failed'
  alertsCreated: number
  alertsResolved: number
  errors?: string[]
}

// ============================================
// Logging Utility
// ============================================

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: unknown
): void {
  const timestamp = new Date().toISOString()
  const prefix = `[AlertCheckCron][${timestamp}]`

  if (level === 'error') {
    console.error(
      `${prefix} ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    )
  } else if (level === 'warn') {
    console.warn(
      `${prefix} ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    )
  } else {
    console.log(
      `${prefix} ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    )
  }
}

// ============================================
// Main Endpoint
// ============================================

/**
 * GET /api/cron/check-alerts
 * Check all controllers for alert conditions
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const results: AlertCheckResult[] = []

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

    // Step 1: Reactivate snoozed alerts whose snooze period has expired
    log('info', 'Reactivating expired snooze alerts')
    const reactivatedCount = await reactivateSnoozedAlerts(supabase)
    if (reactivatedCount > 0) {
      log('info', `Reactivated ${reactivatedCount} snoozed alerts`)
    }

    // Step 2: Fetch all controllers
    const { data: controllers, error: fetchError } = await supabase
      .from('controllers')
      .select('*')

    if (fetchError) {
      log('error', 'Failed to fetch controllers', { error: fetchError.message })
      return NextResponse.json(
        {
          error: 'Failed to fetch controllers',
          details: fetchError.message,
        },
        { status: 500 }
      )
    }

    if (!controllers || controllers.length === 0) {
      return NextResponse.json({
        message: 'No controllers to check',
        checked: 0,
        reactivated: reactivatedCount,
        duration: Date.now() - startTime,
      })
    }

    log('info', `Checking ${controllers.length} controllers for alerts`)

    // Step 3: Process each controller
    for (const controller of controllers as Controller[]) {
      try {
        const result = await processControllerAlerts(supabase, controller)

        results.push({
          controllerId: controller.id,
          controllerName: controller.name,
          brand: controller.brand,
          status: result.errors.length > 0 ? 'failed' : 'success',
          alertsCreated: result.created,
          alertsResolved: result.resolved,
          errors: result.errors.length > 0 ? result.errors : undefined,
        })

        if (result.created > 0 || result.resolved > 0) {
          log('info', `Processed alerts for ${controller.name}`, {
            created: result.created,
            resolved: result.resolved,
          })
        }

        if (result.errors.length > 0) {
          log('warn', `Errors processing ${controller.name}`, {
            errors: result.errors,
          })
        }
      } catch (error) {
        log('error', `Failed to process controller ${controller.id}`, { error })
        results.push({
          controllerId: controller.id,
          controllerName: controller.name,
          brand: controller.brand,
          status: 'failed',
          alertsCreated: 0,
          alertsResolved: 0,
          errors: [
            error instanceof Error ? error.message : 'Unknown error',
          ],
        })
      }
    }

    // Calculate statistics
    const totalCreated = results.reduce((sum, r) => sum + r.alertsCreated, 0)
    const totalResolved = results.reduce((sum, r) => sum + r.alertsResolved, 0)
    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length

    log('info', 'Alert check complete', {
      checked: controllers.length,
      success: successCount,
      failed: failedCount,
      created: totalCreated,
      resolved: totalResolved,
      reactivated: reactivatedCount,
    })

    return NextResponse.json({
      message: `Checked ${controllers.length} controllers`,
      results: {
        checked: controllers.length,
        success: successCount,
        failed: failedCount,
        alertsCreated: totalCreated,
        alertsResolved: totalResolved,
        alertsReactivated: reactivatedCount,
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
