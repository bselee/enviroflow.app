/**
 * Govee Controller Adapter
 *
 * Supports:
 * - Govee H5179 WiFi Hygrometer Thermometer
 * - Govee WiFi Smart LED Lights
 * - Govee WiFi Smart Plugs
 * - Other Govee WiFi-enabled devices
 *
 * API: Govee Developer API
 * Base URL: https://developer-api.govee.com/v1
 * Documentation: https://govee-public.s3.amazonaws.com/developer-docs/GoveeDeveloperAPIReference.pdf
 *
 * Authentication:
 * - Requires Govee-API-Key header (obtain from Govee Home app)
 *
 * Features:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Detailed error logging
 * - Rate limit handling (60 requests/minute per device)
 */

import type {
  ControllerAdapter,
  ControllerCredentials,
  GoveeCredentials,
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
} from './types'
import {
  adapterFetch,
  getCircuitBreaker,
  resetCircuitBreaker,
} from './retry'

// Govee API configuration
const API_BASE = 'https://developer-api.govee.com/v1'
const ADAPTER_NAME = 'govee'

// Rate limiting: 60 requests per minute per device
const RATE_LIMIT_PER_MINUTE = 60
const RATE_LIMIT_WINDOW_MS = 60000

// Device state cache
interface DeviceCache {
  deviceId: string
  model: string
  deviceName: string
  controllable: boolean
  retrievable: boolean
  apiKey: string
  lastUpdate: Date
  requestCount: number
  requestWindowStart: Date
}

const deviceCache = new Map<string, DeviceCache>()

// ============================================
// Govee API Response Types
// ============================================

interface GoveeDevicesResponse {
  data?: {
    devices: GoveeDevice[]
  }
  message?: string
  code?: number
}

interface GoveeDevice {
  device: string          // MAC address (e.g., "AA:BB:CC:DD:EE:FF:GG:HH")
  model: string           // Model code (e.g., "H5179", "H6159")
  deviceName: string      // User-assigned name
  controllable: boolean   // Can send commands
  retrievable: boolean    // Can retrieve state
  supportCmds: string[]   // Supported commands (turn, brightness, color, colorTem)
  properties?: {
    colorTem?: {
      range?: {
        min?: number
        max?: number
      }
    }
  }
}

interface GoveeDeviceStateResponse {
  data?: {
    device: string
    model: string
    properties: GoveeProperty[]
  }
  message?: string
  code?: number
}

interface GoveeProperty {
  online?: boolean
  powerState?: 'on' | 'off'
  brightness?: number        // 0-100
  color?: {
    r: number                // 0-255
    g: number                // 0-255
    b: number                // 0-255
  }
  colorTemInKelvin?: number  // 2000-9000K
  temperature?: number       // Sensor temperature (Celsius)
  humidity?: number          // Sensor humidity (%)
}

interface GoveeControlResponse {
  code?: number
  message?: string
  data?: unknown
}

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[GoveeAdapter][${timestamp}]`

  if (level === 'error') {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

// ============================================
// Govee Adapter Implementation
// ============================================

export class GoveeAdapter implements ControllerAdapter, DiscoverableAdapter {

  /**
   * Discover all Govee devices associated with the API key.
   * Note: Govee API doesn't require email/password, only API key.
   */
  async discoverDevices(credentials: DiscoveryCredentials): Promise<DiscoveryResult> {
    log('warn', 'Govee uses API key authentication, not email/password')

    return {
      success: false,
      devices: [],
      totalDevices: 0,
      alreadyRegisteredCount: 0,
      error: 'Govee requires API key authentication. Use connect() with GoveeCredentials instead.',
      timestamp: new Date(),
      source: 'cloud_api'
    }
  }

  /**
   * Discover devices using API key
   */
  async discoverDevicesWithApiKey(apiKey: string): Promise<DiscoveryResult> {
    log('info', 'Starting device discovery with API key')

    try {
      const result = await adapterFetch<GoveeDevicesResponse>(
        ADAPTER_NAME,
        `${API_BASE}/devices`,
        {
          method: 'GET',
          headers: {
            'Govee-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!result.success || !result.data) {
        log('error', 'Failed to fetch devices', { error: result.error })
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: result.error || 'Failed to retrieve device list',
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      const responseData = result.data

      // Check for API error codes
      if (responseData.code && responseData.code !== 200) {
        const errorMsg = this.mapGoveeErrorCode(responseData.code, responseData.message)
        log('error', 'API returned error', { code: responseData.code, message: errorMsg })
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: errorMsg,
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      if (!responseData.data || !responseData.data.devices || responseData.data.devices.length === 0) {
        log('info', 'No devices found for API key')
        return {
          success: true,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      log('info', `Found ${responseData.data.devices.length} devices`)

      // Map to DiscoveredDevice format
      const discoveredDevices: DiscoveredDevice[] = responseData.data.devices.map(device => ({
        deviceId: device.device,
        name: device.deviceName || `Govee ${device.model}`,
        brand: 'govee' as const,
        model: device.model,
        isOnline: true, // Govee API doesn't return online status in device list
        controllable: device.controllable,
        retrievable: device.retrievable,
        isAlreadyRegistered: false,
        capabilities: {
          sensors: this.getDeviceSensorCapabilities(device.model),
          devices: this.getDeviceControlCapabilities(device.supportCmds),
          supportsDimming: device.supportCmds.includes('brightness')
        }
      }))

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
   * Connect to Govee API and validate credentials
   */
  async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
    if (!this.isGoveeCredentials(credentials)) {
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: 'Invalid credentials type. Expected Govee credentials with API key.'
      }
    }

    const { apiKey } = credentials

    if (!apiKey) {
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: 'Govee API key is required. Obtain from Govee Home app: Account > About Us > Apply for API Key.'
      }
    }

    try {
      log('info', 'Connecting to Govee API')

      // Validate API key by fetching device list
      const result = await adapterFetch<GoveeDevicesResponse>(
        ADAPTER_NAME,
        `${API_BASE}/devices`,
        {
          method: 'GET',
          headers: {
            'Govee-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!result.success || !result.data) {
        log('error', 'Failed to connect', { error: result.error })
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: result.error || 'Failed to connect to Govee API'
        }
      }

      const responseData = result.data

      // Check for error codes
      if (responseData.code && responseData.code !== 200) {
        const errorMsg = this.mapGoveeErrorCode(responseData.code, responseData.message)
        log('error', 'API error during connection', { code: responseData.code, message: errorMsg })
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: errorMsg
        }
      }

      if (!responseData.data || !responseData.data.devices || responseData.data.devices.length === 0) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'No Govee devices found for this API key. Make sure devices are registered in the Govee Home app.'
        }
      }

      // Use the first device (future: support device selection)
      const device = responseData.data.devices[0]
      const controllerId = device.device

      // Cache device info
      deviceCache.set(controllerId, {
        deviceId: controllerId,
        model: device.model,
        deviceName: device.deviceName,
        controllable: device.controllable,
        retrievable: device.retrievable,
        apiKey,
        lastUpdate: new Date(),
        requestCount: 0,
        requestWindowStart: new Date()
      })

      log('info', `Connected to device: ${device.deviceName} (${device.model})`)

      // Build capabilities
      const capabilities = await this.getDeviceCapabilities(device, apiKey)

      return {
        success: true,
        controllerId,
        metadata: {
          brand: 'govee',
          model: device.model,
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
   * Read sensor values from Govee device
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const cached = deviceCache.get(controllerId)
    if (!cached) {
      throw new Error('Device not connected. Call connect() first.')
    }

    // Check rate limit
    if (!this.checkRateLimit(controllerId)) {
      log('warn', 'Rate limit exceeded', { controllerId })
      throw new Error('Rate limit exceeded. Govee API allows 60 requests per minute per device.')
    }

    try {
      const result = await adapterFetch<GoveeDeviceStateResponse>(
        ADAPTER_NAME,
        `${API_BASE}/devices/state?device=${encodeURIComponent(cached.deviceId)}&model=${encodeURIComponent(cached.model)}`,
        {
          method: 'GET',
          headers: {
            'Govee-API-Key': cached.apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to read device state')
      }

      const responseData = result.data

      if (responseData.code && responseData.code !== 200) {
        const errorMsg = this.mapGoveeErrorCode(responseData.code, responseData.message)
        throw new Error(errorMsg)
      }

      if (!responseData.data || !responseData.data.properties) {
        log('warn', 'No properties in device state response')
        return []
      }

      // Parse sensor readings from properties
      const readings: SensorReading[] = []
      const now = new Date()

      for (const prop of responseData.data.properties) {
        // Temperature sensor
        if (prop.temperature !== undefined) {
          // Govee returns temperature in Celsius
          const fahrenheit = (prop.temperature * 9/5) + 32
          readings.push({
            port: 0,
            type: 'temperature',
            value: Math.round(fahrenheit * 10) / 10,
            unit: 'F',
            timestamp: now,
            isStale: false
          })
        }

        // Humidity sensor
        if (prop.humidity !== undefined) {
          readings.push({
            port: 0,
            type: 'humidity',
            value: Math.round(prop.humidity * 10) / 10,
            unit: '%',
            timestamp: now,
            isStale: false
          })
        }
      }

      // Update cache timestamp
      cached.lastUpdate = now

      log('info', `Read ${readings.length} sensor values from ${controllerId}`)
      return readings

    } catch (error) {
      log('error', 'Failed to read sensors', { error, controllerId })
      throw error
    }
  }

  /**
   * Send control command to Govee device
   */
  async controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult> {
    const cached = deviceCache.get(controllerId)
    if (!cached) {
      return {
        success: false,
        error: 'Device not connected',
        timestamp: new Date()
      }
    }

    if (!cached.controllable) {
      return {
        success: false,
        error: 'This device is not controllable via API',
        timestamp: new Date()
      }
    }

    // Check rate limit
    if (!this.checkRateLimit(controllerId)) {
      log('warn', 'Rate limit exceeded', { controllerId })
      return {
        success: false,
        error: 'Rate limit exceeded. Please wait before sending more commands.',
        timestamp: new Date()
      }
    }

    try {
      // Build command payload
      const cmd = this.buildCommandPayload(command)
      if (!cmd) {
        return {
          success: false,
          error: `Unsupported command type: ${command.type}`,
          timestamp: new Date()
        }
      }

      log('info', `Sending command to ${controllerId}`, { command: command.type, payload: cmd })

      const result = await adapterFetch<GoveeControlResponse>(
        ADAPTER_NAME,
        `${API_BASE}/devices/control`,
        {
          method: 'PUT',
          headers: {
            'Govee-API-Key': cached.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device: cached.deviceId,
            model: cached.model,
            cmd
          })
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

      if (responseData.code && responseData.code !== 200) {
        const errorMsg = this.mapGoveeErrorCode(responseData.code, responseData.message)
        return {
          success: false,
          error: errorMsg,
          timestamp: new Date()
        }
      }

      log('info', 'Command executed successfully', { controllerId })

      return {
        success: true,
        actualValue: command.value,
        timestamp: new Date()
      }

    } catch (error) {
      log('error', 'Control command failed', { error, controllerId })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * Get current device status
   */
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const cached = deviceCache.get(controllerId)
    if (!cached) {
      return {
        status: 'offline',
        lastSeen: new Date()
      }
    }

    if (!cached.retrievable) {
      // Device doesn't support state retrieval, assume online if in cache
      return {
        status: 'online',
        lastSeen: cached.lastUpdate
      }
    }

    // Check rate limit
    if (!this.checkRateLimit(controllerId)) {
      log('warn', 'Rate limit exceeded for status check', { controllerId })
      return {
        status: cached.lastUpdate > new Date(Date.now() - 300000) ? 'online' : 'offline',
        lastSeen: cached.lastUpdate
      }
    }

    try {
      const result = await adapterFetch<GoveeDeviceStateResponse>(
        ADAPTER_NAME,
        `${API_BASE}/devices/state?device=${encodeURIComponent(cached.deviceId)}&model=${encodeURIComponent(cached.model)}`,
        {
          method: 'GET',
          headers: {
            'Govee-API-Key': cached.apiKey,
            'Content-Type': 'application/json',
          },
        },
        { maxRetries: 1, timeoutMs: 5000 }
      )

      const now = new Date()

      if (!result.success || !result.data) {
        return {
          status: 'error',
          lastSeen: cached.lastUpdate,
          errors: [result.error || 'Failed to get device status']
        }
      }

      const responseData = result.data

      if (responseData.code && responseData.code !== 200) {
        return {
          status: 'error',
          lastSeen: cached.lastUpdate,
          errors: [this.mapGoveeErrorCode(responseData.code, responseData.message)]
        }
      }

      // Check if device is online
      const properties = responseData.data?.properties || []
      const onlineProperty = properties.find(p => p.online !== undefined)
      const isOnline = onlineProperty ? onlineProperty.online : true

      cached.lastUpdate = now

      return {
        status: isOnline ? 'online' : 'offline',
        lastSeen: now
      }

    } catch (error) {
      log('error', 'Status check failed', { error, controllerId })
      return {
        status: 'error',
        lastSeen: cached.lastUpdate,
        errors: [error instanceof Error ? error.message : 'Status check failed']
      }
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(controllerId: string): Promise<void> {
    deviceCache.delete(controllerId)
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

  private isGoveeCredentials(creds: ControllerCredentials): creds is GoveeCredentials {
    return 'type' in creds && creds.type === 'govee'
  }

  private checkRateLimit(controllerId: string): boolean {
    const cached = deviceCache.get(controllerId)
    if (!cached) return false

    const now = new Date()
    const timeSinceWindowStart = now.getTime() - cached.requestWindowStart.getTime()

    // Reset window if more than 60 seconds have passed
    if (timeSinceWindowStart >= RATE_LIMIT_WINDOW_MS) {
      cached.requestCount = 0
      cached.requestWindowStart = now
    }

    // Check if we're within the rate limit
    if (cached.requestCount >= RATE_LIMIT_PER_MINUTE) {
      return false
    }

    // Increment request count
    cached.requestCount++
    return true
  }

  private buildCommandPayload(command: DeviceCommand): Record<string, unknown> | null {
    switch (command.type) {
      case 'turn_on':
        return { name: 'turn', value: 'on' }

      case 'turn_off':
        return { name: 'turn', value: 'off' }

      case 'set_level':
        // Govee brightness is 0-100
        return { name: 'brightness', value: Math.max(0, Math.min(100, command.value || 0)) }

      case 'toggle':
        // Toggle not directly supported, default to turn on
        return { name: 'turn', value: 'on' }

      default:
        return null
    }
  }

  private mapGoveeErrorCode(code: number, message?: string): string {
    const errorMap: Record<number, string> = {
      400: 'Bad request. Invalid request parameters.',
      401: 'Unauthorized. Invalid API key. Please check your Govee API key.',
      403: 'Forbidden. API key does not have access to this device.',
      404: 'Device not found. The device may have been removed from your account.',
      429: 'Rate limit exceeded. Please wait before making more requests.',
      500: 'Govee server error. Please try again later.',
      503: 'Govee service unavailable. Please try again later.'
    }

    return errorMap[code] || message || `Govee API error: ${code}`
  }

  private getDeviceSensorCapabilities(model: string): string[] {
    // Models with temperature/humidity sensors
    const sensorModels = ['H5179', 'H5075', 'H5074', 'H5101', 'H5102', 'H5177']

    if (sensorModels.some(m => model.includes(m))) {
      return ['temperature', 'humidity']
    }

    return []
  }

  private getDeviceControlCapabilities(supportCmds: string[]): string[] {
    const capabilities: string[] = []

    if (supportCmds.includes('turn')) {
      capabilities.push('light', 'outlet')
    }

    return capabilities
  }

  private async getDeviceCapabilities(
    device: GoveeDevice,
    apiKey: string
  ): Promise<{
    sensors: SensorCapability[]
    devices: DeviceCapability[]
    supportsDimming: boolean
    supportsScheduling: boolean
    maxPorts: number
  }> {
    const sensors: SensorCapability[] = []
    const devices: DeviceCapability[] = []

    // Check if device has sensor capabilities
    const sensorTypes = this.getDeviceSensorCapabilities(device.model)

    if (sensorTypes.includes('temperature')) {
      sensors.push({
        port: 0,
        type: 'temperature',
        unit: 'F'
      })
    }

    if (sensorTypes.includes('humidity')) {
      sensors.push({
        port: 0,
        type: 'humidity',
        unit: '%'
      })
    }

    // Check controllable devices
    if (device.controllable) {
      const supportsDimming = device.supportCmds.includes('brightness')
      const supportsColor = device.supportCmds.includes('color')

      devices.push({
        port: 1,
        name: device.deviceName,
        type: supportsColor ? 'light' : 'outlet',
        supportsDimming,
        minLevel: 0,
        maxLevel: 100
      })
    }

    return {
      sensors,
      devices,
      supportsDimming: device.supportCmds.includes('brightness'),
      supportsScheduling: false, // Govee API doesn't support schedules
      maxPorts: 1
    }
  }

  private emptyMetadata(): ControllerMetadata {
    return {
      brand: 'govee',
      capabilities: {
        sensors: [],
        devices: [],
        supportsDimming: false,
        supportsScheduling: false,
        maxPorts: 0
      }
    }
  }
}
