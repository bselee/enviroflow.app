/**
 * Utility Exports
 */

export * from './encryption'
export * from './logger'

/**
 * VPD (Vapor Pressure Deficit) calculation
 * Essential for cannabis/plant cultivation automation
 */
export function calculateVPD(
  temperatureF: number,
  humidity: number,
  leafTempOffsetF = 3
): number {
  // Convert to Celsius
  const tempC = (temperatureF - 32) * (5 / 9)
  const leafTempC = ((temperatureF - leafTempOffsetF) - 32) * (5 / 9)

  // Calculate saturation vapor pressure at air temp (Tetens formula)
  const svpAir = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))

  // Calculate saturation vapor pressure at leaf temp
  const svpLeaf = 0.6108 * Math.exp((17.27 * leafTempC) / (leafTempC + 237.3))

  // Calculate actual vapor pressure
  const avp = svpAir * (humidity / 100)

  // VPD = SVP at leaf - AVP
  const vpd = svpLeaf - avp

  return Math.round(vpd * 100) / 100 // Round to 2 decimal places
}

/**
 * Temperature conversion utilities
 */
export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9
}

/**
 * Time parsing utilities
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

export function isTimeInRange(current: string, start: string, end: string): boolean {
  const currentMin = parseTimeToMinutes(current)
  const startMin = parseTimeToMinutes(start)
  const endMin = parseTimeToMinutes(end)

  // Handle overnight ranges
  if (endMin < startMin) {
    return currentMin >= startMin || currentMin <= endMin
  }

  return currentMin >= startMin && currentMin <= endMin
}

/**
 * Delay/sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined
  let delay = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries) {
        await sleep(delay)
        delay *= 2
      }
    }
  }

  throw lastError
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * Generate a simple UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}
