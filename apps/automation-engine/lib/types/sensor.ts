/**
 * Sensor Types for EnviroFlow
 * Defines all types related to sensor readings and data
 */

import type { SensorType } from './controller'

export interface SensorReading {
  port: number
  type: SensorType
  value: number
  unit: string
  timestamp: Date
}

export interface SensorReadingRow {
  id: string
  controller_id: string
  sensor_type: string
  value: number
  unit: string
  port: number | null
  timestamp: string
}

export interface SensorReadingInsert {
  controller_id: string
  sensor_type: SensorType
  value: number
  unit: string
  port?: number
  timestamp?: string
}

// Activity log types
export type ActivityAction =
  | 'workflow_executed'
  | 'device_controlled'
  | 'controller_connected'
  | 'controller_disconnected'
  | 'sensor_reading'
  | 'sunrise_executed'
  | 'sunset_executed'
  | 'health_check'
  | 'error'

export type ActivityResult = 'success' | 'failed' | 'skipped'

export interface ActivityLog {
  id: string
  user_id: string
  workflow_id: string | null
  controller_id: string | null
  action: ActivityAction
  result: ActivityResult
  metadata: Record<string, unknown> | null
  timestamp: string
}

export interface ActivityLogInsert {
  user_id: string
  workflow_id?: string
  controller_id?: string
  action: ActivityAction
  result: ActivityResult
  metadata?: Record<string, unknown>
}

// Aggregated sensor data for charts
export interface SensorDataPoint {
  timestamp: string
  value: number
}

export interface SensorTimeSeries {
  controllerId: string
  sensorType: SensorType
  unit: string
  data: SensorDataPoint[]
}

// Sensor statistics
export interface SensorStats {
  controllerId: string
  sensorType: SensorType
  min: number
  max: number
  avg: number
  current: number
  unit: string
  period: string // e.g., '24h', '7d'
}

// VPD calculation helpers
export interface VPDInput {
  temperatureF: number
  humidity: number
  leafTemperatureOffset?: number // typically 2-5°F below air temp
}

export interface VPDResult {
  vpd: number // in kPa
  saturationPressure: number
  actualPressure: number
  isOptimal: boolean // typically 0.8-1.2 kPa for veg, 1.0-1.5 for flower
}

// Unit conversion types
export type TemperatureUnit = 'F' | 'C'

export interface TemperatureConversion {
  value: number
  from: TemperatureUnit
  to: TemperatureUnit
}
