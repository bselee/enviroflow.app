/**
 * Live Sensor Data API Route
 *
 * GET /api/sensors/live - Fetch sensor data directly from AC Infinity API
 *
 * Purpose:
 * Provides real-time sensor data by fetching directly from the AC Infinity cloud API
 * without any database operations. This endpoint is used for live monitoring and testing.
 *
 * Flow:
 * 1. Authenticate request (optional - can work without auth for testing)
 * 2. Fetch from https://myacinfinity.com/api/user/devInfoListAll
 * 3. Parse device data including sensors and ports
 * 4. Calculate VPD from temp/humidity
 * 5. Return structured sensor data
 *
 * NO database reads or writes - pure API passthrough with data transformation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { calculateVPD } from '@/lib/vpd-utils'
import { getACInfinityToken, handleTokenExpiration } from '@/lib/ac-infinity-token-manager'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// Type Definitions
// ============================================

interface LiveSensor {
  id: string
  name: string
  deviceType: 'ac_infinity'
  temperature: number // Fahrenheit
  humidity: number // Percentage
  vpd: number // kPa
  online: boolean
  lastUpdate: string
  ports?: LivePort[]
}

type PortDeviceType = 'fan' | 'light' | 'outlet' | 'humidifier' | 'heater'
type PortMode = 'off' | 'on' | 'auto' | 'vpd' | 'timer' | 'cycle' | 'schedule' | 'advance'

interface LivePort {
  portId: number
  name: string
  speed: number // 0-100 percentage (converted from AC Infinity's 0-10 scale)
  isOn: boolean
  deviceType?: PortDeviceType  // Device type (fan, light, humidifier, etc.)
  mode?: PortMode              // Operating mode (auto, vpd, timer, etc.)
}

interface LiveSensorResponse {
  sensors: LiveSensor[]
  timestamp: string
  source: 'ac_infinity'
  count: number
  responseTimeMs: number
  error?: string
}

interface ACInfinityDevice {
  devId: string
  devName: string
  devType: number
  online: number // 1 = online, 0 = offline
  firmware?: string
  temperature?: number
  temp?: number
  humidity?: number
  vpd?: number
  portInfo?: ACInfinityPort[]
  sensorInfo?: ACInfinitySensor[]
  // AC Infinity nests actual sensor data in deviceInfo object
  deviceInfo?: {
    temperature?: number      // Celsius * 100 (e.g., 2181 = 21.81°C)
    temperatureF?: number     // Fahrenheit * 100
    humidity?: number         // Percentage * 100 (e.g., 5500 = 55.00%)
    vpdnums?: number          // VPD * 100 (e.g., 107 = 1.07 kPa)
    ports?: ACInfinityPort[]
  }
}

interface ACInfinityPort {
  port?: number
  portId: number
  portName?: string
  loadType?: number   // Device type: 0/6=fan, 2=humidifier, 128=light
  speak?: number      // Speed 0-10
  surplus?: number    // On/off state
  online?: number     // Online status
  loadState?: number  // Load state (1=on)
  curMode?: number    // Current mode: 1=on, 2=auto, 3=timer, 4=cycle, 5=schedule, 6=vpd, 7=advance
}

interface ACInfinitySensor {
  sensorType: number
  sensorName?: string
  sensorValue?: number
  value?: number
  unit?: string
}

interface ACInfinityResponse {
  code: number
  msg: string
  data: ACInfinityDevice[]
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert AC Infinity temperature format to Celsius.
 * AC Infinity API returns temperature in hundredths of Celsius (e.g., 2181 = 21.81°C)
 */
function convertTemperature(rawTemp: number | undefined): number | null {
  if (rawTemp === undefined || rawTemp === null) return null
  // Divide by 100 to get actual temperature in Celsius
  return rawTemp / 100
}

/**
 * Convert AC Infinity humidity format to percentage.
 * AC Infinity API returns humidity in hundredths (e.g., 5500 = 55.00%)
 */
function convertHumidity(rawHumidity: number | undefined): number | null {
  if (rawHumidity === undefined || rawHumidity === null) return null
  // Divide by 100 to get actual percentage
  return rawHumidity / 100
}

/**
 * Convert AC Infinity VPD format to kPa.
 * AC Infinity API returns VPD in hundredths of kPa (e.g., 107 = 1.07 kPa)
 */
function convertVPD(rawVPD: number | undefined): number | null {
  if (rawVPD === undefined || rawVPD === null) return null
  // Divide by 100 to get actual kPa
  return rawVPD / 100
}

/**
 * Extract sensor data from AC Infinity device object.
 * Checks both device-level properties and deviceInfo object.
 */
function extractSensorData(device: ACInfinityDevice): {
  temperature: number | null
  humidity: number | null
  vpd: number | null
} {
  let temperature: number | null = null
  let humidity: number | null = null
  let vpd: number | null = null

  // Data is nested in deviceInfo object
  const info = device.deviceInfo

  // Try deviceInfo properties first (this is where AC Infinity puts the data)
  if (info?.temperature !== undefined) {
    temperature = convertTemperature(info.temperature)
  } else if (info?.temperatureF !== undefined) {
    // temperatureF is already in Fahrenheit * 100
    temperature = info.temperatureF / 100
  } else if (device.temperature !== undefined) {
    temperature = convertTemperature(device.temperature)
  } else if (device.temp !== undefined) {
    temperature = convertTemperature(device.temp)
  }

  if (info?.humidity !== undefined) {
    humidity = convertHumidity(info.humidity)
  } else if (device.humidity !== undefined) {
    humidity = convertHumidity(device.humidity)
  }

  if (info?.vpdnums !== undefined) {
    vpd = info.vpdnums / 100  // VPD is stored as vpdnums
  } else if (device.vpd !== undefined) {
    vpd = convertVPD(device.vpd)
  }

  // Fall back to sensorInfo array if available
  if (device.sensorInfo && Array.isArray(device.sensorInfo)) {
    for (const sensor of device.sensorInfo) {
      const value = sensor.sensorValue ?? sensor.value
      if (value === undefined) continue

      // Temperature sensor (type 1)
      if (sensor.sensorType === 1 && temperature === null) {
        temperature = convertTemperature(value)
      }
      // Humidity sensor (type 2)
      else if (sensor.sensorType === 2 && humidity === null) {
        humidity = convertHumidity(value)
      }
      // VPD sensor (type 3)
      else if (sensor.sensorType === 3 && vpd === null) {
        vpd = convertVPD(value)
      }
    }
  }

  return { temperature, humidity, vpd }
}

/**
 * Map AC Infinity loadType to device type string
 * loadType: 0/6=fan, 2=humidifier, 128=light
 */
function mapLoadTypeToDeviceType(loadType: number | undefined): PortDeviceType {
  if (loadType === undefined) return 'outlet'
  if (loadType === 0 || loadType === 6) return 'fan'
  if (loadType === 2) return 'humidifier'
  if (loadType === 128) return 'light'
  if (loadType === 3) return 'heater'
  return 'outlet'
}

/**
 * Map AC Infinity curMode to mode string
 * curMode: 0=off, 1=on, 2=auto, 3=timer, 4=cycle, 5=schedule, 6=vpd, 7=advance
 */
function mapCurModeToMode(curMode: number | undefined, isOn: boolean): PortMode {
  if (curMode === undefined) return isOn ? 'on' : 'off'
  switch (curMode) {
    case 0: return 'off'
    case 1: return 'on'
    case 2: return 'auto'
    case 3: return 'timer'
    case 4: return 'cycle'
    case 5: return 'schedule'
    case 6: return 'vpd'
    case 7: return 'advance'
    default: return isOn ? 'on' : 'off'
  }
}

/**
 * Extract port information from device.
 * Note: AC Infinity uses 0-10 scale for speed, convert to 0-100 percentage
 */
function extractPorts(device: ACInfinityDevice): LivePort[] {
  // Ports are in deviceInfo.ports, not device.portInfo
  const ports = device.deviceInfo?.ports || device.portInfo
  if (!ports || !Array.isArray(ports)) {
    return []
  }

  return ports
    .map((port: ACInfinityPort) => {
      const isOn = port.loadState === 1 || (port.surplus ?? 0) > 0 || port.online === 1
      return {
        portId: port.port || port.portId,
        name: port.portName || `Port ${port.port || port.portId}`,
        speed: (port.speak ?? 0) * 10, // Convert 0-10 scale to 0-100 percentage
        isOn,
        deviceType: mapLoadTypeToDeviceType(port.loadType),
        mode: mapCurModeToMode(port.curMode, isOn),
      }
    })
    .filter((port) => port.portId > 0) // Only include valid ports
}

// ============================================
// GET /api/sensors/live
// ============================================

/**
 * Fetch live sensor data directly from AC Infinity API.
 *
 * Query params:
 * - None required
 *
 * Authentication:
 * - Option 1: AC_INFINITY_TOKEN env var (manual token)
 * - Option 2: AC_INFINITY_EMAIL/PASSWORD env vars (auto-login)
 *
 * Response: LiveSensorResponse
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    // Get AC Infinity token (auto-login if credentials available)
    let token: string
    try {
      token = await getACInfinityToken()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get authentication token'
      console.error('[Live Sensors] Token acquisition failed:', errorMessage)

      return NextResponse.json(
        {
          sensors: [],
          timestamp: new Date().toISOString(),
          source: 'ac_infinity',
          count: 0,
          responseTimeMs: Date.now() - startTime,
          error: errorMessage,
        } satisfies LiveSensorResponse,
        { status: 500 }
      )
    }

    // Fetch from AC Infinity API with 10 second timeout
    // Note: AC Infinity API uses HTTP (no SSL cert on their API server)
    // Base URL verified against official adapter: http://www.acinfinityserver.com
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    let response: Response
    try {
      response = await fetch('http://www.acinfinityserver.com/api/user/devInfoListAll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'token': token,
          'User-Agent':
            'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
        },
        body: new URLSearchParams({ userId: token }).toString(),
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          {
            sensors: [],
            timestamp: new Date().toISOString(),
            source: 'ac_infinity',
            count: 0,
            responseTimeMs: Date.now() - startTime,
            error: 'Request timed out after 10 seconds',
          } satisfies LiveSensorResponse,
          { status: 504 }
        )
      }

      throw fetchError
    }

    clearTimeout(timeoutId)

    // Check response status
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Live Sensors] AC Infinity API error:', response.status, errorText)

      return NextResponse.json(
        {
          sensors: [],
          timestamp: new Date().toISOString(),
          source: 'ac_infinity',
          count: 0,
          responseTimeMs: Date.now() - startTime,
          error: `AC Infinity API returned ${response.status}: ${response.statusText}`,
        } satisfies LiveSensorResponse,
        { status: response.status }
      )
    }

    // Parse response
    const apiResponse = (await response.json()) as ACInfinityResponse

    if (apiResponse.code !== 200) {
      console.error('[Live Sensors] AC Infinity API error code:', apiResponse.code, apiResponse.msg)

      // Handle token expiration (code 1001)
      if (apiResponse.code === 1001) {
        try {
          const newToken = await handleTokenExpiration(apiResponse)
          if (newToken) {
            // Token refreshed, retry the request
            console.log('[Live Sensors] Token refreshed, retrying request...')

            const retryResponse = await fetch('http://www.acinfinityserver.com/api/user/devInfoListAll', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'token': newToken,
                'User-Agent':
                  'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
              },
              body: new URLSearchParams({ userId: newToken }).toString(),
            })

            if (retryResponse.ok) {
              const retryData = (await retryResponse.json()) as ACInfinityResponse
              if (retryData.code === 200) {
                // Process retry response (continue with normal flow)
                console.log('[Live Sensors] Retry successful after token refresh')
                // Update apiResponse for processing below
                Object.assign(apiResponse, retryData)
              }
            }
          }
        } catch (refreshError) {
          console.error('[Live Sensors] Token refresh failed:', refreshError)
          // Continue with original error
        }
      }

      // If still not successful, return error
      if (apiResponse.code !== 200) {
        return NextResponse.json(
          {
            sensors: [],
            timestamp: new Date().toISOString(),
            source: 'ac_infinity',
            count: 0,
            responseTimeMs: Date.now() - startTime,
            error: `AC Infinity API error: ${apiResponse.msg}`,
          } satisfies LiveSensorResponse,
          { status: 400 }
        )
      }
    }

    // Process devices into sensors
    const sensors: LiveSensor[] = []
    const now = new Date().toISOString()

    console.log('[Live Sensors] API response code:', apiResponse.code, 'devices:', apiResponse.data?.length || 0)

    for (const device of apiResponse.data || []) {
      console.log('[Live Sensors] Processing device:', device.devName, 'devId:', device.devId, 'raw temp:', device.deviceInfo?.temperature, 'raw humidity:', device.deviceInfo?.humidity)
      const { temperature, humidity, vpd: rawVPD } = extractSensorData(device)

      // Skip devices without sensor data
      if (temperature === null && humidity === null) {
        continue
      }

      // Calculate VPD if we have temp and humidity but no VPD
      let vpd = rawVPD
      if (vpd === null && temperature !== null && humidity !== null) {
        vpd = calculateVPD(temperature, humidity)
      }

      // Use calculated VPD or fallback to 0
      const finalVPD = vpd ?? 0

      sensors.push({
        id: device.devId,
        name: device.devName,
        deviceType: 'ac_infinity',
        temperature: temperature ?? 0,
        humidity: humidity ?? 0,
        vpd: finalVPD,
        online: device.online === 1,
        lastUpdate: now,
        ports: extractPorts(device),
      })
    }

    const responseTimeMs = Date.now() - startTime

    return NextResponse.json(
      {
        sensors,
        timestamp: now,
        source: 'ac_infinity',
        count: sensors.length,
        responseTimeMs,
      } satisfies LiveSensorResponse,
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Response-Time': `${responseTimeMs}ms`,
        },
      }
    )
  } catch (error) {
    console.error('[Live Sensors] Unexpected error:', error)

    const responseTimeMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    return NextResponse.json(
      {
        sensors: [],
        timestamp: new Date().toISOString(),
        source: 'ac_infinity',
        count: 0,
        responseTimeMs,
        error: errorMessage,
      } satisfies LiveSensorResponse,
      { status: 500 }
    )
  }
}
