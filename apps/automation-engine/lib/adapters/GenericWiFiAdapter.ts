/**
 * Generic WiFi Controller Adapter
 * A flexible adapter for generic REST API-based controllers
 *
 * This adapter allows users to connect to any WiFi controller
 * that exposes a REST API, by providing custom endpoint configuration.
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
import type { SensorReading, SensorType } from '../types/sensor'

interface GenericWiFiConfig {
  apiBase: string
  apiKey?: string
  authHeader?: string
  authType?: 'bearer' | 'api-key' | 'basic' | 'none'
  endpoints: {
    sensors?: string
    control?: string
    status?: string
    capabilities?: string
  }
  // Optional response mapping configuration
  responseMapping?: {
    sensors?: {
      dataPath?: string // JSON path to sensor array
      portField?: string
      typeField?: string
      valueField?: string
      unitField?: string
    }
  }
}

/**
 * Generic WiFi Controller Adapter
 *
 * Supports any REST API-based controller by allowing users to configure:
 * - Base URL
 * - Authentication method
 * - Endpoint paths
 * - Response parsing
 */
export class GenericWiFiAdapter extends BaseControllerAdapter {
  private configs = new Map<string, GenericWiFiConfig>()

  constructor() {
    super('GenericWiFiAdapter')
  }

  async connect(credentials: ControllerCredentials): Promise<ControllerMetadata> {
    const {
      apiBase,
      apiKey,
      endpoints,
      controllerId: providedId,
      authType = 'bearer',
    } = credentials

    if (!apiBase) {
      throw new Error('Generic WiFi adapter requires apiBase URL')
    }

    if (!endpoints || typeof endpoints !== 'object') {
      throw new Error('Generic WiFi adapter requires endpoints configuration')
    }

    const controllerId = providedId || this.generateControllerId(apiBase)

    const config: GenericWiFiConfig = {
      apiBase: apiBase.replace(/\/$/, ''), // Remove trailing slash
      apiKey,
      authType: authType as GenericWiFiConfig['authType'],
      endpoints: endpoints as GenericWiFiConfig['endpoints'],
    }

    this.log('Connecting to generic WiFi controller...', { apiBase })

    // Test connection
    const statusEndpoint = config.endpoints.status || config.endpoints.sensors || '/status'
    const headers = this.buildAuthHeaders(config)

    try {
      const response = await this.fetchWithTimeout(
        `${config.apiBase}${statusEndpoint}`,
        { headers }
      )

      if (!response.ok) {
        throw new Error(`Connection test failed with status ${response.status}`)
      }

      // Store config
      this.configs.set(controllerId, config)

      // Try to fetch capabilities if endpoint is provided
      let capabilities = await this.fetchCapabilities(controllerId, config)

      // If no capabilities endpoint, provide defaults
      if (!capabilities) {
        capabilities = {
          sensors: [],
          devices: [],
        }
      }

      this.log('Connected successfully', { controllerId })

      return {
        controllerId,
        brand: 'generic_wifi',
        capabilities,
      }
    } catch (error) {
      this.logError('Connection failed', error)
      throw new Error(
        `Failed to connect to generic WiFi controller: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private async fetchCapabilities(
    controllerId: string,
    config: GenericWiFiConfig
  ): Promise<{ sensors: SensorCapability[]; devices: DeviceCapability[] } | null> {
    if (!config.endpoints.capabilities) {
      return null
    }

    try {
      const headers = this.buildAuthHeaders(config)
      const response = await this.fetchWithTimeout(
        `${config.apiBase}${config.endpoints.capabilities}`,
        { headers }
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()

      // Try to parse capabilities from response
      // This is a best-effort parsing that may need customization
      const sensors: SensorCapability[] = []
      const devices: DeviceCapability[] = []

      if (Array.isArray(data.sensors)) {
        for (const sensor of data.sensors) {
          sensors.push({
            port: sensor.port || 0,
            type: this.mapSensorType(sensor.type),
            unit: sensor.unit || '',
            name: sensor.name,
          })
        }
      }

      if (Array.isArray(data.devices)) {
        for (const device of data.devices) {
          devices.push({
            port: device.port || 0,
            type: device.type || 'relay',
            name: device.name,
            supportsDimming: device.supportsDimming ?? false,
            minLevel: device.minLevel ?? 0,
            maxLevel: device.maxLevel ?? 100,
          })
        }
      }

      return { sensors, devices }
    } catch (error) {
      this.log('Could not fetch capabilities, using defaults', error)
      return null
    }
  }

  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const config = this.configs.get(controllerId)
    if (!config) {
      throw new Error('Controller not configured')
    }

    if (!config.endpoints.sensors) {
      this.log('No sensors endpoint configured')
      return []
    }

    const headers = this.buildAuthHeaders(config)
    const response = await this.retryWithBackoff(async () => {
      return this.fetchWithTimeout(`${config.apiBase}${config.endpoints.sensors}`, {
        headers,
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to read sensors: ${response.status}`)
    }

    const data = await response.json()
    const readings: SensorReading[] = []
    const now = new Date()

    // Parse response based on mapping or default structure
    const mapping = config.responseMapping?.sensors
    const sensorsArray = mapping?.dataPath
      ? this.getNestedValue(data, mapping.dataPath)
      : Array.isArray(data)
        ? data
        : data.sensors || data.readings || []

    if (Array.isArray(sensorsArray)) {
      for (const sensor of sensorsArray) {
        readings.push({
          port: sensor[mapping?.portField || 'port'] || 0,
          type: this.mapSensorType(sensor[mapping?.typeField || 'type']),
          value: parseFloat(sensor[mapping?.valueField || 'value']) || 0,
          unit: sensor[mapping?.unitField || 'unit'] || '',
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
    const config = this.configs.get(controllerId)
    if (!config) {
      return {
        success: false,
        error: 'Controller not configured',
      }
    }

    if (!config.endpoints.control) {
      return {
        success: false,
        error: 'No control endpoint configured',
      }
    }

    const headers = this.buildAuthHeaders(config)
    headers['Content-Type'] = 'application/json'

    // Build generic control payload
    const payload: Record<string, unknown> = {
      port,
      command: command.type,
    }

    if (command.type === 'set_level' && command.value !== undefined) {
      payload.value = command.value
      payload.level = command.value
    } else if (command.type === 'turn_on') {
      payload.state = 'on'
      payload.value = 100
    } else if (command.type === 'turn_off') {
      payload.state = 'off'
      payload.value = 0
    }

    try {
      const response = await this.retryWithBackoff(async () => {
        return this.fetchWithTimeout(`${config.apiBase}${config.endpoints.control}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        })
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Control request failed with status ${response.status}`,
        }
      }

      const result = await response.json().catch(() => ({}))

      return {
        success: true,
        currentState: {
          port,
          level: command.value ?? (command.type === 'turn_on' ? 100 : 0),
          isOn: command.type !== 'turn_off',
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
    const config = this.configs.get(controllerId)
    if (!config) {
      return {
        isOnline: false,
        lastSeen: new Date(),
      }
    }

    const statusEndpoint =
      config.endpoints.status || config.endpoints.sensors || '/status'
    const headers = this.buildAuthHeaders(config)

    try {
      const response = await this.fetchWithTimeout(
        `${config.apiBase}${statusEndpoint}`,
        { headers },
        5000
      )

      return {
        isOnline: response.ok,
        lastSeen: new Date(),
      }
    } catch {
      return {
        isOnline: false,
        lastSeen: new Date(),
      }
    }
  }

  async disconnect(controllerId: string): Promise<void> {
    this.configs.delete(controllerId)
    this.log('Disconnected', { controllerId })
  }

  // Helper methods

  private buildAuthHeaders(config: GenericWiFiConfig): Record<string, string> {
    const headers: Record<string, string> = {}

    if (!config.apiKey) {
      return headers
    }

    switch (config.authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${config.apiKey}`
        break
      case 'api-key':
        headers['X-API-Key'] = config.apiKey
        break
      case 'basic':
        headers['Authorization'] = `Basic ${config.apiKey}`
        break
      case 'none':
      default:
        // No auth header
        break
    }

    if (config.authHeader) {
      // Custom auth header format
      const [key, value] = config.authHeader.split(':').map((s) => s.trim())
      if (key && value) {
        headers[key] = value.replace('{{apiKey}}', config.apiKey || '')
      }
    }

    return headers
  }

  private generateControllerId(apiBase: string): string {
    // Generate a deterministic ID from the API base URL
    const hash = apiBase
      .split('')
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    return `generic_${Math.abs(hash).toString(16)}`
  }

  private mapSensorType(type: string | undefined): SensorType {
    if (!type) return 'temperature'

    const normalized = type.toLowerCase()

    if (normalized.includes('temp')) return 'temperature'
    if (normalized.includes('humid')) return 'humidity'
    if (normalized.includes('vpd')) return 'vpd'
    if (normalized.includes('co2') || normalized.includes('carbon')) return 'co2'
    if (normalized.includes('light') || normalized.includes('lux')) return 'light'
    if (normalized.includes('ph')) return 'ph'
    if (normalized.includes('ec') || normalized.includes('conductiv')) return 'ec'

    return 'temperature' // Default
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }
}
