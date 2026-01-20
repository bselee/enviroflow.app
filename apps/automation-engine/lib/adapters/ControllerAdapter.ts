/**
 * Controller Adapter Interface
 * Defines the contract that all controller adapters must implement
 */

import type {
  ControllerCredentials,
  ControllerMetadata,
  ControllerStatus,
  DeviceCommand,
  CommandResult,
} from '../types/controller'
import type { SensorReading } from '../types/sensor'

/**
 * Abstract interface for controller adapters
 * Each brand (AC Infinity, Inkbird, etc.) implements this interface
 */
export interface ControllerAdapter {
  /**
   * Connect to controller using credentials
   * @param credentials - Brand-specific authentication credentials
   * @returns Controller metadata including ID and capabilities
   * @throws Error if connection fails
   */
  connect(credentials: ControllerCredentials): Promise<ControllerMetadata>

  /**
   * Read all sensor data from controller
   * @param controllerId - The controller's unique identifier
   * @returns Array of current sensor readings
   */
  readSensors(controllerId: string): Promise<SensorReading[]>

  /**
   * Control a device (fan, light, heater, etc.)
   * @param controllerId - The controller's unique identifier
   * @param port - Physical port number on the controller
   * @param command - Command to execute
   * @returns Result of the command execution
   */
  controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult>

  /**
   * Get current controller status (online/offline, firmware, etc.)
   * @param controllerId - The controller's unique identifier
   * @returns Current status information
   */
  getStatus(controllerId: string): Promise<ControllerStatus>

  /**
   * Disconnect from controller and cleanup resources
   * @param controllerId - The controller's unique identifier
   */
  disconnect(controllerId: string): Promise<void>

  /**
   * Refresh authentication token if applicable
   * @param controllerId - The controller's unique identifier
   * @returns True if refresh was successful or not needed
   */
  refreshAuth?(controllerId: string): Promise<boolean>
}

/**
 * Base class with common functionality for adapters
 */
export abstract class BaseControllerAdapter implements ControllerAdapter {
  protected readonly name: string

  constructor(name: string) {
    this.name = name
  }

  abstract connect(credentials: ControllerCredentials): Promise<ControllerMetadata>
  abstract readSensors(controllerId: string): Promise<SensorReading[]>
  abstract controlDevice(
    controllerId: string,
    port: number,
    command: DeviceCommand
  ): Promise<CommandResult>
  abstract getStatus(controllerId: string): Promise<ControllerStatus>
  abstract disconnect(controllerId: string): Promise<void>

  /**
   * Helper to make HTTP requests with error handling
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 10000
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Helper to retry failed requests
   */
  protected async retryWithBackoff<T>(
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
          await this.sleep(delay)
          delay *= 2 // Exponential backoff
        }
      }
    }

    throw lastError
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Log with adapter name prefix
   */
  protected log(message: string, data?: unknown): void {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${this.name}] ${message}`, data ?? '')
  }

  /**
   * Log error with adapter name prefix
   */
  protected logError(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [${this.name}] ERROR: ${message}`, error ?? '')
  }
}

/**
 * Factory function to get adapter by brand
 */
export function getAdapterForBrand(brand: string): ControllerAdapter {
  // Dynamic import to avoid circular dependencies
  // These will be imported at runtime
  switch (brand) {
    case 'ac_infinity':
      // Will be replaced with actual import
      throw new Error('Use createAdapter() from adapter factory')
    case 'inkbird':
      throw new Error('Use createAdapter() from adapter factory')
    case 'generic_wifi':
      throw new Error('Use createAdapter() from adapter factory')
    default:
      throw new Error(`Unknown controller brand: ${brand}`)
  }
}
