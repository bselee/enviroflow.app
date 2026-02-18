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
  modeSummary?: string         // Brief summary of mode config (e.g., "H 75°F / L 54°F")
}

interface ModeSettings {
  devModeOne?: number          // Mode ID: 0=off, 1=on, 2=auto, 3=timer, 4=cycle, 5=schedule, 6=vpd
  tempTriggerAbove?: number    // Temperature high trigger (Fahrenheit)
  tempTriggerBelow?: number    // Temperature low trigger (Fahrenheit)
  humTriggerAbove?: number     // Humidity high trigger (%)
  humTriggerBelow?: number     // Humidity low trigger (%)
  vpdTriggerAbove?: number     // VPD high trigger (kPa * 100)
  vpdTriggerBelow?: number     // VPD low trigger (kPa * 100)
  timerDuration?: number       // Timer duration in seconds
  timerType?: number           // Timer type: 0=to off, 1=to on
  cycleOnSec?: number          // Cycle on duration in seconds
  cycleOffSec?: number         // Cycle off duration in seconds
  scheduleStartTime?: string   // Schedule start time (HH:MM)
  scheduleEndTime?: string     // Schedule end time (HH:MM)
  speak?: number               // Speed level 0-10
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
 * Fetch mode settings for all ports on a device.
 * Returns a map of portId -> ModeSettings
 */
async function fetchModeSettingsForDevice(
  token: string,
  devId: string,
  ports: ACInfinityPort[]
): Promise<Map<number, ModeSettings>> {
  const settingsMap = new Map<number, ModeSettings>()

  // Fetch mode settings for each port (with small delay to avoid rate limiting)
  for (const port of ports) {
    const portId = port.port || port.portId
    if (portId <= 0) continue

    try {
      const response = await fetch('http://www.acinfinityserver.com/api/dev/getdevModeSettingList', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'token': token,
          'User-Agent': 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
        },
        body: new URLSearchParams({
          devId: devId,
          port: String(portId)
        }).toString(),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.code === 200 && data.data) {
          settingsMap.set(portId, data.data as ModeSettings)
        }
      }
    } catch (err) {
      console.warn(`[Live Sensors] Failed to fetch mode settings for port ${portId}:`, err)
    }
  }

  return settingsMap
}

/**
 * Generate a human-readable mode summary from mode settings.
 * Format matches AC Infinity app style: "AUTO · H 75°F / L 54°F · H 54% / L 39%"
 */
function generateModeSummary(mode: PortMode, settings: ModeSettings | undefined): string {
  if (!settings) return ''

  switch (mode) {
    case 'auto': {
      const parts: string[] = []
      // Temperature triggers
      const tempHigh = settings.tempTriggerAbove
      const tempLow = settings.tempTriggerBelow
      if (tempHigh !== undefined || tempLow !== undefined) {
        const tempParts: string[] = []
        if (tempHigh !== undefined) tempParts.push(`H ${tempHigh}°F`)
        if (tempLow !== undefined) tempParts.push(`L ${tempLow}°F`)
        parts.push(tempParts.join(' / '))
      }
      // Humidity triggers
      const humHigh = settings.humTriggerAbove
      const humLow = settings.humTriggerBelow
      if (humHigh !== undefined || humLow !== undefined) {
        const humParts: string[] = []
        if (humHigh !== undefined) humParts.push(`H ${humHigh}%`)
        if (humLow !== undefined) humParts.push(`L ${humLow}%`)
        parts.push(humParts.join(' / '))
      }
      return parts.join(' · ')
    }

    case 'vpd': {
      const vpdHigh = settings.vpdTriggerAbove
      const vpdLow = settings.vpdTriggerBelow
      if (vpdHigh !== undefined || vpdLow !== undefined) {
        const vpdParts: string[] = []
        // VPD is stored as kPa * 100
        if (vpdHigh !== undefined) vpdParts.push(`H ${(vpdHigh / 100).toFixed(2)}kPa`)
        if (vpdLow !== undefined) vpdParts.push(`L ${(vpdLow / 100).toFixed(2)}kPa`)
        return vpdParts.join(' / ')
      }
      return ''
    }

    case 'timer': {
      const duration = settings.timerDuration
      if (duration) {
        const hours = Math.floor(duration / 3600)
        const mins = Math.floor((duration % 3600) / 60)
        const typeStr = settings.timerType === 1 ? 'To ON' : 'To OFF'
        return hours > 0 ? `${hours}h ${mins}m · ${typeStr}` : `${mins}m · ${typeStr}`
      }
      return ''
    }

    case 'cycle': {
      const onDur = settings.cycleOnSec || 0
      const offDur = settings.cycleOffSec || 0
      const formatDur = (s: number) => {
        if (s < 60) return `${s}s`
        if (s < 3600) return `${Math.floor(s / 60)}m`
        return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
      }
      if (onDur || offDur) {
        return `ON ${formatDur(onDur)} / OFF ${formatDur(offDur)}`
      }
      return ''
    }

    case 'schedule': {
      const formatTime = (t: string | undefined) => {
        if (!t) return '?'
        const [h, m] = t.split(':').map(Number)
        const period = h >= 12 ? 'pm' : 'am'
        const hour = h % 12 || 12
        return `${hour}:${m.toString().padStart(2, '0')}${period}`
      }
      const start = settings.scheduleStartTime
      const end = settings.scheduleEndTime
      if (start || end) {
        return `${formatTime(start)} - ${formatTime(end)}`
      }
      return ''
    }

    case 'on': {
      const level = settings.speak
      if (level !== undefined) return `Level ${level}`
      return ''
    }

    default:
      return ''
  }
}

/**
 * Extract port information from device.
 * Note: AC Infinity uses 0-10 scale for speed, convert to 0-100 percentage
 */
function extractPorts(device: ACInfinityDevice, modeSettingsMap?: Map<number, ModeSettings>): LivePort[] {
  // Ports are in deviceInfo.ports, not device.portInfo
  const ports = device.deviceInfo?.ports || device.portInfo
  if (!ports || !Array.isArray(ports)) {
    return []
  }

  return ports
    .map((port: ACInfinityPort) => {
      const portId = port.port || port.portId
      const speedLevel = Math.max(0, Number(port.speak ?? 0))
      const isOn = port.loadState === 1 || (port.surplus ?? 0) > 0 || speedLevel > 0
      const mode = mapCurModeToMode(port.curMode, isOn)
      const modeSettings = modeSettingsMap?.get(portId)
      const modeSummary = generateModeSummary(mode, modeSettings)

      return {
        portId,
        name: port.portName || `Port ${portId}`,
        speed: Math.min(100, speedLevel * 10), // Convert 0-10 scale to 0-100 percentage
        isOn,
        deviceType: mapLoadTypeToDeviceType(port.loadType),
        mode,
        modeSummary: modeSummary || undefined,
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

      // Fetch mode settings for ports that have non-trivial modes (auto, vpd, timer, cycle, schedule)
      const ports = device.deviceInfo?.ports || device.portInfo || []
      const portsNeedingModeSettings = ports.filter((p: ACInfinityPort) => {
        const curMode = p.curMode
        // Modes 2-6 are: auto, timer, cycle, schedule, vpd - these have settings to display
        return curMode !== undefined && curMode >= 2 && curMode <= 6
      })

      let modeSettingsMap: Map<number, ModeSettings> | undefined
      if (portsNeedingModeSettings.length > 0) {
        try {
          modeSettingsMap = await fetchModeSettingsForDevice(token, device.devId, portsNeedingModeSettings)
        } catch (err) {
          console.warn('[Live Sensors] Failed to fetch mode settings for device:', device.devId, err)
        }
      }

      sensors.push({
        id: device.devId,
        name: device.devName,
        deviceType: 'ac_infinity',
        temperature: temperature ?? 0,
        humidity: humidity ?? 0,
        vpd: finalVPD,
        online: device.online === 1,
        lastUpdate: now,
        ports: extractPorts(device, modeSettingsMap),
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
