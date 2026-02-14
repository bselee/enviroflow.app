/**
 * Unified Sensor Data API Route
 *
 * GET /api/sensors/data - Fetch sensor data with intelligent aggregation
 *
 * Query Parameters:
 * - controllerId: UUID (optional, all controllers if not specified)
 * - range: 1h | 6h | 24h | 7d | 30d | 60d (default: 24h)
 * - includeDeviceState: true | false (default: false)
 *
 * Returns sensor readings with appropriate aggregation:
 * - 1h-24h: Direct query (raw data points)
 * - 7d+: Server-side downsampling via RPC
 *
 * Also returns device state changes for waveform charts when includeDeviceState=true
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// =============================================================================
// Configuration
// =============================================================================

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | '60d'

interface TimeRangeConfig {
  hours: number
  intervalMinutes: number
  useRPC: boolean
}

const TIME_RANGE_CONFIG: Record<TimeRange, TimeRangeConfig> = {
  '1h':  { hours: 1,    intervalMinutes: 1,   useRPC: false },
  '6h':  { hours: 6,    intervalMinutes: 1,   useRPC: false },  // Was 2, now 1 for better resolution
  '24h': { hours: 24,   intervalMinutes: 2,   useRPC: false },  // Was 5, now 2 for better resolution
  '7d':  { hours: 168,  intervalMinutes: 5,   useRPC: true },   // Was 30, now 5 for AC Infinity parity
  '30d': { hours: 720,  intervalMinutes: 15,  useRPC: true },   // Was 120, now 15 for better resolution
  '60d': { hours: 1440, intervalMinutes: 30,  useRPC: true },   // Was 240, now 30 for better resolution
}

// =============================================================================
// Types
// =============================================================================

interface SensorDataPoint {
  timestamp: string
  temperature: number | null
  humidity: number | null
  vpd: number | null
  tempMin?: number | null
  tempMax?: number | null
  humidityMin?: number | null
  humidityMax?: number | null
}

interface DeviceStatePoint {
  timestamp: string
  state: boolean
  speed: number
}

interface DeviceStateData {
  [deviceName: string]: DeviceStatePoint[]
}

interface SensorDataResponse {
  success: boolean
  sensorData: SensorDataPoint[]
  deviceStateData: DeviceStateData
  metadata: {
    range: TimeRange
    intervalMinutes: number
    pointCount: number
    controllerId: string | null
    startDate: string
    endDate: string
    useRPC: boolean
  }
  error?: string
}

// =============================================================================
// Supabase Client
// =============================================================================

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

// =============================================================================
// Main Handler
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<SensorDataResponse>> {
  const startTime = Date.now()

  try {
    const supabase = getSupabase()
    const userId = await getUserId(request)

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          sensorData: [],
          deviceStateData: {},
          metadata: {
            range: 'id' as TimeRange,
            intervalMinutes: 0,
            pointCount: 0,
            controllerId: null,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            useRPC: false,
          },
          error: 'Unauthorized'
        },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const controllerId = searchParams.get('controllerId')
    const range = (searchParams.get('range') || '24h') as TimeRange
    const includeDeviceState = searchParams.get('includeDeviceState') === 'true'

    // Validate range
    if (!TIME_RANGE_CONFIG[range]) {
      return NextResponse.json(
        {
          success: false,
          sensorData: [],
          deviceStateData: {},
          metadata: {
            range: '1d' as TimeRange,
            intervalMinutes: 0,
            pointCount: 0,
            controllerId: null,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            useRPC: false,
          },
          error: `Invalid range parameter. Must be one of: ${Object.keys(TIME_RANGE_CONFIG).join(', ')}`
        },
        { status: 400 }
      )
    }

    const config = TIME_RANGE_CONFIG[range]
    const endDate = new Date()
    const startDate = new Date(Date.now() - config.hours * 3600000)

    // Verify controller ownership if controllerId provided
    let validControllerId: string | null = null
    if (controllerId) {
      // The frontend sends the AC Infinity devId (controller_id column),
      // not the database UUID (id column). Try controller_id first, fall back to id.
      let controller: { id: string } | null = null
      let controllerError: unknown = null

      const { data: byExtId, error: extErr } = await supabase
        .from('controllers')
        .select('id')
        .eq('controller_id', controllerId)
        .eq('user_id', userId)
        .maybeSingle()

      if (byExtId) {
        controller = byExtId
      } else {
        // Fallback: try matching by UUID id column
        const { data: byId, error: idErr } = await supabase
          .from('controllers')
          .select('id')
          .eq('id', controllerId)
          .eq('user_id', userId)
          .maybeSingle()
        controller = byId
        controllerError = idErr
      }

      if (controllerError || !controller) {
        // Controller not registered in database - return empty data gracefully
        // This allows the UI to show "no data" instead of an error
        // (Live sensors work without registration, but historical data requires it)
        console.log(`[SensorData API] Controller ${controllerId} not found in database - returning empty data`)
        return NextResponse.json({
          success: true,
          sensorData: [],
          deviceStateData: {},
          metadata: {
            range,
            intervalMinutes: config.intervalMinutes,
            pointCount: 0,
            controllerId: null,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            useRPC: config.useRPC,
          }
        })
      }
      validControllerId = controller.id
    } else {
      // Get first controller for user if none specified
      const { data: controllers } = await supabase
        .from('controllers')
        .select('id')
        .eq('user_id', userId)
        .limit(1)

      if (controllers && controllers.length > 0) {
        validControllerId = controllers[0].id
      }
    }

    // Fetch sensor data
    let sensorData: SensorDataPoint[] = []

    if (validControllerId) {
      if (config.useRPC) {
        // Server-side downsampling for long ranges
        sensorData = await fetchDownsampledData(
          supabase,
          validControllerId,
          startDate,
          config.intervalMinutes
        )
      } else {
        // Direct query for short ranges
        sensorData = await fetchDirectData(
          supabase,
          validControllerId,
          startDate,
          endDate
        )
      }
    }

    // Fetch device state data if requested
    let deviceStateData: DeviceStateData = {}
    if (includeDeviceState && validControllerId) {
      deviceStateData = await fetchDeviceStateData(
        supabase,
        validControllerId,
        startDate
      )
    }

    const responseTime = Date.now() - startTime
    console.log(`[SensorData API] ${range} range, ${sensorData.length} points, ${responseTime}ms`)

    return NextResponse.json({
      success: true,
      sensorData,
      deviceStateData,
      metadata: {
        range,
        intervalMinutes: config.intervalMinutes,
        pointCount: sensorData.length,
        controllerId: validControllerId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        useRPC: config.useRPC,
      }
    })

  } catch (error) {
    console.error('[SensorData API] Error:', error)
    const now = new Date()
    return NextResponse.json(
      {
        success: false,
        sensorData: [],
        deviceStateData: {},
        metadata: {
          range: '1d' as TimeRange,
          intervalMinutes: 5,
          pointCount: 0,
          controllerId: null,
          startDate: new Date(now.getTime() - 86400000).toISOString(),
          endDate: now.toISOString(),
          useRPC: false,
        },
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

/**
 * Fetch data using server-side RPC for long time ranges
 */
async function fetchDownsampledData(
  supabase: ReturnType<typeof getSupabase>,
  controllerId: string,
  since: Date,
  intervalMinutes: number
): Promise<SensorDataPoint[]> {
  const { data, error } = await supabase.rpc('get_sensor_readings_downsampled', {
    p_controller_id: controllerId,
    p_since: since.toISOString(),
    p_interval: `${intervalMinutes} minutes`
  })

  if (error) {
    console.error('[SensorData API] RPC error:', error)
    // Fallback to direct query if RPC not available
    return fetchDirectDataWithAggregation(supabase, controllerId, since, intervalMinutes)
  }

  if (!data || data.length === 0) {
    return []
  }

  // Transform RPC response to standard format
  return data.map((row: {
    bucket: string
    temperature: number | null
    humidity: number | null
    vpd: number | null
    temp_min: number | null
    temp_max: number | null
    humidity_min: number | null
    humidity_max: number | null
  }) => ({
    timestamp: row.bucket,
    temperature: row.temperature !== null ? Math.round(row.temperature * 100) / 100 : null,
    humidity: row.humidity !== null ? Math.round(row.humidity * 100) / 100 : null,
    vpd: row.vpd !== null ? Math.round(row.vpd * 1000) / 1000 : null,
    tempMin: row.temp_min !== null ? Math.round(row.temp_min * 100) / 100 : null,
    tempMax: row.temp_max !== null ? Math.round(row.temp_max * 100) / 100 : null,
    humidityMin: row.humidity_min !== null ? Math.round(row.humidity_min * 100) / 100 : null,
    humidityMax: row.humidity_max !== null ? Math.round(row.humidity_max * 100) / 100 : null,
  }))
}

/**
 * Fallback: Client-side aggregation if RPC not available
 */
async function fetchDirectDataWithAggregation(
  supabase: ReturnType<typeof getSupabase>,
  controllerId: string,
  since: Date,
  intervalMinutes: number
): Promise<SensorDataPoint[]> {
  const endDate = new Date()

  const { data: readings, error } = await supabase
    .from('sensor_readings')
    .select('sensor_type, value, recorded_at')
    .eq('controller_id', controllerId)
    .gte('recorded_at', since.toISOString())
    .lte('recorded_at', endDate.toISOString())
    .order('recorded_at', { ascending: true })

  if (error || !readings) {
    console.error('[SensorData API] Direct query error:', error)
    return []
  }

  // Aggregate into buckets
  const bucketMs = intervalMinutes * 60 * 1000
  const buckets = new Map<number, {
    temps: number[]
    hums: number[]
    vpds: number[]
    timestamp: string
  }>()

  for (const reading of readings) {
    const recordedAt = new Date(reading.recorded_at).getTime()
    const bucketKey = Math.floor(recordedAt / bucketMs) * bucketMs

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        temps: [],
        hums: [],
        vpds: [],
        timestamp: new Date(bucketKey).toISOString()
      })
    }

    const bucket = buckets.get(bucketKey)!
    const value = Number(reading.value)

    if (reading.sensor_type === 'temperature') bucket.temps.push(value)
    else if (reading.sensor_type === 'humidity') bucket.hums.push(value)
    else if (reading.sensor_type === 'vpd') bucket.vpds.push(value)
  }

  // Convert to array
  const result: SensorDataPoint[] = []
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b)

  for (const key of sortedKeys) {
    const bucket = buckets.get(key)!
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    result.push({
      timestamp: bucket.timestamp,
      temperature: bucket.temps.length > 0 ? Math.round(avg(bucket.temps)! * 100) / 100 : null,
      humidity: bucket.hums.length > 0 ? Math.round(avg(bucket.hums)! * 100) / 100 : null,
      vpd: bucket.vpds.length > 0 ? Math.round(avg(bucket.vpds)! * 1000) / 1000 : null,
    })
  }

  return result
}

/**
 * Fetch raw data for short time ranges (1h-24h)
 */
async function fetchDirectData(
  supabase: ReturnType<typeof getSupabase>,
  controllerId: string,
  startDate: Date,
  endDate: Date
): Promise<SensorDataPoint[]> {
  const { data: readings, error } = await supabase
    .from('sensor_readings')
    .select('sensor_type, value, recorded_at')
    .eq('controller_id', controllerId)
    .gte('recorded_at', startDate.toISOString())
    .lte('recorded_at', endDate.toISOString())
    .order('recorded_at', { ascending: true })

  if (error || !readings) {
    console.error('[SensorData API] Direct query error:', error)
    return []
  }

  // Group readings by timestamp
  const groups = new Map<string, {
    temperature: number | null
    humidity: number | null
    vpd: number | null
  }>()

  for (const reading of readings) {
    // Round to nearest minute for grouping
    const timestamp = new Date(reading.recorded_at)
    timestamp.setSeconds(0, 0)
    const key = timestamp.toISOString()

    if (!groups.has(key)) {
      groups.set(key, { temperature: null, humidity: null, vpd: null })
    }

    const group = groups.get(key)!
    const value = Math.round(Number(reading.value) * 100) / 100

    if (reading.sensor_type === 'temperature') group.temperature = value
    else if (reading.sensor_type === 'humidity') group.humidity = value
    else if (reading.sensor_type === 'vpd') group.vpd = Math.round(Number(reading.value) * 1000) / 1000
  }

  // Convert to array and sort
  const result: SensorDataPoint[] = Array.from(groups.entries())
    .map(([timestamp, values]) => ({
      timestamp,
      ...values
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Cap at 1000 points for performance (increased from 400 for better chart resolution)
  // AC Infinity native app shows 500-1000 points per view
  const MAX_POINTS = 1000
  if (result.length > MAX_POINTS) {
    const step = result.length / MAX_POINTS
    const downsampled: SensorDataPoint[] = []
    for (let i = 0; i < MAX_POINTS; i++) {
      downsampled.push(result[Math.floor(i * step)])
    }
    downsampled[downsampled.length - 1] = result[result.length - 1] // Ensure last point
    return downsampled
  }

  return result
}

/**
 * Fetch device state changes for waveform chart
 */
async function fetchDeviceStateData(
  supabase: ReturnType<typeof getSupabase>,
  controllerId: string,
  since: Date
): Promise<DeviceStateData> {
  // First try the device_state_log table
  const { data: stateLog, error: stateError } = await supabase
    .from('device_state_log')
    .select('device_name, state, speed, recorded_at')
    .eq('controller_id', controllerId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true })

  if (!stateError && stateLog && stateLog.length > 0) {
    // Group by device name
    const deviceData: DeviceStateData = {}

    for (const entry of stateLog) {
      const name = entry.device_name || 'Unknown'
      if (!deviceData[name]) {
        deviceData[name] = []
      }
      deviceData[name].push({
        timestamp: entry.recorded_at,
        state: entry.state,
        speed: entry.speed || 0
      })
    }

    return deviceData
  }

  // Fallback: Derive from command_history if device_state_log is empty
  const { data: commandHistory, error: cmdError } = await supabase
    .from('command_history')
    .select('port, state_after, executed_at')
    .eq('controller_id', controllerId)
    .eq('success', true)
    .gte('executed_at', since.toISOString())
    .order('executed_at', { ascending: true })

  if (cmdError || !commandHistory || commandHistory.length === 0) {
    return {}
  }

  // Get port names
  const { data: ports } = await supabase
    .from('controller_ports')
    .select('port_number, port_name')
    .eq('controller_id', controllerId)

  const portNames = new Map<number, string>()
  if (ports) {
    for (const port of ports) {
      portNames.set(port.port_number, port.port_name || `Port ${port.port_number}`)
    }
  }

  // Group by port
  const deviceData: DeviceStateData = {}

  for (const cmd of commandHistory) {
    const name = portNames.get(cmd.port) || `Port ${cmd.port}`
    if (!deviceData[name]) {
      deviceData[name] = []
    }

    const stateAfter = cmd.state_after as { is_on?: boolean; power_level?: number } | null
    if (stateAfter) {
      deviceData[name].push({
        timestamp: cmd.executed_at,
        state: stateAfter.is_on ?? false,
        speed: (stateAfter.power_level ?? 0) * 10
      })
    }
  }

  return deviceData
}
