/**
 * Inkbird Controller Adapter
 * 
 * Supports:
 * - ITC-308 WiFi Temperature Controller
 * - ITC-310T WiFi Temperature Controller
 * - IHC-200 WiFi Humidity Controller
 * 
 * API: Unofficial WiFi API (reverse-engineered)
 * Note: Inkbird devices primarily do temperature control with heating/cooling relays
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

// Inkbird cloud API (unofficial)
const API_BASE = 'https://api.inkbird.com'

// Token storage
const tokenStore = new Map<string, { token: string; userId: string; expiresAt: Date }>()

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

// ============================================
// Inkbird Adapter Implementation
// ============================================

export class InkbirdAdapter implements ControllerAdapter, DiscoverableAdapter {

  /**
   * Discover all Inkbird devices associated with the given credentials.
   * This queries the Inkbird cloud API to list all registered devices.
   *
   * @param credentials - User's Inkbird account credentials
   * @returns Discovery result with list of all devices
   */
  async discoverDevices(credentials: DiscoveryCredentials): Promise<DiscoveryResult> {
    const { email, password } = credentials

    try {
      // Step 1: Login
      const loginResponse = await fetch(`${API_BASE}/v1/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EnviroFlow/1.0'
        },
        body: JSON.stringify({ email, password })
      })

      if (!loginResponse.ok) {
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: `Login failed: HTTP ${loginResponse.status}`,
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      const loginData: InkbirdLoginResponse = await loginResponse.json()

      if (loginData.code !== 0 || !loginData.data?.token) {
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: loginData.message || 'Login failed: Invalid credentials',
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      const token = loginData.data.token

      // Step 2: Get all devices
      const devicesResponse = await fetch(`${API_BASE}/v1/device/list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'EnviroFlow/1.0'
        }
      })

      const devicesData: InkbirdDeviceListResponse = await devicesResponse.json()

      if (!devicesData.data || devicesData.data.length === 0) {
        return {
          success: true,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

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
          isAlreadyRegistered: false, // Will be updated by caller if needed
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
        alreadyRegisteredCount: 0, // Will be calculated by caller
        timestamp: new Date(),
        source: 'cloud_api'
      }

    } catch (error) {
      return {
        success: false,
        devices: [],
        totalDevices: 0,
        alreadyRegisteredCount: 0,
        error: error instanceof Error ? error.message : 'Discovery failed due to network error',
        timestamp: new Date(),
        source: 'cloud_api'
      }
    }
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
      const loginResponse = await fetch(`${API_BASE}/v1/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EnviroFlow/1.0'
        },
        body: JSON.stringify({ email, password })
      })

      if (!loginResponse.ok) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: `Login failed: HTTP ${loginResponse.status}`
        }
      }

      const loginData: InkbirdLoginResponse = await loginResponse.json()

      if (loginData.code !== 0 || !loginData.data?.token) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: loginData.message || 'Login failed: No token received'
        }
      }

      const { token, userId } = loginData.data

      // Step 2: Get device list
      const devicesResponse = await fetch(`${API_BASE}/v1/device/list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'EnviroFlow/1.0'
        }
      })

      const devicesData: InkbirdDeviceListResponse = await devicesResponse.json()

      if (!devicesData.data || devicesData.data.length === 0) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'No Inkbird devices found for this account'
        }
      }

      // Use the first device
      const device = devicesData.data[0]
      const controllerId = device.deviceId

      // Store token with 24-hour expiry
      tokenStore.set(controllerId, {
        token,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

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

    try {
      const response = await fetch(`${API_BASE}/v1/device/${controllerId}/data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stored.token}`,
          'User-Agent': 'EnviroFlow/1.0'
        }
      })

      const data: InkbirdDeviceDataResponse = await response.json()

      if (!data.data) {
        return []
      }

      const readings: SensorReading[] = []
      const now = new Date()

      // Temperature (all Inkbird devices have this)
      readings.push({
        port: 1,
        type: 'temperature',
        value: data.data.temperature,
        unit: 'F', // Inkbird reports in user's preferred unit
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

      return readings

    } catch (error) {
      throw new Error(`Failed to read sensors: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Control device (set temperature setpoint, trigger heating/cooling)
   * 
   * Note: Inkbird ITC-308/310T are primarily thermostat-based controllers.
   * You set a target temperature and the device automatically controls
   * heating/cooling relays. Direct relay control may not be available.
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
      // Inkbird primarily uses setpoint control
      // port 1 = heating relay, port 2 = cooling relay
      // But most control is done via temperature setpoint

      let endpoint: string
      let body: Record<string, unknown>

      if (command.type === 'set_level' && command.value !== undefined) {
        // Interpret as setting temperature setpoint
        // Value is 0-100, map to reasonable temp range (60-90°F)
        const setPoint = 60 + (command.value / 100) * 30

        endpoint = `${API_BASE}/v1/device/${controllerId}/setpoint`
        body = { setPoint: Math.round(setPoint) }
      } else if (command.type === 'turn_on') {
        // Enable the device
        endpoint = `${API_BASE}/v1/device/${controllerId}/power`
        body = { power: true }
      } else if (command.type === 'turn_off') {
        // Disable the device
        endpoint = `${API_BASE}/v1/device/${controllerId}/power`
        body = { power: false }
      } else {
        return {
          success: false,
          error: 'Unsupported command type for Inkbird. Use set_level for temperature setpoint.',
          timestamp: new Date()
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${stored.token}`,
          'User-Agent': 'EnviroFlow/1.0'
        },
        body: JSON.stringify(body)
      })

      const result = await response.json()

      return {
        success: result.code === 0,
        error: result.code !== 0 ? result.message : undefined,
        timestamp: new Date()
      }

    } catch (error) {
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
      const response = await fetch(`${API_BASE}/v1/device/${controllerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stored.token}`,
          'User-Agent': 'EnviroFlow/1.0'
        }
      })

      const data = await response.json()

      return {
        isOnline: data.data?.online ?? false,
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
      supportsDimming: false, // Inkbird doesn't support dimming
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
