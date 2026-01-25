/**
 * Local Network Discovery
 *
 * Provides local network device discovery using mDNS/Bonjour.
 * This allows EnviroFlow to find controllers on the same network without cloud APIs.
 *
 * Features:
 * - mDNS/Bonjour service discovery
 * - Local IP scanning fallback
 * - Manual IP entry support
 * - Device type detection
 * - Privacy-focused (no cloud communication)
 *
 * Note: Browser-based mDNS is limited by security restrictions.
 * This implementation provides a server-side API endpoint for actual scanning.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6762 (mDNS specification)
 */

import type { ControllerBrand } from '@/types'

// ============================================
// Discovery Types
// ============================================

export interface LocalDevice {
  /** Device IP address */
  ipAddress: string
  /** Device port (if detectable) */
  port?: number
  /** Device hostname */
  hostname?: string
  /** MAC address (if available) */
  macAddress?: string
  /** Device name from mDNS/UPnP */
  name?: string
  /** Device type (detected from service or manual) */
  deviceType?: string
  /** Controller brand (if detectable) */
  brand?: ControllerBrand
  /** mDNS service type */
  serviceType?: string
  /** Additional metadata from discovery */
  metadata?: {
    model?: string
    manufacturer?: string
    serialNumber?: string
    firmwareVersion?: string
    [key: string]: unknown
  }
  /** Discovery method used */
  discoveryMethod: 'mdns' | 'upnp' | 'manual' | 'ip_scan'
  /** When the device was discovered */
  discoveredAt: string
  /** Whether the device responded to ping/probe */
  isReachable: boolean
  /** Response time in milliseconds */
  responseTime?: number
}

export interface LocalDiscoveryOptions {
  /** Network interface to scan (optional, defaults to all) */
  networkInterface?: string
  /** Timeout for discovery in milliseconds */
  timeout?: number
  /** Whether to include offline devices */
  includeOffline?: boolean
  /** Specific service types to search for */
  serviceTypes?: string[]
  /** IP range to scan (for manual scanning) */
  ipRange?: {
    start: string
    end: string
  }
}

export interface LocalDiscoveryResult {
  /** Whether the discovery was successful */
  success: boolean
  /** List of discovered devices */
  devices: LocalDevice[]
  /** Total number of devices found */
  totalDevices: number
  /** Number of reachable devices */
  reachableCount: number
  /** Discovery method used */
  method: 'mdns' | 'upnp' | 'ip_scan' | 'manual'
  /** Error message if discovery failed */
  error?: string
  /** Timestamp of the discovery */
  timestamp: string
  /** Duration of the scan in milliseconds */
  scanDuration?: number
}

// ============================================
// mDNS Service Types
// ============================================

/**
 * Common mDNS service types for IoT devices
 */
export const MDNS_SERVICE_TYPES = {
  HTTP: '_http._tcp.local.',
  HTTPS: '_https._tcp.local.',
  MQTT: '_mqtt._tcp.local.',
  HOMEASSISTANT: '_homeassistant._tcp.local.',
  HOMEKIT: '_hap._tcp.local.',
  PRINTER: '_ipp._tcp.local.',
  AIRPLAY: '_airplay._tcp.local.',
  CHROMECAST: '_googlecast._tcp.local.',
  // Custom service types for specific controllers
  AC_INFINITY: '_acinfinity._tcp.local.',
  INKBIRD: '_inkbird._tcp.local.',
  GOVEE: '_govee._tcp.local.',
  ECOWITT: '_ecowitt._tcp.local.',
} as const

/**
 * Get mDNS service types for a specific brand
 */
export function getBrandServiceTypes(brand: ControllerBrand): string[] {
  const brandServiceTypes: Record<ControllerBrand, string[]> = {
    ac_infinity: [MDNS_SERVICE_TYPES.AC_INFINITY, MDNS_SERVICE_TYPES.HTTP],
    inkbird: [MDNS_SERVICE_TYPES.INKBIRD, MDNS_SERVICE_TYPES.HTTP],
    govee: [MDNS_SERVICE_TYPES.GOVEE, MDNS_SERVICE_TYPES.HTTP],
    ecowitt: [MDNS_SERVICE_TYPES.ECOWITT, MDNS_SERVICE_TYPES.HTTP],
    mqtt: [MDNS_SERVICE_TYPES.MQTT],
    csv_upload: [], // No network discovery for CSV upload
    custom: [MDNS_SERVICE_TYPES.HTTP, MDNS_SERVICE_TYPES.HTTPS],
  }

  return brandServiceTypes[brand] || []
}

// ============================================
// Client-Side Discovery Functions
// ============================================

/**
 * Discover local devices using the server-side API
 * (Browser cannot do mDNS directly due to security restrictions)
 */
export async function discoverLocalDevices(
  options: LocalDiscoveryOptions = {}
): Promise<LocalDiscoveryResult> {
  try {
    const response = await fetch('/api/discovery/local', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        devices: [],
        totalDevices: 0,
        reachableCount: 0,
        method: 'mdns',
        error: errorData.error || `HTTP ${response.status}`,
        timestamp: new Date().toISOString(),
      }
    }

    const data: LocalDiscoveryResult = await response.json()
    return data
  } catch (error) {
    return {
      success: false,
      devices: [],
      totalDevices: 0,
      reachableCount: 0,
      method: 'mdns',
      error: error instanceof Error ? error.message : 'Network error during discovery',
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Test connectivity to a specific IP address
 */
export async function testDeviceConnection(
  ipAddress: string,
  port: number = 80
): Promise<{
  reachable: boolean
  responseTime?: number
  error?: string
}> {
  try {
    const startTime = Date.now()
    const response = await fetch('/api/discovery/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ipAddress, port }),
    })

    const responseTime = Date.now() - startTime

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        reachable: false,
        error: errorData.error || `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    return {
      reachable: data.reachable,
      responseTime: data.responseTime || responseTime,
    }
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    }
  }
}

/**
 * Add a device manually by IP address
 */
export async function addManualDevice(
  ipAddress: string,
  port?: number,
  brand?: ControllerBrand
): Promise<LocalDevice> {
  // Validate IP address format
  if (!isValidIPAddress(ipAddress)) {
    throw new Error('Invalid IP address format')
  }

  // Test connectivity
  const connectionTest = await testDeviceConnection(ipAddress, port)

  return {
    ipAddress,
    port,
    brand,
    discoveryMethod: 'manual',
    discoveredAt: new Date().toISOString(),
    isReachable: connectionTest.reachable,
    responseTime: connectionTest.responseTime,
  }
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate IPv4 address format
 */
export function isValidIPAddress(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(ip)) {
    return false
  }

  const parts = ip.split('.')
  return parts.every(part => {
    const num = parseInt(part, 10)
    return num >= 0 && num <= 255
  })
}

/**
 * Validate IP range
 */
export function isValidIPRange(start: string, end: string): boolean {
  if (!isValidIPAddress(start) || !isValidIPAddress(end)) {
    return false
  }

  const startNum = ipToNumber(start)
  const endNum = ipToNumber(end)

  return startNum <= endNum
}

/**
 * Convert IP address to number for comparison
 */
export function ipToNumber(ip: string): number {
  const parts = ip.split('.')
  return (
    parseInt(parts[0], 10) * 16777216 +
    parseInt(parts[1], 10) * 65536 +
    parseInt(parts[2], 10) * 256 +
    parseInt(parts[3], 10)
  )
}

/**
 * Convert number to IP address
 */
export function numberToIP(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.')
}

/**
 * Generate IP addresses in a range
 */
export function generateIPRange(start: string, end: string): string[] {
  if (!isValidIPRange(start, end)) {
    throw new Error('Invalid IP range')
  }

  const startNum = ipToNumber(start)
  const endNum = ipToNumber(end)
  const ips: string[] = []

  // Limit to 254 IPs to prevent abuse
  const maxRange = Math.min(endNum - startNum + 1, 254)

  for (let i = 0; i < maxRange; i++) {
    ips.push(numberToIP(startNum + i))
  }

  return ips
}

// ============================================
// Brand Detection
// ============================================

/**
 * Attempt to detect controller brand from device metadata
 */
export function detectBrandFromMetadata(device: LocalDevice): ControllerBrand | undefined {
  const metadata = device.metadata
  const hostname = device.hostname?.toLowerCase() || ''
  const name = device.name?.toLowerCase() || ''
  const serviceType = device.serviceType?.toLowerCase() || ''

  // Check for brand-specific identifiers
  if (
    hostname.includes('acinfinity') ||
    name.includes('ac infinity') ||
    serviceType.includes('acinfinity')
  ) {
    return 'ac_infinity'
  }

  if (
    hostname.includes('inkbird') ||
    name.includes('inkbird') ||
    serviceType.includes('inkbird')
  ) {
    return 'inkbird'
  }

  if (
    hostname.includes('govee') ||
    name.includes('govee') ||
    serviceType.includes('govee')
  ) {
    return 'govee'
  }

  if (
    hostname.includes('ecowitt') ||
    name.includes('ecowitt') ||
    serviceType.includes('ecowitt')
  ) {
    return 'ecowitt'
  }

  // Check metadata manufacturer field
  if (metadata?.manufacturer) {
    const manufacturer = metadata.manufacturer.toString().toLowerCase()
    if (manufacturer.includes('ac infinity')) return 'ac_infinity'
    if (manufacturer.includes('inkbird')) return 'inkbird'
    if (manufacturer.includes('govee')) return 'govee'
    if (manufacturer.includes('ecowitt')) return 'ecowitt'
  }

  return undefined
}

// ============================================
// Privacy & Security
// ============================================

/**
 * Check if an IP address is in a private range
 */
export function isPrivateIP(ip: string): boolean {
  if (!isValidIPAddress(ip)) {
    return false
  }

  const parts = ip.split('.').map(Number)
  const firstOctet = parts[0]
  const secondOctet = parts[1]

  // 10.0.0.0 - 10.255.255.255
  if (firstOctet === 10) {
    return true
  }

  // 172.16.0.0 - 172.31.255.255
  if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
    return true
  }

  // 192.168.0.0 - 192.168.255.255
  if (firstOctet === 192 && secondOctet === 168) {
    return true
  }

  // 127.0.0.0 - 127.255.255.255 (loopback)
  if (firstOctet === 127) {
    return true
  }

  return false
}

/**
 * Validate SSL certificate (for HTTPS connections)
 */
export async function validateSSLCertificate(
  ipAddress: string,
  port: number = 443
): Promise<{
  valid: boolean
  issuer?: string
  validFrom?: string
  validTo?: string
  error?: string
}> {
  try {
    const response = await fetch('/api/discovery/validate-ssl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ipAddress, port }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        error: errorData.error || 'SSL validation failed',
      }
    }

    return await response.json()
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'SSL validation error',
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format device for display
 */
export function formatDeviceDisplay(device: LocalDevice): string {
  const parts: string[] = []

  if (device.name) {
    parts.push(device.name)
  }

  if (device.hostname && device.hostname !== device.name) {
    parts.push(device.hostname)
  }

  if (device.ipAddress) {
    parts.push(device.ipAddress)
  }

  return parts.join(' - ') || 'Unknown Device'
}

/**
 * Sort devices by various criteria
 */
export function sortLocalDevices(
  devices: LocalDevice[],
  sortBy: 'ip' | 'name' | 'reachable' | 'responseTime' = 'ip'
): LocalDevice[] {
  return [...devices].sort((a, b) => {
    switch (sortBy) {
      case 'ip':
        return ipToNumber(a.ipAddress) - ipToNumber(b.ipAddress)
      case 'name':
        return (a.name || a.hostname || '').localeCompare(b.name || b.hostname || '')
      case 'reachable':
        return (b.isReachable ? 1 : 0) - (a.isReachable ? 1 : 0)
      case 'responseTime':
        return (a.responseTime || 9999) - (b.responseTime || 9999)
      default:
        return 0
    }
  })
}

/**
 * Filter devices by brand
 */
export function filterDevicesByBrand(
  devices: LocalDevice[],
  brand: ControllerBrand
): LocalDevice[] {
  return devices.filter(device => device.brand === brand)
}

/**
 * Get current network info (from server)
 */
export async function getNetworkInfo(): Promise<{
  success: boolean
  interfaces: Array<{
    name: string
    address: string
    netmask: string
    family: string
  }>
  error?: string
}> {
  try {
    const response = await fetch('/api/discovery/network-info')

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        interfaces: [],
        error: errorData.error || 'Failed to get network info',
      }
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      interfaces: [],
      error: error instanceof Error ? error.message : 'Network info error',
    }
  }
}

/**
 * Estimate scan duration based on IP range
 */
export function estimateScanDuration(ipRange: { start: string; end: string }): number {
  const count = ipToNumber(ipRange.end) - ipToNumber(ipRange.start) + 1
  // Assume ~50ms per IP with parallel scanning
  return Math.min(count * 50, 30000) // Max 30 seconds
}
