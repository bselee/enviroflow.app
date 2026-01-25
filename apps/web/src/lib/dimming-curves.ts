/**
 * Dimming Curve Calculations
 *
 * Provides curve functions for smooth transitions in sunrise/sunset dimming.
 * All curves map progress [0, 1] to a curve value [0, 1] which is then
 * applied to interpolate between startLevel and targetLevel.
 *
 * @module lib/dimming-curves
 */

import type { DimmerCurveType } from '@/types'

/**
 * Calculate the intensity value for a dimming schedule based on elapsed time
 * and the specified curve type.
 *
 * @param startLevel - Starting intensity (0-100)
 * @param targetLevel - Target intensity (0-100)
 * @param elapsedMs - Time elapsed since schedule started (milliseconds)
 * @param durationMs - Total duration of transition (milliseconds)
 * @param curveType - Type of curve to apply
 * @returns Current intensity value (0-100)
 */
export function calculateDimmingValue(
  startLevel: number,
  targetLevel: number,
  elapsedMs: number,
  durationMs: number,
  curveType: DimmerCurveType
): number {
  // Clamp elapsed time to [0, duration]
  const clampedElapsed = Math.max(0, Math.min(elapsedMs, durationMs))

  // Calculate linear progress (0 to 1)
  const linearProgress = durationMs > 0 ? clampedElapsed / durationMs : 1

  // Apply curve function to get curve progress
  const curveProgress = applyCurve(linearProgress, curveType)

  // Interpolate between start and target levels
  const value = startLevel + (targetLevel - startLevel) * curveProgress

  // Round to 1 decimal place and clamp to valid range
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

/**
 * Apply the specified curve function to transform linear progress.
 *
 * @param progress - Linear progress from 0 to 1
 * @param curveType - Type of curve to apply
 * @returns Curve-transformed progress from 0 to 1
 */
export function applyCurve(progress: number, curveType: DimmerCurveType): number {
  // Clamp progress to [0, 1]
  const p = Math.max(0, Math.min(1, progress))

  switch (curveType) {
    case 'linear':
      // Straight line - no transformation
      return p

    case 'sigmoid':
      // S-curve (logistic function) - mimics natural sunrise/sunset
      // Slower at start and end, faster in middle
      // Using a steepness factor of 10 for smooth transitions
      return 1 / (1 + Math.exp(-10 * (p - 0.5)))

    case 'exponential':
      // Exponential curve - faster change at start, slower at end
      // Good for quick ramp-up scenarios
      return Math.pow(p, 2)

    case 'logarithmic':
      // Logarithmic curve - slower change at start, faster at end
      // Inverse of exponential
      return Math.sqrt(p)

    default:
      console.warn(`Unknown curve type: ${curveType}, falling back to linear`)
      return p
  }
}

/**
 * Generate curve preview data points for visualization.
 * Returns an array of {x, y} points representing the curve.
 *
 * @param curveType - Type of curve to visualize
 * @param points - Number of data points to generate (default: 50)
 * @returns Array of {x, y} coordinates where x and y are both in [0, 1]
 */
export function generateCurvePreview(
  curveType: DimmerCurveType,
  points: number = 50
): Array<{ x: number; y: number }> {
  const data: Array<{ x: number; y: number }> = []

  for (let i = 0; i <= points; i++) {
    const x = i / points
    const y = applyCurve(x, curveType)
    data.push({ x, y })
  }

  return data
}

/**
 * Calculate sunrise time for a given date and location.
 * Uses a simplified algorithm (not astronomically precise).
 *
 * @param date - Date to calculate sunrise for
 * @param latitude - Latitude in degrees (-90 to 90)
 * @param longitude - Longitude in degrees (-180 to 180)
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Date object representing sunrise time
 */
export function calculateSunrise(
  date: Date,
  latitude: number,
  longitude: number,
  _timezone: string
): Date {
  // For MVP, use a simple approximation
  // Production should use a library like suncalc or an API

  // Julian day calculation
  const n = Math.floor(
    (date.getTime() - Date.UTC(2000, 0, 1)) / (1000 * 60 * 60 * 24)
  )

  // Mean solar time
  const J = n - longitude / 360

  // Solar mean anomaly
  const M = (357.5291 + 0.98560028 * J) % 360

  // Equation of center
  const C =
    1.9148 * Math.sin((M * Math.PI) / 180) +
    0.02 * Math.sin((2 * M * Math.PI) / 180)

  // Ecliptic longitude
  const lambda = (M + C + 180 + 102.9372) % 360

  // Solar transit
  const Jtransit = 2451545.5 + J + 0.0053 * Math.sin((M * Math.PI) / 180) -
    0.0069 * Math.sin((2 * lambda * Math.PI) / 180)

  // Declination
  const delta =
    Math.asin(Math.sin((lambda * Math.PI) / 180) * Math.sin((23.44 * Math.PI) / 180))

  // Hour angle
  const omega = Math.acos(
    (Math.sin((-0.83 * Math.PI) / 180) -
      Math.sin((latitude * Math.PI) / 180) * Math.sin(delta)) /
      (Math.cos((latitude * Math.PI) / 180) * Math.cos(delta))
  )

  // Sunrise
  const Jrise = Jtransit - (omega * 180) / Math.PI / 360

  // Convert Julian day to timestamp
  const sunriseTime = (Jrise - 2440587.5) * 86400000

  // Create date in UTC and convert to timezone
  const sunriseDate = new Date(sunriseTime)

  // Apply timezone offset
  // Note: This is simplified. Production should use a proper timezone library
  const utcDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    sunriseDate.getUTCHours(),
    sunriseDate.getUTCMinutes(),
    0,
    0
  )

  return utcDate
}

/**
 * Calculate sunset time for a given date and location.
 * Uses a simplified algorithm (not astronomically precise).
 *
 * @param date - Date to calculate sunset for
 * @param latitude - Latitude in degrees (-90 to 90)
 * @param longitude - Longitude in degrees (-180 to 180)
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Date object representing sunset time
 */
export function calculateSunset(
  date: Date,
  latitude: number,
  longitude: number,
  _timezone: string
): Date {
  // For MVP, use a simple approximation
  // Production should use a library like suncalc or an API

  // Julian day calculation
  const n = Math.floor(
    (date.getTime() - Date.UTC(2000, 0, 1)) / (1000 * 60 * 60 * 24)
  )

  // Mean solar time
  const J = n - longitude / 360

  // Solar mean anomaly
  const M = (357.5291 + 0.98560028 * J) % 360

  // Equation of center
  const C =
    1.9148 * Math.sin((M * Math.PI) / 180) +
    0.02 * Math.sin((2 * M * Math.PI) / 180)

  // Ecliptic longitude
  const lambda = (M + C + 180 + 102.9372) % 360

  // Solar transit
  const Jtransit = 2451545.5 + J + 0.0053 * Math.sin((M * Math.PI) / 180) -
    0.0069 * Math.sin((2 * lambda * Math.PI) / 180)

  // Declination
  const delta =
    Math.asin(Math.sin((lambda * Math.PI) / 180) * Math.sin((23.44 * Math.PI) / 180))

  // Hour angle
  const omega = Math.acos(
    (Math.sin((-0.83 * Math.PI) / 180) -
      Math.sin((latitude * Math.PI) / 180) * Math.sin(delta)) /
      (Math.cos((latitude * Math.PI) / 180) * Math.cos(delta))
  )

  // Sunset
  const Jset = Jtransit + (omega * 180) / Math.PI / 360

  // Convert Julian day to timestamp
  const sunsetTime = (Jset - 2440587.5) * 86400000

  // Create date in UTC and convert to timezone
  const sunsetDate = new Date(sunsetTime)

  // Apply timezone offset
  // Note: This is simplified. Production should use a proper timezone library
  const utcDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    sunsetDate.getUTCHours(),
    sunsetDate.getUTCMinutes(),
    0,
    0
  )

  return utcDate
}

/**
 * Get a human-readable description of a curve type.
 *
 * @param curveType - Type of curve
 * @returns Description of the curve behavior
 */
export function getCurveDescription(curveType: DimmerCurveType): string {
  switch (curveType) {
    case 'linear':
      return 'Steady, constant rate of change throughout the transition'

    case 'sigmoid':
      return 'Natural S-curve - slow start, fast middle, slow end (mimics sunrise/sunset)'

    case 'exponential':
      return 'Rapid change at start, gradual slowdown towards end'

    case 'logarithmic':
      return 'Gradual change at start, rapid acceleration towards end'

    default:
      return 'Unknown curve type'
  }
}
