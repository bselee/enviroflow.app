/**
 * Ecowitt Push Webhook Endpoint
 *
 * POST /api/ecowitt/report - Receive form-encoded data from Ecowitt gateway
 *
 * This endpoint receives sensor data pushed from Ecowitt gateways configured
 * for "Custom" HTTP upload in the WS View app or web UI.
 *
 * SECURITY NOTES:
 * - This endpoint does NOT require authentication (gateway pushes anonymously)
 * - Controller is identified by MAC address (PASSKEY or mac field)
 * - Data validation is performed before database insertion
 *
 * Ecowitt Gateway Configuration:
 * - Protocol: Ecowitt or Wunderground
 * - Server: enviroflow.app (or your domain)
 * - Path: /api/ecowitt/report
 * - Port: 443 (HTTPS) or 80 (HTTP)
 * - Interval: 30-60 seconds
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazy initialization of Supabase client with service role key
let supabase: ReturnType<typeof createClient> | null = null

function getSupabase() {
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

// Simple rate limiter (10 requests per minute per MAC)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS = 10

function checkRateLimit(mac: string): boolean {
  const now = Date.now()
  const key = mac.toUpperCase()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (entry.count >= MAX_REQUESTS) {
    return false
  }

  entry.count++
  return true
}

// Allowed sensor types whitelist
const ALLOWED_SENSOR_TYPES = new Set([
  'temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec',
  'pressure', 'water_level', 'soil_moisture', 'wind_speed', 'pm25',
  'uv', 'solar_radiation', 'rain'
])

// Sensor value bounds for validation
const SENSOR_BOUNDS: Record<string, { min: number; max: number }> = {
  temperature: { min: -60, max: 150 },  // Fahrenheit
  humidity: { min: 0, max: 100 },
  pressure: { min: 20, max: 35 },       // inHg
  soil_moisture: { min: 0, max: 100 },
  co2: { min: 0, max: 10000 },
  pm25: { min: 0, max: 1000 },
  uv: { min: 0, max: 20 },
  wind_speed: { min: 0, max: 300 },
  light: { min: 0, max: 2000 },         // W/m² for solar radiation
  solar_radiation: { min: 0, max: 2000 },
  rain: { min: 0, max: 100 },           // inches
}

// MAC address validation regex
const MAC_REGEX = /^([0-9A-F]{2}[:-]?){5}[0-9A-F]{2}$/i

/**
 * Parse Ecowitt sensor data from form-encoded webhook payload
 */
interface EcowittReading {
  controller_id: string
  user_id: string
  sensor_type: string
  value: number
  unit: string
  port: number
}

function parseSensorData(formData: FormData): {
  macAddress: string | null
  timestamp: Date
  readings: Array<{ sensor_type: string; value: number; unit: string; port: number }>
} {
  // Extract MAC address from PASSKEY or mac field
  const macAddress = (formData.get('PASSKEY') || formData.get('mac') || '') as string

  // Parse timestamp (dateutc format: "2026-01-24 12:30:45" or Unix timestamp)
  const dateutc = formData.get('dateutc') as string | null
  let timestamp = new Date()
  if (dateutc) {
    // Try parsing as Unix timestamp first
    const unixTimestamp = parseInt(dateutc)
    if (!isNaN(unixTimestamp)) {
      timestamp = new Date(unixTimestamp * 1000)
    } else {
      // Try parsing as date string
      const parsed = new Date(dateutc)
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed
      }
    }
  }

  const readings: Array<{ sensor_type: string; value: number; unit: string; port: number }> = []

  // Helper to add reading if value is valid
  const addReading = (
    sensorType: string,
    value: string | null,
    unit: string,
    port: number = 0
  ) => {
    if (value === null || value === '') return
    const numValue = parseFloat(value)
    // Check for NaN AND Infinity
    if (!isNaN(numValue) && isFinite(numValue)) {
      readings.push({ sensor_type: sensorType, value: numValue, unit, port })
    }
  }

  // Indoor sensors (port 0)
  addReading('temperature', formData.get('tempinf') as string, '°F', 0)
  addReading('humidity', formData.get('humidityin') as string, '%', 0)

  // Outdoor sensors (port 1)
  addReading('temperature', formData.get('tempf') as string, '°F', 1)
  addReading('humidity', formData.get('humidity') as string, '%', 1)

  // Barometric pressure (port 0)
  addReading('pressure', formData.get('baromabsin') as string, 'inHg', 0)
  addReading('pressure', formData.get('baromrelin') as string, 'inHg', 0)

  // Soil moisture channels (ports 1-8)
  for (let i = 1; i <= 8; i++) {
    addReading('soil_moisture', formData.get(`soilmoisture${i}`) as string, '%', i)
  }

  // Multi-channel temperature sensors (ports 2-9)
  for (let i = 1; i <= 8; i++) {
    addReading('temperature', formData.get(`temp${i}f`) as string, '°F', i + 1)
  }

  // Multi-channel humidity sensors (ports 2-9)
  for (let i = 1; i <= 8; i++) {
    addReading('humidity', formData.get(`humidity${i}`) as string, '%', i + 1)
  }

  // UV index (port 0)
  addReading('light', formData.get('uv') as string, 'UV Index', 0)

  // Solar radiation (port 0)
  addReading('light', formData.get('solarradiation') as string, 'W/m²', 0)

  // Wind (port 0)
  const windspeedmph = formData.get('windspeedmph') as string
  if (windspeedmph) {
    const windValue = parseFloat(windspeedmph)
    if (!isNaN(windValue)) {
      // Store wind as a custom sensor type (not in enum, but accepted by database)
      readings.push({ sensor_type: 'wind_speed', value: windValue, unit: 'mph', port: 0 })
    }
  }

  // CO2 (if available - some Ecowitt sensors support this via WH45)
  addReading('co2', formData.get('co2') as string, 'ppm', 0)

  // PM2.5 air quality sensors (ports 1-4)
  for (let i = 1; i <= 4; i++) {
    const pm25 = formData.get(`pm25_ch${i}`) as string
    if (pm25) {
      const value = parseFloat(pm25)
      if (!isNaN(value)) {
        readings.push({ sensor_type: 'pm25', value, unit: 'µg/m³', port: i })
      }
    }
  }

  return {
    macAddress,
    timestamp,
    readings
  }
}

/**
 * POST /api/ecowitt/report
 * Receive sensor data from Ecowitt gateway via HTTP push
 */
export async function POST(req: NextRequest) {
  const requestStart = Date.now()

  try {
    // Parse form-encoded data
    const formData = await req.formData()

    // Log incoming webhook for debugging
    console.log('[Ecowitt Webhook] Received data:', {
      timestamp: new Date().toISOString(),
      mac: formData.get('PASSKEY') || formData.get('mac'),
      stationtype: formData.get('stationtype'),
      source: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    })

    // Parse sensor data
    const { macAddress, timestamp, readings } = parseSensorData(formData)

    if (!macAddress) {
      console.error('[Ecowitt Webhook] No MAC address found in request')
      return NextResponse.json(
        { error: 'Missing PASSKEY or mac field' },
        { status: 400 }
      )
    }

    // Sanitize MAC address - only allow hex digits, colons, hyphens
    const sanitizedMac = macAddress.replace(/[^0-9A-Fa-f:-]/g, '').toUpperCase()
    if (!sanitizedMac || !MAC_REGEX.test(sanitizedMac)) {
      console.warn('[Ecowitt Webhook] Invalid MAC address format:', macAddress?.slice(0, 10))
      return new Response('success', { status: 200 })
    }

    // Apply rate limiting
    if (!checkRateLimit(sanitizedMac)) {
      console.warn('[Ecowitt Webhook] Rate limit exceeded for MAC:', sanitizedMac.slice(0, 8))
      return new Response('success', { status: 200 }) // Still return success to prevent retries
    }

    // Look up controller by MAC address (check multiple possible ID formats)
    const supabase = getSupabase()

    // The adapter stores controller_id in various formats depending on connection method
    const macWithoutSeparators = sanitizedMac.replace(/[:-]/g, '')
    const possibleControllerIds = [
      sanitizedMac,
      `ecowitt-push-${sanitizedMac}`,
      `ecowitt-tcp-${sanitizedMac}`,
      `ecowitt-http-${sanitizedMac}`,
      `ecowitt-cloud-${sanitizedMac}`,
      macWithoutSeparators,
      `ecowitt-push-${macWithoutSeparators}`,
      `ecowitt-tcp-${macWithoutSeparators}`,
      `ecowitt-http-${macWithoutSeparators}`,
      `ecowitt-cloud-${macWithoutSeparators}`,
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: controller, error: lookupError } = await supabase
      .from('controllers')
      .select('id, controller_id, user_id, name, brand')
      .eq('brand', 'ecowitt')
      .in('controller_id', possibleControllerIds)
      .limit(1)
      .single() as { data: { id: string; controller_id: string; user_id: string; name: string; brand: string } | null; error: any }

    if (lookupError || !controller) {
      console.warn('[Ecowitt Webhook] Controller not found for MAC:', {
        macAddress: sanitizedMac,
        searchedIds: possibleControllerIds.slice(0, 5), // Log first 5 for brevity
        error: lookupError?.message
      })

      // Return success to prevent gateway from retrying
      // The gateway doesn't need to know about our internal registration state
      return new Response('success', { status: 200 })
    }

    console.log('[Ecowitt Webhook] Found controller:', {
      id: controller.id,
      name: controller.name,
      controller_id: controller.controller_id,
      readingCount: readings.length
    })

    // Insert sensor readings into database
    if (readings.length > 0) {
      // Filter readings to only include valid sensor types and values within bounds
      const validReadings = readings.filter(r => {
        // Check sensor type is allowed
        if (!ALLOWED_SENSOR_TYPES.has(r.sensor_type)) {
          console.warn(`[Ecowitt Webhook] Skipping unknown sensor type: ${r.sensor_type}`)
          return false
        }
        // Check value bounds if defined
        const bounds = SENSOR_BOUNDS[r.sensor_type]
        if (bounds && (r.value < bounds.min || r.value > bounds.max)) {
          console.warn(`[Ecowitt Webhook] Value out of bounds for ${r.sensor_type}: ${r.value} (expected ${bounds.min}-${bounds.max})`)
          return false
        }
        return true
      })

      if (validReadings.length === 0) {
        console.log('[Ecowitt Webhook] No valid readings to insert after validation')
        return new Response('success', { status: 200 })
      }

      const sensorReadings: Array<{
        controller_id: string
        user_id: string
        sensor_type: string
        value: number
        unit: string
        port: number
        recorded_at: string
        is_stale: boolean
      }> = validReadings.map(r => ({
        controller_id: controller.id,
        user_id: controller.user_id,
        sensor_type: r.sensor_type,
        value: r.value,
        unit: r.unit,
        port: r.port,
        recorded_at: timestamp.toISOString(),
        is_stale: false
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await supabase
        .from('sensor_readings')
        .insert(sensorReadings as any)

      if (insertError) {
        console.error('[Ecowitt Webhook] Failed to insert readings:', {
          error: insertError.message,
          controller_id: controller.id,
          readingCount: validReadings.length
        })

        // Still return success to gateway to prevent retries
        return new Response('success', { status: 200 })
      }

      console.log('[Ecowitt Webhook] Inserted readings:', {
        controller_id: controller.id,
        count: validReadings.length,
        filtered: readings.length - validReadings.length,
        types: Array.from(new Set(validReadings.map(r => r.sensor_type)))
      })
    }

    // Update controller last_seen timestamp and status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await supabase
      .from('controllers')
      .update({
        last_seen: timestamp.toISOString(),
        status: 'online',
        last_error: null // Clear any previous errors
      } as any)
      .eq('id', controller.id)

    if (updateError) {
      console.error('[Ecowitt Webhook] Failed to update controller status:', {
        error: updateError.message,
        controller_id: controller.id
      })
    }

    const duration = Date.now() - requestStart
    console.log('[Ecowitt Webhook] Processing complete:', {
      controller_id: controller.id,
      readingCount: readings.length,
      duration_ms: duration
    })

    // Ecowitt gateways require "success" text response
    return new Response('success', { status: 200 })

  } catch (error) {
    const duration = Date.now() - requestStart
    console.error('[Ecowitt Webhook] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration
    })

    // Return success to prevent gateway from retrying on our internal errors
    return new Response('success', { status: 200 })
  }
}

/**
 * GET /api/ecowitt/report
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: 'Ecowitt Push Webhook',
    status: 'operational',
    timestamp: new Date().toISOString(),
    documentation: 'Configure your Ecowitt gateway to push data to this endpoint using Custom HTTP Upload.'
  })
}
