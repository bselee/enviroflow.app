/**
 * Network Discovery Service
 *
 * Provides cloud-based device discovery functionality for EnviroFlow.
 * This module orchestrates the discovery process across multiple controller brands
 * and normalizes the results for the frontend.
 *
 * IMPORTANT: Network-level discovery (mDNS, UPnP, IP scanning) is not possible
 * from a browser due to security restrictions. This module focuses on cloud-based
 * discovery through the controllers' cloud APIs, which is more reliable anyway.
 *
 * @module network-discovery
 */

import type { ControllerBrand } from '@/types'

// ============================================
// Discovery Types (Frontend-specific)
// ============================================

/**
 * A device discovered through the cloud API.
 * This is a frontend-friendly version of the adapter's DiscoveredDevice type.
 */
export interface DiscoveredDevice {
  /** Unique device identifier from the cloud API */
  deviceId: string
  /** Device code/serial number (if available) */
  deviceCode?: string
  /** Human-readable device name */
  name: string
  /** Controller brand */
  brand: ControllerBrand
  /** Device model (e.g., "Controller 69", "ITC-308") */
  model?: string
  /** Is device currently online */
  isOnline: boolean
  /** Last online timestamp (ISO string) */
  lastSeen?: string
  /** Firmware version (if available) */
  firmwareVersion?: string
  /** Whether this device is already registered in EnviroFlow */
  isAlreadyRegistered: boolean
  /** Device capabilities summary */
  capabilities?: {
    sensors?: string[]
    devices?: string[]
    supportsDimming?: boolean
  }
}

/**
 * Result of a discovery operation from the API.
 */
export interface DiscoveryResponse {
  /** Whether the discovery was successful */
  success: boolean
  /** List of discovered devices */
  devices: DiscoveredDevice[]
  /** Total number of devices found */
  totalDevices: number
  /** Number of devices already registered */
  alreadyRegisteredCount: number
  /** Error message if discovery failed */
  error?: string
  /** Additional error details for debugging */
  details?: string
  /** Discovery source (cloud_api, mdns, etc.) */
  source: string
  /** Timestamp of the discovery (ISO string) */
  timestamp: string
}

/**
 * Credentials for cloud-based discovery.
 */
export type DiscoveryCredentials =
  | {
      brand: 'ac_infinity' | 'inkbird'
      email: string
      password: string
    }
  | {
      brand: 'govee'
      apiKey: string
    }

/**
 * Discovery state for UI components.
 */
export interface DiscoveryState {
  /** Whether a discovery is in progress */
  isScanning: boolean
  /** Discovered devices */
  devices: DiscoveredDevice[]
  /** Error message if any */
  error: string | null
  /** Last successful scan timestamp */
  lastScanAt: Date | null
}

// ============================================
// Discovery Service Functions
// ============================================

/**
 * Discover devices for a specific brand using cloud API.
 *
 * This function calls the /api/controllers/discover endpoint which
 * uses the brand's adapter to query the cloud API for registered devices.
 *
 * @param credentials - Brand credentials (email/password)
 * @param authToken - User's Supabase auth token for API authentication
 * @returns Discovery result with list of devices
 *
 * @example
 * ```typescript
 * const result = await discoverDevices({
 *   brand: 'ac_infinity',
 *   email: 'user@example.com',
 *   password: 'password123'
 * }, authToken);
 *
 * if (result.success) {
 *   console.log(`Found ${result.totalDevices} devices`);
 *   result.devices.forEach(device => {
 *     console.log(`- ${device.name} (${device.model})`);
 *   });
 * } else {
 *   console.error('Discovery failed:', result.error);
 * }
 * ```
 */
export async function discoverDevices(
  credentials: DiscoveryCredentials,
  authToken?: string
): Promise<DiscoveryResponse> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // Add auth token if provided (for checking already-registered devices)
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const body = credentials.brand === 'govee'
      ? { brand: credentials.brand, apiKey: credentials.apiKey }
      : { brand: credentials.brand, email: credentials.email, password: credentials.password }

    const response = await fetch('/api/controllers/discover', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        devices: [],
        totalDevices: 0,
        alreadyRegisteredCount: 0,
        error: errorData.error || `HTTP ${response.status}`,
        details: errorData.details || errorData.message,
        source: 'cloud_api',
        timestamp: new Date().toISOString(),
      }
    }

    const data: DiscoveryResponse = await response.json()
    return data

  } catch (error) {
    return {
      success: false,
      devices: [],
      totalDevices: 0,
      alreadyRegisteredCount: 0,
      error: error instanceof Error ? error.message : 'Network error during discovery',
      source: 'cloud_api',
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Get the list of brands that support device discovery.
 *
 * @returns Array of brand IDs that support discovery
 */
export function getDiscoverableBrands(): ControllerBrand[] {
  return ['ac_infinity', 'inkbird', 'govee']
}

/**
 * Check if a brand supports cloud-based device discovery.
 *
 * @param brand - The brand to check
 * @returns True if the brand supports discovery
 */
export function supportsDiscovery(brand: ControllerBrand): boolean {
  return getDiscoverableBrands().includes(brand)
}

/**
 * Get brand display information for discovery UI.
 *
 * @param brand - The brand ID
 * @returns Display information for the brand
 */
export function getBrandDisplayInfo(brand: ControllerBrand): {
  name: string
  description: string
  icon: string
  helpText: string
} {
  const brandInfo: Record<ControllerBrand, {
    name: string
    description: string
    icon: string
    helpText: string
  }> = {
    ac_infinity: {
      name: 'AC Infinity',
      description: 'Controller 69, UIS Series',
      icon: 'cpu',
      helpText: 'Enter your AC Infinity app credentials to discover your devices.',
    },
    inkbird: {
      name: 'Inkbird',
      description: 'ITC-308, ITC-310T, IHC-200',
      icon: 'thermometer',
      helpText: 'Enter your Inkbird app credentials to discover your devices.',
    },
    govee: {
      name: 'Govee',
      description: 'WiFi Hygrometers, Smart Lights & Plugs',
      icon: 'droplet',
      helpText: 'Enter your Govee API key. Get it from Govee Home app: Account > About Us > Apply for API Key.',
    },
    ecowitt: {
      name: 'Ecowitt',
      description: 'Weather Stations & Environmental Sensors',
      icon: 'cloud',
      helpText: 'Configure your Ecowitt device to push data via webhook.',
    },
    csv_upload: {
      name: 'CSV Upload',
      description: 'Manual data import',
      icon: 'upload',
      helpText: 'CSV Upload does not support automatic discovery.',
    },
    mqtt: {
      name: 'MQTT',
      description: 'Generic MQTT devices',
      icon: 'radio',
      helpText: 'MQTT devices do not support automatic discovery.',
    },
    custom: {
      name: 'Custom',
      description: 'Custom integration',
      icon: 'settings',
      helpText: 'Custom devices do not support automatic discovery.',
    },
  }

  return brandInfo[brand]
}

/**
 * Filter discovered devices by registration status.
 *
 * @param devices - List of discovered devices
 * @param showRegistered - Whether to include already-registered devices
 * @returns Filtered list of devices
 */
export function filterDiscoveredDevices(
  devices: DiscoveredDevice[],
  showRegistered: boolean = false
): DiscoveredDevice[] {
  if (showRegistered) {
    return devices
  }
  return devices.filter(device => !device.isAlreadyRegistered)
}

/**
 * Sort discovered devices by various criteria.
 *
 * @param devices - List of discovered devices
 * @param sortBy - Sort criteria
 * @returns Sorted list of devices
 */
export function sortDiscoveredDevices(
  devices: DiscoveredDevice[],
  sortBy: 'name' | 'online' | 'registered' = 'name'
): DiscoveredDevice[] {
  return [...devices].sort((a, b) => {
    switch (sortBy) {
      case 'online':
        // Online devices first
        return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0)
      case 'registered':
        // Unregistered devices first
        return (a.isAlreadyRegistered ? 1 : 0) - (b.isAlreadyRegistered ? 1 : 0)
      case 'name':
      default:
        return a.name.localeCompare(b.name)
    }
  })
}

/**
 * Create initial discovery state.
 *
 * @returns Initial discovery state
 */
export function createInitialDiscoveryState(): DiscoveryState {
  return {
    isScanning: false,
    devices: [],
    error: null,
    lastScanAt: null,
  }
}
