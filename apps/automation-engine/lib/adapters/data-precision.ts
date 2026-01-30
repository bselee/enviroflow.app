/**
 * Data Precision Layer for AC Infinity Controllers
 *
 * Provides centralized, auditable transformations for sensor values.
 * All transformations are tracked for debugging and verification.
 *
 * AC Infinity API Value Formats:
 * - Temperature: Celsius × 100 (e.g., 2350 = 23.5°C)
 * - Humidity: Percentage × 100 (e.g., 6500 = 65%)
 * - VPD: kPa × 100 (e.g., 120 = 1.2 kPa)
 * - CO2: ppm (usually unscaled)
 * - Light: lux (usually unscaled)
 */

import { createHash } from 'crypto'
import { calculateLeafVPDCelsius } from './vpd-utils'
import type {
  SensorType,
  SensorReading,
  DataTransformation,
  RawSensorCapture,
  ValidatedSensorReading,
  RawApiCapture,
} from './types'

// ============================================
// Constants
// ============================================

/** Precision settings for different sensor types */
const PRECISION_SETTINGS: Record<string, number> = {
  temperature: 1, // 1 decimal place
  humidity: 1,
  vpd: 2,
  co2: 0,
  light: 0,
  ph: 2,
  ec: 2,
}

/** Scale factors for raw API values */
const SCALE_FACTORS: Record<number, number> = {
  1: 100, // Temperature (÷100)
  2: 100, // Humidity (÷100)
  3: 100, // VPD (÷100)
  4: 1,   // CO2 (no scaling)
  5: 1,   // Light (no scaling)
}

/** Unit mappings for sensor types */
const UNIT_MAPPINGS: Record<number, { celsius: string; fahrenheit: string }> = {
  1: { celsius: 'C', fahrenheit: 'F' },
  2: { celsius: '%', fahrenheit: '%' },
  3: { celsius: 'kPa', fahrenheit: 'kPa' },
  4: { celsius: 'ppm', fahrenheit: 'ppm' },
  5: { celsius: 'lux', fahrenheit: 'lux' },
}

// ============================================
// Transformation Functions
// ============================================

/**
 * Apply scale division to raw value
 */
export function applyScaleDivision(
  rawValue: number,
  scaleFactor: number
): { value: number; transformation: DataTransformation } {
  const output = rawValue / scaleFactor
  return {
    value: output,
    transformation: {
      type: 'scale_division',
      input: rawValue,
      output,
      formula: `${rawValue} / ${scaleFactor} = ${output}`,
    },
  }
}

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(
  celsius: number
): { value: number; transformation: DataTransformation } {
  const fahrenheit = (celsius * 9 / 5) + 32
  return {
    value: fahrenheit,
    transformation: {
      type: 'unit_conversion',
      input: celsius,
      output: fahrenheit,
      formula: `(${celsius}°C × 9/5) + 32 = ${fahrenheit}°F`,
    },
  }
}

/**
 * Round value to specified precision
 */
export function roundToPrecision(
  value: number,
  precision: number
): { value: number; transformation: DataTransformation } {
  const multiplier = Math.pow(10, precision)
  const rounded = Math.round(value * multiplier) / multiplier
  return {
    value: rounded,
    transformation: {
      type: 'rounding',
      input: value,
      output: rounded,
      formula: `round(${value}, ${precision}) = ${rounded}`,
      precision,
    },
  }
}

/**
 * Calculate VPD from temperature and humidity
 * Uses consolidated vpd-utils for calculation
 */
export function calculateVPD(
  tempCelsius: number,
  humidity: number,
  leafTempOffset: number = 0
): { value: number; transformation: DataTransformation } {
  // Leaf temperature offset is negative (leaves are cooler)
  const vpd = calculateLeafVPDCelsius(tempCelsius, humidity, -leafTempOffset) ?? 0

  return {
    value: vpd,
    transformation: {
      type: 'vpd_calculation',
      input: tempCelsius,
      output: vpd,
      formula: `VPD = calculateLeafVPDCelsius(${tempCelsius}°C, ${humidity}%, offset=${-leafTempOffset}) = ${vpd.toFixed(3)} kPa`,
    },
  }
}

// ============================================
// Calibration Types and Functions
// ============================================

/**
 * Calibration data structure from database
 */
export interface SensorCalibration {
  id: string
  controller_id: string
  sensor_type: string
  port: number
  offset_correction: number
  scale_correction: number
  reference_instrument?: string
  reference_reading?: number
  raw_reading_at_calibration?: number
  calibrated_at: Date
  expires_at?: Date
  is_active: boolean
  calibrated_by?: string
  notes?: string
}

/**
 * Result of applying calibration correction
 */
export interface CalibrationCorrectionResult {
  originalValue: number
  correctedValue: number
  calibrationApplied: boolean
  calibrationId?: string
  transformation?: DataTransformation
}

/**
 * Apply calibration correction to a sensor value
 * Formula: corrected = raw * scale + offset
 *
 * @param value - Raw sensor value
 * @param calibration - Calibration settings (or null if no calibration)
 * @returns Correction result with audit trail
 */
export function applyCalibrationCorrection(
  value: number,
  calibration: SensorCalibration | null | undefined
): CalibrationCorrectionResult {
  // If no calibration or not active, return original
  if (!calibration || !calibration.is_active) {
    return {
      originalValue: value,
      correctedValue: value,
      calibrationApplied: false,
    }
  }

  // Check if calibration has expired
  if (calibration.expires_at && new Date(calibration.expires_at) < new Date()) {
    return {
      originalValue: value,
      correctedValue: value,
      calibrationApplied: false,
    }
  }

  // Apply correction: corrected = raw * scale + offset
  const scale = calibration.scale_correction ?? 1.0
  const offset = calibration.offset_correction ?? 0
  const correctedValue = value * scale + offset

  const transformation: DataTransformation = {
    type: 'scale_division', // Using closest match; represents calibration
    input: value,
    output: correctedValue,
    formula: `${value} × ${scale} + ${offset} = ${correctedValue} (calibration)`,
  }

  return {
    originalValue: value,
    correctedValue,
    calibrationApplied: true,
    calibrationId: calibration.id,
    transformation,
  }
}

/**
 * Find matching calibration for a sensor reading
 *
 * @param calibrations - Array of available calibrations
 * @param sensorType - Type of sensor (temperature, humidity, etc.)
 * @param port - Port number (default 0)
 * @returns Matching active calibration or null
 */
export function findMatchingCalibration(
  calibrations: SensorCalibration[],
  sensorType: string,
  port: number = 0
): SensorCalibration | null {
  const now = new Date()

  return calibrations.find(cal =>
    cal.sensor_type === sensorType &&
    (cal.port ?? 0) === port &&
    cal.is_active &&
    (!cal.expires_at || new Date(cal.expires_at) > now)
  ) ?? null
}

/**
 * Calculate calibration offset from reference measurement
 * This is a helper for the calibration UI
 *
 * @param rawReading - Current raw sensor reading
 * @param referenceReading - Reading from reference instrument
 * @returns Offset value to apply
 */
export function calculateCalibrationOffset(
  rawReading: number,
  referenceReading: number
): number {
  // Simple offset: offset = reference - raw
  // When applied: corrected = raw + offset = raw + (reference - raw) = reference
  return referenceReading - rawReading
}

/**
 * Calculate two-point calibration (scale and offset)
 * Useful for sensors that need both slope and intercept correction
 *
 * @param lowRaw - Low point raw reading
 * @param lowRef - Low point reference reading
 * @param highRaw - High point raw reading
 * @param highRef - High point reference reading
 * @returns Scale and offset corrections
 */
export function calculateTwoPointCalibration(
  lowRaw: number,
  lowRef: number,
  highRaw: number,
  highRef: number
): { scale: number; offset: number } {
  // Two-point linear calibration:
  // ref = raw * scale + offset
  // Solving: scale = (highRef - lowRef) / (highRaw - lowRaw)
  //          offset = lowRef - lowRaw * scale

  if (highRaw === lowRaw) {
    // Can't calculate scale with same raw values
    return {
      scale: 1.0,
      offset: lowRef - lowRaw,
    }
  }

  const scale = (highRef - lowRef) / (highRaw - lowRaw)
  const offset = lowRef - lowRaw * scale

  return { scale, offset }
}

// ============================================
// Main Transformation Pipeline
// ============================================

export interface TransformationResult {
  value: number
  unit: string
  transformations: DataTransformation[]
  /** Calibration applied, if any */
  calibrationApplied?: boolean
  calibrationId?: string
}

/**
 * Apply all transformations to a raw sensor value
 * Returns the final value with full audit trail
 *
 * @param raw - Raw sensor capture from API
 * @param outputUnit - 'F' for Fahrenheit, 'C' for Celsius (temperature only)
 * @param calibration - Optional calibration to apply after unit conversion
 * @returns Transformed value with audit trail
 */
export function applyTransformations(
  raw: RawSensorCapture,
  outputUnit: 'F' | 'C' = 'F',
  calibration?: SensorCalibration | null
): TransformationResult {
  const transformations: DataTransformation[] = []
  let value = raw.rawValue
  let unit = ''
  let calibrationApplied = false
  let calibrationId: string | undefined

  // Get scale factor for this sensor type
  const scaleFactor = SCALE_FACTORS[raw.sensorType] || 1

  // Step 1: Apply scale division if needed
  if (scaleFactor > 1) {
    const scaled = applyScaleDivision(value, scaleFactor)
    value = scaled.value
    transformations.push(scaled.transformation)
  }

  // Step 2: Temperature-specific conversions
  if (raw.sensorType === 1) {
    // Temperature
    if (outputUnit === 'F') {
      const converted = celsiusToFahrenheit(value)
      value = converted.value
      transformations.push(converted.transformation)
      unit = 'F'
    } else {
      unit = 'C'
    }
  } else {
    // Non-temperature sensors
    const unitMap = UNIT_MAPPINGS[raw.sensorType]
    unit = unitMap?.celsius || ''
  }

  // Step 3: Apply calibration correction if provided
  if (calibration) {
    const calResult = applyCalibrationCorrection(value, calibration)
    if (calResult.calibrationApplied) {
      value = calResult.correctedValue
      calibrationApplied = true
      calibrationId = calResult.calibrationId
      if (calResult.transformation) {
        transformations.push(calResult.transformation)
      }
    }
  }

  // Step 4: Apply precision rounding (always last)
  const sensorTypeName = mapSensorTypeToName(raw.sensorType)
  const precision = PRECISION_SETTINGS[sensorTypeName] ?? 2
  const rounded = roundToPrecision(value, precision)
  value = rounded.value
  transformations.push(rounded.transformation)

  return {
    value,
    unit,
    transformations,
    calibrationApplied,
    calibrationId,
  }
}

/**
 * Create a sensor reading with full audit trail
 */
export function createValidatedSensorReading(
  raw: RawSensorCapture,
  port: number,
  outputUnit: 'F' | 'C' = 'F'
): ValidatedSensorReading {
  const transformed = applyTransformations(raw, outputUnit)
  const sensorType = mapSensorTypeToName(raw.sensorType)

  return {
    port,
    type: sensorType,
    value: transformed.value,
    unit: transformed.unit,
    timestamp: raw.apiTimestamp || new Date(),
    isStale: false,
    rawCapture: raw,
    transformations: transformed.transformations,
    validationResult: {
      passed: true,
      failedChecks: [],
    },
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map AC Infinity sensor type code to SensorType
 */
export function mapSensorTypeToName(acType: number): SensorType {
  const map: Record<number, SensorType> = {
    1: 'temperature',
    2: 'humidity',
    3: 'vpd',
    4: 'co2',
    5: 'light',
  }
  return map[acType] || 'temperature'
}

/**
 * Map SensorType to AC Infinity type code
 */
export function mapSensorNameToType(type: SensorType): number {
  const map: Record<SensorType, number> = {
    temperature: 1,
    humidity: 2,
    vpd: 3,
    co2: 4,
    light: 5,
    ph: 6,
    ec: 7,
    soil_moisture: 8,
    pressure: 9,
    water_level: 10,
    wind_speed: 11,
    pm25: 12,
    uv: 13,
    solar_radiation: 14,
    rain: 15,
  }
  return map[type] || 1
}

/**
 * Create SHA256 hash of API response for deduplication
 */
export function hashApiResponse(data: unknown): string {
  const json = JSON.stringify(data)
  return createHash('sha256').update(json).digest('hex').substring(0, 16)
}

/**
 * Create raw API capture record
 */
export function createRawCapture(
  endpoint: string,
  sensorData: unknown[],
  portData: unknown[],
  modeData: unknown[],
  latencyMs: number
): RawApiCapture {
  const combinedData = { sensorData, portData, modeData }
  return {
    endpoint,
    responseHash: hashApiResponse(combinedData),
    rawSensorData: sensorData,
    rawPortData: portData,
    rawModeData: modeData,
    latencyMs,
    capturedAt: new Date(),
  }
}

// ============================================
// Device-Level Sensor Extraction
// ============================================

/**
 * Extract sensors from device-level fields
 * Some AC Infinity controllers report temp/humidity/VPD at device level
 */
export function extractDeviceLevelSensors(
  deviceData: Record<string, unknown>,
  outputUnit: 'F' | 'C' = 'F'
): ValidatedSensorReading[] {
  const readings: ValidatedSensorReading[] = []
  const now = new Date()

  // Temperature
  const rawTemp = deviceData.temperature ?? deviceData.temp
  if (typeof rawTemp === 'number' && rawTemp !== 0) {
    const rawCapture: RawSensorCapture = {
      field: 'temperature',
      rawValue: rawTemp,
      sensorType: 1,
      apiTimestamp: now,
      source: 'deviceLevel',
    }
    readings.push(createValidatedSensorReading(rawCapture, 0, outputUnit))
  }

  // Humidity
  const rawHumidity = deviceData.humidity
  if (typeof rawHumidity === 'number' && rawHumidity !== 0) {
    const rawCapture: RawSensorCapture = {
      field: 'humidity',
      rawValue: rawHumidity,
      sensorType: 2,
      apiTimestamp: now,
      source: 'deviceLevel',
    }
    readings.push(createValidatedSensorReading(rawCapture, 0, outputUnit))
  }

  // VPD
  const rawVpd = deviceData.vpd
  if (typeof rawVpd === 'number' && rawVpd !== 0) {
    const rawCapture: RawSensorCapture = {
      field: 'vpd',
      rawValue: rawVpd,
      sensorType: 3,
      apiTimestamp: now,
      source: 'deviceLevel',
    }
    readings.push(createValidatedSensorReading(rawCapture, 0, outputUnit))
  }

  return readings
}

/**
 * Extract sensors from sensorData array
 */
export function extractSensorDataSensors(
  sensorData: Array<{
    sensorType: number
    sensorValue?: number
    value?: number
    sensorName?: string
  }>,
  outputUnit: 'F' | 'C' = 'F'
): ValidatedSensorReading[] {
  const readings: ValidatedSensorReading[] = []
  const now = new Date()

  for (const sensor of sensorData) {
    const rawValue = sensor.sensorValue ?? sensor.value ?? 0
    if (rawValue === 0) continue

    const rawCapture: RawSensorCapture = {
      field: sensor.sensorValue !== undefined ? 'sensorValue' : 'value',
      rawValue,
      sensorType: sensor.sensorType,
      apiTimestamp: now,
      source: 'sensorData',
    }

    readings.push(createValidatedSensorReading(rawCapture, 0, outputUnit))
  }

  return readings
}

/**
 * Calculate VPD if not present but temp/humidity are available
 */
export function calculateVPDIfMissing(
  readings: ValidatedSensorReading[],
  leafTempOffset: number = 0
): ValidatedSensorReading | null {
  const hasVPD = readings.some(r => r.type === 'vpd')
  if (hasVPD) return null

  const tempReading = readings.find(r => r.type === 'temperature')
  const humidityReading = readings.find(r => r.type === 'humidity')

  if (!tempReading || !humidityReading) return null

  // Convert back to Celsius if in Fahrenheit
  let tempCelsius = tempReading.value
  if (tempReading.unit === 'F') {
    tempCelsius = (tempReading.value - 32) * 5 / 9
  }

  const humidity = humidityReading.value
  const vpdResult = calculateVPD(tempCelsius, humidity, leafTempOffset)

  // Round VPD
  const rounded = roundToPrecision(vpdResult.value, 2)

  const rawCapture: RawSensorCapture = {
    field: 'vpd',
    rawValue: tempCelsius * 100, // Simulated raw value
    sensorType: 3,
    apiTimestamp: new Date(),
    source: 'deviceLevel', // Calculated, not from API
  }

  return {
    port: 0,
    type: 'vpd',
    value: rounded.value,
    unit: 'kPa',
    timestamp: new Date(),
    isStale: false,
    rawCapture,
    transformations: [vpdResult.transformation, rounded.transformation],
    validationResult: {
      passed: true,
      failedChecks: [],
    },
  }
}
