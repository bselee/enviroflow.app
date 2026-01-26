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
  ACInfinityAdapter,
  type ControllerBrand,
  type ControllerCredentials,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type EcowittCredentials,
  type SensorReading,
  type FullControllerData,
  type PortState,
  type ParsedModeConfiguration,
  type RawApiCapture,
  type PollResultWithDegradation,
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
  status: 'success' | 'failed' | 'skipped' | 'degraded'
  readingsCount: number
  portsCount?: number
  modesCount?: number
  degradationLevel?: 'fresh' | 'recent_cache' | 'interpolated' | 'last_known'
  error?: string
}

// Degradation thresholds
const DEGRADATION_THRESHOLDS = {
  FRESH: 5 * 60 * 1000, // 5 minutes
  RECENT_CACHE: 15 * 60 * 1000, // 15 minutes
  INTERPOLATED: 60 * 60 * 1000, // 60 minutes
  // Beyond 60 minutes is "last_known"
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
// Port Storage
// ============================================

async function storeControllerPorts(
  supabase: SupabaseClient,
  dbControllerId: string,
  ports: PortState[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (ports.length === 0) {
    return { success: true, count: 0 }
  }

  console.log(`[storeControllerPorts] Storing ${ports.length} ports for ${dbControllerId}`)

  const now = new Date().toISOString()

  // Upsert ports (update if exists, insert if not)
  for (const port of ports) {
    const portData = {
      controller_id: dbControllerId,
      port_number: port.port,
      port_name: port.portName,
      device_type: port.deviceType,
      load_type: port.loadType,
      is_connected: port.isConnected,
      is_on: port.isOn,
      power_level: port.powerLevel,
      current_mode: port.currentMode,
      supports_dimming: port.supportsDimming,
      is_online: port.isOnline,
      port_type: port.portType,
      dev_type: port.devType,
      external_port: port.externalPort,
      surplus: port.surplus,
      speak: port.speak,
      is_supported: port.isSupported,
      updated_at: now,
    }

    const { error } = await supabase
      .from('controller_ports')
      .upsert(portData, {
        onConflict: 'controller_id,port_number',
      })

    if (error) {
      console.error(`[storeControllerPorts] Error upserting port ${port.port}:`, error.message)
    }
  }

  return { success: true, count: ports.length }
}

// ============================================
// Mode Storage
// ============================================

async function storeControllerModes(
  supabase: SupabaseClient,
  dbControllerId: string,
  modes: ParsedModeConfiguration[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (modes.length === 0) {
    return { success: true, count: 0 }
  }

  console.log(`[storeControllerModes] Storing ${modes.length} modes for ${dbControllerId}`)

  const now = new Date().toISOString()

  for (const mode of modes) {
    const modeData = {
      controller_id: dbControllerId,
      port_number: mode.portNumber || 0,
      mode_id: mode.modeId,
      mode_name: mode.modeName,
      is_active: mode.isActive,
      temp_trigger_high: mode.tempTriggerHigh,
      temp_trigger_low: mode.tempTriggerLow,
      humidity_trigger_high: mode.humidityTriggerHigh,
      humidity_trigger_low: mode.humidityTriggerLow,
      vpd_trigger_high: mode.vpdTriggerHigh,
      vpd_trigger_low: mode.vpdTriggerLow,
      device_behavior: mode.deviceBehavior,
      max_level: mode.maxLevel,
      min_level: mode.minLevel,
      transition_enabled: mode.transitionEnabled,
      transition_speed: mode.transitionSpeed,
      buffer_enabled: mode.bufferEnabled,
      buffer_value: mode.bufferValue,
      timer_type: mode.timerType,
      timer_duration: mode.timerDuration,
      cycle_on_duration: mode.cycleOnDuration,
      cycle_off_duration: mode.cycleOffDuration,
      schedule_start_time: mode.scheduleStartTime,
      schedule_end_time: mode.scheduleEndTime,
      raw_settings: mode.rawSettings,
      updated_at: now,
    }

    const { error } = await supabase
      .from('controller_modes')
      .upsert(modeData, {
        onConflict: 'controller_id,port_number,mode_id',
      })

    if (error) {
      console.error(`[storeControllerModes] Error upserting mode ${mode.modeId}:`, error.message)
    }
  }

  return { success: true, count: modes.length }
}

// ============================================
// API Capture Storage
// ============================================

async function storeApiCapture(
  supabase: SupabaseClient,
  dbControllerId: string,
  capture: RawApiCapture
): Promise<{ success: boolean; error?: string }> {
  console.log(`[storeApiCapture] Storing API capture for ${dbControllerId}`)

  const captureData = {
    controller_id: dbControllerId,
    endpoint: capture.endpoint,
    response_hash: capture.responseHash,
    raw_sensor_data: capture.rawSensorData,
    raw_port_data: capture.rawPortData,
    raw_mode_data: capture.rawModeData,
    sensor_count: (capture.rawSensorData as unknown[])?.length || 0,
    port_count: (capture.rawPortData as unknown[])?.length || 0,
    mode_count: (capture.rawModeData as unknown[])?.length || 0,
    latency_ms: capture.latencyMs,
    success: true,
    captured_at: capture.capturedAt.toISOString(),
  }

  const { error } = await supabase
    .from('api_captures')
    .insert(captureData)

  if (error) {
    console.error(`[storeApiCapture] Error storing capture:`, error.message)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// ============================================
// Graceful Degradation - Cached Data Fallback
// ============================================

async function getLastKnownGoodReadings(
  supabase: SupabaseClient,
  dbControllerId: string,
  maxAgeMs: number = DEGRADATION_THRESHOLDS.INTERPOLATED
): Promise<{
  readings: SensorReading[]
  dataAge: number
  degradationLevel: 'fresh' | 'recent_cache' | 'interpolated' | 'last_known'
} | null> {
  console.log(`[getLastKnownGoodReadings] Getting cached readings for ${dbControllerId}`)

  // Get the most recent readings for each sensor type
  const { data: latestReadings, error } = await supabase
    .from('sensor_readings')
    .select('sensor_type, value, unit, port, recorded_at')
    .eq('controller_id', dbControllerId)
    .order('recorded_at', { ascending: false })
    .limit(20)

  if (error || !latestReadings || latestReadings.length === 0) {
    console.log(`[getLastKnownGoodReadings] No cached readings found`)
    return null
  }

  // Get unique readings by sensor type (most recent for each)
  const readingsByType = new Map<string, typeof latestReadings[0]>()
  for (const reading of latestReadings) {
    const key = `${reading.sensor_type}_${reading.port || 0}`
    if (!readingsByType.has(key)) {
      readingsByType.set(key, reading)
    }
  }

  const readings: SensorReading[] = []
  let oldestTimestamp = new Date()

  readingsByType.forEach((reading) => {
    const recordedAt = new Date(reading.recorded_at)
    if (recordedAt < oldestTimestamp) {
      oldestTimestamp = recordedAt
    }

    readings.push({
      type: reading.sensor_type as SensorReading['type'],
      value: reading.value,
      unit: reading.unit,
      port: reading.port || 0,
      timestamp: recordedAt,
      isStale: true, // Mark as stale since we're using cached data
    })
  })

  const dataAge = Date.now() - oldestTimestamp.getTime()

  // Determine degradation level
  let degradationLevel: 'fresh' | 'recent_cache' | 'interpolated' | 'last_known'
  if (dataAge < DEGRADATION_THRESHOLDS.FRESH) {
    degradationLevel = 'fresh'
  } else if (dataAge < DEGRADATION_THRESHOLDS.RECENT_CACHE) {
    degradationLevel = 'recent_cache'
  } else if (dataAge < DEGRADATION_THRESHOLDS.INTERPOLATED) {
    degradationLevel = 'interpolated'
  } else {
    degradationLevel = 'last_known'
  }

  console.log(`[getLastKnownGoodReadings] Found ${readings.length} cached readings, age: ${Math.round(dataAge / 1000 / 60)} min, level: ${degradationLevel}`)

  return { readings, dataAge, degradationLevel }
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
  const { id: dbControllerId, brand, name, credentials } = controller

  console.log(`[pollController] ========== START POLLING ==========`)
  console.log(`[pollController] Controller: ${name} (${dbControllerId})`)
  console.log(`[pollController] Brand: ${brand}`)
  console.log(`[pollController] Controller ID: ${controller.controller_id}`)
  console.log(`[pollController] Credentials type: ${typeof credentials}`)
  console.log(`[pollController] Credentials length: ${typeof credentials === 'string' ? credentials.length : 'N/A'}`)

  // Skip CSV upload controllers - they don't poll
  if (brand === 'csv_upload') {
    console.log(`[pollController] Skipping CSV upload controller`)
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
    console.log(`[pollController] Brand not supported: ${brand}`)
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
  console.log(`[pollController] Attempting to decrypt credentials...`)
  let decryptedCredentials: Record<string, unknown>
  try {
    decryptedCredentials = decryptCredentials(credentials)
    console.log(`[pollController] ✅ Credentials decrypted successfully`)
    console.log(`[pollController] Decrypted credential keys: ${Object.keys(decryptedCredentials).join(', ')}`)
  } catch (error) {
    if (error instanceof EncryptionError) {
      console.error(`[pollController] ❌ Encryption error for controller ${dbControllerId}:`, 'Credentials cannot be decrypted')
      console.error(`[pollController] Error details:`, error.message)

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
    console.error(`[pollController] ❌ Unexpected error during decryption:`, error)
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
  console.log(`[pollController] Getting adapter for brand: ${brand}`)
  const adapter = getAdapter(brand as ControllerBrand)
  console.log(`[pollController] Building adapter credentials...`)
  const adapterCredentials = buildAdapterCredentials(
    brand as ControllerBrand,
    decryptedCredentials
  )
  console.log(`[pollController] Adapter credentials built with type: ${adapterCredentials.type}`)

  console.log(`[pollController] Connecting to ${brand} controller "${name}"...`)

  const connectionResult = await adapter.connect(adapterCredentials)

  console.log(`[pollController] Connection result:`, {
    success: connectionResult.success,
    controllerId: connectionResult.controllerId,
    hasMetadata: !!connectionResult.metadata,
    error: connectionResult.error
  })

  if (!connectionResult.success) {
    console.warn(`[pollController] ❌ Failed to connect to ${name}:`, connectionResult.error)

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

  console.log(`[pollController] ✅ Connected successfully, controller ID: ${connectionResult.controllerId}`)

  try {
    // For AC Infinity, use precision adapter to get all data
    let readings: SensorReading[] = []
    let ports: PortState[] = []
    let modes: ParsedModeConfiguration[] = []
    let rawCapture: RawApiCapture | undefined

    if (brand === 'ac_infinity' && adapter instanceof ACInfinityAdapter) {
      // Check if precision method exists on adapter
      const adapterWithPrecision = adapter as ACInfinityAdapter & {
        readSensorsAndPorts?: (controllerId: string) => Promise<FullControllerData>
      }

      if (typeof adapterWithPrecision.readSensorsAndPorts === 'function') {
        console.log(`[pollController] Using precision adapter for AC Infinity...`)
        try {
          const fullData = await adapterWithPrecision.readSensorsAndPorts(connectionResult.controllerId)
          readings = fullData.sensors
          ports = fullData.ports
          modes = fullData.modes
          rawCapture = fullData.rawCapture

          console.log(`[pollController] ✅ Precision read: ${readings.length} sensors, ${ports.length} ports, ${modes.length} modes`)
        } catch (precisionError) {
          console.warn(`[pollController] ⚠️ Precision read failed, falling back to standard read:`, precisionError)
          readings = await adapter.readSensors(connectionResult.controllerId)
        }
      } else {
        // Precision method not available, use standard read
        console.log(`[pollController] Reading sensors from AC Infinity controller...`)
        readings = await adapter.readSensors(connectionResult.controllerId)
      }
    } else {
      // Standard read for other adapters
      console.log(`[pollController] Reading sensors from controller ${connectionResult.controllerId}...`)
      readings = await adapter.readSensors(connectionResult.controllerId)
    }

    console.log(`[pollController] ✅ Read ${readings.length} sensor readings`)
    console.log(`[pollController] Sensor types: ${readings.map(r => r.type).join(', ')}`)
    console.log(`[pollController] Sensor values:`, readings.map(r => `${r.type}=${r.value}${r.unit}`).join(', '))

    // Validate and store readings
    const validReadings: SensorReading[] = []
    const now = new Date().toISOString()

    for (const reading of readings) {
      if (validateSensorReading(reading)) {
        validReadings.push(reading)
        console.log(`[pollController] ✅ Valid reading: ${reading.type} = ${reading.value} ${reading.unit} (port ${reading.port})`)
      } else {
        console.warn(`[pollController] ⚠️ Invalid sensor reading for ${name}:`, {
          type: reading.type,
          value: reading.value
        })
      }
    }

    console.log(`[pollController] Valid readings count: ${validReadings.length}`)

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
    // Note: sensor_readings table uses controller relationship for access control, not user_id
    if (validReadings.length > 0) {
      const readingsToInsert = validReadings.map(reading => ({
        controller_id: dbControllerId,
        port: reading.port,
        sensor_type: reading.type,
        value: reading.value,
        unit: reading.unit,
        is_stale: false,
        recorded_at: now
      }))

      console.log(`[pollController] Inserting ${readingsToInsert.length} readings into database...`)
      console.log(`[pollController] Sample reading:`, JSON.stringify(readingsToInsert[0]))

      const { data: insertData, error: insertError } = await supabase
        .from('sensor_readings')
        .insert(readingsToInsert)
        .select()

      if (insertError) {
        console.error(`[pollController] ❌ Failed to insert readings for ${name}:`, {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        })
      } else {
        console.log(`[pollController] ✅ Successfully inserted ${readingsToInsert.length} readings`)
        console.log(`[pollController] Insert result count: ${insertData?.length || 0}`)
      }
    } else {
      console.log(`[pollController] ⚠️ No valid readings to insert`)
    }

    // Store ports if available (AC Infinity precision mode)
    let portsCount = 0
    if (ports.length > 0) {
      const portResult = await storeControllerPorts(supabase, dbControllerId, ports)
      portsCount = portResult.count
      console.log(`[pollController] Stored ${portsCount} ports`)
    }

    // Store modes if available (AC Infinity precision mode)
    let modesCount = 0
    if (modes.length > 0) {
      const modeResult = await storeControllerModes(supabase, dbControllerId, modes)
      modesCount = modeResult.count
      console.log(`[pollController] Stored ${modesCount} modes`)
    }

    // Store API capture for audit (AC Infinity precision mode)
    if (rawCapture) {
      await storeApiCapture(supabase, dbControllerId, rawCapture)
      console.log(`[pollController] Stored API capture`)
    }

    // Update controller status to online
    console.log(`[pollController] Updating controller status to online...`)
    const { error: updateError } = await supabase
      .from('controllers')
      .update({
        status: 'online',
        last_seen: now,
        last_error: null,
        updated_at: now
      })
      .eq('id', dbControllerId)

    if (updateError) {
      console.error(`[pollController] ❌ Failed to update controller status:`, updateError.message)
    } else {
      console.log(`[pollController] ✅ Controller status updated to online`)
    }

    console.log(`[pollController] ========== POLLING COMPLETE: SUCCESS ==========`)
    return {
      controllerId: dbControllerId,
      controllerName: name,
      brand,
      status: 'success',
      readingsCount: validReadings.length,
      portsCount,
      modesCount,
      degradationLevel: 'fresh' as const,
    }

  } catch (error) {
    console.error(`[pollController] ❌ Error reading sensors from ${name}:`, error instanceof Error ? error.message : 'Unknown error')
    console.error(`[pollController] Error stack:`, error instanceof Error ? error.stack : undefined)

    // Try graceful degradation - use cached data
    console.log(`[pollController] Attempting graceful degradation with cached data...`)
    const cachedData = await getLastKnownGoodReadings(supabase, dbControllerId)

    if (cachedData && cachedData.readings.length > 0) {
      console.log(`[pollController] ✅ Using cached data (${cachedData.degradationLevel}, age: ${Math.round(cachedData.dataAge / 1000 / 60)} min)`)

      // Update controller with error but keep status based on degradation level
      const newStatus = cachedData.degradationLevel === 'last_known' ? 'offline' : 'online'
      await supabase
        .from('controllers')
        .update({
          status: newStatus,
          last_error: `Degraded: ${error instanceof Error ? error.message : 'Sensor read failed'} (using ${cachedData.degradationLevel} cache)`,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbControllerId)

      console.log(`[pollController] ========== POLLING COMPLETE: DEGRADED ==========`)
      return {
        controllerId: dbControllerId,
        controllerName: name,
        brand,
        status: 'degraded',
        readingsCount: cachedData.readings.length,
        degradationLevel: cachedData.degradationLevel,
        error: error instanceof Error ? error.message : 'Sensor read failed (using cached data)'
      }
    }

    // No cached data available - full failure
    // Update controller with error but don't mark offline
    // (might be a transient issue)
    await supabase
      .from('controllers')
      .update({
        last_error: error instanceof Error ? error.message : 'Sensor read failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', dbControllerId)

    console.log(`[pollController] ========== POLLING COMPLETE: FAILED ==========`)
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
    console.log(`[pollController] Disconnecting from controller...`)
    try {
      await adapter.disconnect(connectionResult.controllerId)
      console.log(`[pollController] ✅ Disconnected successfully`)
    } catch (disconnectError) {
      console.warn(`[pollController] ⚠️ Error disconnecting from ${name}:`, disconnectError instanceof Error ? disconnectError.message : 'Unknown')
    }
  }
}
