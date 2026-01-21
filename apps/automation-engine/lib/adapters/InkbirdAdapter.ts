/**
 * Inkbird Controller Adapter
 *
 * Supports:
 * - ITC-308 WiFi Temperature Controller
 * - ITC-310T WiFi Temperature Controller
 * - IHC-200 WiFi Humidity Controller
 *
 * IMPORTANT: Inkbird WiFi devices use the Tuya IoT platform for cloud connectivity.
 * There is NO direct Inkbird cloud API that accepts email/password authentication.
 *
 * Integration Options:
 * 1. Tuya Cloud API: Requires developer account at iot.tuya.com with Access ID & Secret
 * 2. Local Tuya Control: Requires device ID, IP, and local key (complex setup)
 * 3. CSV Upload: Manual data entry as fallback (currently recommended)
 *
 * Current Status: This adapter is a PLACEHOLDER. Email/password login will NOT work
 * because Inkbird uses Tuya's infrastructure, not their own API.
 *
 * For working integration, users should:
 * 1. Use Home Assistant with Tuya integration
 * 2. Use CSV Upload adapter for manual data entry
 * 3. Wait for future Tuya API integration
 *
 * References:
 * - https://community.inkbird.com/t/is-there-a-public-api-to-use-with-itc-308-wifi/148
 * - https://github.com/rospogrigio/localtuya
 * - https://github.com/make-all/tuya-local
 */

import type {
  ControllerAdapter,
  ControllerCredentials,
  InkbirdCredentials,
  ConnectionResult,
  ControllerMetadata,
  SensorReading,
  DeviceCommand,
  CommandResult,
  ControllerStatus,
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

// NOTE: This API base is a placeholder. Inkbird uses Tuya platform, not their own API.
// Direct email/password authentication will NOT work.
// See adapter header comments for integration options.
const API_BASE = 'https://api.inkbird.com' // DOES NOT EXIST - Inkbird uses Tuya
const ADAPTER_NAME = 'inkbird'

// Error message for users attempting to use this adapter
const TUYA_DEPENDENCY_ERROR = `
Inkbird WiFi devices use the Tuya IoT platform for cloud connectivity.
Direct email/password login is not supported.

Options:
1. Use CSV Upload adapter for manual data entry
2. Use Home Assistant with Tuya integration
3. Wait for future Tuya API integration in EnviroFlow

For more information, see: https://community.inkbird.com/t/is-there-a-public-api-to-use-with-itc-308-wifi/148
`.trim()

// Token storage
const tokenStore = new Map<string, {
  token: string
  userId: string
  expiresAt: Date
}>()

// ============================================
// Inkbird API Response Types
// ============================================

interface InkbirdLoginResponse {
  code: number
  message: string
  data?: {
    token: string
    userId: string
  }
}

interface InkbirdDeviceListResponse {
  code: number
  message: string
  data?: InkbirdDevice[]
}

interface InkbirdDevice {
  deviceId: string
  deviceName: string
  deviceType: string  // 'ITC-308', 'ITC-310T', 'IHC-200'
  online: boolean
  lastUpdate?: number
}

interface InkbirdDeviceDataResponse {
  code: number
  message: string
  data?: {
    temperature: number
    humidity?: number
    heatingOn: boolean
    coolingOn: boolean
    setPoint: number
    calibration: number
    alarmHigh: number
    alarmLow: number
  }
}

interface InkbirdCommandResponse {
  code: number
  message: string
  data?: unknown
}

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[InkbirdAdapter][${timestamp}]`

  if (level === 'error') {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

// ============================================
// Inkbird Adapter Implementation
// ============================================

export class InkbirdAdapter implements ControllerAdapter, DiscoverableAdapter {

  /**
   * Discover all Inkbird devices associated with the given credentials.
   * This queries the Inkbird cloud API to list all registered devices.
   */
  async discoverDevices(credentials: DiscoveryCredentials): Promise<DiscoveryResult> {
    const { email, password } = credentials

    log('info', 'Starting device discovery', { email: email.replace(/(.{2}).*(@.*)/, '$1***$2') })

    try {
      // Step 1: Login
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

      // Step 2: Get all devices
      const devicesResult = await adapterFetch<InkbirdDeviceListResponse>(
        ADAPTER_NAME,
        `${API_BASE}/v1/device/list`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
          }
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

      // Inkbird uses code 0 for success
      if (devicesData.code !== 0) {
        log('error', 'API returned error code', { code: devicesData.code, message: devicesData.message })
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: devicesData.message || `API error: ${devicesData.code}`,
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

      // Step 3: Map Inkbird devices to DiscoveredDevice format
      const discoveredDevices: DiscoveredDevice[] = devicesData.data.map((device) => {
        const capabilities = this.getCapabilitiesForModel(device.deviceType)

        return {
          deviceId: device.deviceId,
          name: device.deviceName || `Inkbird ${device.deviceType}`,
          brand: 'inkbird' as const,
          model: device.deviceType,
          isOnline: device.online,
          lastSeen: device.lastUpdate ? new Date(device.lastUpdate * 1000) : undefined,
          isAlreadyRegistered: false,
          capabilities: {
            sensors: capabilities.sensors.map(s => s.type),
            devices: capabilities.devices.map(d => d.type),
            supportsDimming: capabilities.supportsDimming
          }
        }
      })

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
   * Login to Inkbird cloud
   *
   * NOTE: This method will ALWAYS FAIL because Inkbird uses Tuya's platform,
   * not their own API. The api.inkbird.com endpoint does not exist.
   *
   * This is kept as a placeholder for future Tuya integration.
   */
  private async login(email: string, password: string): Promise<{
    success: boolean
    token?: string
    userId?: string
    error?: string
  }> {
    log('warn', 'Inkbird login attempted - this will fail due to Tuya dependency', {
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2')
    })

    // Return early with informative error - don't waste time trying to connect
    // to a non-existent API endpoint
    log('error', 'Inkbird uses Tuya platform - direct login not supported')
    return {
      success: false,
      error: TUYA_DEPENDENCY_ERROR
    }

    // NOTE: The code below is kept for reference in case Inkbird ever provides
    // their own API, but it is unreachable.
    /*
    const result = await adapterFetch<InkbirdLoginResponse>(
      ADAPTER_NAME,
      `${API_BASE}/v1/user/login`,
      {
        method: 'POST',
        body: JSON.stringify({ email, password })
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

    // Inkbird uses code 0 for success
    if (loginData.code !== 0) {
      log('error', 'Login returned error', { code: loginData.code, message: loginData.message })

      let errorMessage = loginData.message || 'Login failed'
      if (loginData.message?.toLowerCase().includes('password')) {
        errorMessage = 'Invalid email or password. Please check your Inkbird account credentials.'
      } else if (loginData.message?.toLowerCase().includes('email') || loginData.message?.toLowerCase().includes('user')) {
        errorMessage = 'Email not found. Please check your Inkbird account email.'
      }

      return {
        success: false,
        error: errorMessage
      }
    }

    if (!loginData.data?.token) {
      log('error', 'Login succeeded but no token in response')
      return {
        success: false,
        error: 'Login succeeded but server did not return authentication token'
      }
    }

    log('info', 'Login successful')
    return {
      success: true,
      token: loginData.data.token,
      userId: loginData.data.userId
    }
    */
  }

  /**
   * Connect to Inkbird cloud and get device info
   */
  async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
    if (!this.isInkbirdCredentials(credentials)) {
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: 'Invalid credentials type. Expected Inkbird credentials.'
      }
    }

    const { email, password } = credentials

    try {
      // Step 1: Login
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
      const devicesResult = await adapterFetch<InkbirdDeviceListResponse>(
        ADAPTER_NAME,
        `${API_BASE}/v1/device/list`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
          }
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

      if (devicesData.code !== 0 || !devicesData.data || devicesData.data.length === 0) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: devicesData.message || 'No Inkbird devices found for this account. Make sure you have registered devices in the Inkbird app.'
        }
      }

      // Use the first device
      const device = devicesData.data[0]
      const controllerId = device.deviceId

      // Store token with 24-hour expiry
      tokenStore.set(controllerId, {
        token: loginResult.token,
        userId: loginResult.userId || '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      log('info', `Connected to device: ${device.deviceName} (${controllerId})`)

      // Build capabilities based on device type
      const capabilities = this.getCapabilitiesForModel(device.deviceType)

      return {
        success: true,
        controllerId,
        metadata: {
          brand: 'inkbird',
          model: device.deviceType,
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
   * Read sensor values
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

    const result = await adapterFetch<InkbirdDeviceDataResponse>(
      ADAPTER_NAME,
      `${API_BASE}/v1/device/${controllerId}/data`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stored.token}`,
        }
      }
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read sensor data')
    }

    const data = result.data

    if (data.code !== 0 || !data.data) {
      throw new Error(data.message || 'Failed to get device data')
    }

    const readings: SensorReading[] = []
    const now = new Date()

    // Temperature (all Inkbird devices have this)
    readings.push({
      port: 1,
      type: 'temperature',
      value: data.data.temperature,
      unit: 'F',
      timestamp: now,
      isStale: false
    })

    // Humidity (only IHC-200 and some models)
    if (data.data.humidity !== undefined) {
      readings.push({
        port: 2,
        type: 'humidity',
        value: data.data.humidity,
        unit: '%',
        timestamp: now,
        isStale: false
      })
    }

    log('info', `Read ${readings.length} sensor values from ${controllerId}`)
    return readings
  }

  /**
   * Control device (set temperature setpoint, trigger heating/cooling)
   */
  async controlDevice(
    controllerId: string,
    _port: number,
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

    try {
      let endpoint: string
      let body: Record<string, unknown>

      if (command.type === 'set_level' && command.value !== undefined) {
        // Interpret as setting temperature setpoint
        // Value is 0-100, map to reasonable temp range (60-90°F)
        const setPoint = 60 + (command.value / 100) * 30

        endpoint = `${API_BASE}/v1/device/${controllerId}/setpoint`
        body = { setPoint: Math.round(setPoint) }
      } else if (command.type === 'turn_on') {
        endpoint = `${API_BASE}/v1/device/${controllerId}/power`
        body = { power: true }
      } else if (command.type === 'turn_off') {
        endpoint = `${API_BASE}/v1/device/${controllerId}/power`
        body = { power: false }
      } else {
        return {
          success: false,
          error: 'Unsupported command type for Inkbird. Use set_level for temperature setpoint.',
          timestamp: new Date()
        }
      }

      log('info', `Sending command to ${controllerId}`, { endpoint, body })

      const result = await adapterFetch<InkbirdCommandResponse>(
        ADAPTER_NAME,
        endpoint,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stored.token}`,
          },
          body: JSON.stringify(body)
        }
      )

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Command failed',
          timestamp: new Date()
        }
      }

      return {
        success: result.data.code === 0,
        error: result.data.code !== 0 ? result.data.message : undefined,
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
   * Get controller status
   */
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const stored = tokenStore.get(controllerId)

    if (!stored || stored.expiresAt < new Date()) {
      return {
        isOnline: false,
        lastSeen: new Date()
      }
    }

    try {
      const result = await adapterFetch<{ code: number; data?: { online?: boolean } }>(
        ADAPTER_NAME,
        `${API_BASE}/v1/device/${controllerId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stored.token}`,
          }
        },
        { maxRetries: 1, timeoutMs: 5000 }
      )

      return {
        isOnline: result.success && result.data?.data?.online !== false,
        lastSeen: new Date()
      }

    } catch {
      return {
        isOnline: false,
        lastSeen: new Date()
      }
    }
  }

  /**
   * Disconnect
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

  private isInkbirdCredentials(creds: ControllerCredentials): creds is InkbirdCredentials {
    return 'type' in creds && creds.type === 'inkbird'
  }

  private getCapabilitiesForModel(model: string) {
    const sensors: SensorCapability[] = []
    const devices: DeviceCapability[] = []

    // All Inkbird controllers have temperature
    sensors.push({
      port: 1,
      name: 'Temperature Probe',
      type: 'temperature',
      unit: 'F',
      minValue: -40,
      maxValue: 212
    })

    // IHC-200 also has humidity
    if (model.includes('IHC')) {
      sensors.push({
        port: 2,
        name: 'Humidity Sensor',
        type: 'humidity',
        unit: '%',
        minValue: 0,
        maxValue: 100
      })
    }

    // ITC-308/310T have heating and cooling relays
    if (model.includes('ITC-308') || model.includes('ITC-310')) {
      devices.push({
        port: 1,
        name: 'Heating Relay',
        type: 'heater',
        supportsDimming: false,
        isOn: false
      })
      devices.push({
        port: 2,
        name: 'Cooling Relay',
        type: 'cooler',
        supportsDimming: false,
        isOn: false
      })
    }

    // IHC-200 has humidifier/dehumidifier relays
    if (model.includes('IHC')) {
      devices.push({
        port: 1,
        name: 'Humidifier Relay',
        type: 'humidifier',
        supportsDimming: false,
        isOn: false
      })
      devices.push({
        port: 2,
        name: 'Dehumidifier Relay',
        type: 'dehumidifier',
        supportsDimming: false,
        isOn: false
      })
    }

    return {
      sensors,
      devices,
      supportsDimming: false,
      supportsScheduling: true,
      maxPorts: 2
    }
  }

  private emptyMetadata(): ControllerMetadata {
    return {
      brand: 'inkbird',
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
