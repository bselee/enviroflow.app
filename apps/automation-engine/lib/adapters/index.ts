/**
 * EnviroFlow Controller Adapter Factory
 *
 * Supported brands:
 * - AC Infinity (Controller 69, UIS series)
 * - Inkbird (ITC-308, ITC-310T, IHC-200)
 * - CSV Upload (Manual data for any brand)
 * - MQTT (Generic MQTT devices - Tasmota, ESPHome, etc.)
 *
 * Coming soon:
 * - Govee (BLE - mobile only)
 */

import { ACInfinityAdapter } from './ACInfinityAdapter'
import { InkbirdAdapter } from './InkbirdAdapter'
import { CSVUploadAdapter, generateCSVTemplate, validateCSVHeaders } from './CSVUploadAdapter'
import { MQTTAdapter, handleMQTTMessage, clearMessageStore } from './MQTTAdapter'
import type {
  ControllerAdapter,
  ControllerBrand,
  DiscoverableAdapter,
  DiscoveryCredentials,
  DiscoveryResult,
  DiscoveredDevice,
} from './types'

// ============================================
// Adapter Factory
// ============================================

/**
 * Get the appropriate adapter for a controller brand
 */
export function getAdapter(brand: ControllerBrand): ControllerAdapter {
  switch (brand) {
    case 'ac_infinity':
      return new ACInfinityAdapter()
    
    case 'inkbird':
      return new InkbirdAdapter()
    
    case 'csv_upload':
      return new CSVUploadAdapter()
    
    case 'govee':
      throw new Error(
        'Govee adapter requires BLE and is only available in the mobile app. ' +
        'Use CSV Upload as a fallback on web.'
      )
    
    case 'mqtt':
      return new MQTTAdapter()
    
    case 'custom':
      throw new Error(
        'Custom adapters require manual configuration. ' +
        'Contact support for assistance.'
      )
    
    default:
      throw new Error(`Unknown controller brand: ${brand}`)
  }
}

/**
 * Check if a brand is supported
 */
export function isBrandSupported(brand: string): brand is ControllerBrand {
  const supportedBrands: ControllerBrand[] = [
    'ac_infinity',
    'inkbird',
    'csv_upload',
    'mqtt'
  ]
  return supportedBrands.includes(brand as ControllerBrand)
}

/**
 * Check if a brand supports cloud-based device discovery
 */
export function supportsDiscovery(brand: ControllerBrand): boolean {
  const discoverableBrands: ControllerBrand[] = ['ac_infinity', 'inkbird']
  return discoverableBrands.includes(brand)
}

/**
 * Get a discoverable adapter for a brand that supports discovery.
 * Throws an error if the brand doesn't support discovery.
 *
 * @param brand - The controller brand
 * @returns DiscoverableAdapter instance
 * @throws Error if brand doesn't support discovery
 */
export function getDiscoverableAdapter(brand: ControllerBrand): DiscoverableAdapter {
  if (!supportsDiscovery(brand)) {
    throw new Error(
      `Brand "${brand}" does not support cloud discovery. ` +
      'Only AC Infinity and Inkbird currently support this feature.'
    )
  }

  // Both ACInfinityAdapter and InkbirdAdapter implement DiscoverableAdapter
  switch (brand) {
    case 'ac_infinity':
      return new ACInfinityAdapter()
    case 'inkbird':
      return new InkbirdAdapter()
    default:
      throw new Error(`Unknown discoverable brand: ${brand}`)
  }
}

/**
 * Get list of brands that support cloud discovery
 */
export function getDiscoverableBrands(): ControllerBrand[] {
  return ['ac_infinity', 'inkbird']
}

/**
 * Get list of supported brands with metadata
 */
export function getSupportedBrands() {
  return [
    {
      id: 'ac_infinity',
      name: 'AC Infinity',
      description: 'Controller 69, Controller 67, UIS Inline Fans & Lights',
      requiresCredentials: true,
      credentialFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Password', type: 'password', required: true }
      ],
      capabilities: {
        sensors: ['temperature', 'humidity', 'vpd'],
        devices: ['fan', 'light', 'outlet'],
        supportsDimming: true
      },
      marketShare: '40%',
      status: 'available'
    },
    {
      id: 'inkbird',
      name: 'Inkbird',
      description: 'ITC-308, ITC-310T, IHC-200 Temperature & Humidity Controllers',
      requiresCredentials: true,
      credentialFields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Password', type: 'password', required: true }
      ],
      capabilities: {
        sensors: ['temperature', 'humidity'],
        devices: ['heater', 'cooler', 'humidifier', 'dehumidifier'],
        supportsDimming: false
      },
      marketShare: '25%',
      status: 'coming_soon',
      note: 'Uses Tuya platform - cloud integration pending. Use CSV Upload as fallback.'
    },
    {
      id: 'csv_upload',
      name: 'CSV Upload (Manual)',
      description: 'Upload sensor data manually. Works with any controller.',
      requiresCredentials: false,
      credentialFields: [],
      capabilities: {
        sensors: ['temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec'],
        devices: [],
        supportsDimming: false
      },
      marketShare: '10%',
      status: 'available',
      note: 'Read-only - cannot control devices'
    },
    {
      id: 'govee',
      name: 'Govee',
      description: 'H5179 WiFi Hygrometer (Bluetooth, mobile app only)',
      requiresCredentials: false,
      credentialFields: [],
      capabilities: {
        sensors: ['temperature', 'humidity'],
        devices: [],
        supportsDimming: false
      },
      marketShare: '15%',
      status: 'coming_soon',
      note: 'Requires mobile app for BLE pairing'
    },
    {
      id: 'mqtt',
      name: 'MQTT Generic',
      description: 'Tasmota, ESPHome, or any MQTT-compatible device',
      requiresCredentials: true,
      credentialFields: [
        { name: 'brokerUrl', label: 'Broker URL', type: 'text', required: true, placeholder: 'ws://broker.example.com:8083' },
        { name: 'username', label: 'Username', type: 'text', required: false },
        { name: 'password', label: 'Password', type: 'password', required: false },
        { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'tasmota/living_room' }
      ],
      capabilities: {
        sensors: ['temperature', 'humidity', 'vpd', 'co2', 'light'],
        devices: ['fan', 'light', 'outlet'],
        supportsDimming: true
      },
      marketShare: '5%',
      status: 'available',
      note: 'Requires WebSocket-enabled MQTT broker'
    }
  ]
}

// ============================================
// Re-exports
// ============================================

export * from './types'
export { ACInfinityAdapter } from './ACInfinityAdapter'
export { InkbirdAdapter } from './InkbirdAdapter'
export { CSVUploadAdapter, generateCSVTemplate, validateCSVHeaders } from './CSVUploadAdapter'
export { MQTTAdapter, handleMQTTMessage, clearMessageStore } from './MQTTAdapter'

// Retry utilities
export {
  fetchWithRetry,
  adapterFetch,
  getCircuitBreaker,
  recordFailure,
  recordSuccess,
  canMakeRequest,
  resetCircuitBreaker,
  classifyError,
  calculateDelay,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  type RetryConfig,
  type CircuitBreakerConfig,
  type CircuitState,
  type CircuitBreakerState,
  type RetryResult,
  type ErrorType,
  type ClassifiedError,
} from './retry'
