/**
 * Consolidated VPD (Vapor Pressure Deficit) Calculation Utilities
 *
 * VPD is a key metric for plant health, representing the difference between
 * the amount of moisture in the air and the maximum moisture the air can hold.
 *
 * This module provides a single source of truth for VPD calculations across
 * the application to ensure consistency.
 *
 * Formula: VPD = SVP * (1 - RH/100)
 * Where SVP (Saturation Vapor Pressure) = 0.6108 * exp(17.27 * T / (T + 237.3))
 * T is temperature in Celsius
 */

/**
 * Calculates Vapor Pressure Deficit (VPD) from temperature and humidity.
 *
 * @param temperatureFahrenheit - Temperature in Fahrenheit
 * @param humidityPercent - Relative humidity as percentage (0-100)
 * @returns VPD in kPa, rounded to 2 decimal places, or null if inputs are invalid
 *
 * @example
 * ```ts
 * const vpd = calculateVPD(75, 65); // Returns ~1.02 kPa
 * const invalid = calculateVPD(-100, 50); // Returns null (out of range)
 * ```
 */
export function calculateVPD(
  temperatureFahrenheit: number,
  humidityPercent: number
): number | null {
  // Validate inputs to prevent NaN/Infinity
  if (!Number.isFinite(temperatureFahrenheit) || !Number.isFinite(humidityPercent)) {
    return null;
  }

  // Temperature range validation: 32°F to 140°F (0°C to 60°C)
  // This covers reasonable environmental monitoring conditions
  if (temperatureFahrenheit < 32 || temperatureFahrenheit > 140) {
    return null;
  }

  // Humidity range validation: 0-100%
  if (humidityPercent < 0 || humidityPercent > 100) {
    return null;
  }

  // Convert Fahrenheit to Celsius for the VPD formula
  const temperatureCelsius = (temperatureFahrenheit - 32) * 5 / 9;

  // Magnus-Tetens approximation for saturation vapor pressure
  const svp = 0.6108 * Math.exp((17.27 * temperatureCelsius) / (temperatureCelsius + 237.3));
  const vpd = svp * (1 - humidityPercent / 100);

  // Validate result (VPD should be between 0 and ~5 kPa for normal conditions)
  if (!Number.isFinite(vpd) || vpd < 0 || vpd > 5) {
    console.warn(`VPD out of range: ${vpd} kPa (Temp: ${temperatureFahrenheit}°F, RH: ${humidityPercent}%)`);
    return null;
  }

  return Math.round(vpd * 100) / 100;
}

/**
 * Calculates VPD with temperature already in Celsius.
 * Used for internal calculations where Celsius is already available.
 *
 * @param temperatureCelsius - Temperature in Celsius
 * @param humidityPercent - Relative humidity as percentage (0-100)
 * @returns VPD in kPa, rounded to 2 decimal places, or null if inputs are invalid
 */
export function calculateVPDCelsius(
  temperatureCelsius: number,
  humidityPercent: number
): number | null {
  // Convert Celsius to Fahrenheit and use main function
  const temperatureFahrenheit = (temperatureCelsius * 9 / 5) + 32;
  return calculateVPD(temperatureFahrenheit, humidityPercent);
}

/**
 * VPD status categories for plant health monitoring.
 */
export type VPDStatus = 'danger_low' | 'warning_low' | 'optimal' | 'warning_high' | 'danger_high';

/**
 * VPD ranges for different growth stages (in kPa).
 * Based on standard cultivation guidelines.
 */
export const VPD_RANGES = {
  // Propagation/cloning - high humidity, low VPD
  propagation: { min: 0.4, max: 0.8 },
  // Vegetative growth
  vegetative: { min: 0.8, max: 1.2 },
  // Early/mid flowering
  flowering: { min: 1.0, max: 1.5 },
  // Late flowering - can tolerate higher VPD
  lateFlowering: { min: 1.2, max: 1.6 },
  // General optimal range
  general: { min: 0.8, max: 1.2 },
} as const;

/**
 * Determines the VPD status based on the value and target range.
 *
 * @param vpd - VPD value in kPa
 * @param targetRange - Target min/max range
 * @returns VPD status category
 */
export function getVPDStatus(
  vpd: number | null,
  targetRange: { min: number; max: number } = VPD_RANGES.general
): VPDStatus | null {
  if (vpd === null) return null;

  const { min, max } = targetRange;

  if (vpd < min * 0.6) return 'danger_low';
  if (vpd < min) return 'warning_low';
  if (vpd > max * 1.3) return 'danger_high';
  if (vpd > max) return 'warning_high';
  return 'optimal';
}

/**
 * Formats VPD value for display.
 *
 * @param vpd - VPD value in kPa
 * @param unit - Display unit ('kPa' or 'mbar')
 * @returns Formatted string
 */
export function formatVPD(vpd: number | null, unit: 'kPa' | 'mbar' = 'kPa'): string {
  if (vpd === null) return '--';

  if (unit === 'mbar') {
    // 1 kPa = 10 mbar
    return `${(vpd * 10).toFixed(1)} mbar`;
  }

  return `${vpd.toFixed(2)} kPa`;
}

/**
 * Calculates the leaf temperature offset for more accurate VPD.
 * Leaves are typically 2-5°F cooler than air temperature.
 *
 * @param airTemperatureF - Air temperature in Fahrenheit
 * @param lightIntensityPPFD - Light intensity in PPFD (optional)
 * @returns Estimated leaf temperature in Fahrenheit
 */
export function estimateLeafTemperature(
  airTemperatureF: number,
  lightIntensityPPFD?: number
): number {
  // Default offset of 3°F cooler than air
  let offset = 3;

  // Adjust offset based on light intensity
  if (lightIntensityPPFD !== undefined) {
    // Higher light = warmer leaves, lower offset
    if (lightIntensityPPFD > 800) offset = 1;
    else if (lightIntensityPPFD > 400) offset = 2;
    else if (lightIntensityPPFD < 200) offset = 4;
  }

  return airTemperatureF - offset;
}

/**
 * Calculates leaf VPD (more accurate for plant transpiration).
 *
 * @param airTemperatureF - Air temperature in Fahrenheit
 * @param humidityPercent - Relative humidity as percentage
 * @param leafOffset - Temperature offset in Fahrenheit (default: 3)
 * @returns Leaf VPD in kPa
 */
export function calculateLeafVPD(
  airTemperatureF: number,
  humidityPercent: number,
  leafOffset: number = 3
): number | null {
  const leafTemperature = airTemperatureF - leafOffset;
  return calculateVPD(leafTemperature, humidityPercent);
}
