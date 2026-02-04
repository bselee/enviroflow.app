/**
 * Sensor Detail API Routes
 *
 * GET    /api/sensors/:id     - Get single sensor
 * PATCH  /api/sensors/:id     - Update sensor
 * DELETE /api/sensors/:id     - Delete sensor
 *
 * SECURITY NOTES:
 * - Ownership verification on all operations
 * - Credentials in connection_config are encrypted before storage
 * - connection_config is never returned in responses
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  encryptCredentials,
  EncryptionError,
} from '@/lib/server-encryption'
import type { UpdateSensorInput } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

/**
 * Sanitize user input to prevent XSS attacks.
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
 * GET /api/sensors/:id
 * Get a single sensor by ID
 *
 * SECURITY: connection_config is excluded from the response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase()
    const { id: sensorId } = await params

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

    // Fetch sensor - exclude connection_config
    const { data, error } = await supabase
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
      .eq('id', sensorId)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Sensor not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({ sensor: data })

  } catch (error) {
    console.error('Sensor GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sensors/:id
 * Update a sensor
 *
 * Allowed updates: name, room_id, unit, connection_config, is_online, show_on_dashboard
 *
 * SECURITY: connection_config with password is encrypted before storage
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase()
    const { id: sensorId } = await params

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

    // Verify sensor ownership
    const { data: existingSensor, error: fetchError } = await supabase
      .from('sensors')
      .select('id, user_id, name')
      .eq('id', sensorId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingSensor) {
      return NextResponse.json(
        { error: 'Sensor not found or access denied' },
        { status: 404 }
      )
    }

    // Parse body
    const body = await request.json() as UpdateSensorInput
    const {
      name,
      room_id,
      unit,
      connection_config,
      is_online,
      show_on_dashboard
    } = body

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    // Sanitize name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 1) {
        return NextResponse.json(
          { error: 'Sensor name must be a non-empty string' },
          { status: 400 }
        )
      }
      updates.name = sanitizeString(name.trim()).slice(0, 100)
    }

    // Validate room ownership if room_id is provided
    if (room_id !== undefined) {
      if (room_id === null) {
        updates.room_id = null
      } else {
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
        updates.room_id = room_id
      }
    }

    if (unit !== undefined) {
      updates.unit = unit
    }

    if (is_online !== undefined) {
      updates.is_online = is_online
    }

    if (show_on_dashboard !== undefined) {
      updates.show_on_dashboard = show_on_dashboard
    }

    // Encrypt connection_config if provided and contains password
    if (connection_config !== undefined) {
      if (connection_config && Object.keys(connection_config).length > 0) {
        if ('password' in connection_config && connection_config.password) {
          try {
            updates.connection_config = encryptCredentials(connection_config)
          } catch (error) {
            if (error instanceof EncryptionError) {
              console.error('[Sensors PATCH] Encryption configuration error:', error.message)
              return NextResponse.json(
                {
                  error: 'Server configuration error',
                  errorType: 'configuration',
                  message: error.message || 'Credential encryption is not properly configured.',
                  guidance: 'Check ENCRYPTION_KEY in environment variables.',
                },
                { status: 500 }
              )
            }
            throw error
          }
        } else {
          updates.connection_config = JSON.stringify(connection_config)
        }
      } else {
        updates.connection_config = JSON.stringify({})
      }
    }

    // Update sensor - exclude connection_config from response
    const { data, error } = await supabase
      .from('sensors')
      .update(updates)
      .eq('id', sensorId)
      .eq('user_id', userId)
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
      console.error('Database update error:', error)
      return NextResponse.json(
        {
          error: 'Failed to update sensor',
          errorType: 'server',
          message: 'Could not update the sensor.',
          guidance: 'Please try again. If this persists, contact support.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sensor: data,
      message: 'Sensor updated successfully'
    })

  } catch (error) {
    console.error('Sensor PATCH error:', error)
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

/**
 * DELETE /api/sensors/:id
 * Delete a sensor
 *
 * SECURITY: Verifies ownership before deletion
 * Database cascade will set sensor_id to NULL in sensor_readings
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase()
    const { id: sensorId } = await params

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

    // Verify sensor ownership before deletion
    const { data: existingSensor, error: fetchError } = await supabase
      .from('sensors')
      .select('id, name')
      .eq('id', sensorId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingSensor) {
      return NextResponse.json(
        { error: 'Sensor not found or access denied' },
        { status: 404 }
      )
    }

    // Delete sensor
    const { error } = await supabase
      .from('sensors')
      .delete()
      .eq('id', sensorId)
      .eq('user_id', userId)

    if (error) {
      console.error('Database delete error:', error)
      return NextResponse.json(
        {
          error: 'Failed to delete sensor',
          errorType: 'server',
          message: 'Could not delete the sensor.',
          guidance: 'Please try again. If this persists, contact support.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Sensor "${existingSensor.name}" deleted successfully`
    })

  } catch (error) {
    console.error('Sensor DELETE error:', error)
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
