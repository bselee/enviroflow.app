/**
 * Sensor API Routes
 *
 * GET    /api/sensors         - List user's standalone sensors
 * POST   /api/sensors         - Add new standalone sensor
 *
 * SECURITY NOTES:
 * - Credentials in connection_config are encrypted using AES-256-GCM before database storage
 * - Credentials are NEVER returned in GET responses
 * - The ENCRYPTION_KEY environment variable must be set (64 hex chars / 32 bytes)
 * - Generate encryption key with: openssl rand -hex 32
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  encryptCredentials,
  EncryptionError,
} from '@/lib/server-encryption'
import type {
  CreateSensorInput,
  SensorSourceType,
  SensorType,
  SensorWithRoom,
} from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

/**
 * Sanitize user input to prevent XSS attacks.
 * Escapes HTML special characters that could be used for XSS.
 *
 * @param input - Raw user input string
 * @returns Sanitized string safe for storage and display
 */
function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

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
 * GET /api/sensors
 * List all standalone sensors for the authenticated user
 *
 * Query params:
 * - room_id: Filter by room ID
 * - source_type: Filter by source type (cloud_api, manual, controller)
 * - show_on_dashboard: Filter by dashboard visibility (true/false)
 *
 * SECURITY: connection_config is intentionally excluded from the select query.
 * Credentials are encrypted in the database and should never be sent to the client.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()

    // Get user from auth header - Bearer token authentication only
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide a valid Authorization Bearer token.' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const sourceType = searchParams.get('source_type') as SensorSourceType | null
    const showOnDashboard = searchParams.get('show_on_dashboard')

    // Build query - exclude connection_config for security
    let query = supabase
      .from('sensors')
      .select(`
        id,
        user_id,
        name,
        sensor_type,
        source_type,
        brand,
        room_id,
        controller_id,
        controller_port,
        unit,
        current_value,
        last_reading_at,
        is_online,
        metadata,
        show_on_dashboard,
        created_at,
        updated_at,
        room:rooms(id, name)
      `)
      .eq('user_id', userId)

    // Apply filters
    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    if (sourceType) {
      query = query.eq('source_type', sourceType)
    }

    if (showOnDashboard !== null) {
      const showValue = showOnDashboard === 'true'
      query = query.eq('show_on_dashboard', showValue)
    }

    // Order by creation date
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sensors', details: error.message },
        { status: 500 }
      )
    }

    const sensors = (data || []) as SensorWithRoom[]

    return NextResponse.json({
      sensors,
      count: sensors.length
    })

  } catch (error) {
    console.error('Sensors GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sensors
 * Add a new standalone sensor
 *
 * SECURITY NOTES:
 * - Credentials in connection_config are encrypted using AES-256-GCM before storage
 * - Requires ENCRYPTION_KEY environment variable
 * - Credentials are never returned in the response
 *
 * Body: {
 *   name: string,
 *   sensor_type: SensorType,
 *   source_type: SensorSourceType,
 *   brand?: string,
 *   room_id?: string,
 *   unit?: string,
 *   connection_config?: { email?, password?, ... },
 *   show_on_dashboard?: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()

    // Get user - Bearer token authentication only
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse body
    const body = await request.json() as CreateSensorInput
    const {
      name,
      sensor_type,
      source_type,
      brand,
      room_id,
      unit,
      connection_config,
      show_on_dashboard
    } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.length < 1) {
      return NextResponse.json(
        { error: 'Sensor name is required' },
        { status: 400 }
      )
    }

    if (!sensor_type) {
      return NextResponse.json(
        { error: 'Sensor type is required' },
        { status: 400 }
      )
    }

    if (!source_type) {
      return NextResponse.json(
        { error: 'Source type is required' },
        { status: 400 }
      )
    }

    // Validate source_type
    const validSourceTypes: SensorSourceType[] = ['cloud_api', 'manual', 'controller']
    if (!validSourceTypes.includes(source_type)) {
      return NextResponse.json(
        { error: `Invalid source_type. Must be one of: ${validSourceTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Sanitize name (prevent XSS, limit length)
    const sanitizedName = sanitizeString(name.trim()).slice(0, 100)

    // Validate room ownership if room_id is provided
    if (room_id) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', room_id)
        .eq('user_id', userId)
        .single()

      if (roomError || !room) {
        return NextResponse.json(
          {
            error: 'Invalid room or insufficient permissions',
            errorType: 'validation',
            message: 'The selected room does not exist or you do not have access to it.',
          },
          { status: 400 }
        )
      }
    }

    // Encrypt connection_config if it contains a password
    let encryptedConfig: string | null = null
    if (connection_config && Object.keys(connection_config).length > 0) {
      // Check if config has password field
      if ('password' in connection_config && connection_config.password) {
        try {
          encryptedConfig = encryptCredentials(connection_config)
        } catch (error) {
          if (error instanceof EncryptionError) {
            console.error('[Sensors POST] Encryption configuration error:', error.message)
            return NextResponse.json(
              {
                error: 'Server configuration error',
                errorType: 'configuration',
                message: error.message || 'Credential encryption is not properly configured.',
                guidance: 'Check ENCRYPTION_KEY in Vercel environment variables. It must be exactly 64 hex characters with no quotes or spaces.',
              },
              { status: 500 }
            )
          }
          throw error
        }
      } else {
        // No password, store as plain JSON
        encryptedConfig = JSON.stringify(connection_config)
      }
    }

    // Determine default unit based on sensor_type
    const sensorUnits: Record<SensorType, string> = {
      temperature: '°F',
      humidity: '%',
      vpd: 'kPa',
      co2: 'ppm',
      light: 'lux',
      ph: 'pH',
      ec: 'μS/cm',
      soil_moisture: '%',
      pressure: 'hPa',
      wind_speed: 'm/s',
      pm25: 'μg/m³',
      water_level: 'cm',
      uv: 'index',
      solar_radiation: 'W/m²',
      rain: 'mm',
    }

    const finalUnit = unit || sensorUnits[sensor_type] || ''

    // Insert sensor
    const { data, error } = await supabase
      .from('sensors')
      .insert({
        user_id: userId,
        name: sanitizedName,
        sensor_type,
        source_type,
        brand: brand || null,
        room_id: room_id || null,
        unit: finalUnit,
        connection_config: encryptedConfig || JSON.stringify({}),
        show_on_dashboard: show_on_dashboard ?? true,
        is_online: false,
        current_value: null,
        last_reading_at: null,
        metadata: {},
      })
      .select(`
        id,
        user_id,
        name,
        sensor_type,
        source_type,
        brand,
        room_id,
        controller_id,
        controller_port,
        unit,
        current_value,
        last_reading_at,
        is_online,
        metadata,
        show_on_dashboard,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      console.error('Database insert error:', error)

      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          {
            error: 'Sensor already exists',
            errorType: 'validation',
            message: 'A sensor with this name already exists.',
            guidance: 'Please choose a different name.',
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          error: 'Failed to save sensor',
          errorType: 'server',
          message: 'Could not save the sensor to the database.',
          guidance: 'Please try again. If this persists, contact support.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sensor: data,
      message: `Sensor "${sanitizedName}" created successfully`,
    }, { status: 201 })

  } catch (error) {
    // Log detailed error server-side only
    console.error('Sensors POST error:', error)

    // Return user-friendly error without exposing internals
    return NextResponse.json(
      {
        error: 'Server error',
        errorType: 'server',
        message: 'An unexpected error occurred. Please try again.',
        guidance: 'If this problem persists, please contact support.',
      },
      { status: 500 }
    )
  }
}
