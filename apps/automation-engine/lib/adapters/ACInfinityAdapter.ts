/**
 * AC Infinity Controller Adapter
 *
 * Supports:
 * - Controller 69 (flagship model)
 * - Controller 67 (budget model)
 * - UIS series inline fans
 * - UIS series LED lights with dimming
 *
 * API: Reverse-engineered REST API based on I8Beef.ACInfinity and homeassistant-acinfinity
 * Base URL: http://www.acinfinityserver.com (HTTP, not HTTPS - no SSL cert on their API)
 *
 * Authentication Flow:
 * 1. POST /api/user/appUserLogin with AppEmail and AppPasswordL
 * 2. Receive AppId (token) in response
 * 3. Use token in 'token' header for subsequent requests
 *
 * Features:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Detailed error logging
 */

import type {
  ControllerAdapter,
  ControllerCredentials,
  ACInfinityCredentials,
  ConnectionResult,
  ControllerMetadata,
  SensorReading,
  DeviceCommand,
  CommandResult,
  ControllerStatus,
  SensorType,
  DeviceType,
  SensorCapability,
  DeviceCapability,
  DiscoverableAdapter,
  DiscoveryCredentials,
  DiscoveryResult,
  DiscoveredDevice,
  FullControllerData,
  PortState,
  ParsedModeConfiguration,
  RawApiCapture
} from './types'
import {
  adapterFetch,
  getCircuitBreaker,
  resetCircuitBreaker,
} from './retry'
import { createHash } from 'crypto'

// AC Infinity API configuration
// IMPORTANT: AC Infinity API uses HTTP (no SSL certificate!)
// This has been verified against I8Beef.ACInfinity and homeassistant-acinfinity implementations
const API_BASE = 'http://www.acinfinityserver.com'
const ADAPTER_NAME = 'ac_infinity'

// User-Agent string from official AC Infinity iOS app (required for API access)
const USER_AGENT = 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4'

// Default request timeout
const REQUEST_TIMEOUT = 100000 // 100 seconds, matching official client

// Token storage (in production, consider Redis or similar for multi-instance)
const tokenStore = new Map<string, {
  token: string
  userId: string
  expiresAt: Date
}>()

// ============================================
// Rate Limiting
// ============================================

/**
 * Token bucket rate limiter for AC Infinity API requests.
 *
 * AC Infinity API rate limits (empirically determined):
 * - ~60 requests per minute per account
 * - Bursts allowed up to ~100 requests
 *
 * Configuration:
 * - 60 requests per minute (1 per second sustained)
 * - Burst capacity of 10 tokens
 * - Refill rate of 1 token per second
 */
interface RateLimitBucket {
  tokens: number
  lastRefill: number
  maxTokens: number
  refillRate: number // tokens per second
}

const rateLimitBuckets = new Map<string, RateLimitBucket>()

// Rate limit configuration
const RATE_LIMIT_MAX_TOKENS = 10 // Burst capacity
const RATE_LIMIT_REFILL_RATE = 1 // 1 token per second (60/min)

/**
 * Get or create a rate limit bucket for a given key (e.g., user email).
 */
function getRateLimitBucket(key: string): RateLimitBucket {
  let bucket = rateLimitBuckets.get(key)

  if (!bucket) {
    bucket = {
      tokens: RATE_LIMIT_MAX_TOKENS,
      lastRefill: Date.now(),
      maxTokens: RATE_LIMIT_MAX_TOKENS,
      refillRate: RATE_LIMIT_REFILL_RATE,
    }
    rateLimitBuckets.set(key, bucket)
  }

  return bucket
}

/**
 * Refill tokens based on elapsed time since last refill.
 */
function refillBucket(bucket: RateLimitBucket): void {
  const now = Date.now()
  const elapsedSeconds = (now - bucket.lastRefill) / 1000
  const tokensToAdd = elapsedSeconds * bucket.refillRate

  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd)
  bucket.lastRefill = now
}

/**
 * Attempt to consume a token from the bucket.
 * Returns true if token was consumed, false if rate limit exceeded.
 */
function consumeToken(key: string): { allowed: boolean; retryAfterMs?: number } {
  const bucket = getRateLimitBucket(key)
  refillBucket(bucket)

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return { allowed: true }
  }

  // Calculate how long until next token is available
  const tokensNeeded = 1 - bucket.tokens
  const retryAfterMs = Math.ceil((tokensNeeded / bucket.refillRate) * 1000)

  return { allowed: false, retryAfterMs }
}

/**
 * Wait for rate limit token to become available.
 * Throws error if wait time exceeds maximum.
 */
async function waitForRateLimit(key: string, maxWaitMs: number = 5000): Promise<void> {
  const result = consumeToken(key)

  if (result.allowed) {
    return
  }

  if (!result.retryAfterMs || result.retryAfterMs > maxWaitMs) {
    throw new Error(
      `Rate limit exceeded for AC Infinity API. ` +
      `Please wait ${Math.ceil((result.retryAfterMs || maxWaitMs) / 1000)} seconds before retrying.`
    )
  }

  log('info', `Rate limit: waiting ${result.retryAfterMs}ms before request`, { key })
  await new Promise(resolve => setTimeout(resolve, result.retryAfterMs))

  // Try again after waiting
  return waitForRateLimit(key, maxWaitMs - result.retryAfterMs)
}

// ============================================
// AC Infinity API Response Types
// ============================================

interface ACLoginResponse {
  code: number
  msg: string
  data?: {
    // The AppId is returned as the authentication token
    appId: string
    // Alternative field name sometimes used
    token?: string
    userId?: string
    email?: string
  }
}

interface ACDeviceListResponse {
  code: number
  msg: string
  data?: ACDevice[]
}

interface ACDevice {
  devId: string
  devCode: string
  devName: string
  devType: number
  firmwareVersion?: string
  online: boolean
  lastOnlineTime?: number
  macAddr?: string
}

interface ACDeviceSettingResponse {
  code: number
  msg: string
  data?: {
    devId: string
    devName: string
    devType: number
    portData: ACPort[]
    sensorData?: ACSensor[]
    devModeSettingList?: ACModeSetting[]
  }
}

interface ACPort {
  portId: number
  portName: string
  portType: number       // 1=fan, 2=light, 3=outlet, etc.
  devType: number        // Device type on this port
  isSupport: boolean
  supportDim: number     // 1=supports dimming
  onOff: number          // 0=off, 1=on
  speak: number          // Fan speed 0-10
  surplus: number        // Current level
  loadType?: number
  externalPort?: number
}

interface ACSensor {
  sensorType: number     // 1=temp, 2=humidity, 3=vpd, 4=co2, 5=light
  sensorName: string
  sensorValue: number    // Note: API uses sensorValue not value
  value?: number         // Some responses use this
  unit: string
}

interface ACModeSetting {
  modeId: number
  modeName: string
  isActive: boolean
}

interface ACUpdatePortResponse {
  code: number
  msg: string
  data?: unknown
}

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[ACInfinityAdapter][${timestamp}]`

  if (level === 'error') {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

// ============================================
// AC Infinity Adapter Implementation
// ============================================

export class ACInfinityAdapter implements ControllerAdapter, DiscoverableAdapter {

  /**
   * Discover all AC Infinity devices associated with the given credentials.
   * This queries the AC Infinity cloud API to list all registered devices
   * without connecting to any specific one.
   */
  async discoverDevices(credentials: DiscoveryCredentials): Promise<DiscoveryResult> {
    const { email, password } = credentials

    log('info', 'Starting device discovery', { email: email.replace(/(.{2}).*(@.*)/, '$1***$2') })

    try {
      // Step 1: Login to get token
      const loginResult = await this.login(email, password)

      if (!loginResult.success || !loginResult.token) {
        log('error', 'Discovery login failed', { error: loginResult.error })
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: loginResult.error || 'Login failed',
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      // Step 2: Get all devices for this account
      const devicesResult = await adapterFetch<ACDeviceListResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/user/devInfoListAll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': loginResult.token,
          },
          body: new URLSearchParams({ userId: loginResult.token }).toString()
        }
      )

      if (!devicesResult.success || !devicesResult.data) {
        log('error', 'Failed to list devices', { error: devicesResult.error })
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: devicesResult.error || 'Failed to retrieve device list',
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      const devicesData = devicesResult.data

      if (devicesData.code !== 200) {
        log('error', 'API returned error code', { code: devicesData.code, msg: devicesData.msg })
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: devicesData.msg || `API error: ${devicesData.code}`,
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      if (!devicesData.data || devicesData.data.length === 0) {
        log('info', 'No devices found for account')
        return {
          success: true,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      log('info', `Found ${devicesData.data.length} devices`)

      // Step 3: Map AC Infinity devices to DiscoveredDevice format
      const discoveredDevices: DiscoveredDevice[] = await Promise.all(
        devicesData.data.map(async (device) => {
          // Try to get capabilities for each device
          let capabilities: DiscoveredDevice['capabilities'] = undefined
          try {
            const capabilitiesData = await this.getDeviceCapabilities(device.devId, loginResult.token!)
            capabilities = {
              sensors: capabilitiesData.sensors.map(s => s.type),
              devices: capabilitiesData.devices.map(d => d.type),
              supportsDimming: capabilitiesData.supportsDimming
            }
          } catch (err) {
            log('warn', `Failed to get capabilities for device ${device.devId}`, { error: err })
          }

          return {
            deviceId: device.devId,
            deviceCode: device.devCode,
            name: device.devName || `AC Infinity Device`,
            brand: 'ac_infinity' as const,
            model: this.mapDeviceTypeToModel(device.devType),
            deviceType: device.devType,
            isOnline: device.online,
            lastSeen: device.lastOnlineTime ? new Date(device.lastOnlineTime * 1000) : undefined,
            firmwareVersion: device.firmwareVersion,
            macAddress: device.macAddr,
            isAlreadyRegistered: false,
            capabilities
          }
        })
      )

      return {
        success: true,
        devices: discoveredDevices,
        totalDevices: discoveredDevices.length,
        alreadyRegisteredCount: 0,
        timestamp: new Date(),
        source: 'cloud_api'
      }

    } catch (error) {
      log('error', 'Discovery failed with exception', { error })
      return {
        success: false,
        devices: [],
        totalDevices: 0,
        alreadyRegisteredCount: 0,
        error: error instanceof Error ? error.message : 'Discovery failed due to unexpected error',
        timestamp: new Date(),
        source: 'cloud_api'
      }
    }
  }

  /**
   * Map AC Infinity device type number to human-readable model name
   */
  private mapDeviceTypeToModel(devType: number): string {
    const typeMap: Record<number, string> = {
      1: 'Controller 67',
      2: 'Controller 67',
      3: 'Controller 69',
      4: 'Controller 69',
      5: 'Controller 69 Pro',
      6: 'Controller 69 Pro',
      7: 'Controller 69 Pro+',
      11: 'UIS Inline Fan',
      12: 'UIS Inline Fan',
      13: 'UIS LED Bar',
      14: 'UIS Oscillating Fan',
      15: 'UIS Clip Fan',
      18: 'USB-C Zone Controller',
    }
    return typeMap[devType] || `AC Infinity Device (Type ${devType})`
  }

  /**
   * Login to AC Infinity cloud
   *
   * Uses the appUserLogin endpoint with form-urlencoded body.
   * The API returns an AppId which is used as the token for subsequent requests.
   */
  private async login(email: string, password: string): Promise<{
    success: boolean
    token?: string
    userId?: string
    error?: string
  }> {
    log('info', 'Attempting login', { email: email.replace(/(.{2}).*(@.*)/, '$1***$2') })

    // Apply rate limiting per email address
    try {
      await waitForRateLimit(`ac_infinity:${email}`)
    } catch (err) {
      log('error', 'Rate limit exceeded on login', { email: email.replace(/(.{2}).*(@.*)/, '$1***$2') })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Rate limit exceeded'
      }
    }

    // Build form-urlencoded body with correct field names
    // Note: AppPasswordL has an 'L' suffix (not a typo!)
    const formData = new URLSearchParams()
    formData.append('appEmail', email)
    formData.append('appPasswordl', password)

    const result = await adapterFetch<ACLoginResponse>(
      ADAPTER_NAME,
      `${API_BASE}/api/user/appUserLogin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: formData.toString()
      }
    )

    if (!result.success || !result.data) {
      log('error', 'Login request failed', { error: result.error })
      return {
        success: false,
        error: result.error || 'Login request failed'
      }
    }

    const loginData = result.data

    // AC Infinity API uses code 200 for success
    if (loginData.code !== 200) {
      log('error', 'Login returned error', { code: loginData.code, msg: loginData.msg })

      // Provide user-friendly error messages
      let errorMessage = loginData.msg || 'Login failed'
      if (loginData.code === 1002 || loginData.msg?.toLowerCase().includes('password')) {
        errorMessage = 'Invalid email or password. Please check your AC Infinity account credentials.'
      } else if (loginData.code === 1001 || loginData.msg?.toLowerCase().includes('email')) {
        errorMessage = 'Email not found. Please check your AC Infinity account email.'
      } else if (loginData.msg?.toLowerCase().includes('network')) {
        errorMessage = 'Network error connecting to AC Infinity servers. Please try again.'
      }

      return {
        success: false,
        error: errorMessage
      }
    }

    // Get token from appId or token field
    const token = loginData.data?.appId || loginData.data?.token
    if (!token) {
      log('error', 'Login succeeded but no token/appId in response', { data: loginData.data })
      return {
        success: false,
        error: 'Login succeeded but server did not return authentication token'
      }
    }

    log('info', 'Login successful')
    return {
      success: true,
      token,
      userId: loginData.data?.userId
    }
  }

  /**
   * Connect to AC Infinity cloud and get device info
   */
  async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
    if (!this.isACInfinityCredentials(credentials)) {
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: 'Invalid credentials type. Expected AC Infinity credentials.'
      }
    }

    const { email, password, deviceId: requestedDeviceId } = credentials

    try {
      // Step 1: Login to get token
      const loginResult = await this.login(email, password)

      if (!loginResult.success || !loginResult.token) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: loginResult.error || 'Login failed'
        }
      }

      // Step 2: Get device list
      const devicesResult = await adapterFetch<ACDeviceListResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/user/devInfoListAll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': loginResult.token,
          },
          body: new URLSearchParams({ userId: loginResult.token }).toString()
        }
      )

      if (!devicesResult.success || !devicesResult.data) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: devicesResult.error || 'Failed to retrieve devices'
        }
      }

      const devicesData = devicesResult.data

      if (devicesData.code !== 200 || !devicesData.data || devicesData.data.length === 0) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: devicesData.msg || 'No AC Infinity devices found for this account. Make sure you have registered devices in the AC Infinity app.'
        }
      }

      // Select device: use requested deviceId if provided, otherwise use first device
      let device: ACDevice
      if (requestedDeviceId) {
        const matchingDevice = devicesData.data.find(d => d.devId === requestedDeviceId)
        if (!matchingDevice) {
          log('error', `Requested device ${requestedDeviceId} not found in account`, {
            availableDevices: devicesData.data.map(d => ({ id: d.devId, name: d.devName }))
          })
          return {
            success: false,
            controllerId: '',
            metadata: this.emptyMetadata(),
            error: `Device ${requestedDeviceId} not found in your AC Infinity account. Use discovery to see available devices.`
          }
        }
        device = matchingDevice
        log('info', `Using requested device: ${device.devName} (${device.devId})`)
      } else {
        // Default to first device
        device = devicesData.data[0]
        if (devicesData.data.length > 1) {
          log('info', `Multiple devices found, using first device. Available: ${devicesData.data.map(d => d.devName).join(', ')}`)
        }
      }
      const controllerId = device.devId

      // Store token with 24-hour expiry
      tokenStore.set(controllerId, {
        token: loginResult.token,
        userId: loginResult.userId || '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      log('info', `Connected to device: ${device.devName} (${controllerId})`)

      // Step 3: Get device capabilities
      const capabilities = await this.getDeviceCapabilities(controllerId, loginResult.token)

      return {
        success: true,
        controllerId,
        metadata: {
          brand: 'ac_infinity',
          model: device.devName || this.mapDeviceTypeToModel(device.devType),
          firmwareVersion: device.firmwareVersion,
          capabilities
        }
      }

    } catch (error) {
      log('error', 'Connection failed with exception', { error })
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  /**
   * Read all sensor values from controller
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      throw new Error('Controller not connected. Call connect() first.')
    }

    // Check if token is expired
    if (stored.expiresAt < new Date()) {
      tokenStore.delete(controllerId)
      throw new Error('Authentication token expired. Please reconnect.')
    }

    // Apply rate limiting per controller
    try {
      await waitForRateLimit(`ac_infinity:controller:${controllerId}`)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Rate limit exceeded')
    }

    // Use getdevModeSettingList endpoint for sensor and device data
    const result = await adapterFetch<ACDeviceSettingResponse>(
      ADAPTER_NAME,
      `${API_BASE}/api/dev/getdevModeSettingList`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
          'token': stored.token,
        },
        body: new URLSearchParams({ devId: controllerId, port: '0' }).toString()
      }
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read sensor data')
    }

    const data = result.data

    // Check for server-side token expiry (code 1001)
    // This happens when the token is invalidated server-side before our local expiry
    if (data.code === 1001) {
      log('warn', `Token expired server-side for ${controllerId}`, { code: data.code, msg: data.msg })
      tokenStore.delete(controllerId)
      throw new Error('Authentication token expired (server). Please reconnect.')
    }

    if (data.code !== 200 || !data.data) {
      throw new Error(data.msg || 'Failed to get device settings')
    }

    const readings: SensorReading[] = []
    const now = new Date()

    // Log full API response structure for debugging
    log('info', `API response data structure for ${controllerId}`, {
      hasSensorData: !!data.data.sensorData,
      sensorDataLength: data.data.sensorData?.length || 0,
      hasPortData: !!data.data.portData,
      portDataLength: data.data.portData?.length || 0,
      // Log first port structure to understand format
      samplePort: data.data.portData?.[0] ? JSON.stringify(data.data.portData[0]) : 'none',
      // Log full response keys to identify sensor data locations
      responseKeys: Object.keys(data.data)
    })

    // Process explicit sensor probes from sensorData array
    if (data.data.sensorData && data.data.sensorData.length > 0) {
      for (const sensor of data.data.sensorData) {
        // Handle both "sensorValue" and "value" field names
        const rawValue = sensor.sensorValue ?? sensor.value ?? 0

        // Only add readings with valid values (null/undefined check, NOT zero check)
        // Zero is a valid sensor reading (0°F, 0% humidity)
        if (rawValue != null) {
          readings.push({
            port: 0,
            type: this.mapSensorType(sensor.sensorType),
            value: this.convertSensorValue(rawValue, sensor.sensorType),
            unit: this.mapSensorUnit(sensor.sensorType),
            timestamp: now,
            isStale: false
          })
        }
      }
      log('info', `Found ${readings.length} sensors from sensorData array`)
    }

    // Check for built-in controller sensors at device level
    // Some AC Infinity controllers report temp/humidity/VPD at the device level, not port level
    const deviceData = data.data as Record<string, unknown>

    if (typeof deviceData.temperature === 'number' || typeof deviceData.temp === 'number') {
      const rawTempValue = (deviceData.temperature as number) ?? (deviceData.temp as number)
      // Zero is a valid temperature reading - only filter null/undefined
      if (rawTempValue != null) {
        // AC Infinity returns temperature as Celsius × 100 (e.g., 2350 = 23.5°C)
        // Convert to Fahrenheit: (C × 9/5) + 32
        const celsiusValue = rawTempValue / 100
        const fahrenheitValue = (celsiusValue * 9/5) + 32
        readings.push({
          port: 0,
          type: 'temperature',
          value: Math.round(fahrenheitValue * 10) / 10, // Round to 1 decimal
          unit: 'F',
          timestamp: now,
          isStale: false
        })
        log('info', 'Found device-level temperature sensor', {
          rawValue: rawTempValue,
          celsius: celsiusValue,
          fahrenheit: fahrenheitValue
        })
      }
    }

    if (typeof deviceData.humidity === 'number') {
      const rawHumidityValue = deviceData.humidity as number
      // Zero is a valid humidity reading - only filter null/undefined
      if (rawHumidityValue != null) {
        // AC Infinity returns humidity as percentage × 100 (e.g., 6500 = 65%)
        const humidityValue = rawHumidityValue / 100
        readings.push({
          port: 0,
          type: 'humidity',
          value: Math.round(humidityValue * 10) / 10, // Round to 1 decimal
          unit: '%',
          timestamp: now,
          isStale: false
        })
        log('info', 'Found device-level humidity sensor', {
          rawValue: rawHumidityValue,
          percentage: humidityValue
        })
      }
    }

    if (typeof deviceData.vpd === 'number') {
      const rawVpdValue = deviceData.vpd as number
      // Zero is a valid VPD reading - only filter null/undefined
      if (rawVpdValue != null) {
        // VPD is reported as kPa × 100 (e.g., 120 = 1.2 kPa)
        const vpdValue = rawVpdValue / 100
        readings.push({
          port: 0,
          type: 'vpd',
          value: Math.round(vpdValue * 100) / 100, // Round to 2 decimals
          unit: 'kPa',
          timestamp: now,
          isStale: false
        })
        log('info', 'Found device-level VPD sensor', {
          rawValue: rawVpdValue,
          kPa: vpdValue
        })
      }
    }

    // Process port-based sensors (more liberal extraction)
    // Check ports for sensor readings - some controllers report via port data
    for (const port of data.data.portData || []) {
      // Log port structure for debugging
      log('info', `Analyzing port ${port.portId}`, {
        portType: port.portType,
        devType: port.devType,
        surplus: port.surplus,
        speak: port.speak,
        onOff: port.onOff
      })

      // Extract sensor-like values from ports
      // devType 10 = sensor probe
      // portType 10 = sensor port
      // portType 7/8 = often temperature sensors
      // Check surplus field which often contains current sensor value
      // Note: Zero is a valid reading, only filter null/undefined
      if (port.surplus != null) {
        // Determine if this is a sensor port based on type indicators
        if (port.devType === 10 || port.portType === 10 || port.portType === 7 || port.portType === 8) {
          // This is a sensor port - extract the reading
          // AC Infinity port sensors use same scaling as device sensors:
          // - Temperature: Celsius × 100 (e.g., 2350 = 23.5°C)
          // - Humidity: Percentage × 100 (e.g., 6500 = 65%)
          const sensorType = port.portType === 8 ? 'humidity' : 'temperature'

          let transformedValue: number
          if (sensorType === 'temperature') {
            // Convert: raw / 100 → Celsius, then Celsius → Fahrenheit
            const celsiusValue = port.surplus / 100
            transformedValue = Math.round(((celsiusValue * 9/5) + 32) * 10) / 10
          } else {
            // Humidity: raw / 100 → percentage
            transformedValue = Math.round((port.surplus / 100) * 10) / 10
          }

          readings.push({
            port: port.portId,
            type: sensorType,
            value: transformedValue,
            unit: sensorType === 'humidity' ? '%' : 'F',
            timestamp: now,
            isStale: false
          })
          log('info', `Found port-based sensor on port ${port.portId}`, {
            type: sensorType,
            rawValue: port.surplus,
            transformedValue
          })
        }
      }
    }

    // Summary log: Shows which data sources had sensor data for debugging
    const sensorPortCount = (data.data.portData || []).filter(
      (p: ACPort) => p.devType === 10 || p.portType === 10 || p.portType === 7 || p.portType === 8
    ).length

    log('info', `Sensor data sources for ${controllerId}`, {
      hasSensorDataArray: (data.data.sensorData?.length || 0) > 0,
      sensorDataCount: data.data.sensorData?.length || 0,
      hasDeviceLevelTemp: typeof deviceData.temperature === 'number' || typeof deviceData.temp === 'number',
      hasDeviceLevelHumidity: typeof deviceData.humidity === 'number',
      hasDeviceLevelVpd: typeof deviceData.vpd === 'number',
      sensorPortCount,
      totalReadings: readings.length,
      readingTypes: readings.map(r => `${r.type}:${r.value}`).join(', '),
    })

    log('info', `Read ${readings.length} sensor values from ${controllerId}`, {
      sensorCount: readings.length,
      types: readings.map(r => r.type)
    })
    return readings
  }

  /**
   * Precision polling: Read sensors, ports, and modes in one request.
   * This provides a complete state of the controller including attached devices (ports),
   * their names, current modes, and all sensor readings.
   */
  async readSensorsAndPorts(controllerId: string): Promise<FullControllerData> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      throw new Error('Controller not connected. Call connect() first.')
    }

    if (stored.expiresAt < new Date()) {
      tokenStore.delete(controllerId)
      throw new Error('Authentication token expired. Please reconnect.')
    }

    // Rate limit
    try {
      await waitForRateLimit(`ac_infinity:controller:${controllerId}`)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Rate limit exceeded')
    }

    const now = new Date()

    // 1. Fetch data using the rich endpoint
    const result = await adapterFetch<ACDeviceSettingResponse>(
      ADAPTER_NAME,
      `${API_BASE}/api/dev/getdevModeSettingList`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
          'token': stored.token,
        },
        body: new URLSearchParams({ devId: controllerId, port: '0' }).toString()
      }
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read device data')
    }

    const data = result.data
    if (data.code !== 200 || !data.data) {
      throw new Error(data.msg || 'Failed to get device settings')
    }

    const rawData = data.data
    
    // 2. Reuse readSensors logic for basic sensors (inline for safety)
    const readings: SensorReading[] = []
    
    // 2a. SensorData
    if (rawData.sensorData && rawData.sensorData.length > 0) {
      for (const sensor of rawData.sensorData) {
        const rawValue = sensor.sensorValue ?? sensor.value ?? 0
        if (rawValue != null) {
          readings.push({
            port: 0,
            type: this.mapSensorType(sensor.sensorType),
            value: this.convertSensorValue(rawValue, sensor.sensorType),
            unit: this.mapSensorUnit(sensor.sensorType),
            timestamp: now,
            isStale: false
          })
        }
      }
    }

    // 2b. Device level sensors
    const deviceData = rawData as any
    if (typeof deviceData.temperature === 'number' || typeof deviceData.temp === 'number') {
       const val = (deviceData.temperature as number) ?? (deviceData.temp as number)
       if (val != null) {
         readings.push({
           port: 0,
           type: 'temperature',
           value: Math.round(((val/100) * 9/5 + 32) * 10) / 10,
           unit: 'F',
           timestamp: now,
           isStale: false
         })
       }
    }
    if (typeof deviceData.humidity === 'number') {
       const val = deviceData.humidity as number
       if (val != null) {
         readings.push({
           port: 0,
           type: 'humidity',
           value: Math.round((val/100) * 10) / 10,
           unit: '%',
           timestamp: now,
           isStale: false
         })
       }
    }
    if (typeof deviceData.vpd === 'number') {
      const val = deviceData.vpd as number
      if (val != null) {
         readings.push({
           port: 0,
           type: 'vpd',
           value: Math.round((val/100) * 100) / 100,
           unit: 'kPa',
           timestamp: now,
           isStale: false
         })
      }
    }

    // 3. Process Ports
    const ports: PortState[] = []
    if (rawData.portData) {
      for (const port of rawData.portData) {
        ports.push({
          port: port.portId,
          portName: port.portName,
          portType: port.portType,
          devType: port.devType, // Keep as number for filtering
          deviceType: this.mapDeviceType(port.portType), // Map to string type

          isConnected: port.onOff !== undefined,
          isOn: port.onOff === 1,
          isOnline: true,

          powerLevel: port.speak || 0,
          loadType: port.loadType || 0,

          surplus: port.surplus,
          speak: port.speak,
          externalPort: port.externalPort,
          
          updatedAt: now
        })

        // 3b. Port Sensors
        if (port.surplus != null && (port.devType === 10 || port.portType === 10 || port.portType === 7 || port.portType === 8)) {
           const sensorType = port.portType === 8 ? 'humidity' : 'temperature'
           let val: number
           if (sensorType === 'temperature') {
             val = Math.round(((port.surplus / 100) * 9/5 + 32) * 10) / 10
           } else {
             val = Math.round((port.surplus / 100) * 10) / 10
           }
           readings.push({
             port: port.portId,
             type: sensorType,
             value: val,
             unit: sensorType === 'humidity' ? '%' : 'F',
             timestamp: now,
             isStale: false
           })
        }
      }
    }

    // 4. Capture Raw API Data
    const rawCapture: RawApiCapture = {
        endpoint: 'getdevModeSettingList',
        responseHash: createHash('md5').update(JSON.stringify(rawData)).digest('hex'),
        rawSensorData: rawData.sensorData || {},
        rawPortData: rawData.portData || {},
        rawModeData: rawData.devModeSettingList || {},
        latencyMs: 0, 
        capturedAt: now
    }

    return { sensors: readings, ports, modes: [], rawCapture }
  }

  /**
   * Send control command to device
   */
  async controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      return {
        success: false,
        error: 'Controller not connected',
        timestamp: new Date()
      }
    }

    // Apply rate limiting per controller
    try {
      await waitForRateLimit(`ac_infinity:controller:${controllerId}`)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Rate limit exceeded',
        timestamp: new Date()
      }
    }

    try {
      // Calculate power value (AC Infinity uses 0-10 scale)
      let power: number

      switch (command.type) {
        case 'turn_on':
          power = 10
          break
        case 'turn_off':
          power = 0
          break
        case 'set_level':
          // Convert 0-100 to 0-10
          power = Math.round((command.value || 0) / 10)
          power = Math.max(0, Math.min(10, power))
          break
        case 'toggle':
          power = 10
          break
        default:
          power = 0
      }

      log('info', `Sending command to ${controllerId}:${port}`, { command: command.type, power })

      // Use addDevMode endpoint to set device port settings
      const result = await adapterFetch<ACUpdatePortResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/dev/addDevMode`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': stored.token,
          },
          body: new URLSearchParams({
            devId: controllerId,
            port: String(port),
            speak: String(power),
            onOff: power > 0 ? '1' : '0'
          }).toString()
        }
      )

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Command failed',
          timestamp: new Date()
        }
      }

      const responseData = result.data

      return {
        success: responseData.code === 200,
        error: responseData.code !== 200 ? responseData.msg : undefined,
        actualValue: power * 10,
        timestamp: new Date()
      }

    } catch (error) {
      log('error', 'Control command failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Get current controller status
   */
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const stored = tokenStore.get(controllerId)

    if (!stored) {
      return {
        status: 'offline',
        lastSeen: new Date()
      }
    }

    try {
      const result = await adapterFetch<ACDeviceSettingResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/dev/getdevModeSettingList`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': stored.token,
          },
          body: new URLSearchParams({ devId: controllerId, port: '0' }).toString()
        },
        { maxRetries: 1, timeoutMs: 5000 }
      )

      return {
        status: result.success && result.data?.code === 200 ? 'online' : 'offline',
        lastSeen: new Date()
      }

    } catch {
      return {
        status: 'error',
        lastSeen: new Date()
      }
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(controllerId: string): Promise<void> {
    tokenStore.delete(controllerId)
    log('info', `Disconnected from ${controllerId}`)
  }

  /**
   * Reset circuit breaker for this adapter
   */
  resetCircuitBreaker(): void {
    resetCircuitBreaker(`adapter:${ADAPTER_NAME}`)
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState() {
    return getCircuitBreaker(`adapter:${ADAPTER_NAME}`)
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private isACInfinityCredentials(creds: ControllerCredentials): creds is ACInfinityCredentials {
    return 'type' in creds && creds.type === 'ac_infinity'
  }

  private async getDeviceCapabilities(controllerId: string, token: string) {
    log('info', `Fetching capabilities for device ${controllerId}`)
    try {
      const result = await adapterFetch<ACDeviceSettingResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/dev/getdevModeSettingList`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': token,
          },
          body: new URLSearchParams({ devId: controllerId, port: '0' }).toString()
        }
      )

      if (!result.success) {
        log('error', `Capabilities fetch failed for ${controllerId}`, {
          error: result.error
        })
        return this.emptyCapabilities()
      }

      if (!result.data) {
        log('error', `Capabilities response empty for ${controllerId}`)
        return this.emptyCapabilities()
      }

      if (result.data.code !== 200) {
        log('error', `Capabilities API error for ${controllerId}`, {
          code: result.data.code,
          msg: result.data.msg
        })
        return this.emptyCapabilities()
      }

      const data = result.data.data!
      const sensors: SensorCapability[] = []
      const devices: DeviceCapability[] = []
      let supportsDimming = false

      if (data.sensorData) {
        for (const sensor of data.sensorData) {
          sensors.push({
            port: 0,
            name: sensor.sensorName,
            type: this.mapSensorType(sensor.sensorType),
            unit: this.mapSensorUnit(sensor.sensorType)
          })
        }
      }

      if (data.portData) {
        log('info', `Raw portData for ${controllerId}:`, data.portData)
        for (const port of data.portData) {
          log('info', `Processing port ${port.portId}: devType=${port.devType}, portType=${port.portType}, name=${port.portName}`)
          // devType 10 = sensor probe (not a controllable device)
          // Only filter on devType, NOT portType - portType indicates the type of output (fan, light, etc)
          // The original working code only checked devType !== 10
          if (port.devType !== 10) {
            const hasDimming = port.supportDim === 1
            if (hasDimming) supportsDimming = true

            devices.push({
              port: port.portId,
              name: port.portName,
              type: this.mapDeviceType(port.portType),
              supportsDimming: hasDimming,
              minLevel: 0,
              maxLevel: 10,
              currentLevel: port.surplus,
              isOn: port.onOff === 1
            })
            log('info', `Added device: port=${port.portId}, name=${port.portName}, type=${this.mapDeviceType(port.portType)}, isOn=${port.onOff === 1}`)
          } else {
            log('info', `Skipping sensor port ${port.portId} (devType=${port.devType}, portType=${port.portType})`)
          }
        }
      } else {
        log('warn', `No portData in API response for ${controllerId}`)
      }

      log('info', `Capabilities loaded for ${controllerId}`, {
        sensorCount: sensors.length,
        deviceCount: devices.length,
        supportsDimming,
        maxPorts: data.portData?.length || 4
      })

      return {
        sensors,
        devices,
        supportsDimming,
        supportsScheduling: true,
        maxPorts: data.portData?.length || 4
      }

    } catch (err) {
      log('error', `Exception getting device capabilities for ${controllerId}`, {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      })
      return this.emptyCapabilities()
    }
  }

  private mapSensorType(acType: number): SensorType {
    const map: Record<number, SensorType> = {
      1: 'temperature',
      2: 'humidity',
      3: 'vpd',
      4: 'co2',
      5: 'light'
    }
    return map[acType] || 'temperature'
  }

  private mapSensorUnit(acType: number): string {
    const map: Record<number, string> = {
      1: 'F',
      2: '%',
      3: 'kPa',
      4: 'ppm',
      5: 'lux'
    }
    return map[acType] || ''
  }

  private mapDeviceType(acType: number): DeviceType {
    // AC Infinity device type mappings based on docs/spec/Controllers/ACInfinity.md
    // and observed API responses
    const map: Record<number, DeviceType> = {
      1: 'fan',
      2: 'light',
      3: 'outlet',
      4: 'heater',
      5: 'humidifier',
      6: 'dehumidifier',
      7: 'outlet',       // CO2 controller (treated as outlet for control purposes)
      8: 'pump'          // Water pump
    }
    return map[acType] || 'outlet'
  }

  private convertSensorValue(value: number, acType: number): number {
    // AC Infinity returns sensor values multiplied by 100
    // acType: 1=temp (C×100), 2=humidity (%×100), 3=vpd (kPa×100), 4=co2, 5=light
    switch (acType) {
      case 1: // Temperature: Celsius × 100 → Fahrenheit
        const celsiusValue = value / 100
        return Math.round(((celsiusValue * 9/5) + 32) * 10) / 10
      case 2: // Humidity: percentage × 100 → percentage
        return Math.round((value / 100) * 10) / 10
      case 3: // VPD: kPa × 100 → kPa
        return Math.round((value / 100) * 100) / 100
      case 4: // CO2: ppm (usually not scaled)
        return value
      case 5: // Light: lux (usually not scaled)
        return value
      default:
        return value
    }
  }

  private emptyMetadata(): ControllerMetadata {
    return {
      brand: 'ac_infinity',
      capabilities: this.emptyCapabilities()
    }
  }

  private emptyCapabilities() {
    return {
      sensors: [],
      devices: [],
      supportsDimming: false,
      supportsScheduling: false,
      maxPorts: 0
    }
  }
}
