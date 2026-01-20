/**
 * AC Infinity Controller Adapter
 * Implements the ControllerAdapter interface for AC Infinity controllers
 * (Controller 69, Controller 67, etc.)
 */

import { BaseControllerAdapter } from './ControllerAdapter'
import type {
  ControllerCredentials,
  ControllerMetadata,
  ControllerStatus,
  DeviceCommand,
  CommandResult,
  SensorCapability,
  DeviceCapability,
} from '../types/controller'
import type { SensorReading } from '../types/sensor'

// AC Infinity API types
interface ACILoginResponse {
  code: number
  msg: string
  data: {
    token: string
    userId: string
  }
}

interface ACIDevice {
  devId: string
  devType: string
  devName: string
  devCode: string
  firmwareVersion?: string
  onlineState: number
}

interface ACIPortData {
  port: number
  devType: number // 10=sensor, 11=UIS outlet, 12=fan
  sensorType?: number // 1=temp, 2=humidity, 3=vpd
  value?: number
  speak?: number // fan speed (0-10)
  loadState?: number // on/off state
}

interface ACIDeviceSettings {
  code: number
  data: {
    devId: string
    portData: ACIPortData[]
  }
}

/**
 * AC Infinity API Adapter
 * Based on reverse-engineered API from AC Infinity mobile app
 */
export class ACInfinityAdapter extends BaseControllerAdapter {
  private readonly apiBase = 'https://www.acinfinityserver.com'
  private tokens = new Map<string, string>()
  private deviceCache = new Map<string, ACIDevice>()

  constructor() {
    super('ACInfinityAdapter')
  }

  async connect(credentials: ControllerCredentials): Promise<ControllerMetadata> {
    const { email, password } = credentials

    if (!email || !password) {
      throw new Error('AC Infinity requires email and password credentials')
    }

    this.log('Connecting to AC Infinity...', { email })

    // Login to AC Infinity API
    const loginResponse = await this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.apiBase}/api/user/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appEmail: email,
            appPasswordl: password, // Note: typo in actual API
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`Login failed with status ${response.status}`)
      }

      return response.json() as Promise<ACILoginResponse>
    })

    if (loginResponse.code !== 200) {
      throw new Error(`AC Infinity login failed: ${loginResponse.msg}`)
    }

    const token = loginResponse.data.token
    this.log('Login successful, fetching devices...')

    // Fetch device list
    const devicesResponse = await this.fetchWithTimeout(
      `${this.apiBase}/api/user/devInfoListAll`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: token,
        },
      }
    )

    if (!devicesResponse.ok) {
      throw new Error('Failed to fetch device list')
    }

    const devicesData = await devicesResponse.json()
    const devices: ACIDevice[] = devicesData.data || []

    if (devices.length === 0) {
      throw new Error('No AC Infinity devices found on this account')
    }

    // Use first device (TODO: enhance to support multiple devices)
    const device = devices[0]
    const controllerId = device.devId

    // Store token and device info
    this.tokens.set(controllerId, token)
    this.deviceCache.set(controllerId, device)

    this.log('Connected to device', { controllerId, model: device.devType })

    // Get device capabilities
    const capabilities = await this.fetchCapabilities(controllerId)

    return {
      controllerId,
      brand: 'ac_infinity',
      model: device.devType,
      firmware: device.firmwareVersion,
      capabilities,
    }
  }

  private async fetchCapabilities(
    controllerId: string
  ): Promise<{ sensors: SensorCapability[]; devices: DeviceCapability[] }> {
    const token = this.tokens.get(controllerId)
    if (!token) {
      throw new Error('Controller not connected')
    }

    const response = await this.fetchWithTimeout(
      `${this.apiBase}/api/dev/getDevSetting`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: token,
        },
        body: JSON.stringify({ devId: controllerId }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch device settings')
    }

    const settings: ACIDeviceSettings = await response.json()
    const portData = settings.data?.portData || []

    const sensors: SensorCapability[] = portData
      .filter((p) => p.devType === 10) // Type 10 = UIS sensor probe
      .flatMap((p) => {
        // Each sensor probe can report multiple values
        const capabilities: SensorCapability[] = []

        // Temperature sensor
        capabilities.push({
          port: p.port,
          type: 'temperature',
          unit: 'F',
          name: `Sensor ${p.port} - Temperature`,
        })

        // Humidity sensor
        capabilities.push({
          port: p.port,
          type: 'humidity',
          unit: '%',
          name: `Sensor ${p.port} - Humidity`,
        })

        // VPD (calculated)
        capabilities.push({
          port: p.port,
          type: 'vpd',
          unit: 'kPa',
          name: `Sensor ${p.port} - VPD`,
        })

        return capabilities
      })

    const devices: DeviceCapability[] = portData
      .filter((p) => [11, 12].includes(p.devType)) // 11=UIS outlet, 12=fan
      .map((p) => ({
        port: p.port,
        type: p.devType === 12 ? ('fan' as const) : ('light' as const),
        name: `Port ${p.port}`,
        supportsDimming: true,
        minLevel: 0,
        maxLevel: 10, // AC Infinity uses 0-10 scale
      }))

    return { sensors, devices }
  }

  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const token = this.tokens.get(controllerId)
    if (!token) {
      throw new Error('Controller not connected')
    }

    const response = await this.retryWithBackoff(async () => {
      const res = await this.fetchWithTimeout(
        `${this.apiBase}/api/dev/getDevSetting`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            token: token,
          },
          body: JSON.stringify({ devId: controllerId }),
        }
      )

      if (!res.ok) {
        throw new Error(`Failed to read sensors: ${res.status}`)
      }

      return res.json() as Promise<ACIDeviceSettings>
    })

    const portData = response.data?.portData || []
    const readings: SensorReading[] = []
    const now = new Date()

    // Process sensor ports
    for (const port of portData) {
      if (port.devType !== 10 || port.value === null || port.value === undefined) {
        continue
      }

      // AC Infinity returns sensors with different types in the same port
      // We need to parse based on sensorType
      const sensorType = port.sensorType

      if (sensorType === 1) {
        // Temperature
        readings.push({
          port: port.port,
          type: 'temperature',
          value: port.value, // Already in Fahrenheit
          unit: 'F',
          timestamp: now,
        })
      } else if (sensorType === 2) {
        // Humidity
        readings.push({
          port: port.port,
          type: 'humidity',
          value: port.value,
          unit: '%',
          timestamp: now,
        })
      } else if (sensorType === 3) {
        // VPD (value is kPa * 10)
        readings.push({
          port: port.port,
          type: 'vpd',
          value: port.value / 10,
          unit: 'kPa',
          timestamp: now,
        })
      }
    }

    this.log(`Read ${readings.length} sensor values`, { controllerId })
    return readings
  }

  async controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult> {
    const token = this.tokens.get(controllerId)
    if (!token) {
      return {
        success: false,
        error: 'Controller not connected',
      }
    }

    // Convert command to AC Infinity format
    let power: number
    if (command.type === 'set_level') {
      // Map 0-100 to AC Infinity's 0-10 scale
      power = Math.round((command.value || 0) / 10)
      power = Math.max(0, Math.min(10, power)) // Clamp to valid range
    } else if (command.type === 'turn_on') {
      power = 10
    } else {
      power = 0
    }

    this.log(`Setting port ${port} to power level ${power}`, { controllerId })

    try {
      const response = await this.retryWithBackoff(async () => {
        return this.fetchWithTimeout(
          `${this.apiBase}/api/dev/updateDevPort`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              token: token,
            },
            body: JSON.stringify({
              devId: controllerId,
              port,
              speak: power, // Fan speed
              loadState: power > 0 ? 1 : 0, // On/off state
            }),
          }
        )
      })

      if (!response.ok) {
        return {
          success: false,
          error: `API returned status ${response.status}`,
        }
      }

      const result = await response.json()

      return {
        success: result.code === 200,
        error: result.code !== 200 ? result.msg : undefined,
        currentState: {
          port,
          level: power * 10, // Convert back to 0-100
          isOn: power > 0,
        },
      }
    } catch (error) {
      this.logError('Control device failed', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const token = this.tokens.get(controllerId)
    if (!token) {
      return {
        isOnline: false,
        lastSeen: new Date(),
      }
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBase}/api/dev/getDevSetting`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            token: token,
          },
          body: JSON.stringify({ devId: controllerId }),
        },
        5000 // Short timeout for status check
      )

      const device = this.deviceCache.get(controllerId)

      return {
        isOnline: response.ok,
        lastSeen: new Date(),
        firmware: device?.firmwareVersion,
      }
    } catch {
      return {
        isOnline: false,
        lastSeen: new Date(),
      }
    }
  }

  async disconnect(controllerId: string): Promise<void> {
    this.tokens.delete(controllerId)
    this.deviceCache.delete(controllerId)
    this.log('Disconnected', { controllerId })
  }

  async refreshAuth(controllerId: string): Promise<boolean> {
    // AC Infinity tokens may expire, but we can use stored credentials
    // For now, return true as tokens seem to be long-lived
    return this.tokens.has(controllerId)
  }
}
