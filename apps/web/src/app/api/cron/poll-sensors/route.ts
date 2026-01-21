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
import { decryptCredentials, EncryptionError } from '@/lib/server-encryption'
import {
  getAdapter,
  isBrandSupported,
  type ControllerBrand,
  type ControllerCredentials,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type SensorReading,
} from '@enviroflow/automation-engine/adapters'

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
  status: string
  is_online: boolean
  last_seen: string | null
  last_error: string | null
  room_id: string | null
}

interface PollResult {
  controllerId: string
  controllerName: string
  brand: string
  status: 'success' | 'failed' | 'skipped'
  readingsCount: number
  error?: string
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
// Credential Building
// ============================================

function buildAdapterCredentials(
  brand: ControllerBrand,
  rawCredentials: Record<string, unknown>
): ControllerCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: (rawCredentials.email as string) || '',
        password: (rawCredentials.password as string) || '',
      } satisfies ACInfinityCredentials

    case 'inkbird':
      return {
        type: 'inkbird',
        email: (rawCredentials.email as string) || '',
        password: (rawCredentials.password as string) || '',
      } satisfies InkbirdCredentials

    case 'csv_upload':
      return {
        type: 'csv_upload',
      } satisfies CSVUploadCredentials

    default:
      throw new Error(`Cannot build credentials for unsupported brand: ${brand}`)
  }
}

// ============================================
// Sensor Value Validation
// ============================================

interface SensorValidation {
  type: string
  minValue: number
  maxValue: number
}

const SENSOR_VALIDATIONS: SensorValidation[] = [
  { type: 'temperature', minValue: -40, maxValue: 212 },
  { type: 'humidity', minValue: 0, maxValue: 100 },
  { type: 'vpd', minValue: 0, maxValue: 5 },
  { type: 'co2', minValue: 0, maxValue: 10000 },
  { type: 'light', minValue: 0, maxValue: 200000 },
  { type: 'ph', minValue: 0, maxValue: 14 },
  { type: 'ec', minValue: 0, maxValue: 20 },
]

function validateSensorReading(reading: SensorReading): boolean {
  const validation = SENSOR_VALIDATIONS.find(v => v.type === reading.type)
  if (!validation) return true // Unknown types pass through

  return reading.value >= validation.minValue && reading.value <= validation.maxValue
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
    // Verify cron secret (optional security)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        log('warn', 'Unauthorized cron request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabase = getSupabase()

    // Calculate cutoff time - consider controllers that were seen in last 30 minutes
    // even if marked offline (they might just have a temporary network issue)
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    // Fetch all controllers that are:
    // - Online (is_online = true), OR
    // - Were seen recently (last_seen within cutoff), OR
    // - Have never errored and were created recently
    const { data: controllers, error: fetchError } = await supabase
      .from('controllers')
      .select('*')
      .or(`is_online.eq.true,last_seen.gt.${cutoffTime},last_error.is.null`)

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

/**
 * Poll a single controller for sensor readings
 */
async function pollController(
  supabase: SupabaseClient,
  controller: DBController
): Promise<PollResult> {
  const { id: dbControllerId, user_id, brand, controller_id: controllerId, name, credentials } = controller

  // Skip CSV upload controllers - they don't poll
  if (brand === 'csv_upload') {
    return {
      controllerId: dbControllerId,
      controllerName: name,
      brand,
      status: 'skipped',
      readingsCount: 0,
      error: 'CSV controllers do not support polling'
    }
  }

  // Check if brand is supported
  if (!isBrandSupported(brand)) {
    return {
      controllerId: dbControllerId,
      controllerName: name,
      brand,
      status: 'skipped',
      readingsCount: 0,
      error: `Unsupported brand: ${brand}`
    }
  }

  // Decrypt credentials
  let decryptedCredentials: Record<string, unknown>
  try {
    decryptedCredentials = decryptCredentials(credentials)
  } catch (error) {
    if (error instanceof EncryptionError) {
      log('error', `Encryption error for controller ${dbControllerId}`, {
        error: 'Credentials cannot be decrypted'
      })

      // Update controller with error
      await supabase
        .from('controllers')
        .update({
          is_online: false,
          last_error: 'Credentials cannot be decrypted',
          updated_at: new Date().toISOString()
        })
        .eq('id', dbControllerId)

      return {
        controllerId: dbControllerId,
        controllerName: name,
        brand,
        status: 'failed',
        readingsCount: 0,
        error: 'Credentials cannot be decrypted'
      }
    }
    throw error
  }

  // Validate credentials
  if (!decryptedCredentials.email || !decryptedCredentials.password) {
    return {
      controllerId: dbControllerId,
      controllerName: name,
      brand,
      status: 'failed',
      readingsCount: 0,
      error: 'Incomplete credentials'
    }
  }

  // Get adapter and connect
  const adapter = getAdapter(brand as ControllerBrand)
  const adapterCredentials = buildAdapterCredentials(
    brand as ControllerBrand,
    decryptedCredentials
  )

  log('info', `Connecting to ${brand} controller "${name}"`)

  const connectionResult = await adapter.connect(adapterCredentials)

  if (!connectionResult.success) {
    log('warn', `Failed to connect to ${name}`, { error: connectionResult.error })

    // Update controller status
    await supabase
      .from('controllers')
      .update({
        is_online: false,
        status: 'offline',
        last_error: connectionResult.error || 'Connection failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', dbControllerId)

    return {
      controllerId: dbControllerId,
      controllerName: name,
      brand,
      status: 'failed',
      readingsCount: 0,
      error: connectionResult.error || 'Connection failed'
    }
  }

  try {
    // Read sensors
    const readings = await adapter.readSensors(connectionResult.controllerId)

    log('info', `Read ${readings.length} sensors from ${name}`)

    // Validate and store readings
    const validReadings: SensorReading[] = []
    const now = new Date().toISOString()

    for (const reading of readings) {
      if (validateSensorReading(reading)) {
        validReadings.push(reading)
      } else {
        log('warn', `Invalid sensor reading for ${name}`, {
          type: reading.type,
          value: reading.value
        })
      }
    }

    // Insert readings into database
    if (validReadings.length > 0) {
      const readingsToInsert = validReadings.map(reading => ({
        controller_id: dbControllerId,
        user_id,
        port: reading.port,
        sensor_type: reading.type,
        value: reading.value,
        unit: reading.unit,
        is_stale: false,
        timestamp: now
      }))

      const { error: insertError } = await supabase
        .from('sensor_readings')
        .insert(readingsToInsert)

      if (insertError) {
        log('error', `Failed to insert readings for ${name}`, { error: insertError.message })
      }
    }

    // Update controller status to online
    await supabase
      .from('controllers')
      .update({
        is_online: true,
        status: 'online',
        last_seen: now,
        last_error: null,
        updated_at: now
      })
      .eq('id', dbControllerId)

    return {
      controllerId: dbControllerId,
      controllerName: name,
      brand,
      status: 'success',
      readingsCount: validReadings.length
    }

  } catch (error) {
    log('error', `Error reading sensors from ${name}`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    // Update controller with error but don't mark offline
    // (might be a transient issue)
    await supabase
      .from('controllers')
      .update({
        last_error: error instanceof Error ? error.message : 'Sensor read failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', dbControllerId)

    return {
      controllerId: dbControllerId,
      controllerName: name,
      brand,
      status: 'failed',
      readingsCount: 0,
      error: error instanceof Error ? error.message : 'Sensor read failed'
    }

  } finally {
    // Always disconnect
    try {
      await adapter.disconnect(connectionResult.controllerId)
    } catch (disconnectError) {
      log('warn', `Error disconnecting from ${name}`, {
        error: disconnectError instanceof Error ? disconnectError.message : 'Unknown'
      })
    }
  }
}
