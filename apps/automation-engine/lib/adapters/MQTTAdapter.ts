/**
 * MQTT Controller Adapter
 *
 * Supports generic MQTT-based devices including:
 * - Tasmota devices
 * - ESPHome devices
 * - Home Assistant MQTT devices
 * - Custom MQTT sensors and switches
 *
 * Features:
 * - WebSocket-based MQTT connection (for browser/serverless compatibility)
 * - Topic-based sensor reading and device control
 * - Configurable topic patterns
 * - Last Will and Testament (LWT) support
 * - QoS levels 0, 1, 2
 *
 * Note: This adapter uses MQTT over WebSocket for serverless compatibility.
 * Native MQTT (tcp://) requires persistent connections which don't work well
 * in serverless environments.
 *
 * Phase 2 Feature - Currently a skeleton implementation
 */

import type {
  ControllerAdapter,
  ControllerCredentials,
  MQTTCredentials,
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

// ============================================
// MQTT Configuration Types
// ============================================

export interface MQTTTopicConfig {
  /** Base topic for this device (e.g., "tasmota/living_room") */
  baseTopic: string
  /** Topic pattern for sensor readings (default: "{base}/sensor/{type}") */
  sensorPattern?: string
  /** Topic pattern for commands (default: "{base}/cmnd/{device}") */
  commandPattern?: string
  /** Topic pattern for status (default: "{base}/stat/{type}") */
  statusPattern?: string
  /** Topic for device availability (default: "{base}/LWT") */
  availabilityTopic?: string
}

export interface MQTTDeviceConfig {
  /** Device port/channel number */
  port: number
  /** Device name */
  name: string
  /** Device type */
  type: DeviceType
  /** Command topic for this device */
  commandTopic: string
  /** State topic for this device */
  stateTopic?: string
  /** Whether device supports dimming */
  supportsDimming: boolean
  /** Payload for ON command */
  payloadOn?: string
  /** Payload for OFF command */
  payloadOff?: string
  /** Min value for dimming */
  minValue?: number
  /** Max value for dimming */
  maxValue?: number
}

export interface MQTTSensorConfig {
  /** Sensor port/channel number */
  port: number
  /** Sensor name */
  name: string
  /** Sensor type */
  type: SensorType
  /** Topic to subscribe for readings */
  topic: string
  /** JSON path to value in message (e.g., "temperature" or "AM2301.Temperature") */
  valuePath?: string
  /** Unit of measurement */
  unit: string
  /** Value multiplier (e.g., 0.1 if raw value is 10x) */
  multiplier?: number
  /** Value offset */
  offset?: number
}

// ============================================
// Message Storage (for serverless)
// ============================================

// In-memory storage for last received messages
// In production, consider Redis or similar for multi-instance deployments
const messageStore = new Map<string, {
  topic: string
  payload: string
  timestamp: Date
}>()

// Connection state tracking
const connectionStore = new Map<string, {
  connected: boolean
  lastConnected: Date | null
  lastError: string | null
  config: MQTTCredentials
}>()

// ============================================
// Logging Utility
// ============================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[MQTTAdapter][${timestamp}]`

  if (level === 'error') {
    console.error(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else {
    console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '')
  }
}

// ============================================
// MQTT Adapter Implementation
// ============================================

export class MQTTAdapter implements ControllerAdapter {

  /**
   * Connect to MQTT broker
   *
   * Note: In serverless environments, this creates a short-lived connection
   * to verify credentials and retrieve initial state. For real-time updates,
   * consider a dedicated MQTT-to-Supabase bridge service.
   */
  async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
    if (!this.isMQTTCredentials(credentials)) {
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: 'Invalid credentials type. Expected MQTT credentials.'
      }
    }

    const { brokerUrl, username, password, topic } = credentials

    log('info', 'Connecting to MQTT broker', {
      broker: brokerUrl.replace(/\/\/.*:.*@/, '//***:***@'),
      topic
    })

    try {
      // Validate broker URL
      if (!brokerUrl) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'MQTT broker URL is required'
        }
      }

      // Generate a unique controller ID based on broker and topic
      const controllerId = this.generateControllerId(brokerUrl, topic)

      // Store connection config
      connectionStore.set(controllerId, {
        connected: false,
        lastConnected: null,
        lastError: null,
        config: credentials
      })

      // In a real implementation, we would:
      // 1. Connect to the MQTT broker via WebSocket
      // 2. Subscribe to relevant topics
      // 3. Wait for initial messages
      //
      // For Phase 2, we're implementing a polling-based approach
      // that works better in serverless environments.

      // Validate broker URL format
      const isValidUrl = this.validateBrokerUrl(brokerUrl)
      if (!isValidUrl) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'Invalid broker URL. Expected format: ws://host:port or wss://host:port'
        }
      }

      // Mark as connected (connection will be established on first read)
      connectionStore.set(controllerId, {
        connected: true,
        lastConnected: new Date(),
        lastError: null,
        config: credentials
      })

      log('info', `MQTT controller registered: ${controllerId}`)

      return {
        success: true,
        controllerId,
        metadata: {
          brand: 'mqtt',
          model: 'Generic MQTT Device',
          capabilities: this.buildCapabilities(credentials)
        }
      }

    } catch (error) {
      log('error', 'MQTT connection failed', { error })
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  /**
   * Read sensor values from MQTT device
   *
   * Implementation approach for serverless:
   * 1. Check message store for cached values
   * 2. If stale or missing, create temporary connection to fetch
   * 3. Return latest values
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const connection = connectionStore.get(controllerId)
    if (!connection) {
      throw new Error('Controller not connected. Call connect() first.')
    }

    const { config } = connection
    const { topic } = config

    log('info', `Reading sensors from MQTT topic: ${topic}`)

    // For Phase 2, return placeholder readings based on topic configuration
    // A full implementation would:
    // 1. Connect to broker
    // 2. Subscribe to sensor topics
    // 3. Wait for messages or timeout
    // 4. Parse JSON payloads
    // 5. Return structured readings

    const readings: SensorReading[] = []
    const now = new Date()

    // Check message store for cached readings
    const cachedMessage = messageStore.get(`${controllerId}:sensors`)
    if (cachedMessage) {
      try {
        const payload = JSON.parse(cachedMessage.payload)

        // Parse Tasmota-style sensor payload
        // Example: {"Time":"2024-01-21T10:30:00","AM2301":{"Temperature":72.5,"Humidity":55.2}}
        if (payload.AM2301 || payload.DHT || payload.SHT || payload.DS18B20) {
          const sensor = payload.AM2301 || payload.DHT || payload.SHT || payload.DS18B20

          if (sensor.Temperature !== undefined) {
            readings.push({
              port: 1,
              type: 'temperature',
              value: sensor.Temperature,
              unit: 'F',
              timestamp: now,
              isStale: this.isMessageStale(cachedMessage.timestamp)
            })
          }

          if (sensor.Humidity !== undefined) {
            readings.push({
              port: 2,
              type: 'humidity',
              value: sensor.Humidity,
              unit: '%',
              timestamp: now,
              isStale: this.isMessageStale(cachedMessage.timestamp)
            })
          }
        }

        // Parse ESPHome-style sensor payload
        // Example: {"sensor":"temperature","value":72.5,"unit":"°F"}
        if (payload.sensor && payload.value !== undefined) {
          const sensorType = this.mapSensorTypeName(payload.sensor)
          if (sensorType) {
            readings.push({
              port: payload.port || 1,
              type: sensorType,
              value: payload.value,
              unit: payload.unit || '',
              timestamp: now,
              isStale: this.isMessageStale(cachedMessage.timestamp)
            })
          }
        }

      } catch (parseError) {
        log('warn', 'Failed to parse cached MQTT message', { error: parseError })
      }
    }

    // If no cached readings, return empty (or trigger a refresh)
    if (readings.length === 0) {
      log('info', 'No cached MQTT readings available')
    }

    return readings
  }

  /**
   * Send control command to MQTT device
   */
  async controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult> {
    const connection = connectionStore.get(controllerId)
    if (!connection) {
      return {
        success: false,
        error: 'Controller not connected',
        timestamp: new Date()
      }
    }

    const { config } = connection
    const { topic } = config

    log('info', `Sending MQTT command to ${topic}`, { port, command })

    try {
      // Build command topic (Tasmota style: cmnd/{device}/POWER)
      const commandTopic = port > 1
        ? `cmnd/${topic}/POWER${port}`
        : `cmnd/${topic}/POWER`

      // Build payload based on command type
      let payload: string

      switch (command.type) {
        case 'turn_on':
          payload = 'ON'
          break
        case 'turn_off':
          payload = 'OFF'
          break
        case 'toggle':
          payload = 'TOGGLE'
          break
        case 'set_level':
          // For dimmers, use Dimmer command
          payload = String(command.value || 0)
          break
        default:
          payload = 'OFF'
      }

      log('info', `MQTT publish: ${commandTopic} = ${payload}`)

      // In a full implementation, we would:
      // 1. Connect to broker
      // 2. Publish message
      // 3. Wait for confirmation (QoS 1+)
      // 4. Return result

      // For Phase 2, simulate success
      // A real implementation would publish the message

      return {
        success: true,
        actualValue: command.value,
        timestamp: new Date()
      }

    } catch (error) {
      log('error', 'MQTT command failed', { error })
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
    const connection = connectionStore.get(controllerId)

    if (!connection) {
      return {
        status: 'offline',
        lastSeen: new Date()
      }
    }

    // Check for LWT (Last Will and Testament) message
    const lwtMessage = messageStore.get(`${controllerId}:LWT`)
    const isOnline = lwtMessage
      ? lwtMessage.payload.toLowerCase() === 'online'
      : connection.connected

    return {
      status: isOnline ? 'online' : 'offline',
      lastSeen: connection.lastConnected || new Date(),
      errors: connection.lastError ? [connection.lastError] : undefined
    }
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(controllerId: string): Promise<void> {
    const connection = connectionStore.get(controllerId)
    if (connection) {
      connectionStore.set(controllerId, {
        ...connection,
        connected: false
      })
    }

    // Clean up message store entries
    const keysToDelete: string[] = []
    messageStore.forEach((_, key) => {
      if (key.startsWith(`${controllerId}:`)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => messageStore.delete(key))

    log('info', `Disconnected from MQTT controller: ${controllerId}`)
  }

  // ============================================
  // Helper Methods
  // ============================================

  private isMQTTCredentials(creds: ControllerCredentials): creds is MQTTCredentials {
    return 'type' in creds && creds.type === 'mqtt'
  }

  private generateControllerId(brokerUrl: string, topic: string): string {
    // Create a unique ID from broker and topic
    const hash = Buffer.from(`${brokerUrl}:${topic}`).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16)
    return `mqtt_${hash}`
  }

  private validateBrokerUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['ws:', 'wss:', 'mqtt:', 'mqtts:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  private isMessageStale(timestamp: Date, maxAgeMs: number = 5 * 60 * 1000): boolean {
    return Date.now() - timestamp.getTime() > maxAgeMs
  }

  private mapSensorTypeName(name: string): SensorType | null {
    const nameMap: Record<string, SensorType> = {
      'temperature': 'temperature',
      'temp': 'temperature',
      'humidity': 'humidity',
      'hum': 'humidity',
      'co2': 'co2',
      'carbon_dioxide': 'co2',
      'vpd': 'vpd',
      'light': 'light',
      'lux': 'light',
      'illuminance': 'light',
      'ph': 'ph',
      'ec': 'ec',
      'conductivity': 'ec',
    }
    return nameMap[name.toLowerCase()] || null
  }

  private buildCapabilities(config: MQTTCredentials) {
    // Default capabilities for generic MQTT device
    // In a full implementation, this would be discovered from the device
    const sensors: SensorCapability[] = [
      { port: 1, name: 'Temperature', type: 'temperature', unit: 'F' },
      { port: 2, name: 'Humidity', type: 'humidity', unit: '%' }
    ]

    const devices: DeviceCapability[] = [
      { port: 1, name: 'Relay 1', type: 'outlet', supportsDimming: false },
      { port: 2, name: 'Relay 2', type: 'outlet', supportsDimming: false }
    ]

    return {
      sensors,
      devices,
      supportsDimming: false,
      supportsScheduling: true,
      maxPorts: 4
    }
  }

  private emptyMetadata(): ControllerMetadata {
    return {
      brand: 'mqtt',
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

// ============================================
// MQTT Message Handler (for bridge service)
// ============================================

/**
 * Handle incoming MQTT message
 * This would be called by an MQTT bridge service that maintains
 * persistent connections and forwards messages.
 */
export function handleMQTTMessage(
  controllerId: string,
  topic: string,
  payload: string
): void {
  const timestamp = new Date()

  // Determine message type from topic
  let messageType = 'unknown'
  if (topic.includes('/sensor') || topic.includes('/tele') || topic.includes('/SENSOR')) {
    messageType = 'sensors'
  } else if (topic.includes('/LWT') || topic.includes('/status')) {
    messageType = 'LWT'
  } else if (topic.includes('/stat') || topic.includes('/STATE')) {
    messageType = 'state'
  }

  // Store message
  messageStore.set(`${controllerId}:${messageType}`, {
    topic,
    payload,
    timestamp
  })

  log('info', `MQTT message stored: ${controllerId}:${messageType}`)
}

/**
 * Clear all stored messages (for testing)
 */
export function clearMessageStore(): void {
  messageStore.clear()
  connectionStore.clear()
}
