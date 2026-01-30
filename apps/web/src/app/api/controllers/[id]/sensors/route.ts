/**
 * Controller Sensor Reading API Route
 *
 * GET /api/controllers/[id]/sensors - Fetch live sensor readings
 *
 * Flow:
 * 1. Verify user owns the controller
 * 2. Get adapter based on brand
 * 3. Call adapter.connect() with credentials
 * 4. Call adapter.readSensors()
 * 5. Validate readings against acceptable ranges
 * 6. Store in sensor_readings table
 * 7. Return readings
 *
 * Validation ranges (per MVP spec):
 * - Temperature: 32-120°F (0-49°C)
 * - Humidity: 0-100%
 * - VPD: 0-3.0 kPa
 * - CO2: 0-5000 ppm
 * - Light: 0-150000 lux
 * - pH: 0-14
 * - EC: 0-20 mS/cm
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { calculateVPD } from '@/lib/vpd-utils'
import {
  decryptCredentials as decryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limit'
import { safeError, safeWarn } from '@/lib/sanitize-log'

// Import REAL adapter factory from automation-engine workspace package
import {
  getAdapter,
  type ControllerBrand,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
} from '@enviroflow/automation-engine/adapters'

// ============================================
// Local Types (for API response formatting)
// ============================================

type SensorType = 'temperature' | 'humidity' | 'vpd' | 'co2' | 'light' | 'ph' | 'ec' | 'soil_moisture' | 'pressure' | 'water_level' | 'wind_speed' | 'pm25' | 'uv' | 'solar_radiation' | 'rain'

interface SensorReading {
  type: SensorType
  value: number
  unit: string
  timestamp: string
  port?: number
  isStale?: boolean
}

/**
 * Build credentials object with proper type discriminator for adapter factory.
 * The adapter factory uses a discriminated union based on the 'type' field.
 *
 * @param brand - The controller brand
 * @param credentials - Email/password credentials
 * @param deviceId - Optional AC Infinity device ID (for multi-device accounts)
 */
function buildAdapterCredentials(
  brand: ControllerBrand,
  credentials: { email?: string; password?: string; type?: string },
  deviceId?: string
): ACInfinityCredentials | InkbirdCredentials | CSVUploadCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: credentials.email || '',
        password: credentials.password || '',
        deviceId: deviceId, // Pass the specific device ID to connect to the right controller
      } satisfies ACInfinityCredentials

    case 'inkbird':
      return {
        type: 'inkbird',
        email: credentials.email || '',
        password: credentials.password || '',
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
// Types
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

interface RouteParams {
  params: Promise<{ id: string }>
}

interface ValidatedReading extends SensorReading {
  isValid: boolean
  validationError?: string
}

interface SensorRanges {
  min: number
  max: number
  unit: string
}

// ============================================
// Sensor Validation Ranges
// ============================================

/**
 * Acceptable ranges for each sensor type.
 * Readings outside these ranges are flagged but still stored.
 */
const SENSOR_RANGES: Record<SensorType, SensorRanges> = {
  temperature: { min: 32, max: 120, unit: 'F' }, // 0-49°C
  humidity: { min: 0, max: 100, unit: '%' },
  vpd: { min: 0, max: 3.0, unit: 'kPa' },
  co2: { min: 0, max: 5000, unit: 'ppm' },
  light: { min: 0, max: 150000, unit: 'lux' },
  ph: { min: 0, max: 14, unit: 'pH' },
  ec: { min: 0, max: 20, unit: 'mS/cm' },
  soil_moisture: { min: 0, max: 100, unit: '%' },
  pressure: { min: 800, max: 1200, unit: 'hPa' },
  water_level: { min: 0, max: 100, unit: '%' },
  wind_speed: { min: 0, max: 200, unit: 'mph' },
  pm25: { min: 0, max: 500, unit: 'µg/m³' },
  uv: { min: 0, max: 15, unit: 'index' },
  solar_radiation: { min: 0, max: 1500, unit: 'W/m²' },
  rain: { min: 0, max: 500, unit: 'mm' },
}

// ============================================
// Supabase Client (Service Role)
// ============================================

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error(
        'Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      )
    }

    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabase
}

// ============================================
// Authentication Helper
// ============================================

/**
 * Extract and validate user ID from request.
 * Uses Bearer token authentication only.
 *
 * SECURITY: x-user-id header bypass has been removed. All authentication
 * must go through Supabase Auth with a valid Bearer token.
 */
async function getUserId(request: NextRequest, client: SupabaseClient): Promise<string | null> {
  // Bearer token authentication only
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const {
      data: { user },
    } = await client.auth.getUser(token)
    if (user?.id) return user.id
  }

  return null
}

// ============================================
// Credential Decryption
// ============================================

/**
 * Decrypt credentials from database storage.
 * Handles both AES-256-GCM and legacy formats.
 *
 * @param encrypted - Encrypted string from database
 * @returns Object with decrypted credentials and success flag
 */
function decryptCredentials(encrypted: string | Record<string, unknown>): {
  success: boolean
  credentials: Record<string, unknown>
  error?: string
} {
  try {
    const credentials = decryptCredentialsAES(encrypted)
    return { success: true, credentials }
  } catch (error) {
    if (error instanceof EncryptionError) {
      safeError('[Decryption] Failed to decrypt credentials:', error.message)
      return {
        success: false,
        credentials: {},
        error: 'Failed to decrypt stored credentials. The encryption key may have changed.',
      }
    }
    safeError('[Decryption] Unexpected error:', error)
    return {
      success: false,
      credentials: {},
      error: 'Unexpected error decrypting credentials.',
    }
  }
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate a sensor reading against acceptable ranges.
 *
 * @param reading - The sensor reading to validate
 * @returns Validated reading with isValid flag and optional error
 */
function validateReading(reading: SensorReading): ValidatedReading {
  const ranges = SENSOR_RANGES[reading.type]

  if (!ranges) {
    // Unknown sensor type - accept but flag
    return {
      ...reading,
      isValid: true,
      validationError: `Unknown sensor type: ${reading.type}`,
    }
  }

  const isValid = reading.value >= ranges.min && reading.value <= ranges.max

  return {
    ...reading,
    isValid,
    validationError: isValid
      ? undefined
      : `Value ${reading.value} ${reading.unit} is outside acceptable range (${ranges.min}-${ranges.max} ${ranges.unit})`,
  }
}

// ============================================
// GET /api/controllers/[id]/sensors
// ============================================

/**
 * Fetch live sensor readings from a controller.
 *
 * Query params:
 * - store=true/false (default: true) - Whether to store readings in database
 * - calculate_vpd=true/false (default: true) - Calculate VPD if not provided
 *
 * Response: {
 *   success: true
 *   controller_id: string
 *   readings: ValidatedReading[]
 *   timestamp: string
 *   status: 'online' | 'offline' | 'error' | 'initializing'
 *   warnings?: string[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting: 10 requests per minute per user
    const rateLimitResult = checkRateLimit(userId, {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'sensor-read'
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many sensor read requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const shouldStore = searchParams.get('store') !== 'false'
    const calculateVPDFlag = searchParams.get('calculate_vpd') !== 'false'

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get controller with credentials
    const { data: controller, error: fetchError } = await client
      .from('controllers')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    const brand = controller.brand as ControllerBrand
    const warnings: string[] = []

    // Get adapter and read sensors
    let readings: SensorReading[] = []
    let isOnline = true

    try {
      const adapter = getAdapter(brand)

      // Decrypt stored credentials
      const decryptResult = decryptCredentials(controller.credentials)

      if (!decryptResult.success) {
        // Log detailed error server-side only - don't expose to client
        safeError('[Sensors GET] Credential decryption failed:', decryptResult.error)
        return NextResponse.json(
          {
            success: false,
            controller_id: id,
            readings: [],
            timestamp: new Date().toISOString(),
            status: 'error',
            error: 'Failed to access controller credentials. Please re-add the controller.',
          },
          { status: 500 }
        )
      }

      const storedCredentials = decryptResult.credentials

      // Validate we have required credentials for cloud-connected brands
      // Use proper type checking instead of unsafe casting
      if (brand === 'ac_infinity' || brand === 'inkbird') {
        const email = storedCredentials.email
        const password = storedCredentials.password

        if (typeof email !== 'string' || !email ||
            typeof password !== 'string' || !password) {
          const brandName = brand === 'ac_infinity' ? 'AC Infinity' : 'Inkbird'
          console.error(`[Sensors GET] Missing/invalid credentials for ${brandName} controller`)
          return NextResponse.json(
            {
              success: false,
              controller_id: id,
              readings: [],
              timestamp: new Date().toISOString(),
              status: 'error',
              error: `${brandName} credentials are incomplete or invalid`,
            },
            { status: 400 }
          )
        }
      }

      // Build properly typed credentials for the adapter
      // Type safety ensured by validation above
      // Pass controller_id (AC Infinity device ID) to connect to the specific device
      const adapterCredentials = buildAdapterCredentials(
        brand,
        {
          email: storedCredentials.email as string,
          password: storedCredentials.password as string,
          type: brand,
        },
        controller.controller_id // AC Infinity device ID selected during setup
      )

      console.log('[Sensors GET] Using device ID:', controller.controller_id, 'for controller:', controller.name)

      // Connect to get fresh data
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        isOnline = false
        warnings.push(`Connection failed: ${connectionResult.error}`)

        // Try to return cached data if available
        const { data: cachedReadings } = await client
          .from('sensor_readings')
          .select('*')
          .eq('controller_id', id)
          .order('recorded_at', { ascending: false })
          .limit(10)

        if (cachedReadings && cachedReadings.length > 0) {
          // Return cached readings with stale flag
          const cachedResponse = cachedReadings.map((r) => ({
            port: r.port,
            type: r.sensor_type as SensorType,
            value: r.value,
            unit: r.unit,
            timestamp: new Date(r.recorded_at).toISOString(),
            isStale: true,
            isValid: true,
          }))

          // Update controller status
          await client
            .from('controllers')
            .update({
              status: 'offline',
              last_error: connectionResult.error || 'Connection failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          return NextResponse.json({
            success: true,
            controller_id: id,
            readings: cachedResponse,
            timestamp: new Date().toISOString(),
            status: 'offline',
            is_cached: true,
            warnings: [
              'Controller is offline. Returning cached readings.',
              ...warnings,
            ],
          })
        }

        // No cached data available
        await client
          .from('controllers')
          .update({
            status: 'offline',
            last_error: connectionResult.error || 'Connection failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        return NextResponse.json(
          {
            success: false,
            controller_id: id,
            readings: [],
            timestamp: new Date().toISOString(),
            status: 'offline',
            error: 'Controller offline and no cached data available',
          },
          { status: 503 }
        )
      }

      // Read sensors with auto-reconnect on token expiration
      const controllerId = connectionResult.controllerId || id

      try {
        const adapterReadings = await adapter.readSensors(controllerId)
        // Convert adapter readings to local SensorReading type
        readings = adapterReadings.map((r) => ({
          type: r.type as SensorType,
          value: r.value,
          unit: r.unit,
          timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
          port: r.port,
          isStale: r.isStale,
        }))
      } catch (readError) {
        const errorMsg = readError instanceof Error ? readError.message : String(readError)

        // Handle token expiration - attempt ONE reconnect only
        if (errorMsg.includes('token expired') || errorMsg.includes('not connected')) {
          warnings.push('Token expired - reconnecting to controller')

          try {
            // Disconnect previous connection first to prevent resource leaks
            try {
              await adapter.disconnect(controllerId)
            } catch (disconnectErr) {
              safeWarn('[Sensors GET] Error during pre-reconnect disconnect:', disconnectErr)
            }

            // Reconnect with fresh token
            const reconnectResult = await adapter.connect(adapterCredentials)

            if (!reconnectResult.success) {
              throw new Error(`Reconnect failed: ${reconnectResult.error}`)
            }

            // Retry sensor read with new token
            const newControllerId = reconnectResult.controllerId || id
            const adapterReadings = await adapter.readSensors(newControllerId)
            readings = adapterReadings.map((r) => ({
              type: r.type as SensorType,
              value: r.value,
              unit: r.unit,
              timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
              port: r.port,
              isStale: r.isStale,
            }))

            // Update controllerId for final disconnect
            // Note: newControllerId is used for the cleanup below
          } catch (retryError) {
            // Retry failed - log and re-throw
            console.error('[Sensors GET] Reconnect retry failed:', retryError)
            throw retryError
          }
        } else {
          // Re-throw non-token errors
          throw readError
        }
      }

      // Disconnect after reading - wrap in try-catch for robustness
      try {
        if (controllerId) {
          await adapter.disconnect(controllerId)
        }
      } catch (disconnectErr) {
        // Disconnect error - non-critical
      }

      // Update controller status
      await client
        .from('controllers')
        .update({
          status: 'online',
          last_seen: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    } catch (adapterError) {
      safeError('[Sensors GET] Adapter error:', adapterError)
      isOnline = false

      const errorMessage =
        adapterError instanceof Error ? adapterError.message : 'Unknown adapter error'
      warnings.push(`Adapter error: ${errorMessage}`)

      // Update controller status
      await client
        .from('controllers')
        .update({
          status: 'error',
          last_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json(
        {
          success: false,
          controller_id: id,
          readings: [],
          timestamp: new Date().toISOString(),
          status: 'error',
          error: 'Failed to read sensors. The controller may be offline or unreachable.',
        },
        { status: 503 }
      )
    }

    // Calculate VPD if not present and we have temp/humidity
    if (calculateVPDFlag) {
      const hasVPD = readings.some((r) => r.type === 'vpd')
      const tempReading = readings.find((r) => r.type === 'temperature')
      const humidityReading = readings.find((r) => r.type === 'humidity')

      if (!hasVPD && tempReading && humidityReading) {
        const calculatedVPD = calculateVPD(tempReading.value, humidityReading.value)
        readings.push({
          port: 0, // Calculated, no physical port
          type: 'vpd',
          value: calculatedVPD,
          unit: 'kPa',
          timestamp: new Date().toISOString(),
          isStale: false,
        })
        warnings.push('VPD calculated from temperature and humidity readings')
      }
    }

    // Validate all readings
    const validatedReadings: ValidatedReading[] = readings.map(validateReading)

    // Collect validation warnings
    const invalidReadings = validatedReadings.filter((r) => !r.isValid)
    if (invalidReadings.length > 0) {
      invalidReadings.forEach((r) => {
        if (r.validationError) {
          warnings.push(`${r.type}: ${r.validationError}`)
        }
      })
    }

    // Store readings in database
    // Note: sensor_readings table uses controller relationship for access control, not user_id
    if (shouldStore && readings.length > 0) {
      const readingsToInsert = validatedReadings.map((r) => ({
        controller_id: id,
        port: r.port,
        sensor_type: r.type,
        value: r.value,
        unit: r.unit,
        is_stale: r.isStale || false,
        recorded_at: new Date().toISOString(),
      }))

      const { error: insertError } = await client
        .from('sensor_readings')
        .insert(readingsToInsert)

      if (insertError) {
        console.error('[Sensors GET] Error storing readings:', insertError)
        warnings.push('Failed to store readings in database')
      }
    }

    // Format response
    const responseReadings = validatedReadings.map((r) => ({
      port: r.port,
      type: r.type,
      value: r.value,
      unit: r.unit,
      timestamp: r.timestamp,
      is_stale: r.isStale || false,
      is_valid: r.isValid,
      validation_error: r.validationError,
    }))

    return NextResponse.json(
      {
        success: true,
        controller_id: id,
        controller_name: controller.name,
        brand: controller.brand,
        readings: responseReadings,
        reading_count: responseReadings.length,
        timestamp: new Date().toISOString(),
        status: isOnline ? 'online' : 'offline',
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      {
        headers: createRateLimitHeaders(rateLimitResult)
      }
    )
  } catch (error) {
    // Log detailed error server-side only - don't expose to client
    safeError('[Sensors GET] Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
