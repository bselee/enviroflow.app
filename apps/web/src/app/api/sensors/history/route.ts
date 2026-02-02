/**
 * Sensor History API Route
 *
 * GET /api/sensors/history - Fetch historical sensor data for graphs
 *
 * Query Parameters:
 * - days: 10 | 30 | 60 (default: 30)
 * - controllerIds: comma-separated list (optional, all if not specified)
 * - sensorType: temperature | humidity | vpd (optional, all if not specified)
 * - aggregate: hour | day (optional, raw if not specified)
 *
 * Returns aggregated data suitable for charting with reasonable data points:
 * - 10 days: hourly averages (~240 points)
 * - 30 days: 4-hour averages (~180 points)
 * - 60 days: daily averages (~60 points)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

// Type definitions
interface SensorReading {
  id: string
  controller_id: string
  sensor_type: string
  value: number
  unit: string
  recorded_at: string
}

interface AggregatedReading {
  controller_id: string
  sensor_type: string
  avg_value: number
  min_value: number
  max_value: number
  unit: string
  bucket_start: string
  reading_count: number
}

interface HistoryResponse {
  success: boolean
  data: AggregatedReading[]
  metadata: {
    days: number
    startDate: string
    endDate: string
    aggregation: string
    totalPoints: number
    controllers: string[]
  }
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
    const days = parseInt(searchParams.get('days') || '30', 10)
    const controllerIdsParam = searchParams.get('controllerIds')
    const sensorType = searchParams.get('sensorType')

    // Validate days parameter
    if (![10, 30, 60].includes(days)) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be 10, 30, or 60.' },
        { status: 400 }
      )
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Determine aggregation interval based on days
    // This keeps data points reasonable for charting
    let bucketHours: number
    let aggregation: string
    if (days <= 10) {
      bucketHours = 1  // Hourly for 10 days (~240 points)
      aggregation = 'hourly'
    } else if (days <= 30) {
      bucketHours = 4  // 4-hour buckets for 30 days (~180 points)
      aggregation = '4-hourly'
    } else {
      bucketHours = 24  // Daily for 60 days (~60 points)
      aggregation = 'daily'
    }

    // Get user's controllers
    let controllerQuery = supabase
      .from('controllers')
      .select('id, name')
      .eq('user_id', userId)

    if (controllerIdsParam) {
      const controllerIds = controllerIdsParam.split(',').filter(Boolean)
      controllerQuery = controllerQuery.in('id', controllerIds)
    }

    const { data: controllers, error: controllerError } = await controllerQuery

    if (controllerError) {
      console.error('[SensorHistory API] Controller query failed:', controllerError)
      return NextResponse.json(
        { error: 'Failed to fetch controllers' },
        { status: 500 }
      )
    }

    if (!controllers || controllers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          days,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          aggregation,
          totalPoints: 0,
          controllers: []
        }
      })
    }

    const controllerIds = controllers.map(c => c.id)

    // Fetch raw readings from database
    let readingsQuery = supabase
      .from('sensor_readings')
      .select('*')
      .in('controller_id', controllerIds)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true })

    if (sensorType) {
      readingsQuery = readingsQuery.eq('sensor_type', sensorType)
    }

    const { data: readings, error: readingsError } = await readingsQuery

    if (readingsError) {
      console.error('[SensorHistory API] Readings query failed:', readingsError)
      return NextResponse.json(
        { error: 'Failed to fetch sensor readings' },
        { status: 500 }
      )
    }

    // Aggregate readings into time buckets
    const aggregatedData = aggregateReadings(
      readings as SensorReading[] || [],
      bucketHours
    )

    console.log('[SensorHistory API] Query result:', {
      userId,
      days,
      controllers: controllerIds.length,
      rawReadings: readings?.length || 0,
      aggregatedPoints: aggregatedData.length
    })

    const response: HistoryResponse = {
      success: true,
      data: aggregatedData,
      metadata: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        aggregation,
        totalPoints: aggregatedData.length,
        controllers: controllerIds
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[SensorHistory API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Aggregate sensor readings into time buckets
 */
function aggregateReadings(
  readings: SensorReading[],
  bucketHours: number
): AggregatedReading[] {
  if (!readings || readings.length === 0) {
    return []
  }

  // Group by controller_id + sensor_type + time bucket
  const buckets = new Map<string, {
    controller_id: string
    sensor_type: string
    unit: string
    values: number[]
    bucket_start: Date
  }>()

  const bucketMs = bucketHours * 60 * 60 * 1000

  for (const reading of readings) {
    const recordedAt = new Date(reading.recorded_at)
    // Round down to bucket start
    const bucketStart = new Date(
      Math.floor(recordedAt.getTime() / bucketMs) * bucketMs
    )
    
    const key = `${reading.controller_id}|${reading.sensor_type}|${bucketStart.toISOString()}`
    
    if (!buckets.has(key)) {
      buckets.set(key, {
        controller_id: reading.controller_id,
        sensor_type: reading.sensor_type,
        unit: reading.unit,
        values: [],
        bucket_start: bucketStart
      })
    }
    
    buckets.get(key)!.values.push(Number(reading.value))
  }

  // Calculate aggregates for each bucket
  const aggregated: AggregatedReading[] = []
  
  for (const bucket of buckets.values()) {
    const values = bucket.values
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)

    aggregated.push({
      controller_id: bucket.controller_id,
      sensor_type: bucket.sensor_type,
      avg_value: Math.round(avg * 100) / 100,
      min_value: Math.round(min * 100) / 100,
      max_value: Math.round(max * 100) / 100,
      unit: bucket.unit,
      bucket_start: bucket.bucket_start.toISOString(),
      reading_count: values.length
    })
  }

  // Sort by time
  aggregated.sort((a, b) => 
    new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime()
  )

  return aggregated
}
