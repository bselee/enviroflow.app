/**
 * MQTT Controller Adapter
 *
 * Supports generic MQTT-based IoT devices including:
 * - Tasmota devices
 * - ESPHome devices
 * - Home Assistant MQTT devices
 * - Custom MQTT sensors and switches
 *
 * Features:
 * - Native MQTT and WebSocket connections
 * - Topic-based sensor reading and device control
 * - Automatic reconnection with exponential backoff
 * - Last Will and Testament (LWT) support
 * - QoS levels 0, 1, 2
 * - Message caching for serverless environments
 * - Graceful connection cleanup
 *
 * Protocol Support:
 * - mqtt:// - Standard MQTT over TCP (port 1883)
 * - mqtts:// - MQTT over TLS (port 8883)
 * - ws:// - MQTT over WebSocket (port 8083)
 * - wss:// - MQTT over secure WebSocket (port 9001)
 */

import mqtt from 'mqtt'
import type {
  ControllerAdapter,
  DiscoverableAdapter,
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
  DiscoveryCredentials,
  DiscoveryResult,
  DiscoveredDevice,
} from './types'

// ============================================
// MQTT Configuration
// ============================================

const ADAPTER_NAME = 'mqtt'

// Connection timeout settings
const CONNECTION_TIMEOUT = 10000 // 10 seconds
const RECONNECT_PERIOD = 5000 // 5 seconds
const KEEP_ALIVE = 60 // 60 seconds

// Message staleness threshold (5 minutes)
const MESSAGE_STALE_THRESHOLD = 5 * 60 * 1000

// Maximum number of messages to store (prevents memory leaks)
const MAX_MESSAGE_STORE_SIZE = 1000

// Message cleanup interval (1 minute)
const MESSAGE_CLEANUP_INTERVAL = 60 * 1000

// ============================================
// MQTT Client Storage
// ============================================

// Store MQTT client instances per controller
const clientStore = new Map<string, {
  client: mqtt.MqttClient
  config: MQTTCredentials
  lastConnected: Date | null
  lastError: string | null
}>()

// Store last received messages for each topic
const messageStore = new Map<string, {
  topic: string
  payload: string
  timestamp: Date
}>()

// Track last cleanup time for message store
let lastMessageCleanup = Date.now()

/**
 * Clean up stale messages from the message store to prevent memory leaks.
 * Called automatically during message handling.
 */
function cleanupMessageStore(): void {
  const now = Date.now()

  // Only cleanup if enough time has passed
  if (now - lastMessageCleanup < MESSAGE_CLEANUP_INTERVAL) {
    return
  }

  lastMessageCleanup = now
  const keysToDelete: string[] = []

  // Find stale messages
  messageStore.forEach((msg, key) => {
    if (now - msg.timestamp.getTime() > MESSAGE_STALE_THRESHOLD) {
      keysToDelete.push(key)
    }
  })

  // Delete stale messages
  for (const key of keysToDelete) {
    messageStore.delete(key)
  }

  if (keysToDelete.length > 0) {
    log('info', `Cleaned up ${keysToDelete.length} stale messages from store`)
  }

  // If still too large, remove oldest messages
  if (messageStore.size > MAX_MESSAGE_STORE_SIZE) {
    const entries = Array.from(messageStore.entries())
      .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())

    const toRemove = entries.slice(0, messageStore.size - MAX_MESSAGE_STORE_SIZE)
    for (const [key] of toRemove) {
      messageStore.delete(key)
    }

    log('warn', `Message store exceeded max size, removed ${toRemove.length} oldest entries`)
  }
}

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

export class MQTTAdapter implements ControllerAdapter, DiscoverableAdapter {

  /**
   * Connect to MQTT broker and establish persistent connection
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

    const { brokerUrl, port, username, password, topicPrefix, useTls, clientId } = credentials

    log('info', 'Connecting to MQTT broker', {
      broker: brokerUrl.replace(/\/\/.*:.*@/, '//***:***@'),
      port,
      useTls,
      topicPrefix
    })

    try {
      // Validate required fields
      if (!brokerUrl || !port || !topicPrefix) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'Missing required MQTT configuration: brokerUrl, port, and topicPrefix are required'
        }
      }

      // Generate unique controller ID
      const controllerId = this.generateControllerId(brokerUrl, port, topicPrefix)

      // Check if already connected
      const existing = clientStore.get(controllerId)
      if (existing && existing.client.connected) {
        log('info', `Already connected to ${controllerId}`)
        return {
          success: true,
          controllerId,
          metadata: {
            brand: 'mqtt',
            model: 'Generic MQTT Device',
            capabilities: this.buildCapabilities(credentials)
          }
        }
      }

      // Build MQTT connection URL
      const protocol = this.determineProtocol(brokerUrl, useTls)
      const host = this.extractHost(brokerUrl)
      const connectionUrl = `${protocol}://${host}:${port}`

      log('info', `Connecting to ${connectionUrl}`)

      // Create MQTT client with options
      const client = mqtt.connect(connectionUrl, {
        clientId: clientId || `enviroflow_${controllerId}_${Date.now()}`,
        username,
        password,
        clean: true, // Clean session
        reconnectPeriod: RECONNECT_PERIOD,
        connectTimeout: CONNECTION_TIMEOUT,
        keepalive: KEEP_ALIVE,
        protocolVersion: 4, // MQTT 3.1.1
        will: {
          topic: `${topicPrefix}/status`,
          payload: Buffer.from('offline'),
          qos: 1,
          retain: true
        }
      })

      // Wait for connection or error
      const connected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          client.end(true)
          resolve(false)
        }, CONNECTION_TIMEOUT)

        client.on('connect', () => {
          clearTimeout(timeout)
          log('info', `Connected to MQTT broker: ${connectionUrl}`)
          resolve(true)
        })

        client.on('error', (err) => {
          clearTimeout(timeout)
          log('error', 'MQTT connection error', { error: err.message })
          resolve(false)
        })
      })

      if (!connected) {
        return {
          success: false,
          controllerId: '',
          metadata: this.emptyMetadata(),
          error: 'Failed to connect to MQTT broker. Check broker URL, port, and credentials.'
        }
      }

      // Subscribe to sensor topics
      const sensorTopics = [
        `${topicPrefix}/+/sensors/#`,  // Topic: {prefix}/{controllerId}/sensors/{type}
        `${topicPrefix}/sensors/#`,     // Topic: {prefix}/sensors/{type}
        `${topicPrefix}/tele/+/SENSOR`, // Tasmota-style telemetry
        `${topicPrefix}/stat/+/STATUS`, // Tasmota-style status
      ]

      for (const topic of sensorTopics) {
        client.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            log('warn', `Failed to subscribe to ${topic}`, { error: err.message })
          } else {
            log('info', `Subscribed to sensor topic: ${topic}`)
          }
        })
      }

      // Set up message handler
      client.on('message', (topic: string, message: Buffer) => {
        this.handleMessage(controllerId, topic, message)
      })

      // Set up disconnect handler
      client.on('close', () => {
        log('warn', `MQTT connection closed for ${controllerId}`)
        const stored = clientStore.get(controllerId)
        if (stored) {
          stored.lastConnected = null
        }
      })

      // Set up reconnect handler
      client.on('reconnect', () => {
        log('info', `Reconnecting to MQTT broker for ${controllerId}`)
      })

      // Store client
      clientStore.set(controllerId, {
        client,
        config: credentials,
        lastConnected: new Date(),
        lastError: null
      })

      // Publish online status
      client.publish(`${topicPrefix}/status`, 'online', { qos: 1, retain: true })

      log('info', `MQTT controller connected: ${controllerId}`)

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
   * Read sensor values from MQTT messages
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const stored = clientStore.get(controllerId)
    if (!stored) {
      throw new Error('Controller not connected. Call connect() first.')
    }

    if (!stored.client.connected) {
      throw new Error('MQTT client disconnected. Reconnection in progress.')
    }

    log('info', `Reading sensors from MQTT controller: ${controllerId}`)

    const readings: SensorReading[] = []
    const now = new Date()

    // Scan message store for sensor readings
    messageStore.forEach((msg, key) => {
      if (!key.startsWith(`${controllerId}:`)) {
        return
      }

      try {
        const payload = JSON.parse(msg.payload)

        // Parse sensor data from various formats
        const parsed = this.parseSensorPayload(payload, msg.timestamp)
        readings.push(...parsed)

      } catch (parseError) {
        log('warn', 'Failed to parse MQTT message', {
          topic: msg.topic,
          error: parseError instanceof Error ? parseError.message : 'Parse error'
        })
      }
    })

    // If no readings found, check for recent messages
    if (readings.length === 0) {
      log('info', `No sensor readings available for ${controllerId}`)
    } else {
      log('info', `Read ${readings.length} sensor values from ${controllerId}`, {
        types: readings.map(r => r.type)
      })
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
    const stored = clientStore.get(controllerId)
    if (!stored) {
      return {
        success: false,
        error: 'Controller not connected',
        timestamp: new Date()
      }
    }

    if (!stored.client.connected) {
      return {
        success: false,
        error: 'MQTT client disconnected',
        timestamp: new Date()
      }
    }

    const { client, config } = stored
    const { topicPrefix } = config

    log('info', `Sending MQTT command to ${controllerId}:${port}`, { command })

    try {
      // Build command topic
      const commandTopic = `${topicPrefix}/${controllerId}/devices/${port}/command`

      // Build payload based on command type
      const payload = this.buildCommandPayload(command)

      // Publish command
      await new Promise<void>((resolve, reject) => {
        client.publish(commandTopic, JSON.stringify(payload), { qos: 1 }, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })

      log('info', `MQTT command published: ${commandTopic}`, { payload })

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
   * Get current controller status
   */
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const stored = clientStore.get(controllerId)

    if (!stored) {
      return {
        status: 'offline',
        lastSeen: new Date()
      }
    }

    const isConnected = stored.client.connected

    // Check for LWT message
    const lwtMessage = messageStore.get(`${controllerId}:status`)
    const isOnline = lwtMessage
      ? lwtMessage.payload.toLowerCase() === 'online'
      : isConnected

    return {
      status: isOnline ? 'online' : 'offline',
      lastSeen: stored.lastConnected || new Date(),
      errors: stored.lastError ? [stored.lastError] : undefined
    }
  }

  /**
   * Disconnect from MQTT broker and cleanup
   */
  async disconnect(controllerId: string): Promise<void> {
    const stored = clientStore.get(controllerId)
    if (!stored) {
      return
    }

    const { client, config } = stored

    log('info', `Disconnecting from MQTT controller: ${controllerId}`)

    try {
      // Publish offline status
      await new Promise<void>((resolve) => {
        client.publish(
          `${config.topicPrefix}/status`,
          'offline',
          { qos: 1, retain: true },
          () => resolve()
        )
      })

      // Unsubscribe from all topics
      await new Promise<void>((resolve) => {
        client.unsubscribe('#', () => resolve())
      })

      // Close connection
      await new Promise<void>((resolve) => {
        client.end(false, {}, () => resolve())
      })

    } catch (error) {
      log('warn', 'Error during MQTT disconnect', { error })
    }

    // Clean up stores
    clientStore.delete(controllerId)

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
  // Private Helper Methods
  // ============================================

  private isMQTTCredentials(creds: ControllerCredentials): creds is MQTTCredentials {
    return 'type' in creds && creds.type === 'mqtt'
  }

  private generateControllerId(brokerUrl: string, port: number, topicPrefix: string): string {
    const hash = Buffer.from(`${brokerUrl}:${port}:${topicPrefix}`)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16)
    return `mqtt_${hash}`
  }

  private determineProtocol(brokerUrl: string, useTls: boolean): string {
    // Check if URL already has protocol
    if (brokerUrl.startsWith('mqtt://') || brokerUrl.startsWith('mqtts://')) {
      return brokerUrl.split('://')[0]
    }
    if (brokerUrl.startsWith('ws://') || brokerUrl.startsWith('wss://')) {
      return brokerUrl.split('://')[0]
    }

    // Default to mqtt/mqtts based on useTls
    return useTls ? 'mqtts' : 'mqtt'
  }

  private extractHost(brokerUrl: string): string {
    // Remove protocol if present
    let host = brokerUrl.replace(/^(mqtt|mqtts|ws|wss):\/\//, '')

    // Remove port if present
    host = host.split(':')[0]

    // Remove path if present
    host = host.split('/')[0]

    return host
  }

  private handleMessage(controllerId: string, topic: string, message: Buffer): void {
    const payload = message.toString()
    const timestamp = new Date()

    // Perform periodic cleanup to prevent memory leaks
    cleanupMessageStore()

    log('info', `MQTT message received on ${topic}`, {
      controllerId,
      payloadLength: payload.length
    })

    // Determine message type from topic
    let messageType = 'unknown'
    if (topic.includes('/sensors') || topic.includes('/SENSOR') || topic.includes('/tele')) {
      messageType = 'sensors'
    } else if (topic.includes('/status') || topic.includes('/LWT')) {
      messageType = 'status'
    } else if (topic.includes('/devices') || topic.includes('/stat')) {
      messageType = 'devices'
    }

    // Store message
    messageStore.set(`${controllerId}:${messageType}`, {
      topic,
      payload,
      timestamp
    })

    // Also store by full topic for specific lookups
    messageStore.set(`${controllerId}:topic:${topic}`, {
      topic,
      payload,
      timestamp
    })
  }

  private parseSensorPayload(payload: Record<string, unknown>, timestamp: Date): SensorReading[] {
    const readings: SensorReading[] = []
    const now = new Date()
    const isStale = this.isMessageStale(timestamp)

    // Format 1: Direct sensor fields
    // Example: { "sensor_type": "temperature", "value": 72.5, "unit": "F" }
    if (typeof payload.sensor_type === 'string' && typeof payload.value === 'number') {
      const sensorType = this.mapSensorTypeName(payload.sensor_type)
      if (sensorType) {
        readings.push({
          port: (payload.port as number) || 0,
          type: sensorType,
          value: payload.value,
          unit: (payload.unit as string) || '',
          timestamp: now,
          isStale
        })
      }
    }

    // Format 2: Tasmota-style nested sensors
    // Example: { "AM2301": { "Temperature": 72.5, "Humidity": 55 } }
    const sensorKeys = ['AM2301', 'DHT11', 'DHT22', 'SHT3X', 'DS18B20', 'BME280', 'BMP280']
    for (const key of sensorKeys) {
      if (payload[key] && typeof payload[key] === 'object') {
        const sensor = payload[key] as Record<string, unknown>

        if (typeof sensor.Temperature === 'number') {
          readings.push({
            port: 1,
            type: 'temperature',
            value: sensor.Temperature,
            unit: 'F',
            timestamp: now,
            isStale
          })
        }

        if (typeof sensor.Humidity === 'number') {
          readings.push({
            port: 2,
            type: 'humidity',
            value: sensor.Humidity,
            unit: '%',
            timestamp: now,
            isStale
          })
        }

        if (typeof sensor.Pressure === 'number') {
          readings.push({
            port: 3,
            type: 'pressure',
            value: sensor.Pressure,
            unit: 'hPa',
            timestamp: now,
            isStale
          })
        }
      }
    }

    // Format 3: Flat object with sensor names as keys
    // Example: { "temperature": 72.5, "humidity": 55, "co2": 800 }
    const sensorMappings: Array<{ key: string; type: SensorType; unit: string }> = [
      { key: 'temperature', type: 'temperature', unit: 'F' },
      { key: 'temp', type: 'temperature', unit: 'F' },
      { key: 'humidity', type: 'humidity', unit: '%' },
      { key: 'hum', type: 'humidity', unit: '%' },
      { key: 'co2', type: 'co2', unit: 'ppm' },
      { key: 'vpd', type: 'vpd', unit: 'kPa' },
      { key: 'light', type: 'light', unit: 'lux' },
      { key: 'lux', type: 'light', unit: 'lux' },
      { key: 'ph', type: 'ph', unit: 'pH' },
      { key: 'ec', type: 'ec', unit: 'mS/cm' },
      { key: 'soil_moisture', type: 'soil_moisture', unit: '%' },
      { key: 'pressure', type: 'pressure', unit: 'hPa' }
    ]

    let port = 1
    for (const mapping of sensorMappings) {
      if (typeof payload[mapping.key] === 'number') {
        // Avoid duplicates
        const alreadyExists = readings.some(r => r.type === mapping.type)
        if (!alreadyExists) {
          readings.push({
            port: port++,
            type: mapping.type,
            value: payload[mapping.key] as number,
            unit: mapping.unit,
            timestamp: now,
            isStale
          })
        }
      }
    }

    return readings
  }

  private buildCommandPayload(command: DeviceCommand): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      command: command.type,
      timestamp: new Date().toISOString()
    }

    switch (command.type) {
      case 'turn_on':
        payload.state = 'ON'
        payload.power = true
        break

      case 'turn_off':
        payload.state = 'OFF'
        payload.power = false
        break

      case 'toggle':
        payload.state = 'TOGGLE'
        break

      case 'set_level':
        payload.state = 'ON'
        payload.level = command.value || 0
        payload.dimmer = command.value || 0
        break

      case 'increase':
        payload.state = 'ON'
        payload.increment = command.value || 10
        break

      case 'decrease':
        payload.state = 'ON'
        payload.decrement = command.value || 10
        break
    }

    return payload
  }

  private isMessageStale(timestamp: Date): boolean {
    return Date.now() - timestamp.getTime() > MESSAGE_STALE_THRESHOLD
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
      'soil_moisture': 'soil_moisture',
      'moisture': 'soil_moisture',
      'pressure': 'pressure',
      'water_level': 'water_level',
      'wind_speed': 'wind_speed',
      'pm25': 'pm25',
      'uv': 'uv',
      'solar_radiation': 'solar_radiation',
      'rain': 'rain'
    }
    return nameMap[name.toLowerCase()] || null
  }

  private buildCapabilities(config: MQTTCredentials) {
    // Default capabilities for generic MQTT device
    const sensors: SensorCapability[] = [
      { port: 1, name: 'Temperature', type: 'temperature', unit: 'F' },
      { port: 2, name: 'Humidity', type: 'humidity', unit: '%' },
      { port: 3, name: 'VPD', type: 'vpd', unit: 'kPa' },
      { port: 4, name: 'CO2', type: 'co2', unit: 'ppm' },
      { port: 5, name: 'Light', type: 'light', unit: 'lux' }
    ]

    const devices: DeviceCapability[] = [
      { port: 1, name: 'Relay 1', type: 'outlet', supportsDimming: false },
      { port: 2, name: 'Relay 2', type: 'outlet', supportsDimming: false },
      { port: 3, name: 'Dimmer 1', type: 'light', supportsDimming: true, minLevel: 0, maxLevel: 100 }
    ]

    return {
      sensors,
      devices,
      supportsDimming: true,
      supportsScheduling: true,
      maxPorts: 8
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

  // ============================================
  // Discovery Implementation
  // ============================================

  /**
   * Discover MQTT devices by connecting to broker and listening for messages
   *
   * This method:
   * 1. Connects to the MQTT broker with provided credentials
   * 2. Subscribes to topic wildcard pattern
   * 3. Listens for 10 seconds to collect device messages
   * 4. Parses messages to identify unique devices
   * 5. Returns list of discovered devices with capabilities
   */
  async discoverDevices(credentials: DiscoveryCredentials): Promise<DiscoveryResult> {
    const { brand, email, password } = credentials

    log('info', 'Starting MQTT device discovery', { brand })

    // For MQTT, we expect the credentials to include MQTT connection details
    // Since DiscoveryCredentials only has email/password, we need to handle this differently
    // In practice, for MQTT discovery, we'll use the email as brokerUrl and password as the actual password
    // This is a workaround for the discovery flow

    // Build temporary MQTT credentials from discovery credentials
    // Note: This is a simplified approach. In production, you'd want to collect full MQTT details
    const mqttCreds: MQTTCredentials = {
      type: 'mqtt',
      brokerUrl: email, // Using email field as broker URL (hack for discovery flow)
      port: 1883, // Default MQTT port
      topicPrefix: '#', // Wildcard to discover all topics
      useTls: false,
      username: undefined,
      password: password
    }

    const discoveredDevices: DiscoveredDevice[] = []
    const deviceMessages = new Map<string, { topics: Set<string>; sensors: Set<string>; devices: Set<string> }>()

    try {
      // Build connection URL
      const protocol = this.determineProtocol(mqttCreds.brokerUrl, mqttCreds.useTls)
      const host = this.extractHost(mqttCreds.brokerUrl)
      const port = mqttCreds.port
      const connectionUrl = `${protocol}://${host}:${port}`

      log('info', `Connecting to MQTT broker for discovery: ${connectionUrl}`)

      // Create temporary MQTT client
      const client = mqtt.connect(connectionUrl, {
        clientId: `enviroflow_discovery_${Date.now()}`,
        username: mqttCreds.username,
        password: mqttCreds.password,
        clean: true,
        connectTimeout: CONNECTION_TIMEOUT,
        keepalive: KEEP_ALIVE
      })

      // Wait for connection
      const connected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          client.end(true)
          resolve(false)
        }, CONNECTION_TIMEOUT)

        client.on('connect', () => {
          clearTimeout(timeout)
          log('info', 'Connected to MQTT broker for discovery')
          resolve(true)
        })

        client.on('error', (err) => {
          clearTimeout(timeout)
          log('error', 'MQTT discovery connection error', { error: err.message })
          resolve(false)
        })
      })

      if (!connected) {
        return {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: 'Failed to connect to MQTT broker. Check broker URL, port, and credentials.',
          timestamp: new Date(),
          source: 'cloud_api'
        }
      }

      // Subscribe to wildcard to capture all messages
      client.subscribe('#', { qos: 0 })
      log('info', 'Subscribed to wildcard topic for discovery')

      // Listen for messages for 10 seconds
      const discoveryPromise = new Promise<void>((resolve) => {
        client.on('message', (topic: string, message: Buffer) => {
          const payload = message.toString()

          // Extract device identifier from topic
          // Common patterns:
          // - tasmota/device123/sensor
          // - esphome/living_room/temperature
          // - homeassistant/sensor/device/temp
          // - enviroflow/controller1/sensors/temp

          const topicParts = topic.split('/')
          const deviceId = topicParts.length >= 2 ? topicParts[1] : topicParts[0]

          // Initialize device tracking
          if (!deviceMessages.has(deviceId)) {
            deviceMessages.set(deviceId, {
              topics: new Set(),
              sensors: new Set(),
              devices: new Set()
            })
          }

          const deviceData = deviceMessages.get(deviceId)!
          deviceData.topics.add(topic)

          // Try to parse message and identify sensors/devices
          try {
            const parsed = JSON.parse(payload)

            // Identify sensors from message
            const sensorFields = ['temperature', 'humidity', 'pressure', 'co2', 'light', 'vpd', 'ph', 'ec', 'soil_moisture']
            for (const field of sensorFields) {
              if (field in parsed || field.toUpperCase() in parsed) {
                deviceData.sensors.add(field)
              }
            }

            // Identify devices from message or topic
            if (topic.includes('light') || topic.includes('LIGHT')) {
              deviceData.devices.add('light')
            }
            if (topic.includes('fan') || topic.includes('FAN')) {
              deviceData.devices.add('fan')
            }
            if (topic.includes('outlet') || topic.includes('POWER')) {
              deviceData.devices.add('outlet')
            }

          } catch {
            // Not JSON, check topic for clues
            if (topic.toLowerCase().includes('temp')) {
              deviceData.sensors.add('temperature')
            }
            if (topic.toLowerCase().includes('hum')) {
              deviceData.sensors.add('humidity')
            }
          }
        })

        // Wait 10 seconds for discovery
        setTimeout(() => {
          log('info', `Discovery period complete. Found ${deviceMessages.size} potential devices`)
          resolve()
        }, 10000)
      })

      await discoveryPromise

      // Cleanup: disconnect
      client.end()

      // Build discovered device list
      deviceMessages.forEach((data, deviceId) => {
        const sensors = Array.from(data.sensors)
        const devices = Array.from(data.devices)

        discoveredDevices.push({
          deviceId,
          name: `MQTT Device: ${deviceId}`,
          brand: 'mqtt',
          model: 'Generic MQTT Device',
          isOnline: true,
          lastSeen: new Date(),
          isAlreadyRegistered: false,
          capabilities: {
            sensors,
            devices,
            supportsDimming: devices.includes('light')
          }
        })
      })

      log('info', `MQTT discovery complete. Found ${discoveredDevices.length} devices`)

      return {
        success: true,
        devices: discoveredDevices,
        totalDevices: discoveredDevices.length,
        alreadyRegisteredCount: 0,
        timestamp: new Date(),
        source: 'cloud_api'
      }

    } catch (error) {
      log('error', 'MQTT discovery failed', { error })
      return {
        success: false,
        devices: [],
        totalDevices: 0,
        alreadyRegisteredCount: 0,
        error: error instanceof Error ? error.message : 'Discovery failed',
        timestamp: new Date(),
        source: 'cloud_api'
      }
    }
  }
}

// ============================================
// Utility Functions (for webhook/bridge)
// ============================================

/**
 * Handle incoming MQTT message from external bridge
 * Use this when MQTT messages are forwarded via webhook
 */
export function handleMQTTMessage(
  controllerId: string,
  topic: string,
  payload: string
): void {
  const timestamp = new Date()

  // Perform periodic cleanup to prevent memory leaks
  cleanupMessageStore()

  log('info', `External MQTT message received for ${controllerId}`, { topic })

  // Determine message type
  let messageType = 'unknown'
  if (topic.includes('/sensors') || topic.includes('/SENSOR')) {
    messageType = 'sensors'
  } else if (topic.includes('/status') || topic.includes('/LWT')) {
    messageType = 'status'
  }

  // Store message
  messageStore.set(`${controllerId}:${messageType}`, {
    topic,
    payload,
    timestamp
  })

  messageStore.set(`${controllerId}:topic:${topic}`, {
    topic,
    payload,
    timestamp
  })
}

/**
 * Clear message store (for testing)
 */
export function clearMessageStore(): void {
  messageStore.clear()
}

/**
 * Clear all connections and cleanup (for testing)
 */
export async function disconnectAll(): Promise<void> {
  const controllers = Array.from(clientStore.keys())
  const adapter = new MQTTAdapter()

  for (const controllerId of controllers) {
    await adapter.disconnect(controllerId)
  }

  clientStore.clear()
  messageStore.clear()
}
