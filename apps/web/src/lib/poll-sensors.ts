/**
 * Shared sensor polling utility
 *
 * This module provides a reusable function to fetch sensor readings from a controller
 * and store them in the database. It's used by:
 * 1. POST /api/controllers - Immediately after adding a controller
 * 2. GET /api/cron/poll-sensors - Periodic polling cron job
 *
 * This ensures users see data immediately after adding a controller instead of
 * seeing "waiting for data" until the cron job runs.
 */

import { createClient } from '@supabase/supabase-js'
import { decryptCredentials, EncryptionError } from './server-encryption'
import {
  getAdapter,
  isBrandSupported,
  type ControllerBrand,
  type ControllerCredentials,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type EcowittCredentials,
  type SensorReading,
} from '../../../automation-engine/lib/adapters'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

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
}

export interface PollResult {
  controllerId: string
  controllerName: string
  brand: string
  status: 'success' | 'failed' | 'skipped'
  readingsCount: number
  error?: string
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

    case 'ecowitt':
      return {
        type: 'ecowitt',
        connectionMethod: (rawCredentials.connectionMethod as 'push' | 'tcp' | 'http' | 'cloud') || 'push',
        gatewayIP: rawCredentials.gatewayIP as string | undefined,
        apiKey: rawCredentials.apiKey as string | undefined,
        applicationKey: rawCredentials.applicationKey as string | undefined,
        macAddress: rawCredentials.macAddress as string | undefined,
      } satisfies EcowittCredentials

    default:
      throw new Error(`Cannot build credentials for unsupported brand: ${brand}`)
  }
}

// ============================================
// Main Polling Function
// ============================================

/**
 * Poll a single controller for sensor readings and store them in the database.
 *
 * This function:
 * 1. Decrypts controller credentials
 * 2. Connects to the controller via the appropriate adapter
 * 3. Reads sensor data
 * 4. Validates sensor readings
 * 5. Calculates VPD if temperature and humidity are available
 * 6. Stores readings in the sensor_readings table
 * 7. Updates controller status and last_seen timestamp
 *
 * @param supabase - Supabase client (service role)
 * @param controller - Controller database record
 * @returns Poll result with status and readings count
 */
export async function pollController(
  supabase: SupabaseClient,
  controller: DBController
): Promise<PollResult> {
  const { id: dbControllerId, user_id, brand, name, credentials } = controller

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
      console.error(`[pollController] Encryption error for controller ${dbControllerId}:`, 'Credentials cannot be decrypted')

      // Update controller with error
      await supabase
        .from('controllers')
        .update({
          status: 'error',
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

  // Validate credentials for cloud-connected brands
  if ((brand === 'ac_infinity' || brand === 'inkbird') && (!decryptedCredentials.email || !decryptedCredentials.password)) {
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

  console.log(`[pollController] Connecting to ${brand} controller "${name}"`)

  const connectionResult = await adapter.connect(adapterCredentials)

  if (!connectionResult.success) {
    console.warn(`[pollController] Failed to connect to ${name}:`, connectionResult.error)

    // Update controller status
    await supabase
      .from('controllers')
      .update({
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

    console.log(`[pollController] Read ${readings.length} sensors from ${name}`)

    // Validate and store readings
    const validReadings: SensorReading[] = []
    const now = new Date().toISOString()

    for (const reading of readings) {
      if (validateSensorReading(reading)) {
        validReadings.push(reading)
      } else {
        console.warn(`[pollController] Invalid sensor reading for ${name}:`, {
          type: reading.type,
          value: reading.value
        })
      }
    }

    // Check if we need to calculate VPD
    const hasVPD = validReadings.some(r => r.type === 'vpd')
    const tempReading = validReadings.find(r => r.type === 'temperature')
    const humidityReading = validReadings.find(r => r.type === 'humidity')

    if (!hasVPD && tempReading && humidityReading) {
      // Calculate VPD using Magnus-Tetens formula
      // Temperature is in Fahrenheit, convert to Celsius
      const tempF = tempReading.value
      const humidity = humidityReading.value

      if (tempF >= 32 && tempF <= 140 && humidity >= 0 && humidity <= 100) {
        const tempC = (tempF - 32) * 5 / 9
        const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
        const vpd = svp * (1 - humidity / 100)

        if (Number.isFinite(vpd) && vpd >= 0 && vpd <= 5) {
          validReadings.push({
            type: 'vpd',
            value: Math.round(vpd * 100) / 100,
            unit: 'kPa',
            timestamp: new Date(),
            port: 0,
            isStale: false,
          })
        }
      }
    }

    // Insert readings into database
    if (validReadings.length > 0) {
      const readingsToInsert = validReadings.map(reading => ({
        controller_id: dbControllerId,
        user_id: user_id,  // Required by database schema
        port: reading.port,
        sensor_type: reading.type,
        value: reading.value,
        unit: reading.unit,
        is_stale: false,
        recorded_at: now
      }))

      const { error: insertError } = await supabase
        .from('sensor_readings')
        .insert(readingsToInsert)

      if (insertError) {
        console.error(`[pollController] Failed to insert readings for ${name}:`, insertError.message)
      }
    }

    // Update controller status to online
    await supabase
      .from('controllers')
      .update({
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
    console.error(`[pollController] Error reading sensors from ${name}:`, error instanceof Error ? error.message : 'Unknown error')

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
      console.warn(`[pollController] Error disconnecting from ${name}:`, disconnectError instanceof Error ? disconnectError.message : 'Unknown')
    }
  }
}
