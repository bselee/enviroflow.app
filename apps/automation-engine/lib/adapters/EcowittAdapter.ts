/**
 * Ecowitt Environmental Sensor Adapter
 *
 * Supports:
 * - GW1100/GW2000/GW3000 WiFi Gateways
 * - Display Consoles (WS2320_C, HP2560_C, etc.)
 * - WH31 Multi-channel temp/humidity sensors
 * - WH51 Soil moisture sensors
 * - WFC01 Water valves
 * - AC1100 Smart plugs
 *
 * Connection Methods:
 * 1. Push (Recommended): Gateway pushes data via HTTP POST
 * 2. TCP: Direct TCP connection on port 45000 (GW1000/GW2000/GW3000 only)
 * 3. HTTP: Local web API (undocumented, may break)
 * 4. Cloud: Ecowitt cloud API (requires API key)
 *
 * Features:
 * - Multi-method connectivity for maximum compatibility
 * - IoT device control (valves, plugs)
 * - Exponential backoff with circuit breaker
 * - Real-time sensor data parsing
 */

import type {
  ControllerAdapter,
  ControllerCredentials,
  EcowittCredentials,
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
import {
  adapterFetch,
  getCircuitBreaker,
  resetCircuitBreaker,
} from './retry'
import * as net from 'net'

// Ecowitt configuration
const ADAPTER_NAME = 'ecowitt'
const TCP_PORT = 45000 // Standard Ecowitt TCP port
const TCP_TIMEOUT = 10000 // 10 seconds
const CLOUD_API_BASE = 'https://api.ecowitt.net/api/v3'
const REQUEST_TIMEOUT = 15000 // 15 seconds

// Gateway cache for connection reuse
interface GatewayCache {
  ip: string
  method: 'push' | 'tcp' | 'http' | 'cloud'
  lastSeen: Date
  macAddress?: string
  apiKey?: string
  applicationKey?: string
}

// TCP Command codes (from Ecowitt protocol documentation)
const CMD_READ_SYSTEM_INFO = 0x0C
const CMD_READ_LIVEDATA = 0x0B
const PROTOCOL_HEADER = [0xFF, 0xFF]

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[EcowittAdapter][${timestamp}]`

  if (level === 'error') {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

// ============================================
// Ecowitt Cloud API Response Types
// ============================================

interface EcowittCloudResponse {
  code: number
  msg: string
  time: number
  data?: {
    indoor?: {
      temperature?: { value: string; unit: string }
      humidity?: { value: string; unit: string }
    }
    outdoor?: {
      temperature?: { value: string; unit: string }
      humidity?: { value: string; unit: string }
    }
    pressure?: {
      absolute?: { value: string; unit: string }
      relative?: { value: string; unit: string }
    }
    wind?: Record<string, unknown>
    solar_and_uvi?: Record<string, unknown>
    rainfall?: Record<string, unknown>
  }
}

interface IoTDeviceListResponse {
  code: number
  message: string
  data?: {
    list?: Array<{
      id: number
      model: number
      nickname: string
      device_type: string
      ac_status?: number
      realtime_power?: number
      ac_voltage?: number
    }>
  }
}

interface IoTControlResponse {
  code: number
  message: string
  data?: {
    ac_status?: number
    realtime_power?: number
    ac_voltage?: number
  }
}

// ============================================
// Ecowitt Adapter Implementation
// ============================================

export class EcowittAdapter implements ControllerAdapter {
  private gatewayCache: Map<string, GatewayCache> = new Map()

  /**
   * Connect to Ecowitt gateway and validate credentials
   * For 'push' method: Validate credentials and return success
   * For 'tcp' method: Connect via TCP and read system info
   * For 'http' method: Validate via local HTTP endpoint
   * For 'cloud' method: Authenticate with cloud API
   */
  async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
    if (!this.isEcowittCredentials(credentials)) {
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: 'Invalid credentials type. Expected Ecowitt credentials.'
      }
    }

    const { connectionMethod, gatewayIP, apiKey, applicationKey, macAddress } = credentials

    try {
      switch (connectionMethod) {
        case 'push':
          return await this.connectPush(macAddress || 'unknown')

        case 'tcp':
          if (!gatewayIP) {
            return {
              success: false,
              controllerId: '',
              metadata: this.emptyMetadata(),
              error: 'Gateway IP address is required for TCP connection method'
            }
          }
          return await this.connectTCP(gatewayIP, macAddress)

        case 'http':
          if (!gatewayIP) {
            return {
              success: false,
              controllerId: '',
              metadata: this.emptyMetadata(),
              error: 'Gateway IP address is required for HTTP connection method'
            }
          }
          return await this.connectHTTP(gatewayIP, macAddress)

        case 'cloud':
          if (!apiKey || !applicationKey || !macAddress) {
            return {
              success: false,
              controllerId: '',
              metadata: this.emptyMetadata(),
              error: 'API key, application key, and MAC address are required for cloud connection method'
            }
          }
          return await this.connectCloud(apiKey, applicationKey, macAddress)

        default:
          return {
            success: false,
            controllerId: '',
            metadata: this.emptyMetadata(),
            error: `Unsupported connection method: ${connectionMethod}`
          }
      }
    } catch (error) {
      log('error', 'Connection failed with exception', { error, method: connectionMethod })
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  /**
   * Connect via Push method (data comes via webhook)
   */
  private async connectPush(macAddress: string): Promise<ConnectionResult> {
    log('info', 'Connecting via Push method', { macAddress })

    // For push method, we just validate and store the configuration
    // Actual data will come via the webhook endpoint
    const controllerId = `ecowitt-push-${macAddress}`

    this.gatewayCache.set(controllerId, {
      ip: '',
      method: 'push',
      lastSeen: new Date(),
      macAddress
    })

    return {
      success: true,
      controllerId,
      metadata: {
        brand: 'ecowitt',
        model: 'Gateway (Push Mode)',
        capabilities: {
          sensors: this.getDefaultSensorCapabilities(),
          devices: [],
          supportsDimming: false,
          supportsScheduling: false,
          maxPorts: 8 // Support up to 8 multi-channel sensors
        }
      }
    }
  }

  /**
   * Connect via TCP (GW1000/GW2000/GW3000 only)
   */
  private async connectTCP(gatewayIP: string, macAddress?: string): Promise<ConnectionResult> {
    log('info', 'Connecting via TCP', { gatewayIP })

    return new Promise((resolve) => {
      let isResolved = false
      const safeResolve = (result: ConnectionResult) => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          client.destroy()
          resolve(result)
        }
      }

      const client = net.createConnection({ host: gatewayIP, port: TCP_PORT }, () => {
        log('info', 'TCP connection established')

        // Send CMD_READ_SYSTEM_INFO command
        const command = this.buildTCPCommand(CMD_READ_SYSTEM_INFO, Buffer.alloc(0))
        client.write(command)
      })

      // Set socket-level timeout for read/write operations
      client.setTimeout(TCP_TIMEOUT)

      let responseData = Buffer.alloc(0)
      const timeout = setTimeout(() => {
        log('warn', 'TCP connection timeout', { gatewayIP })
        safeResolve({
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'TCP connection timeout. Ensure gateway IP is correct and gateway supports TCP API.'
        })
      }, TCP_TIMEOUT)

      // Handle socket timeout event
      client.on('timeout', () => {
        log('warn', 'TCP socket timeout', { gatewayIP })
        safeResolve({
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'TCP socket timeout. The gateway did not respond in time.'
        })
      })

      client.on('data', (data) => {
        responseData = Buffer.concat([responseData, data])
      })

      client.on('end', () => {
        try {
          const systemInfo = this.parseTCPSystemInfo(responseData)
          const controllerId = `ecowitt-tcp-${macAddress || gatewayIP.replace(/\./g, '-')}`

          this.gatewayCache.set(controllerId, {
            ip: gatewayIP,
            method: 'tcp',
            lastSeen: new Date(),
            macAddress: systemInfo.macAddress || macAddress
          })

          safeResolve({
            success: true,
            controllerId,
            metadata: {
              brand: 'ecowitt',
              model: systemInfo.model || 'Gateway',
              firmwareVersion: systemInfo.firmwareVersion,
              capabilities: {
                sensors: this.getDefaultSensorCapabilities(),
                devices: this.getDefaultDeviceCapabilities(),
                supportsDimming: false,
                supportsScheduling: true,
                maxPorts: 8
              }
            }
          })
        } catch (error) {
          log('error', 'Failed to parse TCP response', { error })
          safeResolve({
            success: false,
            controllerId: '',
            metadata: this.emptyMetadata(),
            error: error instanceof Error ? error.message : 'Failed to parse system info'
          })
        }
      })

      client.on('error', (error) => {
        log('error', 'TCP connection error', { error })
        safeResolve({
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: `TCP connection failed: ${error.message}. Ensure gateway IP is correct and supports TCP API.`
        })
      })

      // Handle close event for cleanup
      client.on('close', () => {
        clearTimeout(timeout)
      })
    })
  }

  /**
   * Connect via local HTTP API (undocumented)
   */
  private async connectHTTP(gatewayIP: string, macAddress?: string): Promise<ConnectionResult> {
    log('info', 'Connecting via HTTP', { gatewayIP })

    try {
      const result = await adapterFetch<Record<string, unknown>>(
        ADAPTER_NAME,
        `http://${gatewayIP}/get_livedata_info`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        },
        { maxRetries: 2, timeoutMs: REQUEST_TIMEOUT }
      )

      if (!result.success) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: result.error || 'Failed to connect via HTTP. Ensure gateway IP is correct and supports HTTP API.'
        }
      }

      const controllerId = `ecowitt-http-${macAddress || gatewayIP.replace(/\./g, '-')}`

      this.gatewayCache.set(controllerId, {
        ip: gatewayIP,
        method: 'http',
        lastSeen: new Date(),
        macAddress
      })

      return {
        success: true,
        controllerId,
        metadata: {
          brand: 'ecowitt',
          model: 'Gateway (HTTP Mode)',
          capabilities: {
            sensors: this.getDefaultSensorCapabilities(),
            devices: this.getDefaultDeviceCapabilities(),
            supportsDimming: false,
            supportsScheduling: true,
            maxPorts: 8
          }
        }
      }
    } catch (error) {
      log('error', 'HTTP connection failed', { error })
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: error instanceof Error ? error.message : 'HTTP connection failed'
      }
    }
  }

  /**
   * Connect via Ecowitt Cloud API
   */
  private async connectCloud(
    apiKey: string,
    applicationKey: string,
    macAddress: string
  ): Promise<ConnectionResult> {
    log('info', 'Connecting via Cloud API', { macAddress: macAddress.slice(0, 8) + '***' })

    try {
      // Test connection by fetching real-time data
      const result = await adapterFetch<EcowittCloudResponse>(
        ADAPTER_NAME,
        `${CLOUD_API_BASE}/device/real_time`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            application_key: applicationKey,
            api_key: apiKey,
            mac: macAddress,
            call_back: 'indoor,outdoor',
            temp_unitid: 1, // Fahrenheit
            pressure_unitid: 3, // inHg
          }),
        },
        { maxRetries: 2, timeoutMs: REQUEST_TIMEOUT }
      )

      if (!result.success || !result.data) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: result.error || 'Failed to authenticate with Ecowitt cloud API'
        }
      }

      const cloudData = result.data

      if (cloudData.code !== 0) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: cloudData.msg || `Cloud API error: ${cloudData.code}`
        }
      }

      const controllerId = `ecowitt-cloud-${macAddress}`

      this.gatewayCache.set(controllerId, {
        ip: '',
        method: 'cloud',
        lastSeen: new Date(),
        macAddress,
        apiKey,
        applicationKey
      })

      return {
        success: true,
        controllerId,
        metadata: {
          brand: 'ecowitt',
          model: 'Gateway (Cloud Mode)',
          capabilities: {
            sensors: this.getDefaultSensorCapabilities(),
            devices: this.getDefaultDeviceCapabilities(),
            supportsDimming: false,
            supportsScheduling: true,
            maxPorts: 8
          }
        }
      }
    } catch (error) {
      log('error', 'Cloud API connection failed', { error })
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: error instanceof Error ? error.message : 'Cloud API connection failed'
      }
    }
  }

  /**
   * Read all sensor values from gateway
   * For 'push': Return empty array (data comes via webhook)
   * For 'tcp': Send CMD_READ_LIVEDATA command and parse binary response
   * For 'http': GET /get_livedata_info and parse JSON
   * For 'cloud': Call cloud API real_time endpoint
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const cached = this.gatewayCache.get(controllerId)
    if (!cached) {
      throw new Error('Controller not connected. Call connect() first.')
    }

    log('info', `Reading sensors via ${cached.method}`, { controllerId })

    try {
      switch (cached.method) {
        case 'push':
          // For push method, data comes via webhook - return empty array
          log('info', 'Push method: sensor data received via webhook')
          return []

        case 'tcp':
          return await this.readSensorsTCP(cached.ip)

        case 'http':
          return await this.readSensorsHTTP(cached.ip)

        case 'cloud':
          if (!cached.apiKey || !cached.applicationKey || !cached.macAddress) {
            throw new Error('Cloud credentials not available')
          }
          return await this.readSensorsCloud(cached.apiKey, cached.applicationKey, cached.macAddress)

        default:
          throw new Error(`Unsupported connection method: ${cached.method}`)
      }
    } catch (error) {
      log('error', 'Failed to read sensors', { error, method: cached.method })
      throw error
    }
  }

  /**
   * Read sensors via TCP
   */
  private async readSensorsTCP(gatewayIP: string): Promise<SensorReading[]> {
    return new Promise((resolve, reject) => {
      let isSettled = false
      const safeResolve = (readings: SensorReading[]) => {
        if (!isSettled) {
          isSettled = true
          clearTimeout(timeout)
          client.destroy()
          resolve(readings)
        }
      }
      const safeReject = (error: Error) => {
        if (!isSettled) {
          isSettled = true
          clearTimeout(timeout)
          client.destroy()
          reject(error)
        }
      }

      const client = net.createConnection({ host: gatewayIP, port: TCP_PORT }, () => {
        // Send CMD_READ_LIVEDATA command
        const command = this.buildTCPCommand(CMD_READ_LIVEDATA, Buffer.alloc(0))
        client.write(command)
      })

      // Set socket-level timeout for read/write operations
      client.setTimeout(TCP_TIMEOUT)

      let responseData = Buffer.alloc(0)
      const timeout = setTimeout(() => {
        log('warn', 'TCP read timeout', { gatewayIP })
        safeReject(new Error('TCP read timeout'))
      }, TCP_TIMEOUT)

      // Handle socket timeout event
      client.on('timeout', () => {
        log('warn', 'TCP socket timeout during read', { gatewayIP })
        safeReject(new Error('TCP socket timeout'))
      })

      client.on('data', (data) => {
        responseData = Buffer.concat([responseData, data])
      })

      client.on('end', () => {
        try {
          const readings = this.parseTCPLiveData(responseData)
          safeResolve(readings)
        } catch (error) {
          safeReject(error instanceof Error ? error : new Error(String(error)))
        }
      })

      client.on('error', (error) => {
        safeReject(error)
      })

      // Handle close event for cleanup
      client.on('close', () => {
        clearTimeout(timeout)
      })
    })
  }

  /**
   * Read sensors via local HTTP
   */
  private async readSensorsHTTP(gatewayIP: string): Promise<SensorReading[]> {
    const result = await adapterFetch<Record<string, unknown>>(
      ADAPTER_NAME,
      `http://${gatewayIP}/get_livedata_info`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      },
      { maxRetries: 2, timeoutMs: REQUEST_TIMEOUT }
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read sensor data via HTTP')
    }

    return this.parseHTTPLiveData(result.data)
  }

  /**
   * Read sensors via Cloud API
   */
  private async readSensorsCloud(
    apiKey: string,
    applicationKey: string,
    macAddress: string
  ): Promise<SensorReading[]> {
    const result = await adapterFetch<EcowittCloudResponse>(
      ADAPTER_NAME,
      `${CLOUD_API_BASE}/device/real_time`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          application_key: applicationKey,
          api_key: apiKey,
          mac: macAddress,
          call_back: 'all',
          temp_unitid: 1, // Fahrenheit
          pressure_unitid: 3, // inHg
          wind_speed_unitid: 5, // mph
          rainfall_unitid: 12, // inches
          solar_irradiance_unitid: 16, // W/m²
        }),
      },
      { maxRetries: 2, timeoutMs: REQUEST_TIMEOUT }
    )

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read sensor data from cloud')
    }

    const cloudData = result.data

    if (cloudData.code !== 0) {
      throw new Error(cloudData.msg || `Cloud API error: ${cloudData.code}`)
    }

    return this.parseCloudData(cloudData.data || {})
  }

  /**
   * Control IoT device (valve or plug)
   * Sends HTTP POST to gateway's /parse_quick_cmd_iot endpoint
   */
  async controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult> {
    const cached = this.gatewayCache.get(controllerId)
    if (!cached) {
      return {
        success: false,
        error: 'Controller not connected',
        timestamp: new Date()
      }
    }

    // IoT control requires local IP (not available for cloud or push methods without gateway IP)
    if (!cached.ip) {
      return {
        success: false,
        error: 'IoT control requires gateway IP address. Use TCP or HTTP connection method.',
        timestamp: new Date()
      }
    }

    try {
      log('info', `Sending control command to port ${port}`, { command: command.type })

      // Build control command based on device type and action
      let commandPayload: unknown

      switch (command.type) {
        case 'turn_on':
          commandPayload = {
            command: [{
              cmd: 'quick_run',
              on_type: 0,
              off_type: 0,
              always_on: 1, // Always on mode
              on_time: 0,
              off_time: 0,
              val_type: 0,
              val: 0,
              id: port,
              model: this.getDeviceModel(port) // 1=WFC01, 2=AC1100
            }]
          }
          break

        case 'turn_off':
          commandPayload = {
            command: [{
              cmd: 'quick_stop',
              id: port,
              model: this.getDeviceModel(port)
            }]
          }
          break

        case 'set_level':
          // For devices that support levels (future enhancement)
          commandPayload = {
            command: [{
              cmd: 'quick_run',
              on_type: 0,
              off_type: 0,
              always_on: 0,
              on_time: command.value || 0,
              off_time: 0,
              val_type: 1,
              val: command.value || 0,
              id: port,
              model: this.getDeviceModel(port)
            }]
          }
          break

        default:
          return {
            success: false,
            error: `Unsupported command type: ${command.type}`,
            timestamp: new Date()
          }
      }

      const result = await adapterFetch<IoTControlResponse>(
        ADAPTER_NAME,
        `http://${cached.ip}/parse_quick_cmd_iot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(commandPayload),
        },
        { maxRetries: 2, timeoutMs: REQUEST_TIMEOUT }
      )

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Control command failed',
          timestamp: new Date()
        }
      }

      const response = result.data

      return {
        success: response.code === 0,
        error: response.code !== 0 ? response.message : undefined,
        actualValue: response.data?.ac_status === 1 ? 100 : 0,
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
   * Get current gateway status
   */
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const cached = this.gatewayCache.get(controllerId)

    if (!cached) {
      return {
        status: 'offline',
        lastSeen: new Date()
      }
    }

    try {
      // Try to read sensors as a health check
      await this.readSensors(controllerId)

      // Update last seen
      cached.lastSeen = new Date()

      return {
        status: 'online',
        lastSeen: cached.lastSeen
      }
    } catch {
      return {
        status: 'error',
        lastSeen: cached.lastSeen
      }
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(controllerId: string): Promise<void> {
    this.gatewayCache.delete(controllerId)
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

  private isEcowittCredentials(creds: ControllerCredentials): creds is EcowittCredentials {
    return 'type' in creds && creds.type === 'ecowitt'
  }

  /**
   * Build TCP command with header and checksum
   */
  private buildTCPCommand(command: number, payload: Buffer): Buffer {
    const size = payload.length
    const header = Buffer.from([
      ...PROTOCOL_HEADER,
      command,
      (size >> 8) & 0xFF, // Size high byte
      size & 0xFF         // Size low byte
    ])

    const fullCommand = Buffer.concat([header, payload])

    // Calculate checksum (sum of all bytes from command to end, then & 0xFF)
    let checksum = 0
    for (let i = 2; i < fullCommand.length; i++) {
      checksum += fullCommand[i]
    }

    return Buffer.concat([fullCommand, Buffer.from([checksum & 0xFF])])
  }

  /**
   * Parse TCP system info response
   */
  private parseTCPSystemInfo(buffer: Buffer): { macAddress?: string; model?: string; firmwareVersion?: string } {
    // Validate header
    if (buffer.length < 5 || buffer[0] !== 0xFF || buffer[1] !== 0xFF) {
      throw new Error('Invalid TCP response header')
    }

    // Extract firmware version if available (varies by gateway model)
    const firmwareVersion = buffer.length > 10 ? buffer.toString('ascii', 10, 20).trim() : undefined

    return {
      firmwareVersion,
      model: 'GW1000/GW2000/GW3000'
    }
  }

  /**
   * Parse TCP live data response
   */
  private parseTCPLiveData(buffer: Buffer): SensorReading[] {
    const readings: SensorReading[] = []
    const now = new Date()

    // Validate header
    if (buffer.length < 5 || buffer[0] !== 0xFF || buffer[1] !== 0xFF) {
      throw new Error('Invalid TCP response header')
    }

    let offset = 5 // Skip header (0xFF 0xFF CMD SIZE_H SIZE_L)

    // Parse sensor data based on data type codes
    while (offset < buffer.length - 1) { // -1 for checksum
      const dataType = buffer[offset]
      offset++

      switch (dataType) {
        case 0x01: // Indoor temperature
          if (offset + 1 < buffer.length) {
            const value = buffer.readInt16BE(offset) / 10 // Temperature in °C × 10
            readings.push({
              port: 0,
              type: 'temperature',
              value: (value * 9/5) + 32, // Convert to Fahrenheit
              unit: 'F',
              timestamp: now,
              isStale: false
            })
            offset += 2
          }
          break

        case 0x02: // Outdoor temperature
          if (offset + 1 < buffer.length) {
            const value = buffer.readInt16BE(offset) / 10
            readings.push({
              port: 1,
              type: 'temperature',
              value: (value * 9/5) + 32,
              unit: 'F',
              timestamp: now,
              isStale: false
            })
            offset += 2
          }
          break

        case 0x06: // Indoor humidity
          if (offset < buffer.length) {
            readings.push({
              port: 0,
              type: 'humidity',
              value: buffer.readUInt8(offset),
              unit: '%',
              timestamp: now,
              isStale: false
            })
            offset += 1
          }
          break

        case 0x07: // Outdoor humidity
          if (offset < buffer.length) {
            readings.push({
              port: 1,
              type: 'humidity',
              value: buffer.readUInt8(offset),
              unit: '%',
              timestamp: now,
              isStale: false
            })
            offset += 1
          }
          break

        case 0x09: // Absolute pressure
          if (offset + 1 < buffer.length) {
            const value = buffer.readUInt16BE(offset) / 10 // hPa × 10
            readings.push({
              port: 0,
              type: 'pressure',
              value: value * 0.02953, // Convert hPa to inHg
              unit: 'inHg',
              timestamp: now,
              isStale: false
            })
            offset += 2
          }
          break

        case 0x17: // Soil moisture channel 1
        case 0x18: // Soil moisture channel 2
        case 0x19: // Soil moisture channel 3
        case 0x1A: // Soil moisture channel 4
          if (offset < buffer.length) {
            const channel = dataType - 0x17 + 1
            readings.push({
              port: channel,
              type: 'soil_moisture',
              value: buffer.readUInt8(offset),
              unit: '%',
              timestamp: now,
              isStale: false
            })
            offset += 1
          }
          break

        default:
          // Unknown data type - fail fast to prevent buffer desync
          log('error', `Unknown TCP data type: 0x${dataType.toString(16).toUpperCase()} at offset ${offset}`)
          // Return what we have so far rather than risking corrupted parsing
          return readings
      }
    }

    log('info', `Parsed ${readings.length} sensor readings from TCP response`)
    return readings
  }

  /**
   * Parse HTTP live data response
   */
  private parseHTTPLiveData(data: Record<string, unknown>): SensorReading[] {
    const readings: SensorReading[] = []
    const now = new Date()

    // Parse indoor sensors
    const indoor = data.indoor as Record<string, unknown> | undefined
    if (indoor) {
      const temp = indoor.temperature as { value: number } | undefined
      if (temp?.value !== undefined) {
        readings.push({
          port: 0,
          type: 'temperature',
          value: temp.value,
          unit: 'F',
          timestamp: now,
          isStale: false
        })
      }

      const humidity = indoor.humidity as { value: number } | undefined
      if (humidity?.value !== undefined) {
        readings.push({
          port: 0,
          type: 'humidity',
          value: humidity.value,
          unit: '%',
          timestamp: now,
          isStale: false
        })
      }
    }

    // Parse outdoor sensors
    const outdoor = data.outdoor as Record<string, unknown> | undefined
    if (outdoor) {
      const temp = outdoor.temperature as { value: number } | undefined
      if (temp?.value !== undefined) {
        readings.push({
          port: 1,
          type: 'temperature',
          value: temp.value,
          unit: 'F',
          timestamp: now,
          isStale: false
        })
      }

      const humidity = outdoor.humidity as { value: number } | undefined
      if (humidity?.value !== undefined) {
        readings.push({
          port: 1,
          type: 'humidity',
          value: humidity.value,
          unit: '%',
          timestamp: now,
          isStale: false
        })
      }
    }

    // Parse pressure
    const pressure = data.pressure as Record<string, unknown> | undefined
    if (pressure) {
      const absolute = pressure.absolute as { value: number } | undefined
      if (absolute?.value !== undefined) {
        readings.push({
          port: 0,
          type: 'pressure',
          value: absolute.value,
          unit: 'inHg',
          timestamp: now,
          isStale: false
        })
      }
    }

    log('info', `Parsed ${readings.length} sensor readings from HTTP response`)
    return readings
  }

  /**
   * Parse Cloud API data
   */
  private parseCloudData(data: EcowittCloudResponse['data']): SensorReading[] {
    const readings: SensorReading[] = []
    const now = new Date()

    if (!data) return readings

    // Parse indoor sensors
    if (data.indoor?.temperature?.value) {
      readings.push({
        port: 0,
        type: 'temperature',
        value: parseFloat(data.indoor.temperature.value),
        unit: 'F',
        timestamp: now,
        isStale: false
      })
    }

    if (data.indoor?.humidity?.value) {
      readings.push({
        port: 0,
        type: 'humidity',
        value: parseFloat(data.indoor.humidity.value),
        unit: '%',
        timestamp: now,
        isStale: false
      })
    }

    // Parse outdoor sensors
    if (data.outdoor?.temperature?.value) {
      readings.push({
        port: 1,
        type: 'temperature',
        value: parseFloat(data.outdoor.temperature.value),
        unit: 'F',
        timestamp: now,
        isStale: false
      })
    }

    if (data.outdoor?.humidity?.value) {
      readings.push({
        port: 1,
        type: 'humidity',
        value: parseFloat(data.outdoor.humidity.value),
        unit: '%',
        timestamp: now,
        isStale: false
      })
    }

    // Parse pressure
    if (data.pressure?.absolute?.value) {
      readings.push({
        port: 0,
        type: 'pressure',
        value: parseFloat(data.pressure.absolute.value),
        unit: 'inHg',
        timestamp: now,
        isStale: false
      })
    }

    log('info', `Parsed ${readings.length} sensor readings from cloud API`)
    return readings
  }

  /**
   * Get device model for IoT control
   * Port 1-4: WFC01 valves (model 1)
   * Port 5-8: AC1100 plugs (model 2)
   */
  private getDeviceModel(port: number): number {
    return port <= 4 ? 1 : 2
  }

  /**
   * Get default sensor capabilities
   */
  private getDefaultSensorCapabilities(): SensorCapability[] {
    return [
      { port: 0, name: 'Indoor Temperature', type: 'temperature', unit: 'F' },
      { port: 0, name: 'Indoor Humidity', type: 'humidity', unit: '%' },
      { port: 1, name: 'Outdoor Temperature', type: 'temperature', unit: 'F' },
      { port: 1, name: 'Outdoor Humidity', type: 'humidity', unit: '%' },
      { port: 0, name: 'Barometric Pressure', type: 'pressure', unit: 'inHg' },
      { port: 1, name: 'Soil Moisture 1', type: 'soil_moisture', unit: '%' },
      { port: 2, name: 'Soil Moisture 2', type: 'soil_moisture', unit: '%' },
      { port: 3, name: 'Soil Moisture 3', type: 'soil_moisture', unit: '%' },
      { port: 4, name: 'Soil Moisture 4', type: 'soil_moisture', unit: '%' },
    ]
  }

  /**
   * Get default device capabilities (IoT devices)
   */
  private getDefaultDeviceCapabilities(): DeviceCapability[] {
    return [
      { port: 1, name: 'Valve 1', type: 'valve', supportsDimming: false },
      { port: 2, name: 'Valve 2', type: 'valve', supportsDimming: false },
      { port: 3, name: 'Valve 3', type: 'valve', supportsDimming: false },
      { port: 4, name: 'Valve 4', type: 'valve', supportsDimming: false },
      { port: 5, name: 'Outlet 1', type: 'outlet', supportsDimming: false },
      { port: 6, name: 'Outlet 2', type: 'outlet', supportsDimming: false },
      { port: 7, name: 'Outlet 3', type: 'outlet', supportsDimming: false },
      { port: 8, name: 'Outlet 4', type: 'outlet', supportsDimming: false },
    ]
  }

  private emptyMetadata(): ControllerMetadata {
    return {
      brand: 'ecowitt',
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
