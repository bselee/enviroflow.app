/**
 * CSV Upload Adapter
 * 
 * For users without API access or with unsupported controllers.
 * Allows manual upload of sensor data in CSV format.
 * 
 * Expected CSV format:
 * timestamp,temperature,humidity,vpd,co2,light
 * 2026-01-20T10:00:00Z,78.5,55,1.2,800,45000
 * 
 * This adapter is READ-ONLY - it cannot control devices.
 */

import type {
  ControllerAdapter,
  ControllerCredentials,
  CSVUploadCredentials,
  ConnectionResult,
  ControllerMetadata,
  SensorReading,
  DeviceCommand,
  CommandResult,
  ControllerStatus,
  SensorType,
  SensorCapability,
} from './types'

// In-memory storage for CSV data (in production, use database)
const csvDataStore = new Map<string, CSVSensorData[]>()

interface CSVSensorData {
  timestamp: Date
  temperature?: number
  humidity?: number
  vpd?: number
  co2?: number
  light?: number
  ph?: number
  ec?: number
}

interface CSVParseResult {
  success: boolean
  data: CSVSensorData[]
  errors: string[]
  rowCount: number
}

/**
 * Sensor value bounds for validation
 * These represent physically reasonable ranges to catch data entry errors
 */
const SENSOR_BOUNDS = {
  temperature: { min: -50, max: 200, unit: '°F' },      // Reasonable temp range
  humidity: { min: 0, max: 100, unit: '%' },            // Percentage
  vpd: { min: 0, max: 10, unit: 'kPa' },               // Typical VPD range
  co2: { min: 0, max: 50000, unit: 'ppm' },            // High CO2 for enrichment scenarios
  light: { min: 0, max: 200000, unit: 'lux' },         // Direct sunlight ~100k lux
  ph: { min: 0, max: 14, unit: 'pH' },                 // pH scale
  ec: { min: 0, max: 20, unit: 'mS/cm' }              // Typical EC range
} as const

/**
 * Validate a sensor value is within reasonable bounds
 */
function validateSensorValue(
  type: keyof typeof SENSOR_BOUNDS,
  value: number,
  row: number
): { valid: boolean; error?: string } {
  const bounds = SENSOR_BOUNDS[type]

  if (!isFinite(value)) {
    return { valid: false, error: `Row ${row}: ${type} value is not a valid number` }
  }

  if (value < bounds.min || value > bounds.max) {
    return {
      valid: false,
      error: `Row ${row}: ${type} value ${value} is outside valid range (${bounds.min}-${bounds.max} ${bounds.unit})`
    }
  }

  return { valid: true }
}

// ============================================
// CSV Upload Adapter Implementation
// ============================================

export class CSVUploadAdapter implements ControllerAdapter {

  /**
   * "Connect" a CSV upload controller
   * This just creates a virtual controller ID for tracking
   */
  async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
    if (!this.isCSVCredentials(credentials)) {
      return {
        success: false,
        controllerId: '',
        metadata: this.emptyMetadata(),
        error: 'Invalid credentials type. Expected CSV upload credentials.'
      }
    }

    // Generate a unique controller ID
    const controllerId = `csv_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Initialize empty data store
    csvDataStore.set(controllerId, [])

    return {
      success: true,
      controllerId,
      metadata: {
        brand: 'csv_upload',
        model: 'Manual CSV Data',
        capabilities: {
          sensors: this.getDefaultSensorCapabilities(),
          devices: [], // No controllable devices
          supportsDimming: false,
          supportsScheduling: false,
          maxPorts: 0
        }
      }
    }
  }

  /**
   * Upload CSV data to this controller
   * This is a custom method not in the standard interface
   */
  async uploadCSV(controllerId: string, csvContent: string): Promise<CSVParseResult> {
    const parseResult = this.parseCSV(csvContent)

    if (parseResult.success && parseResult.data.length > 0) {
      // Store the data
      const existingData = csvDataStore.get(controllerId) || []
      csvDataStore.set(controllerId, [...existingData, ...parseResult.data])
    }

    return parseResult
  }

  /**
   * Read the most recent sensor values from uploaded CSV data
   */
  async readSensors(controllerId: string): Promise<SensorReading[]> {
    const data = csvDataStore.get(controllerId)
    
    if (!data || data.length === 0) {
      return []
    }

    // Get the most recent entry
    const latest = data[data.length - 1]
    const readings: SensorReading[] = []
    const now = new Date()

    // Check if data is stale (more than 5 minutes old)
    const isStale = (now.getTime() - latest.timestamp.getTime()) > 5 * 60 * 1000

    if (latest.temperature !== undefined) {
      readings.push({
        port: 1,
        type: 'temperature',
        value: latest.temperature,
        unit: 'F',
        timestamp: latest.timestamp,
        isStale
      })
    }

    if (latest.humidity !== undefined) {
      readings.push({
        port: 2,
        type: 'humidity',
        value: latest.humidity,
        unit: '%',
        timestamp: latest.timestamp,
        isStale
      })
    }

    if (latest.vpd !== undefined) {
      readings.push({
        port: 3,
        type: 'vpd',
        value: latest.vpd,
        unit: 'kPa',
        timestamp: latest.timestamp,
        isStale
      })
    }

    if (latest.co2 !== undefined) {
      readings.push({
        port: 4,
        type: 'co2',
        value: latest.co2,
        unit: 'ppm',
        timestamp: latest.timestamp,
        isStale
      })
    }

    if (latest.light !== undefined) {
      readings.push({
        port: 5,
        type: 'light',
        value: latest.light,
        unit: 'lux',
        timestamp: latest.timestamp,
        isStale
      })
    }

    if (latest.ph !== undefined) {
      readings.push({
        port: 6,
        type: 'ph',
        value: latest.ph,
        unit: 'pH',
        timestamp: latest.timestamp,
        isStale
      })
    }

    if (latest.ec !== undefined) {
      readings.push({
        port: 7,
        type: 'ec',
        value: latest.ec,
        unit: 'mS/cm',
        timestamp: latest.timestamp,
        isStale
      })
    }

    return readings
  }

  /**
   * Get historical sensor data (for dry-run simulations)
   */
  getHistoricalData(controllerId: string, startTime: Date, endTime: Date): CSVSensorData[] {
    const data = csvDataStore.get(controllerId) || []
    
    return data.filter(d => 
      d.timestamp >= startTime && d.timestamp <= endTime
    )
  }

  /**
   * CSV adapter cannot control devices - always returns failure
   */
  async controlDevice(
    _controllerId: string,
    _port: number,
    _command: DeviceCommand
  ): Promise<CommandResult> {
    return {
      success: false,
      error: 'CSV Upload adapter is read-only. Device control is not supported.',
      timestamp: new Date()
    }
  }

  /**
   * Get controller status
   */
  async getStatus(controllerId: string): Promise<ControllerStatus> {
    const data = csvDataStore.get(controllerId)
    
    if (!data || data.length === 0) {
      return {
        status: 'offline',
        lastSeen: new Date(),
        errors: ['No CSV data uploaded yet']
      }
    }

    const latest = data[data.length - 1]
    const now = new Date()
    const isStale = (now.getTime() - latest.timestamp.getTime()) > 5 * 60 * 1000

    return {
      status: isStale ? 'offline' : 'online',
      lastSeen: latest.timestamp,
      errors: isStale ? ['Data is stale - upload new CSV'] : undefined
    }
  }

  /**
   * Disconnect and clear data
   */
  async disconnect(controllerId: string): Promise<void> {
    csvDataStore.delete(controllerId)
  }

  /**
   * Clear all uploaded data for a controller
   */
  clearData(controllerId: string): void {
    csvDataStore.set(controllerId, [])
  }

  /**
   * Get the count of data points
   */
  getDataCount(controllerId: string): number {
    return csvDataStore.get(controllerId)?.length || 0
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private isCSVCredentials(creds: ControllerCredentials): creds is CSVUploadCredentials {
    return 'type' in creds && creds.type === 'csv_upload'
  }

  private parseCSV(csvContent: string): CSVParseResult {
    const lines = csvContent.trim().split('\n')
    const errors: string[] = []
    const data: CSVSensorData[] = []

    if (lines.length < 2) {
      return {
        success: false,
        data: [],
        errors: ['CSV must have a header row and at least one data row'],
        rowCount: 0
      }
    }

    // Parse header
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
    
    // Validate required header
    if (!headers.includes('timestamp')) {
      return {
        success: false,
        data: [],
        errors: ['CSV must have a "timestamp" column'],
        rowCount: 0
      }
    }

    // Map headers to indices
    const headerIndices: Record<string, number> = {}
    headers.forEach((h, i) => {
      headerIndices[h] = i
    })

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map(v => v.trim())
      
      try {
        const entry: CSVSensorData = {
          timestamp: new Date(values[headerIndices['timestamp']])
        }

        if (isNaN(entry.timestamp.getTime())) {
          errors.push(`Row ${i + 1}: Invalid timestamp "${values[headerIndices['timestamp']]}"`)
          continue
        }

        // Parse optional sensor values with bounds validation
        let hasValidationError = false

        // Temperature (supports 'temperature' or 'temp' headers)
        for (const header of ['temperature', 'temp']) {
          if (headerIndices[header] !== undefined && entry.temperature === undefined) {
            const val = parseFloat(values[headerIndices[header]])
            if (!isNaN(val)) {
              const validation = validateSensorValue('temperature', val, i + 1)
              if (validation.valid) {
                entry.temperature = val
              } else {
                errors.push(validation.error!)
                hasValidationError = true
              }
            }
          }
        }

        // Humidity (supports 'humidity' or 'rh' headers)
        for (const header of ['humidity', 'rh']) {
          if (headerIndices[header] !== undefined && entry.humidity === undefined) {
            const val = parseFloat(values[headerIndices[header]])
            if (!isNaN(val)) {
              const validation = validateSensorValue('humidity', val, i + 1)
              if (validation.valid) {
                entry.humidity = val
              } else {
                errors.push(validation.error!)
                hasValidationError = true
              }
            }
          }
        }

        // VPD
        if (headerIndices['vpd'] !== undefined) {
          const val = parseFloat(values[headerIndices['vpd']])
          if (!isNaN(val)) {
            const validation = validateSensorValue('vpd', val, i + 1)
            if (validation.valid) {
              entry.vpd = val
            } else {
              errors.push(validation.error!)
              hasValidationError = true
            }
          }
        }

        // CO2
        if (headerIndices['co2'] !== undefined) {
          const val = parseFloat(values[headerIndices['co2']])
          if (!isNaN(val)) {
            const validation = validateSensorValue('co2', val, i + 1)
            if (validation.valid) {
              entry.co2 = val
            } else {
              errors.push(validation.error!)
              hasValidationError = true
            }
          }
        }

        // Light (supports 'light' or 'lux' headers)
        for (const header of ['light', 'lux']) {
          if (headerIndices[header] !== undefined && entry.light === undefined) {
            const val = parseFloat(values[headerIndices[header]])
            if (!isNaN(val)) {
              const validation = validateSensorValue('light', val, i + 1)
              if (validation.valid) {
                entry.light = val
              } else {
                errors.push(validation.error!)
                hasValidationError = true
              }
            }
          }
        }

        // pH
        if (headerIndices['ph'] !== undefined) {
          const val = parseFloat(values[headerIndices['ph']])
          if (!isNaN(val)) {
            const validation = validateSensorValue('ph', val, i + 1)
            if (validation.valid) {
              entry.ph = val
            } else {
              errors.push(validation.error!)
              hasValidationError = true
            }
          }
        }

        // EC
        if (headerIndices['ec'] !== undefined) {
          const val = parseFloat(values[headerIndices['ec']])
          if (!isNaN(val)) {
            const validation = validateSensorValue('ec', val, i + 1)
            if (validation.valid) {
              entry.ec = val
            } else {
              errors.push(validation.error!)
              hasValidationError = true
            }
          }
        }

        // Only add entry if no validation errors (strict mode)
        // Or if at least one valid value exists (lenient mode - we use this)
        if (!hasValidationError || Object.keys(entry).length > 1) {
          data.push(entry)
        }

      } catch (err) {
        errors.push(`Row ${i + 1}: Parse error - ${err instanceof Error ? err.message : 'Unknown'}`)
      }
    }

    // Sort by timestamp
    data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return {
      success: data.length > 0,
      data,
      errors,
      rowCount: data.length
    }
  }

  private getDefaultSensorCapabilities(): SensorCapability[] {
    return [
      { port: 1, name: 'Temperature', type: 'temperature', unit: 'F' },
      { port: 2, name: 'Humidity', type: 'humidity', unit: '%' },
      { port: 3, name: 'VPD', type: 'vpd', unit: 'kPa' },
      { port: 4, name: 'CO2', type: 'co2', unit: 'ppm' },
      { port: 5, name: 'Light', type: 'light', unit: 'lux' },
      { port: 6, name: 'pH', type: 'ph', unit: 'pH' },
      { port: 7, name: 'EC', type: 'ec', unit: 'mS/cm' }
    ]
  }

  private emptyMetadata(): ControllerMetadata {
    return {
      brand: 'csv_upload',
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
// CSV Template Generator
// ============================================

export function generateCSVTemplate(): string {
  return `timestamp,temperature,humidity,vpd,co2,light
2026-01-20T06:00:00Z,75.5,60,0.95,450,0
2026-01-20T07:00:00Z,76.0,58,1.02,480,15000
2026-01-20T08:00:00Z,77.2,55,1.15,520,35000
2026-01-20T09:00:00Z,78.5,52,1.25,600,45000
2026-01-20T10:00:00Z,79.0,50,1.30,650,48000`
}

// ============================================
// CSV Validation Helper
// ============================================

export function validateCSVHeaders(csvContent: string): { 
  valid: boolean
  headers: string[]
  missing: string[]
  optional: string[]
} {
  const lines = csvContent.trim().split('\n')
  if (lines.length === 0) {
    return { valid: false, headers: [], missing: ['timestamp'], optional: [] }
  }

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  const required = ['timestamp']
  const optionalHeaders = ['temperature', 'temp', 'humidity', 'rh', 'vpd', 'co2', 'light', 'lux', 'ph', 'ec']
  
  const missing = required.filter(r => !headers.includes(r))
  const found = optionalHeaders.filter(o => headers.includes(o))

  return {
    valid: missing.length === 0,
    headers,
    missing,
    optional: found
  }
}
