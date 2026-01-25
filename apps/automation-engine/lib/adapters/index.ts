/**
 * EnviroFlow Controller Adapter Factory
 *
 * Supported brands:
 * - AC Infinity (Controller 69, UIS series)
 * - Inkbird (ITC-308, ITC-310T, IHC-200)
 * - CSV Upload (Manual data for any brand)
 * - MQTT (Generic MQTT devices - Tasmota, ESPHome, etc.)
 * - Ecowitt (Weather Gateways - GW1100, GW2000, GW3000)
 * - Govee (H5179 sensors, Smart LED lights, Smart plugs - API-based)
 */

import { ACInfinityAdapter } from './ACInfinityAdapter'
import { InkbirdAdapter } from './InkbirdAdapter'
import { CSVUploadAdapter, generateCSVTemplate, validateCSVHeaders } from './CSVUploadAdapter'
import { MQTTAdapter, handleMQTTMessage, clearMessageStore } from './MQTTAdapter'
import { EcowittAdapter } from './EcowittAdapter'
import { GoveeAdapter } from './GoveeAdapter'
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
      return new GoveeAdapter()
    
    case 'mqtt':
      return new MQTTAdapter()

    case 'ecowitt':
      return new EcowittAdapter()

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
    'mqtt',
    'ecowitt',
    'govee'
  ]
  return supportedBrands.includes(brand as ControllerBrand)
}

/**
 * Check if a brand supports cloud-based device discovery
 */
export function supportsDiscovery(brand: ControllerBrand): boolean {
  const discoverableBrands: ControllerBrand[] = ['ac_infinity', 'inkbird', 'govee', 'mqtt']
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
      `Brand "${brand}" does not support discovery. ` +
      'Only AC Infinity, Inkbird, Govee, and MQTT currently support this feature.'
    )
  }

  // ACInfinityAdapter, InkbirdAdapter, GoveeAdapter, and MQTTAdapter implement DiscoverableAdapter
  switch (brand) {
    case 'ac_infinity':
      return new ACInfinityAdapter()
    case 'inkbird':
      return new InkbirdAdapter()
    case 'govee':
      return new GoveeAdapter()
    case 'mqtt':
      return new MQTTAdapter()
    default:
      throw new Error(`Unknown discoverable brand: ${brand}`)
  }
}

/**
 * Get list of brands that support cloud discovery
 */
export function getDiscoverableBrands(): ControllerBrand[] {
  return ['ac_infinity', 'inkbird', 'govee', 'mqtt']
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
      description: 'H5179 WiFi Hygrometer, Smart LED Lights, Smart Plugs',
      requiresCredentials: true,
      credentialFields: [
        { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Get from Govee Home app: Account > About Us > Apply for API Key' }
      ],
      capabilities: {
        sensors: ['temperature', 'humidity'],
        devices: ['light', 'outlet'],
        supportsDimming: true
      },
      marketShare: '15%',
      status: 'available',
      note: 'Requires API key from Govee Home app. Rate limited to 60 requests/min per device.'
    },
    {
      id: 'mqtt',
      name: 'MQTT Generic',
      description: 'Tasmota, ESPHome, or any MQTT-compatible device',
      requiresCredentials: true,
      credentialFields: [
        { name: 'brokerUrl', label: 'Broker URL', type: 'text', required: true, placeholder: 'mqtt://broker.example.com' },
        { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '1883' },
        { name: 'topicPrefix', label: 'Topic Prefix', type: 'text', required: true, placeholder: 'enviroflow/sensors' },
        { name: 'useTls', label: 'Use TLS/SSL', type: 'checkbox', required: false },
        { name: 'username', label: 'Username', type: 'text', required: false },
        { name: 'password', label: 'Password', type: 'password', required: false },
        { name: 'clientId', label: 'Client ID (optional)', type: 'text', required: false, placeholder: 'enviroflow_device' }
      ],
      capabilities: {
        sensors: ['temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec', 'soil_moisture', 'pressure'],
        devices: ['fan', 'light', 'outlet'],
        supportsDimming: true
      },
      marketShare: '5%',
      status: 'available',
      note: 'Supports MQTT, MQTTS, WebSocket (ws://), and secure WebSocket (wss://)'
    },
    {
      id: 'ecowitt',
      name: 'Ecowitt Weather Gateway',
      description: 'GW1100, GW2000, GW3000 with RF sensors for temperature, humidity, soil moisture, and more',
      requiresCredentials: true,
      credentialFields: [
        { name: 'connectionMethod', label: 'Connection Method', type: 'select', required: true, options: ['push', 'tcp', 'http', 'cloud'] },
        { name: 'gatewayIP', label: 'Gateway IP Address', type: 'text', required: false, placeholder: '192.168.1.100' },
        { name: 'macAddress', label: 'MAC Address', type: 'text', required: false, placeholder: 'XX:XX:XX:XX:XX:XX' },
        { name: 'apiKey', label: 'API Key (for cloud)', type: 'password', required: false },
        { name: 'applicationKey', label: 'Application Key (for cloud)', type: 'password', required: false }
      ],
      capabilities: {
        sensors: ['temperature', 'humidity', 'pressure', 'soil_moisture', 'uv', 'solar_radiation', 'wind', 'rain'],
        devices: ['valve', 'plug'],
        supportsDimming: false
      },
      status: 'available'
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
export { EcowittAdapter } from './EcowittAdapter'
export { GoveeAdapter } from './GoveeAdapter'

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
