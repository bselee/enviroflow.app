/**
 * Sensor Readings API Route
 *
 * Proxies sensor_readings queries through the server to avoid
 * browser-side QUIC protocol errors when querying Supabase directly.
 *
 * GET /api/sensor-readings?controllerIds=id1,id2&timeRangeHours=24&limit=100
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Supabase service client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase credentials not configured')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Get user ID from Bearer token
 */
async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id ?? null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const controllerIdsParam = searchParams.get('controllerIds')
    const timeRangeHours = parseInt(searchParams.get('timeRangeHours') || '24', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    const controllerIds = controllerIdsParam
      ? controllerIdsParam.split(',').filter(Boolean)
      : []

    // Calculate time range
    let startTime: Date
    let endTime: Date

    if (fromDate && toDate) {
      startTime = new Date(fromDate)
      endTime = new Date(toDate)
    } else {
      endTime = new Date()
      startTime = new Date()
      startTime.setHours(startTime.getHours() - timeRangeHours)
    }

    // First verify user owns these controllers
    if (controllerIds.length > 0) {
      const { data: ownedControllers, error: ownershipError } = await supabase
        .from('controllers')
        .select('id')
        .eq('user_id', userId)
        .in('id', controllerIds)

      if (ownershipError) {
        console.error('[SensorReadings API] Ownership check failed:', ownershipError)
        return NextResponse.json(
          { error: 'Failed to verify controller ownership' },
          { status: 500 }
        )
      }

      // Filter to only controllers user owns
      const ownedIds = (ownedControllers || []).map(c => c.id)
      if (ownedIds.length === 0) {
        return NextResponse.json({
          success: true,
          readings: [],
          message: 'No authorized controllers found'
        })
      }

      // Use only owned controller IDs
      controllerIds.length = 0
      controllerIds.push(...ownedIds)
    }

    // Build query
    let query = supabase
      .from('sensor_readings')
      .select('*')
      .gte('recorded_at', startTime.toISOString())
      .lte('recorded_at', endTime.toISOString())
      .order('recorded_at', { ascending: false })
      .limit(limit * Math.max(controllerIds.length, 1))

    // Filter by controller IDs if provided
    if (controllerIds.length > 0) {
      query = query.in('controller_id', controllerIds)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      console.error('[SensorReadings API] Query failed:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch sensor readings', details: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      readings: data || [],
      count: data?.length || 0,
      timeRange: {
        from: startTime.toISOString(),
        to: endTime.toISOString(),
      }
    })
  } catch (error) {
    console.error('[SensorReadings API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
