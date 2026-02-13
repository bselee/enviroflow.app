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
  email: string  // Store email for account-based rate limiting
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

/**
 * AC Infinity Advance Automation structure (based on app behavior)
 */
interface ACAdvanceAutomation {
  autoId?: string | number
  autoName?: string
  devId: string
  port: number
  isOpen: number // 1=enabled, 0=disabled
  startTime: string // HH:MM or seconds from midnight
  endTime: string
  week?: string // "1,2,3,4,5,6,7" format or array
  devModeOne: number // Mode: 0=OFF, 1=ON, 2=AUTO, 4=CYCLE
  // Mode-specific settings follow the same structure as addDevMode
  [key: string]: unknown
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
      // Include email for account-based rate limiting (AC Infinity rate limits by account, not device)
      tokenStore.set(controllerId, {
        token: loginResult.token,
        userId: loginResult.userId || '',
        email: email,  // Store email for rate limiting across all controllers on same account
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
   * Read all sensor values from controller using devInfoListAll endpoint
   * This returns complete device info including sensors for all devices on the account
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      throw new Error('Controller not connected. Call connect() first.')
    }

    if (stored.expiresAt < new Date()) {
      tokenStore.delete(controllerId)
      throw new Error('Authentication token expired. Please reconnect.')
    }

    try {
      await waitForRateLimit(`ac_infinity:${stored.email}`)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Rate limit exceeded')
    }

    const readings: SensorReading[] = []
    const now = new Date()

    // Use devInfoListAll - returns ALL devices with complete sensor/port data
    const result = await adapterFetch<ACDeviceListResponse>(
      ADAPTER_NAME,
      `${API_BASE}/api/user/devInfoListAll`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
          'token': stored.token,
        },
        body: new URLSearchParams({ userId: stored.token }).toString()
      }
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read sensor data')
    }

    if (result.data.code !== 200 || !result.data.data) {
      throw new Error(result.data.msg || 'Failed to get device list')
    }

    // Find our specific device in the list
    const device = result.data.data.find(d => d.devId === controllerId)
    if (!device) {
      throw new Error(`Device ${controllerId} not found in account`)
    }

    const deviceInfo = (device as any).deviceInfo
    if (!deviceInfo) {
      throw new Error(`No deviceInfo for device ${controllerId}`)
    }

    log('info', `Got deviceInfo for ${controllerId}`, {
      temperature: deviceInfo.temperature,
      temperatureF: deviceInfo.temperatureF,
      humidity: deviceInfo.humidity,
      vpdnums: deviceInfo.vpdnums,
      portsCount: deviceInfo.ports?.length || 0
    })

    // Extract temperature (temperatureF is in F × 100)
    if (typeof deviceInfo.temperatureF === 'number') {
      readings.push({
        port: 0,
        type: 'temperature',
        value: Math.round(deviceInfo.temperatureF) / 100,
        unit: 'F',
        timestamp: now,
        isStale: false
      })
    }

    // Extract humidity (humidity is % × 100)
    if (typeof deviceInfo.humidity === 'number') {
      readings.push({
        port: 0,
        type: 'humidity',
        value: Math.round(deviceInfo.humidity) / 100,
        unit: '%',
        timestamp: now,
        isStale: false
      })
    }

    // Extract VPD (vpdnums is kPa × 100)
    if (typeof deviceInfo.vpdnums === 'number') {
      readings.push({
        port: 0,
        type: 'vpd',
        value: Math.round(deviceInfo.vpdnums) / 100,
        unit: 'kPa',
        timestamp: now,
        isStale: false
      })
    }

    log('info', `Read ${readings.length} sensor values from ${controllerId}`, {
      temp: readings.find(r => r.type === 'temperature')?.value,
      humidity: readings.find(r => r.type === 'humidity')?.value,
      vpd: readings.find(r => r.type === 'vpd')?.value
    })

    return readings
  }

  /**
   * Precision polling: Read sensors, ports, and modes with a single API call.
   * This provides a complete state of the controller including attached devices (ports),
   * their names, current modes, and all sensor readings.
   *
   * Uses devInfoListAll endpoint which returns complete data including:
   * - deviceInfo.temperatureF (°F × 100)
   * - deviceInfo.humidity (% × 100)
   * - deviceInfo.vpdnums (kPa × 100)
   * - deviceInfo.ports[] - array of port objects
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

    // Apply rate limiting per ACCOUNT (email), not per controller
    try {
      await waitForRateLimit(`ac_infinity:${stored.email}`)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Rate limit exceeded')
    }

    const now = new Date()
    const readings: SensorReading[] = []
    const ports: PortState[] = []

    // Use devInfoListAll - returns complete device info including ports
    const result = await adapterFetch<ACDeviceListResponse>(
      ADAPTER_NAME,
      `${API_BASE}/api/user/devInfoListAll`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
          'token': stored.token,
        },
        body: new URLSearchParams({ userId: stored.token }).toString()
      }
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read device data')
    }

    if (result.data.code !== 200 || !result.data.data) {
      throw new Error(result.data.msg || 'Failed to get device list')
    }

    // Find our specific device in the list
    const device = result.data.data.find(d => d.devId === controllerId)
    if (!device) {
      throw new Error(`Device ${controllerId} not found in account`)
    }

    const deviceInfo = (device as any).deviceInfo
    if (!deviceInfo) {
      throw new Error(`No deviceInfo for device ${controllerId}`)
    }

    log('info', `readSensorsAndPorts deviceInfo for ${controllerId}`, {
      temperatureF: deviceInfo.temperatureF,
      humidity: deviceInfo.humidity,
      vpdnums: deviceInfo.vpdnums,
      portsCount: deviceInfo.ports?.length || 0
    })

    // Extract temperature (temperatureF is in F × 100)
    if (typeof deviceInfo.temperatureF === 'number') {
      readings.push({
        port: 0,
        type: 'temperature',
        value: Math.round(deviceInfo.temperatureF) / 100,
        unit: 'F',
        timestamp: now,
        isStale: false
      })
    }

    // Extract humidity (humidity is % × 100)
    if (typeof deviceInfo.humidity === 'number') {
      readings.push({
        port: 0,
        type: 'humidity',
        value: Math.round(deviceInfo.humidity) / 100,
        unit: '%',
        timestamp: now,
        isStale: false
      })
    }

    // Extract VPD (vpdnums is kPa × 100)
    if (typeof deviceInfo.vpdnums === 'number') {
      readings.push({
        port: 0,
        type: 'vpd',
        value: Math.round(deviceInfo.vpdnums) / 100,
        unit: 'kPa',
        timestamp: now,
        isStale: false
      })
    }

    // Extract ports from deviceInfo.ports
    const portsArray = deviceInfo.ports as any[]
    if (portsArray && Array.isArray(portsArray)) {
      log('info', `Found ${portsArray.length} ports in readSensorsAndPorts`)

      for (const port of portsArray) {
        // Port data structure from API:
        // port: number, portName: string, speak: number (0-10), online: number, loadType: number
        const portNum = port.port as number
        const portName = (port.portName as string) || `Port ${portNum}`
        const isOnline = port.online === 1
        const powerLevel = port.speak as number || 0
        const loadType = port.loadType as number || 0

        // Map loadType to device type string
        let loadTypeStr = 'outlet'
        if (loadType === 0 || loadType === 6) loadTypeStr = 'fan'
        else if (loadType === 2) loadTypeStr = 'humidifier'
        else if (loadType === 128) loadTypeStr = 'light'

        ports.push({
          port: portNum,
          portName: portName,
          portType: loadType,
          deviceType: loadTypeStr,

          isConnected: true,
          isOn: powerLevel > 0,
          isOnline: isOnline,

          powerLevel: powerLevel,
          supportsDimming: loadType === 0 || loadType === 6 || loadType === 128,

          loadType: loadType,
          devType: loadType,

          surplus: port.surplus,
          speak: powerLevel,
          externalPort: port.externalPort,
        } satisfies PortState)

        log('info', `Port ${portNum}: ${portName}, power=${powerLevel}, online=${isOnline}, loadType=${loadType}`)
      }
    } else {
      log('warn', `No ports array found in deviceInfo for ${controllerId}`)
    }

    // Capture Raw API Data
    const rawCapture: RawApiCapture = {
      endpoint: 'devInfoListAll',
      responseHash: createHash('md5').update(JSON.stringify(deviceInfo)).digest('hex'),
      rawSensorData: {
        temperatureF: deviceInfo.temperatureF,
        humidity: deviceInfo.humidity,
        vpdnums: deviceInfo.vpdnums
      },
      rawPortData: deviceInfo.ports || [],
      rawModeData: {},
      latencyMs: 0,
      capturedAt: now
    }

    log('info', `readSensorsAndPorts complete for ${controllerId}`, {
      sensorCount: readings.length,
      portCount: ports.length,
      ports: ports.map(p => ({ port: p.port, name: p.portName, isOn: p.isOn, power: p.powerLevel }))
    })

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

    // Apply rate limiting per ACCOUNT (email), not per controller
    // AC Infinity enforces ~60 requests/minute per account across ALL devices
    try {
      await waitForRateLimit(`ac_infinity:${stored.email}`)
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

      // Step 1: Get current mode settings (AC Infinity requires ALL settings to be sent)
      const settingsResult = await adapterFetch<{ code: number; data?: Record<string, unknown>; msg?: string }>(
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
          body: new URLSearchParams({
            devId: controllerId,
            port: String(port)
          }).toString()
        }
      )

      // Build settings object - merge existing with our changes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentSettings: Record<string, any> = settingsResult.success && settingsResult.data?.data
        ? { ...(settingsResult.data.data as Record<string, unknown>) }
        : {}

      // Update only the power-related fields
      currentSettings.devId = controllerId
      currentSettings.port = port
      currentSettings.speak = power
      currentSettings.onOff = power > 0 ? 1 : 0

      // Track the previous mode for restore capability
      const previousMode = currentSettings.devModeOne as number | undefined
      const modeNames: Record<number, string> = {
        0: 'Off', 1: 'On', 2: 'Auto', 3: 'Timer to On',
        4: 'Timer to Off', 5: 'Schedule', 6: 'VPD', 7: 'Cycle'
      }

      // Handle mode based on command options
      if (command.type === 'restore_mode' && command.targetMode !== undefined) {
        // Restore to a specific native programming mode
        currentSettings.devModeOne = command.targetMode
        log('info', `Restoring native mode to ${command.targetMode} (${modeNames[command.targetMode] || 'Unknown'})`, { port })
      } else if (command.preserveNativeMode) {
        // Keep native mode active - just change the immediate power level
        // Note: Native programming may override this soon based on conditions
        log('info', `Preserving native mode ${previousMode} (${modeNames[previousMode || 0]}), temporary power change`, { port, power })
      } else {
        // Default behavior: Force ON mode (1) to override native programming
        // This ensures manual control persists until user explicitly restores native mode
        currentSettings.devModeOne = 1
        if (previousMode !== 1 && previousMode !== undefined) {
          log('info', `Overriding native mode ${previousMode} (${modeNames[previousMode]}) with manual ON mode`, { port, previousMode })
        }
      }

      if (currentSettings.levelLow === undefined) currentSettings.levelLow = 0
      if (currentSettings.levelHigh === undefined) currentSettings.levelHigh = 10

      log('info', `Sending merged settings`, { port, speak: power, onOff: currentSettings.onOff, mode: currentSettings.devModeOne })

      // Step 2: Send updated settings back
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
          body: new URLSearchParams(
            Object.entries(currentSettings).reduce((acc, [key, value]) => {
              // Convert values to strings for URLSearchParams
              acc[key] = value === null || value === undefined ? '' : String(value)
              return acc
            }, {} as Record<string, string>)
          ).toString()
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
        // Include mode information for UI to offer restore capability
        previousMode: previousMode,
        previousModeName: previousMode !== undefined ? modeNames[previousMode] : undefined,
        currentMode: currentSettings.devModeOne as number,
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
   * Get current controller status using devInfoListAll endpoint
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
      const result = await adapterFetch<ACDeviceListResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/user/devInfoListAll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': stored.token,
          },
          body: new URLSearchParams({ userId: stored.token }).toString()
        },
        { maxRetries: 1, timeoutMs: 5000 }
      )

      if (!result.success || result.data?.code !== 200) {
        return {
          status: 'offline',
          lastSeen: new Date()
        }
      }

      // Check if our device exists in the list
      const device = result.data.data?.find(d => d.devId === controllerId)
      return {
        status: device ? 'online' : 'offline',
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
  // Historical Data Methods (Experimental)
  // ============================================

  /**
   * Attempt to fetch historical sensor data from AC Infinity cloud.
   * Note: This explores various potential endpoints as AC Infinity's historical
   * data API is not officially documented.
   *
   * Returns null if historical data is not available from the API.
   */
  async getHistoricalData(
    controllerId: string,
    options?: {
      startDate?: Date
      endDate?: Date
      dataType?: 'temperature' | 'humidity' | 'vpd' | 'all'
    }
  ): Promise<{
    success: boolean
    data?: Array<{
      timestamp: Date
      temperature?: number
      humidity?: number
      vpd?: number
    }>
    endpointUsed?: string
    error?: string
    explorationResults?: Record<string, unknown>
  }> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      return { success: false, error: 'Controller not connected' }
    }

    const endDate = options?.endDate || new Date()
    const startDate = options?.startDate || new Date(endDate.getTime() - 24 * 60 * 60 * 1000) // Default 24h

    const explorationResults: Record<string, unknown> = {}

    // List of potential historical data endpoints to try
    // These are guesses based on common API naming conventions
    const endpointsToTry = [
      { name: 'getChartData', body: { devId: controllerId, type: '1', startTime: Math.floor(startDate.getTime() / 1000), endTime: Math.floor(endDate.getTime() / 1000) } },
      { name: 'getSensorHistory', body: { devId: controllerId, startTime: Math.floor(startDate.getTime() / 1000), endTime: Math.floor(endDate.getTime() / 1000) } },
      { name: 'getDevHistory', body: { devId: controllerId } },
      { name: 'getDeviceData', body: { devId: controllerId, type: 'sensor' } },
      { name: 'getHistoryData', body: { devId: controllerId, days: '7' } },
      { name: 'getDevRunLog', body: { devId: controllerId } },
      { name: 'getPortHistory', body: { devId: controllerId, port: '1' } },
    ]

    for (const endpoint of endpointsToTry) {
      try {
        const result = await adapterFetch<{ code: number; data?: unknown; msg?: string }>(
          ADAPTER_NAME,
          `${API_BASE}/api/dev/${endpoint.name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'User-Agent': USER_AGENT,
              'token': stored.token,
            },
            body: new URLSearchParams(
              Object.entries(endpoint.body).reduce((acc, [k, v]) => {
                acc[k] = String(v)
                return acc
              }, {} as Record<string, string>)
            ).toString()
          },
          { maxRetries: 1, timeoutMs: 10000 }
        )

        explorationResults[endpoint.name] = {
          success: result.success,
          code: result.data?.code,
          hasData: result.data?.data != null,
          dataType: result.data?.data ? typeof result.data.data : null,
          isArray: Array.isArray(result.data?.data),
          dataLength: Array.isArray(result.data?.data) ? result.data.data.length : null,
          message: result.data?.msg,
          sampleData: result.data?.data ? JSON.stringify(result.data.data).substring(0, 500) : null
        }

        // If we got valid data that looks like historical readings, parse and return it
        if (result.success && result.data?.code === 200 && Array.isArray(result.data?.data) && result.data.data.length > 0) {
          const historicalData = this.parseHistoricalData(result.data.data as unknown[])
          if (historicalData.length > 0) {
            log('info', `Found historical data via ${endpoint.name}`, { count: historicalData.length })
            return {
              success: true,
              data: historicalData,
              endpointUsed: endpoint.name,
              explorationResults
            }
          }
        }
      } catch (err) {
        explorationResults[endpoint.name] = { error: err instanceof Error ? err.message : String(err) }
      }
    }

    log('warn', 'No historical data endpoints returned valid data', { explorationResults })
    return {
      success: false,
      error: 'Historical data not available from AC Infinity API',
      explorationResults
    }
  }

  /**
   * Get device activity log (on/off events, mode changes)
   * Note: This explores potential endpoints - may not be available
   */
  async getDeviceActivityLog(
    controllerId: string,
    portId?: number
  ): Promise<{
    success: boolean
    events?: Array<{
      timestamp: Date
      port: number
      action: string
      previousState?: unknown
      newState?: unknown
    }>
    error?: string
    explorationResults?: Record<string, unknown>
  }> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      return { success: false, error: 'Controller not connected' }
    }

    const explorationResults: Record<string, unknown> = {}

    const baseBody: Record<string, string> = { devId: controllerId }
    const portBody: Record<string, string> = portId ? { devId: controllerId, port: String(portId) } : baseBody

    const endpointsToTry: Array<{ name: string; body: Record<string, string> }> = [
      { name: 'getDeviceLog', body: portBody },
      { name: 'getActionLog', body: baseBody },
      { name: 'getEventLog', body: baseBody },
      { name: 'getModeHistory', body: baseBody },
      { name: 'getDeviceActivity', body: baseBody },
    ]

    for (const endpoint of endpointsToTry) {
      try {
        const result = await adapterFetch<{ code: number; data?: unknown; msg?: string }>(
          ADAPTER_NAME,
          `${API_BASE}/api/dev/${endpoint.name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'User-Agent': USER_AGENT,
              'token': stored.token,
            },
            body: new URLSearchParams(endpoint.body).toString()
          },
          { maxRetries: 1, timeoutMs: 10000 }
        )

        explorationResults[endpoint.name] = {
          success: result.success,
          code: result.data?.code,
          hasData: result.data?.data != null,
          dataType: result.data?.data ? typeof result.data.data : null,
          isArray: Array.isArray(result.data?.data),
          message: result.data?.msg,
          sampleData: result.data?.data ? JSON.stringify(result.data.data).substring(0, 500) : null
        }

        // If we got valid array data, try to parse as activity log
        if (result.success && result.data?.code === 200 && Array.isArray(result.data?.data) && result.data.data.length > 0) {
          const events = this.parseActivityLog(result.data.data as unknown[])
          if (events.length > 0) {
            log('info', `Found activity log via ${endpoint.name}`, { count: events.length })
            return {
              success: true,
              events,
              explorationResults
            }
          }
        }
      } catch (err) {
        explorationResults[endpoint.name] = { error: err instanceof Error ? err.message : String(err) }
      }
    }

    return {
      success: false,
      error: 'Device activity log not available from AC Infinity API',
      explorationResults
    }
  }

  /**
   * Parse raw historical data from AC Infinity API
   * Tries to extract timestamp and sensor values from various possible formats
   */
  private parseHistoricalData(data: unknown[]): Array<{ timestamp: Date; temperature?: number; humidity?: number; vpd?: number }> {
    const results: Array<{ timestamp: Date; temperature?: number; humidity?: number; vpd?: number }> = []

    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue

      const record = item as Record<string, unknown>

      // Try various possible timestamp field names
      let timestamp: Date | null = null
      const timestampFields = ['timestamp', 'time', 'recordTime', 'createTime', 'recordedAt', 'created_at', 'ts']
      for (const field of timestampFields) {
        if (record[field]) {
          const val = record[field]
          if (typeof val === 'number') {
            // Unix timestamp (seconds or milliseconds)
            timestamp = val > 1e12 ? new Date(val) : new Date(val * 1000)
          } else if (typeof val === 'string') {
            timestamp = new Date(val)
          }
          if (timestamp && !isNaN(timestamp.getTime())) break
          timestamp = null
        }
      }

      if (!timestamp) continue

      // Try to extract sensor values
      const point: { timestamp: Date; temperature?: number; humidity?: number; vpd?: number } = { timestamp }

      // Temperature fields
      const tempFields = ['temperature', 'temp', 'temperatureF', 'temperatureC', 'tempValue']
      for (const field of tempFields) {
        if (typeof record[field] === 'number') {
          let val = record[field] as number
          // AC Infinity typically uses values × 100
          if (val > 1000) val = val / 100
          point.temperature = val
          break
        }
      }

      // Humidity fields
      const humFields = ['humidity', 'hum', 'humidityValue', 'rh']
      for (const field of humFields) {
        if (typeof record[field] === 'number') {
          let val = record[field] as number
          if (val > 100) val = val / 100
          point.humidity = val
          break
        }
      }

      // VPD fields
      const vpdFields = ['vpd', 'vpdnums', 'vpdValue']
      for (const field of vpdFields) {
        if (typeof record[field] === 'number') {
          let val = record[field] as number
          if (val > 10) val = val / 100
          point.vpd = val
          break
        }
      }

      if (point.temperature !== undefined || point.humidity !== undefined || point.vpd !== undefined) {
        results.push(point)
      }
    }

    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  /**
   * Parse activity log data from AC Infinity API
   */
  private parseActivityLog(data: unknown[]): Array<{ timestamp: Date; port: number; action: string; previousState?: unknown; newState?: unknown }> {
    const events: Array<{ timestamp: Date; port: number; action: string; previousState?: unknown; newState?: unknown }> = []

    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue

      const record = item as Record<string, unknown>

      // Try to parse timestamp
      let timestamp: Date | null = null
      const timestampFields = ['timestamp', 'time', 'actionTime', 'eventTime', 'created_at']
      for (const field of timestampFields) {
        if (record[field]) {
          const val = record[field]
          if (typeof val === 'number') {
            timestamp = val > 1e12 ? new Date(val) : new Date(val * 1000)
          } else if (typeof val === 'string') {
            timestamp = new Date(val)
          }
          if (timestamp && !isNaN(timestamp.getTime())) break
          timestamp = null
        }
      }

      if (!timestamp) continue

      // Try to extract port and action
      const port = typeof record.port === 'number' ? record.port : (typeof record.portNum === 'number' ? record.portNum : 1)
      const action = typeof record.action === 'string' ? record.action :
                    (typeof record.actionType === 'string' ? record.actionType :
                    (typeof record.type === 'string' ? record.type : 'unknown'))

      events.push({
        timestamp,
        port,
        action,
        previousState: record.previousState || record.oldValue || record.before,
        newState: record.newState || record.newValue || record.after || record.value
      })
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  // ============================================
  // Advance Automations (Time-Windowed Mode Overrides)
  // ============================================

  /**
   * Get all advance automations for a device
   * Probes multiple potential endpoints to find the automation list
   */
  async getAdvanceAutomations(
    controllerId: string,
    portId?: number
  ): Promise<{
    success: boolean
    automations?: ACAdvanceAutomation[]
    error?: string
    endpointUsed?: string
    explorationResults?: Record<string, unknown>
  }> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      return { success: false, error: 'Controller not connected' }
    }

    const explorationResults: Record<string, unknown> = {}

    // Potential endpoints for getting automations
    const endpointsToTry = [
      { name: 'getAutoList', body: { devId: controllerId } },
      { name: 'getAdvanceList', body: { devId: controllerId } },
      { name: 'getAutomationList', body: { devId: controllerId } },
      { name: 'getDevAutoList', body: { devId: controllerId } },
      { name: 'getPortAutoList', body: { devId: controllerId, port: String(portId || 1) } },
      { name: 'getAdvList', body: { devId: controllerId } },
      { name: 'getSceneList', body: { devId: controllerId } },
      { name: 'getRecipeList', body: { devId: controllerId } },
    ]

    for (const endpoint of endpointsToTry) {
      try {
        const result = await adapterFetch<{ code: number; data?: unknown; msg?: string }>(
          ADAPTER_NAME,
          `${API_BASE}/api/dev/${endpoint.name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'User-Agent': USER_AGENT,
              'token': stored.token,
            },
            body: new URLSearchParams(
              Object.entries(endpoint.body).reduce((acc, [k, v]) => {
                acc[k] = String(v)
                return acc
              }, {} as Record<string, string>)
            ).toString()
          },
          { maxRetries: 1, timeoutMs: 10000 }
        )

        explorationResults[endpoint.name] = {
          success: result.success,
          code: result.data?.code,
          hasData: result.data?.data != null,
          dataType: result.data?.data ? typeof result.data.data : null,
          isArray: Array.isArray(result.data?.data),
          dataLength: Array.isArray(result.data?.data) ? result.data.data.length : null,
          message: result.data?.msg,
          sampleData: result.data?.data ? JSON.stringify(result.data.data).substring(0, 1000) : null
        }

        // If we got valid array data, try to parse as automations
        if (result.success && result.data?.code === 200 && Array.isArray(result.data?.data)) {
          const automations = this.parseAutomations(result.data.data as unknown[], controllerId)
          log('info', `Found ${automations.length} automations via ${endpoint.name}`)
          return {
            success: true,
            automations,
            endpointUsed: endpoint.name,
            explorationResults
          }
        }
      } catch (err) {
        explorationResults[endpoint.name] = { error: err instanceof Error ? err.message : String(err) }
      }
    }

    // Also check if automations are embedded in the main device info
    try {
      const deviceResult = await adapterFetch<ACDeviceListResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/user/devInfoListAll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': stored.token,
          },
          body: new URLSearchParams({ userId: stored.token }).toString()
        }
      )

      if (deviceResult.success && deviceResult.data?.code === 200 && deviceResult.data?.data) {
        const device = deviceResult.data.data.find(d => d.devId === controllerId)
        if (device) {
          const deviceAny = device as any
          // Check for automation-related fields
          const autoFields = ['autoList', 'advanceList', 'automations', 'scenes', 'recipes']
          for (const field of autoFields) {
            if (Array.isArray(deviceAny[field]) && deviceAny[field].length > 0) {
              const automations = this.parseAutomations(deviceAny[field], controllerId)
              log('info', `Found ${automations.length} automations in deviceInfo.${field}`)
              return {
                success: true,
                automations,
                endpointUsed: `devInfoListAll.${field}`,
                explorationResults
              }
            }
            if (deviceAny.deviceInfo && Array.isArray(deviceAny.deviceInfo[field])) {
              const automations = this.parseAutomations(deviceAny.deviceInfo[field], controllerId)
              log('info', `Found ${automations.length} automations in deviceInfo.deviceInfo.${field}`)
              return {
                success: true,
                automations,
                endpointUsed: `devInfoListAll.deviceInfo.${field}`,
                explorationResults
              }
            }
          }
          explorationResults['devInfoListAll'] = {
            deviceKeys: Object.keys(device),
            deviceInfoKeys: deviceAny.deviceInfo ? Object.keys(deviceAny.deviceInfo) : null
          }
        }
      }
    } catch (err) {
      explorationResults['devInfoListAll'] = { error: err instanceof Error ? err.message : String(err) }
    }

    log('warn', 'No automation endpoints returned valid data', { controllerId, explorationResults })
    return {
      success: false,
      error: 'Advance automations not available from AC Infinity API (endpoints not found)',
      explorationResults
    }
  }

  /**
   * Create or update an advance automation
   */
  async setAdvanceAutomation(
    controllerId: string,
    automation: ACAdvanceAutomation
  ): Promise<{
    success: boolean
    automationId?: string
    error?: string
    endpointUsed?: string
  }> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      return { success: false, error: 'Controller not connected' }
    }

    // Try rate limiting
    try {
      await waitForRateLimit(`ac_infinity:${stored.email}`)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Rate limit exceeded' }
    }

    // Endpoints to try for creating/updating automations
    const isUpdate = automation.autoId !== undefined
    const endpointsToTry = isUpdate
      ? [
          { name: 'updateAuto', priority: 1 },
          { name: 'editAuto', priority: 2 },
          { name: 'modifyAuto', priority: 3 },
          { name: 'setAuto', priority: 4 },
        ]
      : [
          { name: 'addAuto', priority: 1 },
          { name: 'createAuto', priority: 2 },
          { name: 'addAdvance', priority: 3 },
          { name: 'addAutoMode', priority: 4 },
        ]

    for (const endpoint of endpointsToTry.sort((a, b) => a.priority - b.priority)) {
      try {
        const body: Record<string, string> = {
          devId: controllerId,
          port: String(automation.port),
          autoName: automation.autoName || 'Automation',
          isOpen: String(automation.isOpen),
          startTime: automation.startTime,
          endTime: automation.endTime,
          devModeOne: String(automation.devModeOne),
        }

        if (automation.autoId) {
          body.autoId = String(automation.autoId)
        }
        if (automation.week) {
          body.week = automation.week
        }

        // Add any additional mode settings
        for (const [key, value] of Object.entries(automation)) {
          if (!body[key] && value !== undefined && value !== null) {
            body[key] = String(value)
          }
        }

        const result = await adapterFetch<{ code: number; data?: { autoId?: string | number }; msg?: string }>(
          ADAPTER_NAME,
          `${API_BASE}/api/dev/${endpoint.name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'User-Agent': USER_AGENT,
              'token': stored.token,
            },
            body: new URLSearchParams(body).toString()
          },
          { maxRetries: 1, timeoutMs: 15000 }
        )

        if (result.success && result.data?.code === 200) {
          log('info', `${isUpdate ? 'Updated' : 'Created'} automation via ${endpoint.name}`, {
            autoId: result.data.data?.autoId || automation.autoId
          })
          return {
            success: true,
            automationId: String(result.data.data?.autoId || automation.autoId || ''),
            endpointUsed: endpoint.name
          }
        }
      } catch (err) {
        log('warn', `Failed to ${isUpdate ? 'update' : 'create'} automation via ${endpoint.name}`, {
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    return {
      success: false,
      error: `Failed to ${isUpdate ? 'update' : 'create'} automation - no working endpoint found`
    }
  }

  /**
   * Delete an advance automation
   */
  async deleteAdvanceAutomation(
    controllerId: string,
    automationId: string
  ): Promise<{
    success: boolean
    error?: string
  }> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      return { success: false, error: 'Controller not connected' }
    }

    try {
      await waitForRateLimit(`ac_infinity:${stored.email}`)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Rate limit exceeded' }
    }

    const endpointsToTry = ['deleteAuto', 'removeAuto', 'delAuto', 'delAdvance']

    for (const endpoint of endpointsToTry) {
      try {
        const result = await adapterFetch<{ code: number; msg?: string }>(
          ADAPTER_NAME,
          `${API_BASE}/api/dev/${endpoint}`,
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
              autoId: automationId
            }).toString()
          },
          { maxRetries: 1, timeoutMs: 10000 }
        )

        if (result.success && result.data?.code === 200) {
          log('info', `Deleted automation ${automationId} via ${endpoint}`)
          return { success: true }
        }
      } catch (err) {
        log('warn', `Failed to delete automation via ${endpoint}`, {
          error: err instanceof Error ? err.message : String(err)
        })
      }
    }

    return { success: false, error: 'Failed to delete automation - no working endpoint found' }
  }

  /**
   * Parse automation data from various API response formats
   */
  private parseAutomations(data: unknown[], controllerId: string): ACAdvanceAutomation[] {
    const automations: ACAdvanceAutomation[] = []

    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue

      const record = item as Record<string, unknown>

      // Try to extract automation fields
      const automation: ACAdvanceAutomation = {
        autoId: (record.autoId ?? record.id ?? record.automationId) as string | number | undefined,
        autoName: (record.autoName ?? record.name ?? record.automationName ?? 'Automation') as string,
        devId: (record.devId ?? controllerId) as string,
        port: Number(record.port ?? record.portNum ?? 1),
        isOpen: Number(record.isOpen ?? record.enabled ?? record.active ?? 1),
        startTime: (record.startTime ?? record.start ?? '00:00') as string,
        endTime: (record.endTime ?? record.end ?? '23:59') as string,
        week: record.week as string | undefined,
        devModeOne: Number(record.devModeOne ?? record.mode ?? record.modeId ?? 1),
      }

      // Copy any additional mode settings
      const modeFields = [
        'speak', 'levelHigh', 'levelLow', 'tempTriggerAbove', 'tempTriggerBelow',
        'humTriggerAbove', 'humTriggerBelow', 'vpdTriggerAbove', 'vpdTriggerBelow',
        'transTemp', 'transHum', 'transVpd', 'bufferTemp', 'bufferHum', 'bufferVpd',
        'cycleOnTime', 'cycleOffTime', 'timerTime', 'timerMode'
      ]
      for (const field of modeFields) {
        if (record[field] !== undefined) {
          automation[field] = record[field]
        }
      }

      automations.push(automation)
    }

    return automations
  }

  /**
   * Get detailed mode settings for a port (for generating mode summary)
   */
  async getPortModeSettings(
    controllerId: string,
    port: number
  ): Promise<{
    success: boolean
    settings?: Record<string, unknown>
    error?: string
  }> {
    const stored = tokenStore.get(controllerId)
    if (!stored) {
      return { success: false, error: 'Controller not connected' }
    }

    try {
      await waitForRateLimit(`ac_infinity:${stored.email}`)

      const result = await adapterFetch<{ code: number; data?: Record<string, unknown>; msg?: string }>(
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
          body: new URLSearchParams({
            devId: controllerId,
            port: String(port)
          }).toString()
        }
      )

      if (result.success && result.data?.code === 200 && result.data?.data) {
        return {
          success: true,
          settings: result.data.data as Record<string, unknown>
        }
      }

      return {
        success: false,
        error: result.data?.msg || result.error || 'Failed to get mode settings'
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private isACInfinityCredentials(creds: ControllerCredentials): creds is ACInfinityCredentials {
    return 'type' in creds && creds.type === 'ac_infinity'
  }

  private async getDeviceCapabilities(controllerId: string, token: string) {
    log('info', `Fetching capabilities for device ${controllerId} via devInfoListAll`)

    const sensors: SensorCapability[] = []
    const devices: DeviceCapability[] = []
    let supportsDimming = false

    try {
      // Use devInfoListAll - returns complete device info including ports
      const result = await adapterFetch<ACDeviceListResponse>(
        ADAPTER_NAME,
        `${API_BASE}/api/user/devInfoListAll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
            'token': token,
          },
          body: new URLSearchParams({ userId: token }).toString()
        }
      )

      if (!result.success || !result.data || result.data.code !== 200) {
        log('error', `Capabilities fetch failed for ${controllerId}`, { error: result.error })
        return this.emptyCapabilities()
      }

      // Find our specific device
      const allDevices = result.data.data || []
      log('info', `devInfoListAll returned ${allDevices.length} devices`, {
        deviceIds: allDevices.map((d: any) => d.devId),
        lookingFor: controllerId
      })

      const device = allDevices.find((d: any) => d.devId === controllerId)
      if (!device) {
        log('error', `Device ${controllerId} not found in devInfoListAll`, {
          availableIds: allDevices.map((d: any) => d.devId)
        })
        return this.emptyCapabilities()
      }

      log('info', `Found device ${controllerId}`, {
        devName: device.devName,
        hasDeviceInfo: !!(device as any).deviceInfo,
        deviceKeys: Object.keys(device)
      })

      const deviceInfo = (device as any).deviceInfo
      if (!deviceInfo) {
        log('error', `No deviceInfo for device ${controllerId}`, {
          deviceKeys: Object.keys(device),
          rawDevice: JSON.stringify(device).slice(0, 500)
        })
        return this.emptyCapabilities()
      }

      log('info', `deviceInfo for ${controllerId}`, {
        hasPortsArray: Array.isArray(deviceInfo.ports),
        portsLength: deviceInfo.ports?.length,
        deviceInfoKeys: Object.keys(deviceInfo)
      })

      // Add built-in sensors (all Controller 69s have temp/humidity/VPD)
      sensors.push(
        { port: 0, name: 'Temperature', type: 'temperature', unit: 'F' },
        { port: 0, name: 'Humidity', type: 'humidity', unit: '%' },
        { port: 0, name: 'VPD', type: 'vpd', unit: 'kPa' }
      )

      // Extract ports from deviceInfo.ports
      const ports = deviceInfo.ports as any[]
      if (ports && Array.isArray(ports)) {
        log('info', `Found ${ports.length} ports for ${controllerId}`)

        for (const port of ports) {
          // Port data structure from API:
          // port: number, portName: string, speak: number (0-10), online: number, curMode: number, loadType: number
          const portNum = port.port as number
          const portName = (port.portName as string) || `Port ${portNum}`
          const isOnline = port.online === 1
          const powerLevel = port.speak as number || 0
          const loadType = port.loadType as number || 0

          // Map loadType to device type
          // loadType: 0=fan, 2=humidifier, 6=fan, 128=light/heater
          let deviceType: DeviceType = 'outlet'
          if (loadType === 0 || loadType === 6) deviceType = 'fan'
          else if (loadType === 2) deviceType = 'humidifier'
          else if (loadType === 128) deviceType = 'light'

          // All ports support dimming (0-10 scale)
          supportsDimming = true

          devices.push({
            port: portNum,
            name: portName,
            type: deviceType,
            supportsDimming: true,
            minLevel: 0,
            maxLevel: 10,
            currentLevel: powerLevel,
            isOn: powerLevel > 0 && isOnline
          })

          log('info', `Added device: port=${portNum}, name=${portName}, type=${deviceType}, level=${powerLevel}, online=${isOnline}`)
        }
      }

      log('info', `Capabilities loaded for ${controllerId}`, {
        sensorCount: sensors.length,
        deviceCount: devices.length,
        devices: devices.map(d => ({ port: d.port, name: d.name, type: d.type, level: d.currentLevel }))
      })

      return {
        sensors,
        devices,
        supportsDimming,
        supportsScheduling: true,
        maxPorts: 4
      }

    } catch (err) {
      log('error', `Exception getting capabilities for ${controllerId}`, {
        error: err instanceof Error ? err.message : String(err)
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
