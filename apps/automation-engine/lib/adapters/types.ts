/**
 * EnviroFlow Controller Adapter Types
 * Based on MVP Spec v2.0
 * 
 * Supported brands:
 * - AC Infinity (Controller 69, UIS Dimmers)
 * - Inkbird (ITC-308, ITC-310T)
 * - Govee (H5179 - BLE, read-only)
 * - CSV Upload (Manual data)
 * - MQTT (Generic - Phase 2)
 */

// ============================================
// Adapter Interface
// ============================================

export interface ControllerAdapter {
  /** Connect to controller and retrieve metadata */
  connect(credentials: ControllerCredentials): Promise<ConnectionResult>
  
  /** Read all sensor values */
  readSensors(controllerId: string): Promise<SensorReading[]>
  
  /** Send command to device (fan, light, outlet) */
  controlDevice(controllerId: string, port: number, command: DeviceCommand): Promise<CommandResult>
  
  /** Get current status (online/offline) */
  getStatus(controllerId: string): Promise<ControllerStatus>
  
  /** Disconnect and cleanup */
  disconnect(controllerId: string): Promise<void>
}

// ============================================
// Credential Types (per brand)
// ============================================

export type ControllerCredentials = 
  | ACInfinityCredentials
  | InkbirdCredentials
  | GoveeCredentials
  | CSVUploadCredentials
  | MQTTCredentials
  | GenericCredentials

export interface ACInfinityCredentials {
  type: 'ac_infinity'
  email: string
  password: string
}

export interface InkbirdCredentials {
  type: 'inkbird'
  email: string
  password: string
}

export interface GoveeCredentials {
  type: 'govee'
  apiKey?: string
  // BLE devices discovered via mobile app
  bleDeviceId?: string
}

export interface CSVUploadCredentials {
  type: 'csv_upload'
  // No credentials needed - data uploaded manually
}

export interface MQTTCredentials {
  type: 'mqtt'
  brokerUrl: string
  username?: string
  password?: string
  topic: string
}

export interface GenericCredentials {
  type: 'generic'
  [key: string]: unknown
}

// ============================================
// Connection Result
// ============================================

export interface ConnectionResult {
  success: boolean
  controllerId: string
  metadata: ControllerMetadata
  error?: string
}

export interface ControllerMetadata {
  brand: ControllerBrand
  model?: string
  firmwareVersion?: string
  capabilities: ControllerCapabilities
}

export type ControllerBrand = 
  | 'ac_infinity' 
  | 'inkbird' 
  | 'govee' 
  | 'csv_upload' 
  | 'mqtt' 
  | 'custom'

export interface ControllerCapabilities {
  sensors: SensorCapability[]
  devices: DeviceCapability[]
  supportsDimming: boolean
  supportsScheduling: boolean
  maxPorts: number
}

// ============================================
// Sensor Types
// ============================================

export interface SensorCapability {
  port: number
  name?: string
  type: SensorType
  unit: string
  minValue?: number
  maxValue?: number
}

export type SensorType = 
  | 'temperature'
  | 'humidity'
  | 'vpd'
  | 'co2'
  | 'light'
  | 'ph'
  | 'ec'
  | 'soil_moisture'
  | 'pressure'

export interface SensorReading {
  port: number
  type: SensorType
  value: number
  unit: string
  timestamp: Date
  isStale?: boolean
}

// ============================================
// Device Types
// ============================================

export interface DeviceCapability {
  port: number
  name?: string
  type: DeviceType
  supportsDimming: boolean
  minLevel?: number
  maxLevel?: number
  currentLevel?: number
  isOn?: boolean
}

export type DeviceType = 
  | 'fan'
  | 'light'
  | 'heater'
  | 'cooler'
  | 'humidifier'
  | 'dehumidifier'
  | 'outlet'
  | 'pump'
  | 'valve'

// ============================================
// Commands
// ============================================

export interface DeviceCommand {
  type: CommandType
  value?: number  // 0-100 for dimmers, undefined for on/off
}

export type CommandType = 
  | 'turn_on'
  | 'turn_off'
  | 'set_level'      // 0-100
  | 'increase'       // Increment by value
  | 'decrease'       // Decrement by value
  | 'toggle'

export interface CommandResult {
  success: boolean
  error?: string
  actualValue?: number
  previousValue?: number
  timestamp: Date
}

// ============================================
// Status
// ============================================

export interface ControllerStatus {
  status: 'online' | 'offline' | 'error' | 'initializing'
  lastSeen: Date
  firmwareVersion?: string
  signalStrength?: number
  batteryLevel?: number
  errors?: string[]
}

// ============================================
// Dry-Run Simulation
// ============================================

export interface DryRunResult {
  timestamp: Date
  action: string
  wouldExecute: boolean
  predictedResult: 'success' | 'failed' | 'skipped'
  reason?: string
  sensorContext?: SensorReading[]
}

// ============================================
// Sunrise/Sunset Dimming
// ============================================

export interface DimmerSchedule {
  id: string
  controllerId: string
  port: number
  scheduleType: 'sunrise' | 'sunset' | 'custom' | 'dli_curve'
  startTime: string  // HH:MM format
  endTime?: string
  durationMinutes: number
  startIntensity: number  // 0-100
  targetIntensity: number // 0-100
  curve: DimmerCurve
  isActive: boolean
}

export type DimmerCurve = 
  | 'linear'      // Straight line
  | 'sigmoid'     // S-curve (natural sunrise/sunset)
  | 'exponential' // Faster at start
  | 'logarithmic' // Faster at end

// ============================================
// Workflow Node Types
// ============================================

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
}

export type NodeType = 
  | 'trigger'
  | 'sensor'
  | 'condition'
  | 'action'
  | 'delay'
  | 'dimmer'
  | 'notification'

export type NodeData = 
  | TriggerNodeData
  | SensorNodeData
  | ConditionNodeData
  | ActionNodeData
  | DelayNodeData
  | DimmerNodeData
  | NotificationNodeData

export interface TriggerNodeData {
  variant: 'schedule' | 'sensor_threshold' | 'time_of_day' | 'sunrise' | 'sunset' | 'manual'
  schedule?: string  // Cron expression
  time?: string      // HH:MM
  sensorType?: SensorType
  threshold?: number
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
}

export interface SensorNodeData {
  controllerId: string
  port: number
  sensorType: SensorType
}

export interface ConditionNodeData {
  operator: 'and' | 'or' | 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between'
  value?: number
  minValue?: number
  maxValue?: number
}

export interface ActionNodeData {
  variant: 'set_fan' | 'set_light' | 'toggle_outlet' | 'set_level' | 'send_notification'
  controllerId: string
  port: number
  value?: number
  notificationMessage?: string
}

export interface DelayNodeData {
  duration: number  // Seconds
  unit: 'seconds' | 'minutes' | 'hours'
}

export interface DimmerNodeData {
  controllerId: string
  port: number
  startIntensity: number
  targetIntensity: number
  durationMinutes: number
  curve: DimmerCurve
}

export interface NotificationNodeData {
  message: string
  channels: ('push' | 'email' | 'sms')[]
  priority: 'low' | 'normal' | 'high' | 'critical'
}

// ============================================
// Push Notifications
// ============================================

export interface PushNotification {
  userId: string
  title: string
  body: string
  category: NotificationCategory
  data?: Record<string, unknown>
  priority: 'low' | 'normal' | 'high'
}

export type NotificationCategory = 
  | 'alert'           // Controller offline, errors
  | 'transition'      // Growth stage change, sunrise/sunset
  | 'daily_summary'   // Daily report
  | 'security'        // 2FA, new device login

// ============================================
// Database Types (matching Supabase schema)
// ============================================

export interface DBController {
  id: string
  user_id: string
  brand: ControllerBrand
  controller_id: string
  name: string
  credentials: ControllerCredentials
  capabilities: ControllerCapabilities
  status: 'online' | 'offline' | 'error' | 'initializing'
  last_seen: string | null
  last_error: string | null
  firmware_version: string | null
  model: string | null
  room_id: string | null
  created_at: string
  updated_at: string
}

export interface DBRoom {
  id: string
  user_id: string
  name: string
  description: string | null
  settings: Record<string, unknown>
  current_stage: string | null
  stage_started_at: string | null
  latitude: number | null
  longitude: number | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface DBWorkflow {
  id: string
  user_id: string
  room_id: string | null
  name: string
  description: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  last_run: string | null
  last_error: string | null
  run_count: number
  dry_run_enabled: boolean
  growth_stage: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface DBSensorReading {
  id: string
  controller_id: string
  user_id: string
  port: number | null
  sensor_type: SensorType
  value: number
  unit: string
  is_stale: boolean
  timestamp: string
}

export interface DBActivityLog {
  id: string
  user_id: string
  workflow_id: string | null
  room_id: string | null
  controller_id: string | null
  action_type: string
  action_data: Record<string, unknown>
  result: 'success' | 'failed' | 'skipped' | 'dry_run'
  error_message: string | null
  ip_address: string | null
  user_agent: string | null
  timestamp: string
}

// ============================================
// Network/Cloud Discovery Types
// ============================================

/**
 * A device discovered through cloud API or network scanning.
 * Represents a controller that can be added to EnviroFlow.
 */
export interface DiscoveredDevice {
  /** Unique device identifier from the cloud API */
  deviceId: string
  /** Device code/serial number (if available) */
  deviceCode?: string
  /** Human-readable device name */
  name: string
  /** Controller brand */
  brand: ControllerBrand
  /** Device model (e.g., "Controller 69", "ITC-308") */
  model?: string
  /** Device type code (brand-specific) */
  deviceType?: number
  /** Is device currently online */
  isOnline: boolean
  /** Last online timestamp */
  lastSeen?: Date
  /** Firmware version (if available) */
  firmwareVersion?: string
  /** IP address (for local network devices, if discoverable) */
  ipAddress?: string
  /** MAC address (if available) */
  macAddress?: string
  /** Whether this device is already registered in EnviroFlow */
  isAlreadyRegistered?: boolean
  /** Device capabilities summary */
  capabilities?: {
    sensors?: string[]
    devices?: string[]
    supportsDimming?: boolean
  }
}

/**
 * Result of a cloud-based device discovery operation.
 */
export interface DiscoveryResult {
  /** Whether the discovery was successful */
  success: boolean
  /** List of discovered devices */
  devices: DiscoveredDevice[]
  /** Total number of devices found */
  totalDevices: number
  /** Number of devices already registered */
  alreadyRegisteredCount: number
  /** Error message if discovery failed */
  error?: string
  /** Timestamp of the discovery */
  timestamp: Date
  /** Source of discovery (cloud, mdns, upnp, etc.) */
  source: DiscoverySource
}

/**
 * Source of device discovery
 */
export type DiscoverySource =
  | 'cloud_api'      // Via brand's cloud API (most reliable)
  | 'mdns'           // Via mDNS/Bonjour local network discovery
  | 'upnp'           // Via UPnP/SSDP local network discovery
  | 'manual_scan'    // Via IP range scanning

/**
 * Credentials required for cloud-based discovery
 */
export interface DiscoveryCredentials {
  brand: ControllerBrand
  email: string
  password: string
}

/**
 * Interface for adapters that support cloud-based device discovery
 */
export interface DiscoverableAdapter extends ControllerAdapter {
  /**
   * Discover all devices associated with the given credentials.
   * This queries the brand's cloud API to list all registered devices.
   *
   * @param credentials - User credentials for the brand's cloud service
   * @returns Discovery result with list of devices
   */
  discoverDevices(credentials: DiscoveryCredentials): Promise<DiscoveryResult>
}
