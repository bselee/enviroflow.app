/**
 * AC Infinity Controller Adapter
 * 
 * Supports:
 * - Controller 69 (flagship model)
 * - Controller 67 (budget model)
 * - UIS series inline fans
 * - UIS series LED lights with dimming
 * 
 * API: Reverse-engineered REST API
 * Base URL: https://www.acinfinityserver.com
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
} from './types'

const API_BASE = 'https://www.acinfinityserver.com'

// Token storage (in production, use proper session management)
const tokenStore = new Map<string, { token: string; expiresAt: Date }>()

// ============================================
// AC Infinity API Response Types
// ============================================

interface ACLoginResponse {
  code: number
  msg: string
  data?: {
    token: string
    userId: string
    email: string
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
}

interface ACDeviceSettingResponse {
  code: number
  msg: string
  data?: {
    devId: string
    portData: ACPort[]
    sensorData?: ACSensor[]
  }
}

interface ACPort {
  portId: number
  portName: string
  portType: number      // 1=fan, 2=light, 3=outlet
  devType: number       // Device type on this port
  isSupport: boolean
  supportDim: number    // 1=supports dimming
  onOff: number         // 0=off, 1=on
  speak: number         // Fan speed 0-10
  surplus: number       // Current level
}

interface ACSensor {
  sensorType: number    // 1=temp, 2=humidity, 3=vpd
  sensorName: string
  value: number
  unit: string
}

// ============================================
// AC Infinity Adapter Implementation
// ============================================

export class ACInfinityAdapter implements ControllerAdapter {
  
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

    const { email, password } = credentials

    try {
      // Step 1: Login to get token
      const loginResponse = await fetch(`${API_BASE}/api/user/login`, {
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

      const loginData: ACLoginResponse = await loginResponse.json()

      if (loginData.code !== 200 || !loginData.data?.token) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: loginData.msg || 'Login failed: No token received'
        }
      }

      const token = loginData.data.token

      // Step 2: Get device list
      const devicesResponse = await fetch(`${API_BASE}/api/user/devInfoListAll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'EnviroFlow/1.0'
        }
      })

      const devicesData: ACDeviceListResponse = await devicesResponse.json()

      if (!devicesData.data || devicesData.data.length === 0) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'No AC Infinity devices found for this account'
        }
      }

      // Use the first device (future: support multiple devices)
      const device = devicesData.data[0]
      const controllerId = device.devId

      // Store token with 24-hour expiry
      tokenStore.set(controllerId, {
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      // Step 3: Get device capabilities
      const capabilities = await this.getDeviceCapabilities(controllerId, token)

      return {
        success: true,
        controllerId,
        metadata: {
          brand: 'ac_infinity',
          model: device.devName || 'Controller 69',
          firmwareVersion: device.firmwareVersion,
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
   * Read all sensor values from controller
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const token = this.getToken(controllerId)
    if (!token) {
      throw new Error('Controller not connected. Call connect() first.')
    }

    try {
      const response = await fetch(`${API_BASE}/api/dev/getDevSetting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'EnviroFlow/1.0'
        },
        body: JSON.stringify({ devId: controllerId })
      })

      const data: ACDeviceSettingResponse = await response.json()

      if (!data.data) {
        return []
      }

      const readings: SensorReading[] = []
      const now = new Date()

      // Process sensor probes
      if (data.data.sensorData) {
        for (const sensor of data.data.sensorData) {
          readings.push({
            port: 0, // Sensors don't have port numbers in AC Infinity
            type: this.mapSensorType(sensor.sensorType),
            value: this.convertSensorValue(sensor.value, sensor.sensorType),
            unit: this.mapSensorUnit(sensor.sensorType),
            timestamp: now,
            isStale: false
          })
        }
      }

      // Process port-based sensors (some devices report via portData)
      for (const port of data.data.portData) {
        if (port.devType === 10) { // Sensor probe type
          readings.push({
            port: port.portId,
            type: 'temperature', // Default, would need more data to determine
            value: port.surplus,
            unit: 'F',
            timestamp: now,
            isStale: false
          })
        }
      }

      return readings

    } catch (error) {
      throw new Error(`Failed to read sensors: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send control command to device
   */
  async controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult> {
    const token = this.getToken(controllerId)
    if (!token) {
      return {
        success: false,
        error: 'Controller not connected',
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
          // Would need current state - default to on
          power = 10
          break
        default:
          power = 0
      }

      const response = await fetch(`${API_BASE}/api/dev/updateDevPort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'EnviroFlow/1.0'
        },
        body: JSON.stringify({
          devId: controllerId,
          portId: port,
          power
        })
      })

      const result = await response.json()

      return {
        success: result.code === 200,
        error: result.code !== 200 ? result.msg : undefined,
        actualValue: power * 10, // Convert back to 0-100
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
   * Get current controller status
   */
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const token = this.getToken(controllerId)
    
    if (!token) {
      return {
        isOnline: false,
        lastSeen: new Date()
      }
    }

    try {
      const response = await fetch(`${API_BASE}/api/dev/getDevSetting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'EnviroFlow/1.0'
        },
        body: JSON.stringify({ devId: controllerId })
      })

      const isOnline = response.ok

      return {
        isOnline,
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
   * Disconnect and cleanup
   */
  async disconnect(controllerId: string): Promise<void> {
    tokenStore.delete(controllerId)
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private isACInfinityCredentials(creds: ControllerCredentials): creds is ACInfinityCredentials {
    return 'type' in creds && creds.type === 'ac_infinity'
  }

  private getToken(controllerId: string): string | null {
    const stored = tokenStore.get(controllerId)
    if (!stored) return null
    if (stored.expiresAt < new Date()) {
      tokenStore.delete(controllerId)
      return null
    }
    return stored.token
  }

  private async getDeviceCapabilities(controllerId: string, token: string) {
    try {
      const response = await fetch(`${API_BASE}/api/dev/getDevSetting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'EnviroFlow/1.0'
        },
        body: JSON.stringify({ devId: controllerId })
      })

      const data: ACDeviceSettingResponse = await response.json()
      
      const sensors: SensorCapability[] = []
      const devices: DeviceCapability[] = []
      let supportsDimming = false

      if (data.data?.sensorData) {
        for (const sensor of data.data.sensorData) {
          sensors.push({
            port: 0,
            name: sensor.sensorName,
            type: this.mapSensorType(sensor.sensorType),
            unit: this.mapSensorUnit(sensor.sensorType)
          })
        }
      }

      if (data.data?.portData) {
        for (const port of data.data.portData) {
          if (port.devType !== 10) { // Not a sensor probe
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
          }
        }
      }

      return {
        sensors,
        devices,
        supportsDimming,
        supportsScheduling: true,
        maxPorts: data.data?.portData?.length || 4
      }

    } catch {
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
    const map: Record<number, DeviceType> = {
      1: 'fan',
      2: 'light',
      3: 'outlet',
      4: 'heater',
      5: 'humidifier'
    }
    return map[acType] || 'outlet'
  }

  private convertSensorValue(value: number, acType: number): number {
    // VPD is reported as kPa * 10 (e.g., 9 = 0.9 kPa)
    if (acType === 3) {
      return value / 10
    }
    return value
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
