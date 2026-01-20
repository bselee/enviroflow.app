/**
 * Controller Types for EnviroFlow
 * Defines all types related to physical controllers (AC Infinity, Inkbird, etc.)
 */

export type ControllerBrand = 'ac_infinity' | 'inkbird' | 'generic_wifi'

export type SensorType = 'temperature' | 'humidity' | 'vpd' | 'co2' | 'light' | 'ph' | 'ec'

export type DeviceType = 'fan' | 'light' | 'heater' | 'humidifier' | 'dehumidifier' | 'pump' | 'relay'

export interface ControllerCredentials {
  email?: string
  password?: string
  apiKey?: string
  ipAddress?: string
  port?: number
  // Generic WiFi specific
  apiBase?: string
  endpoints?: {
    sensors?: string
    control?: string
    status?: string
  }
  [key: string]: unknown
}

export interface SensorCapability {
  port: number
  type: SensorType
  unit: string
  name?: string
}

export interface DeviceCapability {
  port: number
  type: DeviceType
  name?: string
  supportsDimming: boolean
  minLevel?: number
  maxLevel?: number
}

export interface ControllerCapabilities {
  sensors: SensorCapability[]
  devices: DeviceCapability[]
}

export interface ControllerMetadata {
  controllerId: string
  brand: ControllerBrand
  model?: string
  firmware?: string
  capabilities: ControllerCapabilities
}

export interface Controller {
  id: string
  user_id: string
  brand: ControllerBrand
  controller_id: string
  name: string
  credentials: ControllerCredentials
  capabilities: ControllerCapabilities | null
  is_online: boolean
  last_seen: string | null
  created_at: string
  updated_at: string
}

export interface ControllerStatus {
  isOnline: boolean
  lastSeen: Date
  firmware?: string
  signal?: number
}

export interface DeviceCommand {
  type: 'set_level' | 'turn_on' | 'turn_off'
  value?: number // 0-100 for dimmers, ignored for on/off
}

export interface CommandResult {
  success: boolean
  error?: string
  currentState?: {
    port: number
    level: number
    isOn: boolean
  }
}

// Database row types
export interface ControllerRow {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: ControllerCredentials
  capabilities: ControllerCapabilities | null
  is_online: boolean
  last_seen: string | null
  created_at: string
  updated_at: string
}

// Insert/Update types
export interface ControllerInsert {
  user_id: string
  brand: ControllerBrand
  controller_id: string
  name: string
  credentials: ControllerCredentials
  capabilities?: ControllerCapabilities
  is_online?: boolean
  last_seen?: string
}

export interface ControllerUpdate {
  name?: string
  credentials?: ControllerCredentials
  capabilities?: ControllerCapabilities
  is_online?: boolean
  last_seen?: string
}
