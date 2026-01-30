/**
 * VPD (Vapor Pressure Deficit) Calculation Utilities
 *
 * Consolidated VPD calculations for the automation engine adapters.
 * These functions use the Magnus-Tetens approximation for saturation vapor pressure.
 */

/**
 * Calculates VPD from temperature (Celsius) and humidity.
 *
 * @param temperatureCelsius - Temperature in Celsius
 * @param humidityPercent - Relative humidity (0-100)
 * @returns VPD in kPa, or null if inputs are invalid
 */
export function calculateVPDCelsius(
  temperatureCelsius: number,
  humidityPercent: number
): number | null {
  if (!Number.isFinite(temperatureCelsius) || !Number.isFinite(humidityPercent)) {
    return null
  }

  if (temperatureCelsius < 0 || temperatureCelsius > 60 || humidityPercent < 0 || humidityPercent > 100) {
    return null
  }

  const svp = 0.6108 * Math.exp((17.27 * temperatureCelsius) / (temperatureCelsius + 237.3))
  const vpd = svp * (1 - humidityPercent / 100)

  if (!Number.isFinite(vpd) || vpd < 0 || vpd > 5) {
    return null
  }

  return Math.round(vpd * 100) / 100
}

/**
 * Calculates VPD from temperature (Fahrenheit) and humidity.
 *
 * @param temperatureFahrenheit - Temperature in Fahrenheit
 * @param humidityPercent - Relative humidity (0-100)
 * @returns VPD in kPa, or null if inputs are invalid
 */
export function calculateVPD(
  temperatureFahrenheit: number,
  humidityPercent: number
): number | null {
  const temperatureCelsius = (temperatureFahrenheit - 32) * 5 / 9
  return calculateVPDCelsius(temperatureCelsius, humidityPercent)
}

/**
 * Calculates leaf VPD (accounts for leaf temperature being different from air temperature).
 *
 * @param temperatureCelsius - Air temperature in Celsius
 * @param humidityPercent - Relative humidity (0-100)
 * @param leafTempOffset - Leaf temperature offset in Celsius (usually negative, leaves are cooler)
 * @returns VPD in kPa, or null if inputs are invalid
 */
export function calculateLeafVPDCelsius(
  temperatureCelsius: number,
  humidityPercent: number,
  leafTempOffset: number = -2
): number | null {
  if (!Number.isFinite(temperatureCelsius) || !Number.isFinite(humidityPercent)) {
    return null
  }

  if (temperatureCelsius < 0 || temperatureCelsius > 60 || humidityPercent < 0 || humidityPercent > 100) {
    return null
  }

  const leafTempC = temperatureCelsius + leafTempOffset

  // Saturation vapor pressure at leaf temperature
  const svpLeaf = 0.6108 * Math.exp((17.27 * leafTempC) / (leafTempC + 237.3))

  // Actual vapor pressure at air temperature
  const svpAir = 0.6108 * Math.exp((17.27 * temperatureCelsius) / (temperatureCelsius + 237.3))
  const avp = svpAir * (humidityPercent / 100)

  // VPD is the difference
  const vpd = svpLeaf - avp

  if (!Number.isFinite(vpd) || vpd < 0 || vpd > 5) {
    return null
  }

  return Math.max(0, Math.round(vpd * 100) / 100)
}
