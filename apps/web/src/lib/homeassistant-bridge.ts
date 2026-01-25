/**
 * Home Assistant MQTT Bridge
 *
 * Provides two-way integration between EnviroFlow and Home Assistant using MQTT Discovery.
 * This allows Home Assistant to automatically discover and control EnviroFlow entities.
 *
 * Features:
 * - Auto-publish sensor entities to HA MQTT Discovery
 * - Device controls (fans, lights, outlets) as HA entities
 * - Two-way sync with last-write-wins conflict resolution
 * - State change notifications
 *
 * MQTT Discovery Format:
 * homeassistant/<component>/enviroflow_<controller_id>_<entity>/config
 *
 * @see https://www.home-assistant.io/integrations/mqtt/#mqtt-discovery
 */

import type {
  Controller,
  SensorReading,
  SensorType,
  DeviceType,
} from '@/types'

// ============================================
// MQTT Configuration Types
// ============================================

export interface MQTTConfig {
  brokerUrl: string
  username?: string
  password?: string
  clientId?: string
  port?: number
  useTLS?: boolean
}

export interface HomeAssistantBridgeConfig {
  mqtt: MQTTConfig
  enabled: boolean
  discoveryPrefix?: string // Default: "homeassistant"
  statePrefix?: string // Default: "enviroflow"
  updateInterval?: number // Default: 30000ms (30 seconds)
}

// ============================================
// Home Assistant Entity Types
// ============================================

export interface HADeviceInfo {
  identifiers: string[]
  name: string
  manufacturer: string
  model?: string
  sw_version?: string
  via_device?: string
}

export interface HADiscoveryConfig {
  name: string
  unique_id: string
  state_topic: string
  command_topic?: string
  availability_topic?: string
  device: HADeviceInfo
  device_class?: string
  unit_of_measurement?: string
  value_template?: string
  icon?: string
  state_class?: 'measurement' | 'total' | 'total_increasing'
  expire_after?: number
  force_update?: boolean
  min?: number
  max?: number
  step?: number
  optimistic?: boolean
  payload_on?: string
  payload_off?: string
  payload_available?: string
  payload_not_available?: string
}

export interface HAEntityState {
  state: string | number | boolean
  attributes?: Record<string, unknown>
  last_updated?: string
  last_changed?: string
}

// ============================================
// Mapping Functions
// ============================================

/**
 * Map EnviroFlow sensor type to Home Assistant device class
 */
export function mapSensorTypeToHADeviceClass(sensorType: SensorType): string | undefined {
  const mapping: Record<SensorType, string | undefined> = {
    temperature: 'temperature',
    humidity: 'humidity',
    pressure: 'pressure',
    vpd: undefined, // Custom sensor, no standard HA class
    co2: undefined, // Use 'carbon_dioxide' in newer HA versions
    light: 'illuminance',
    ph: undefined,
    ec: undefined,
    soil_moisture: 'moisture',
    wind_speed: 'wind_speed',
    pm25: 'pm25',
    water_level: undefined,
    uv: undefined,
    solar_radiation: 'irradiance',
    rain: 'precipitation',
  }

  return mapping[sensorType]
}

/**
 * Map EnviroFlow sensor type to Home Assistant icon
 */
export function mapSensorTypeToHAIcon(sensorType: SensorType): string {
  const iconMapping: Record<SensorType, string> = {
    temperature: 'mdi:thermometer',
    humidity: 'mdi:water-percent',
    vpd: 'mdi:gauge',
    co2: 'mdi:molecule-co2',
    light: 'mdi:lightbulb',
    ph: 'mdi:ph',
    ec: 'mdi:flash',
    soil_moisture: 'mdi:water',
    pressure: 'mdi:gauge',
    wind_speed: 'mdi:weather-windy',
    pm25: 'mdi:air-filter',
    water_level: 'mdi:water-check',
    uv: 'mdi:weather-sunny-alert',
    solar_radiation: 'mdi:solar-power',
    rain: 'mdi:weather-rainy',
  }

  return iconMapping[sensorType] || 'mdi:gauge'
}

/**
 * Map EnviroFlow device type to Home Assistant component
 */
export function mapDeviceTypeToHAComponent(deviceType: DeviceType): string {
  const componentMapping: Record<DeviceType, string> = {
    fan: 'fan',
    light: 'light',
    outlet: 'switch',
    heater: 'climate',
    cooler: 'climate',
    humidifier: 'humidifier',
    dehumidifier: 'humidifier',
    pump: 'switch',
    valve: 'switch',
  }

  return componentMapping[deviceType] || 'switch'
}

// ============================================
// Discovery Payload Builders
// ============================================

/**
 * Build Home Assistant MQTT Discovery payload for a sensor
 */
export function buildSensorDiscoveryPayload(
  controller: Controller,
  reading: SensorReading,
  config: HomeAssistantBridgeConfig
): HADiscoveryConfig {
  const statePrefix = config.statePrefix || 'enviroflow'
  const uniqueId = `enviroflow_${controller.id}_${reading.sensor_type}_${reading.port || 0}`

  const deviceInfo: HADeviceInfo = {
    identifiers: [`enviroflow_${controller.id}`],
    name: controller.name,
    manufacturer: 'EnviroFlow',
    model: controller.model || controller.brand,
    sw_version: controller.firmware_version || undefined,
  }

  const discoveryConfig: HADiscoveryConfig = {
    name: `${controller.name} ${reading.sensor_type.replace(/_/g, ' ')}`,
    unique_id: uniqueId,
    state_topic: `${statePrefix}/${controller.id}/sensors/${reading.sensor_type}/${reading.port || 0}`,
    availability_topic: `${statePrefix}/${controller.id}/availability`,
    device: deviceInfo,
    device_class: mapSensorTypeToHADeviceClass(reading.sensor_type),
    unit_of_measurement: reading.unit,
    icon: mapSensorTypeToHAIcon(reading.sensor_type),
    state_class: 'measurement',
    expire_after: 600, // Mark as unavailable after 10 minutes without update
    force_update: true,
    payload_available: 'online',
    payload_not_available: 'offline',
  }

  return discoveryConfig
}

/**
 * Build Home Assistant MQTT Discovery payload for a controllable device
 */
export function buildDeviceDiscoveryPayload(
  controller: Controller,
  port: number,
  deviceType: DeviceType,
  deviceName: string | undefined,
  config: HomeAssistantBridgeConfig
): HADiscoveryConfig {
  const statePrefix = config.statePrefix || 'enviroflow'
  const uniqueId = `enviroflow_${controller.id}_${deviceType}_${port}`

  const deviceInfo: HADeviceInfo = {
    identifiers: [`enviroflow_${controller.id}`],
    name: controller.name,
    manufacturer: 'EnviroFlow',
    model: controller.model || controller.brand,
    sw_version: controller.firmware_version || undefined,
  }

  const component = mapDeviceTypeToHAComponent(deviceType)
  const name = deviceName || `${controller.name} ${deviceType} ${port}`

  const discoveryConfig: HADiscoveryConfig = {
    name,
    unique_id: uniqueId,
    state_topic: `${statePrefix}/${controller.id}/devices/${port}/state`,
    command_topic: `${statePrefix}/${controller.id}/devices/${port}/set`,
    availability_topic: `${statePrefix}/${controller.id}/availability`,
    device: deviceInfo,
    payload_available: 'online',
    payload_not_available: 'offline',
    optimistic: false,
  }

  // Add dimming support if applicable
  if (controller.capabilities?.supportsDimming && (deviceType === 'light' || deviceType === 'fan')) {
    discoveryConfig.min = 0
    discoveryConfig.max = 100
    discoveryConfig.step = 1
  }

  // Add on/off payloads for switches
  if (component === 'switch') {
    discoveryConfig.payload_on = 'ON'
    discoveryConfig.payload_off = 'OFF'
  }

  return discoveryConfig
}

// ============================================
// State Management
// ============================================

/**
 * Build MQTT state payload for a sensor reading
 */
export function buildSensorStatePayload(reading: SensorReading): string {
  return reading.value.toString()
}

/**
 * Build MQTT state payload for a device
 */
export function buildDeviceStatePayload(
  isOn: boolean,
  level?: number
): string {
  if (level !== undefined) {
    return JSON.stringify({
      state: isOn ? 'ON' : 'OFF',
      brightness: level,
    })
  }
  return isOn ? 'ON' : 'OFF'
}

/**
 * Parse incoming MQTT command from Home Assistant
 */
export interface ParsedDeviceCommand {
  action: 'turn_on' | 'turn_off' | 'set_level'
  level?: number
}

export function parseHACommand(payload: string): ParsedDeviceCommand {
  try {
    // Try parsing as JSON first (for brightness control)
    const data = JSON.parse(payload)
    if (typeof data === 'object' && data !== null) {
      if ('brightness' in data) {
        return {
          action: 'set_level',
          level: Number(data.brightness),
        }
      }
      if ('state' in data) {
        return {
          action: data.state === 'ON' ? 'turn_on' : 'turn_off',
        }
      }
    }
  } catch {
    // Not JSON, parse as plain text
  }

  // Parse simple ON/OFF commands
  const upperPayload = payload.toString().trim().toUpperCase()
  if (upperPayload === 'ON') {
    return { action: 'turn_on' }
  }
  if (upperPayload === 'OFF') {
    return { action: 'turn_off' }
  }

  // Try parsing as a number (brightness level)
  const numValue = Number(payload)
  if (!isNaN(numValue)) {
    return {
      action: 'set_level',
      level: numValue,
    }
  }

  // Default to turn on
  return { action: 'turn_on' }
}

// ============================================
// Conflict Resolution
// ============================================

export interface SyncState {
  source: 'enviroflow' | 'homeassistant'
  timestamp: number
  value: unknown
}

/**
 * Last-write-wins conflict resolution
 */
export function resolveConflict(
  enviroflowState: SyncState,
  haState: SyncState
): 'enviroflow' | 'homeassistant' | 'same' {
  // If timestamps are the same (within 1 second), consider them the same
  if (Math.abs(enviroflowState.timestamp - haState.timestamp) < 1000) {
    return 'same'
  }

  // Otherwise, use the more recent one
  return enviroflowState.timestamp > haState.timestamp
    ? 'enviroflow'
    : 'homeassistant'
}

// ============================================
// Topic Builders
// ============================================

/**
 * Build MQTT discovery topic for an entity
 */
export function buildDiscoveryTopic(
  component: string,
  controllerId: string,
  entityId: string,
  discoveryPrefix = 'homeassistant'
): string {
  return `${discoveryPrefix}/${component}/enviroflow_${controllerId}_${entityId}/config`
}

/**
 * Build MQTT state topic for a sensor
 */
export function buildSensorStateTopic(
  controllerId: string,
  sensorType: string,
  port: number,
  statePrefix = 'enviroflow'
): string {
  return `${statePrefix}/${controllerId}/sensors/${sensorType}/${port}`
}

/**
 * Build MQTT state topic for a device
 */
export function buildDeviceStateTopic(
  controllerId: string,
  port: number,
  statePrefix = 'enviroflow'
): string {
  return `${statePrefix}/${controllerId}/devices/${port}/state`
}

/**
 * Build MQTT command topic for a device
 */
export function buildDeviceCommandTopic(
  controllerId: string,
  port: number,
  statePrefix = 'enviroflow'
): string {
  return `${statePrefix}/${controllerId}/devices/${port}/set`
}

/**
 * Build MQTT availability topic for a controller
 */
export function buildAvailabilityTopic(
  controllerId: string,
  statePrefix = 'enviroflow'
): string {
  return `${statePrefix}/${controllerId}/availability`
}

// ============================================
// Validation
// ============================================

/**
 * Validate MQTT configuration
 */
export function validateMQTTConfig(config: MQTTConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!config.brokerUrl) {
    errors.push('MQTT broker URL is required')
  } else {
    // Validate URL format
    try {
      new URL(config.brokerUrl)
    } catch {
      errors.push('Invalid MQTT broker URL format')
    }
  }

  if (config.port && (config.port < 1 || config.port > 65535)) {
    errors.push('MQTT port must be between 1 and 65535')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate Home Assistant bridge configuration
 */
export function validateBridgeConfig(config: HomeAssistantBridgeConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  const mqttValidation = validateMQTTConfig(config.mqtt)
  if (!mqttValidation.valid) {
    errors.push(...mqttValidation.errors)
  }

  if (config.discoveryPrefix && !/^[a-zA-Z0-9_-]+$/.test(config.discoveryPrefix)) {
    errors.push('Discovery prefix must contain only letters, numbers, hyphens, and underscores')
  }

  if (config.statePrefix && !/^[a-zA-Z0-9_-]+$/.test(config.statePrefix)) {
    errors.push('State prefix must contain only letters, numbers, hyphens, and underscores')
  }

  if (config.updateInterval && config.updateInterval < 1000) {
    errors.push('Update interval must be at least 1000ms (1 second)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique client ID for MQTT connection
 */
export function generateMQTTClientId(prefix = 'enviroflow'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sanitize entity name for Home Assistant
 */
export function sanitizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Build complete device registry entry for Home Assistant
 */
export function buildDeviceRegistry(controller: Controller): HADeviceInfo {
  return {
    identifiers: [`enviroflow_${controller.id}`],
    name: controller.name,
    manufacturer: 'EnviroFlow',
    model: controller.model || controller.brand,
    sw_version: controller.firmware_version || undefined,
  }
}
