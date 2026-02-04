/**
 * Sensor Readings API Routes
 *
 * POST /api/sensors/:id/readings - Submit a manual reading for a sensor
 *
 * This endpoint is used for manual sensors where users submit readings directly
 * rather than pulling from a cloud API or controller.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
 * POST /api/sensors/:id/readings
 * Submit a manual reading for a sensor
 *
 * Body: {
 *   value: number,
 *   unit?: string  // Optional, uses sensor's default unit if not provided
 * }
 *
 * Updates:
 * 1. Inserts a new reading into sensor_readings table
 * 2. Updates sensor's current_value and last_reading_at
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase()
    const sensorId = params.id

    // Get user from auth header
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

    // Verify sensor ownership and get sensor details
    const { data: sensor, error: fetchError } = await supabase
      .from('sensors')
      .select('id, user_id, name, sensor_type, unit')
      .eq('id', sensorId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !sensor) {
      return NextResponse.json(
        { error: 'Sensor not found or access denied' },
        { status: 404 }
      )
    }

    // Parse body
    const body = await request.json()
    const { value, unit } = body

    // Validate value
    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Reading value is required' },
        { status: 400 }
      )
    }

    if (typeof value !== 'number' || isNaN(value)) {
      return NextResponse.json(
        { error: 'Reading value must be a valid number' },
        { status: 400 }
      )
    }

    // Use provided unit or sensor's default unit
    const readingUnit = unit || sensor.unit

    const now = new Date().toISOString()

    // Insert reading into sensor_readings table
    const { data: reading, error: insertError } = await supabase
      .from('sensor_readings')
      .insert({
        sensor_id: sensorId,
        controller_id: null, // Manual sensors don't have a controller
        port: null,
        sensor_type: sensor.sensor_type,
        value,
        unit: readingUnit,
        is_stale: false,
        recorded_at: now,
      })
      .select('id, value, recorded_at')
      .single()

    if (insertError) {
      console.error('Failed to insert reading:', insertError)
      return NextResponse.json(
        {
          error: 'Failed to save reading',
          errorType: 'server',
          message: 'Could not save the sensor reading.',
          guidance: 'Please try again.',
        },
        { status: 500 }
      )
    }

    // Update sensor's current_value and last_reading_at
    const { error: updateError } = await supabase
      .from('sensors')
      .update({
        current_value: value,
        last_reading_at: now,
        is_online: true,
        updated_at: now,
      })
      .eq('id', sensorId)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to update sensor:', updateError)
      // Non-fatal - reading was saved, just sensor metadata didn't update
      // Continue and return success
    }

    return NextResponse.json({
      success: true,
      reading: {
        id: reading.id,
        value: reading.value,
        recorded_at: reading.recorded_at,
      },
      message: 'Reading saved successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Sensor reading POST error:', error)
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
