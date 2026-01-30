/**
 * Validation Pipeline for Sensor Readings
 *
 * Multi-stage validation ensures data quality:
 * 1. Range validation - Values within physical limits
 * 2. Plausibility checks - Rate of change within expected bounds
 * 3. Cross-sensor validation - VPD consistency with temp/humidity
 *
 * Designed for grow room environmental monitoring where
 * data accuracy is critical for plant health.
 */

import { calculateVPDCelsius } from './vpd-utils'
import type {
  SensorReading,
  SensorType,
  ValidatedSensorReading,
} from './types'

// ============================================
// Validation Configuration
// ============================================

/**
 * Physical limits for sensor readings
 * Based on grow room operating ranges and sensor specifications
 */
export const SENSOR_RANGES: Record<SensorType, { min: number; max: number; unit: string }> = {
  temperature: { min: -20, max: 150, unit: 'F' }, // -29°C to 65°C
  humidity: { min: 0, max: 100, unit: '%' },
  vpd: { min: 0, max: 5, unit: 'kPa' },
  co2: { min: 0, max: 10000, unit: 'ppm' },
  light: { min: 0, max: 200000, unit: 'lux' },
  ph: { min: 0, max: 14, unit: 'pH' },
  ec: { min: 0, max: 20, unit: 'mS/cm' },
  soil_moisture: { min: 0, max: 100, unit: '%' },
  pressure: { min: 800, max: 1200, unit: 'hPa' },
  water_level: { min: 0, max: 100, unit: '%' },
  wind_speed: { min: 0, max: 200, unit: 'km/h' },
  pm25: { min: 0, max: 1000, unit: 'µg/m³' },
  uv: { min: 0, max: 15, unit: 'index' },
  solar_radiation: { min: 0, max: 2000, unit: 'W/m²' },
  rain: { min: 0, max: 500, unit: 'mm/hr' },
}

/**
 * Optimal ranges for grow room operation
 * Used for warnings, not validation failures
 */
export const OPTIMAL_RANGES: Record<string, { min: number; max: number }> = {
  temperature: { min: 65, max: 85 }, // Fahrenheit
  humidity: { min: 40, max: 70 },
  vpd: { min: 0.8, max: 1.6 },
  co2: { min: 400, max: 1500 },
}

/**
 * Maximum delta per minute for plausibility checks
 * Prevents spurious spikes from being stored
 */
export const MAX_DELTA_PER_MINUTE: Record<SensorType, number> = {
  temperature: 10, // 10°F per minute max
  humidity: 15, // 15% per minute max
  vpd: 0.5, // 0.5 kPa per minute max
  co2: 500, // 500 ppm per minute max
  light: 50000, // 50000 lux per minute max (sunrise)
  ph: 1, // 1 pH per minute max
  ec: 2, // 2 mS/cm per minute max
  soil_moisture: 20,
  pressure: 10,
  water_level: 50,
  wind_speed: 50,
  pm25: 200,
  uv: 5,
  solar_radiation: 500,
  rain: 100,
}

// ============================================
// Validation Result Types
// ============================================

export interface ValidationResult {
  passed: boolean
  stage: 'range' | 'plausibility' | 'cross_sensor' | 'all'
  failedChecks: string[]
  warnings: string[]
  /** Quality score 0-100 reflecting overall data quality */
  qualityScore: number
  /** Confidence level 0-1 reflecting reliability of the reading */
  confidence: number
}

export interface ValidationContext {
  previousReading?: SensorReading
  previousTimestamp?: Date
  allCurrentReadings: SensorReading[]
}

// ============================================
// Quality Score Constants
// ============================================

/** Points awarded for passing each validation stage */
export const QUALITY_SCORE_WEIGHTS = {
  /** Base points for passing range validation (value within physical limits) */
  RANGE_PASS: 40,
  /** Points for passing plausibility check (reasonable rate of change) */
  PLAUSIBILITY_PASS: 30,
  /** Points for passing cross-sensor consistency check */
  CROSS_SENSOR_PASS: 20,
  /** Bonus points when no warnings are generated */
  NO_WARNINGS_BONUS: 10,
} as const

/** Penalty factors for different warning types */
export const WARNING_PENALTIES: Record<string, number> = {
  /** Outside optimal range but within physical limits */
  OUTSIDE_OPTIMAL: 5,
  /** VPD inconsistency with temp/humidity */
  VPD_INCONSISTENT: 10,
  /** Cross-sensor validation warning */
  CROSS_SENSOR_WARNING: 10,
  /** Unknown sensor type warning */
  UNKNOWN_TYPE: 5,
}

// ============================================
// Stage 1: Range Validation
// ============================================

/**
 * Validate that sensor value is within physical limits
 */
export function validateRange(reading: SensorReading): ValidationResult {
  const range = SENSOR_RANGES[reading.type]
  const failedChecks: string[] = []
  const warnings: string[] = []
  let qualityScore = 0
  let confidence = 0

  if (!range) {
    // Unknown sensor type - pass with warning
    warnings.push(`UNKNOWN_TYPE: Unknown sensor type: ${reading.type}`)
    return {
      passed: true,
      stage: 'range',
      failedChecks: [],
      warnings,
      qualityScore: QUALITY_SCORE_WEIGHTS.RANGE_PASS - WARNING_PENALTIES.UNKNOWN_TYPE,
      confidence: 0.7,
    }
  }

  // Check if value is within physical limits
  if (reading.value < range.min) {
    failedChecks.push(
      `${reading.type} value ${reading.value} below minimum ${range.min}${range.unit}`
    )
  }

  if (reading.value > range.max) {
    failedChecks.push(
      `${reading.type} value ${reading.value} above maximum ${range.max}${range.unit}`
    )
  }

  // Calculate quality score for range check
  if (failedChecks.length === 0) {
    qualityScore = QUALITY_SCORE_WEIGHTS.RANGE_PASS
    confidence = 1.0
  } else {
    qualityScore = 0
    confidence = 0
  }

  // Check for optimal range (warning only)
  const optimalRange = OPTIMAL_RANGES[reading.type]
  if (optimalRange && failedChecks.length === 0) {
    if (reading.value < optimalRange.min || reading.value > optimalRange.max) {
      warnings.push(
        `OUTSIDE_OPTIMAL: ${reading.type} value ${reading.value} outside optimal range ${optimalRange.min}-${optimalRange.max}`
      )
      qualityScore -= WARNING_PENALTIES.OUTSIDE_OPTIMAL
    }
  }

  return {
    passed: failedChecks.length === 0,
    stage: 'range',
    failedChecks,
    warnings,
    qualityScore: Math.max(0, qualityScore),
    confidence,
  }
}

// ============================================
// Stage 2: Plausibility Validation
// ============================================

/**
 * Validate that sensor value change is plausible
 * Checks rate of change against physical limits
 */
export function validatePlausibility(
  reading: SensorReading,
  context: ValidationContext
): ValidationResult {
  const failedChecks: string[] = []
  const warnings: string[] = []

  // Skip if no previous reading - award full points since we can't validate
  if (!context.previousReading || !context.previousTimestamp) {
    return {
      passed: true,
      stage: 'plausibility',
      failedChecks: [],
      warnings: [],
      qualityScore: QUALITY_SCORE_WEIGHTS.PLAUSIBILITY_PASS,
      confidence: 0.8, // Slightly lower confidence without temporal context
    }
  }

  // Only check if same sensor type
  if (context.previousReading.type !== reading.type) {
    return {
      passed: true,
      stage: 'plausibility',
      failedChecks: [],
      warnings: [],
      qualityScore: QUALITY_SCORE_WEIGHTS.PLAUSIBILITY_PASS,
      confidence: 0.8,
    }
  }

  const maxDelta = MAX_DELTA_PER_MINUTE[reading.type]
  if (!maxDelta) {
    return {
      passed: true,
      stage: 'plausibility',
      failedChecks: [],
      warnings: [],
      qualityScore: QUALITY_SCORE_WEIGHTS.PLAUSIBILITY_PASS,
      confidence: 0.8,
    }
  }

  // Calculate time difference in minutes
  const timeDiffMs = reading.timestamp.getTime() - context.previousTimestamp.getTime()
  const timeDiffMinutes = timeDiffMs / (1000 * 60)

  // Calculate value delta
  const valueDelta = Math.abs(reading.value - context.previousReading.value)

  // Calculate max allowed delta based on time
  const maxAllowedDelta = maxDelta * Math.max(timeDiffMinutes, 0.1) // Minimum 6-second window

  if (valueDelta > maxAllowedDelta) {
    failedChecks.push(
      `${reading.type} changed by ${valueDelta.toFixed(2)} in ${timeDiffMinutes.toFixed(1)} min, ` +
      `max expected: ${maxAllowedDelta.toFixed(2)}`
    )
  }

  // Calculate quality score based on how close to max delta we are
  let qualityScore = 0
  let confidence = 0

  if (failedChecks.length === 0) {
    qualityScore = QUALITY_SCORE_WEIGHTS.PLAUSIBILITY_PASS
    // Higher confidence if well within expected delta range
    const deltaRatio = valueDelta / maxAllowedDelta
    confidence = deltaRatio < 0.5 ? 1.0 : deltaRatio < 0.8 ? 0.9 : 0.85
  } else {
    qualityScore = 0
    confidence = 0.2 // Very low confidence when plausibility fails
  }

  return {
    passed: failedChecks.length === 0,
    stage: 'plausibility',
    failedChecks,
    warnings,
    qualityScore,
    confidence,
  }
}

// ============================================
// Stage 3: Cross-Sensor Validation
// ============================================

/**
 * Validate sensor readings against each other
 * Checks VPD consistency with temperature and humidity
 */
export function validateCrossSensor(
  reading: SensorReading,
  context: ValidationContext
): ValidationResult {
  const failedChecks: string[] = []
  const warnings: string[] = []
  let qualityScore = QUALITY_SCORE_WEIGHTS.CROSS_SENSOR_PASS
  let confidence = 1.0

  // Track whether we had enough data to do cross-validation
  let crossValidationPerformed = false

  // VPD validation: Check consistency with temp/humidity
  if (reading.type === 'vpd') {
    const tempReading = context.allCurrentReadings.find(r => r.type === 'temperature')
    const humidityReading = context.allCurrentReadings.find(r => r.type === 'humidity')

    if (tempReading && humidityReading) {
      crossValidationPerformed = true
      // Calculate expected VPD
      let tempCelsius = tempReading.value
      if (tempReading.unit === 'F') {
        tempCelsius = (tempReading.value - 32) * 5 / 9
      }

      const expectedVpd = calculateVPDCelsius(tempCelsius, humidityReading.value) ?? 0

      const vpdDelta = Math.abs(reading.value - expectedVpd)

      // Allow 0.2 kPa tolerance for leaf temperature offset
      if (vpdDelta > 0.3) {
        warnings.push(
          `VPD_INCONSISTENT: VPD ${reading.value.toFixed(2)} kPa differs from calculated ${expectedVpd.toFixed(2)} kPa ` +
          `(temp=${tempReading.value}${tempReading.unit}, humidity=${humidityReading.value}%)`
        )
        qualityScore -= WARNING_PENALTIES.VPD_INCONSISTENT
        confidence = Math.max(0.5, 1.0 - vpdDelta) // Reduce confidence based on delta
      }
    }
  }

  // Temperature/Humidity cross-check: Ensure VPD is calculable
  if (reading.type === 'temperature' || reading.type === 'humidity') {
    const vpdReading = context.allCurrentReadings.find(r => r.type === 'vpd')
    const otherReading = context.allCurrentReadings.find(
      r => r.type === (reading.type === 'temperature' ? 'humidity' : 'temperature')
    )

    // If we have temp, humidity, and VPD, validate consistency
    if (vpdReading && otherReading) {
      crossValidationPerformed = true
      let tempCelsius: number
      let humidity: number

      if (reading.type === 'temperature') {
        tempCelsius = reading.unit === 'F' ? (reading.value - 32) * 5 / 9 : reading.value
        humidity = otherReading.value
      } else {
        tempCelsius = otherReading.unit === 'F' ? (otherReading.value - 32) * 5 / 9 : otherReading.value
        humidity = reading.value
      }

      const expectedVpd = calculateVPDCelsius(tempCelsius, humidity) ?? 0
      const vpdDelta = Math.abs(vpdReading.value - expectedVpd)

      if (vpdDelta > 0.3) {
        warnings.push(
          `CROSS_SENSOR_WARNING: VPD ${vpdReading.value.toFixed(2)} kPa inconsistent with ` +
          `temp/humidity readings (expected ~${expectedVpd.toFixed(2)} kPa)`
        )
        qualityScore -= WARNING_PENALTIES.CROSS_SENSOR_WARNING
        confidence = Math.max(0.5, 1.0 - vpdDelta)
      }
    }
  }

  // If no cross-validation was possible, still award points but with lower confidence
  if (!crossValidationPerformed) {
    confidence = 0.85 // Lower confidence without cross-validation context
  }

  return {
    passed: failedChecks.length === 0,
    stage: 'cross_sensor',
    failedChecks,
    warnings,
    qualityScore: Math.max(0, qualityScore),
    confidence: Math.max(0, confidence),
  }
}

// ============================================
// Full Validation Pipeline
// ============================================

/**
 * Calculate combined quality score from individual stage results
 * @param rangeScore - Score from range validation (0-40)
 * @param plausibilityScore - Score from plausibility validation (0-30)
 * @param crossSensorScore - Score from cross-sensor validation (0-20)
 * @param warnings - Array of warning strings
 * @returns Final quality score 0-100
 */
export function calculateQualityScore(
  rangeScore: number,
  plausibilityScore: number,
  crossSensorScore: number,
  warnings: string[]
): number {
  // Sum base scores from each stage
  let score = rangeScore + plausibilityScore + crossSensorScore

  // Add bonus points if no warnings
  if (warnings.length === 0) {
    score += QUALITY_SCORE_WEIGHTS.NO_WARNINGS_BONUS
  }

  // Ensure score is within 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Calculate combined confidence from individual stage results
 * Uses weighted geometric mean for more conservative confidence estimation
 * @param rangeConfidence - Confidence from range validation (0-1)
 * @param plausibilityConfidence - Confidence from plausibility validation (0-1)
 * @param crossSensorConfidence - Confidence from cross-sensor validation (0-1)
 * @returns Final confidence 0-1
 */
export function calculateCombinedConfidence(
  rangeConfidence: number,
  plausibilityConfidence: number,
  crossSensorConfidence: number
): number {
  // Use weighted geometric mean - more conservative than arithmetic mean
  // Range validation is most important (40% weight), followed by plausibility (35%), then cross-sensor (25%)
  const weights = { range: 0.4, plausibility: 0.35, crossSensor: 0.25 }

  // Avoid log(0) by ensuring minimum confidence
  const minConf = 0.01
  const r = Math.max(rangeConfidence, minConf)
  const p = Math.max(plausibilityConfidence, minConf)
  const c = Math.max(crossSensorConfidence, minConf)

  // Weighted geometric mean: exp(sum(w_i * log(x_i)))
  const logSum =
    weights.range * Math.log(r) +
    weights.plausibility * Math.log(p) +
    weights.crossSensor * Math.log(c)

  const combined = Math.exp(logSum)

  // Round to 2 decimal places
  return Math.round(combined * 100) / 100
}

/**
 * Run all validation stages on a sensor reading
 */
export function validateReading(
  reading: SensorReading,
  context: ValidationContext
): ValidationResult {
  const allFailedChecks: string[] = []
  const allWarnings: string[] = []

  // Stage 1: Range validation
  const rangeResult = validateRange(reading)
  allFailedChecks.push(...rangeResult.failedChecks)
  allWarnings.push(...rangeResult.warnings)

  // If range validation fails, skip other stages
  if (!rangeResult.passed) {
    return {
      passed: false,
      stage: 'range',
      failedChecks: allFailedChecks,
      warnings: allWarnings,
      qualityScore: 0,
      confidence: 0,
    }
  }

  // Stage 2: Plausibility validation
  const plausibilityResult = validatePlausibility(reading, context)
  allFailedChecks.push(...plausibilityResult.failedChecks)
  allWarnings.push(...plausibilityResult.warnings)

  // If plausibility fails, still run cross-sensor but mark as failed
  const plausibilityPassed = plausibilityResult.passed

  // Stage 3: Cross-sensor validation
  const crossSensorResult = validateCrossSensor(reading, context)
  allFailedChecks.push(...crossSensorResult.failedChecks)
  allWarnings.push(...crossSensorResult.warnings)

  const allPassed = rangeResult.passed && plausibilityPassed && crossSensorResult.passed

  // Calculate combined quality score and confidence
  const qualityScore = calculateQualityScore(
    rangeResult.qualityScore,
    plausibilityResult.qualityScore,
    crossSensorResult.qualityScore,
    allWarnings
  )

  const confidence = calculateCombinedConfidence(
    rangeResult.confidence,
    plausibilityResult.confidence,
    crossSensorResult.confidence
  )

  return {
    passed: allPassed,
    stage: 'all',
    failedChecks: allFailedChecks,
    warnings: allWarnings,
    qualityScore,
    confidence,
  }
}

/**
 * Validate an array of sensor readings
 * Returns readings that pass validation with warnings attached
 */
export function validateReadings(
  readings: SensorReading[],
  previousReadings?: Map<SensorType, { reading: SensorReading; timestamp: Date }>
): {
  valid: ValidatedSensorReading[]
  invalid: { reading: SensorReading; result: ValidationResult }[]
  /** Summary statistics for the batch */
  summary: {
    totalReadings: number
    validCount: number
    invalidCount: number
    averageQualityScore: number
    averageConfidence: number
    warningCount: number
  }
} {
  const valid: ValidatedSensorReading[] = []
  const invalid: { reading: SensorReading; result: ValidationResult }[] = []
  let totalQualityScore = 0
  let totalConfidence = 0
  let totalWarnings = 0

  for (const reading of readings) {
    const previous = previousReadings?.get(reading.type)
    const context: ValidationContext = {
      previousReading: previous?.reading,
      previousTimestamp: previous?.timestamp,
      allCurrentReadings: readings,
    }

    const result = validateReading(reading, context)
    totalQualityScore += result.qualityScore
    totalConfidence += result.confidence
    totalWarnings += result.warnings.length

    if (result.passed) {
      // Cast to ValidatedSensorReading (adding validation fields)
      const validated: ValidatedSensorReading = {
        ...reading,
        rawCapture: {
          field: 'value',
          rawValue: reading.value,
          sensorType: 0,
          source: 'sensorData',
        },
        transformations: [],
        validationResult: {
          passed: true,
          failedChecks: result.failedChecks,
          qualityScore: result.qualityScore,
          confidence: result.confidence,
          warnings: result.warnings,
        },
      }
      valid.push(validated)
    } else {
      invalid.push({ reading, result })
    }
  }

  return {
    valid,
    invalid,
    summary: {
      totalReadings: readings.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      averageQualityScore: readings.length > 0 ? Math.round(totalQualityScore / readings.length) : 0,
      averageConfidence: readings.length > 0 ? Math.round((totalConfidence / readings.length) * 100) / 100 : 0,
      warningCount: totalWarnings,
    },
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a sensor value is within the optimal range
 */
export function isOptimal(reading: SensorReading): boolean {
  const range = OPTIMAL_RANGES[reading.type]
  if (!range) return true
  return reading.value >= range.min && reading.value <= range.max
}

/**
 * Get the deviation from optimal range
 * Returns 0 if within range, positive if above, negative if below
 */
export function getOptimalDeviation(reading: SensorReading): number {
  const range = OPTIMAL_RANGES[reading.type]
  if (!range) return 0

  if (reading.value < range.min) {
    return reading.value - range.min
  }
  if (reading.value > range.max) {
    return reading.value - range.max
  }
  return 0
}

/**
 * Calculate a health score for sensor readings
 * Returns 0-100 where 100 is all readings optimal
 */
export function calculateHealthScore(readings: SensorReading[]): number {
  if (readings.length === 0) return 100

  const optimalReadings = readings.filter(isOptimal)
  return Math.round((optimalReadings.length / readings.length) * 100)
}
