/**
 * Local Network Discovery API Endpoint
 *
 * Performs mDNS/Bonjour discovery of local devices.
 * This runs on the server side since browsers cannot perform mDNS discovery directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import Bonjour from 'bonjour-service'
import type {
  LocalDiscoveryOptions,
  LocalDiscoveryResult,
  LocalDevice,
} from '@/lib/local-discovery'

/**
 * Perform mDNS discovery and return discovered devices
 */
async function performMdnsDiscovery(
  options: LocalDiscoveryOptions
): Promise<LocalDevice[]> {
  const devices: LocalDevice[] = []
  const timeout = options.timeout || 5000

  return new Promise((resolve) => {
    const bonjour = new Bonjour()
    const discoveredServices = new Map<string, LocalDevice>()

    // Default service types to search for
    const serviceTypes = options.serviceTypes || [
      'http',
      'https',
      'mqtt',
      'homeassistant',
      'hap', // HomeKit
    ]

    let completedSearches = 0
    const totalSearches = serviceTypes.length

    // Search for each service type
    serviceTypes.forEach((serviceType) => {
      const browser = bonjour.find({ type: serviceType })

      browser.on('up', (service) => {
        // Extract device information from the service
        const device: LocalDevice = {
          ipAddress: service.addresses?.[0] || service.host || '',
          port: service.port,
          hostname: service.host,
          name: service.name,
          serviceType: service.type,
          metadata: {
            ...service.txt,
            protocol: service.protocol,
            subtypes: service.subtypes,
          },
          discoveryMethod: 'mdns',
          discoveredAt: new Date().toISOString(),
          isReachable: true,
          responseTime: 0,
        }

        // Use host+port as unique key to avoid duplicates
        const key = `${device.ipAddress}:${device.port}`
        if (device.ipAddress && !discoveredServices.has(key)) {
          discoveredServices.set(key, device)
        }
      })

      // Stop searching after timeout
      setTimeout(() => {
        browser.stop()
        completedSearches++

        // When all searches complete, resolve with discovered devices
        if (completedSearches === totalSearches) {
          bonjour.destroy()
          resolve(Array.from(discoveredServices.values()))
        }
      }, timeout)
    })

    // Fallback: If no service types specified, resolve empty array
    if (serviceTypes.length === 0) {
      bonjour.destroy()
      resolve([])
    }
  })
}

/**
 * POST /api/discovery/local
 *
 * Discover devices on the local network using mDNS/Bonjour
 */
export async function POST(request: NextRequest) {
  try {
    const options: LocalDiscoveryOptions = await request.json()

    // Validate timeout
    const timeout = options.timeout || 5000
    if (timeout < 1000 || timeout > 30000) {
      return NextResponse.json(
        { error: 'Timeout must be between 1000ms and 30000ms' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    // Perform mDNS discovery
    const devices = await performMdnsDiscovery(options)

    // Filter by reachability if requested
    const filteredDevices = options.includeOffline
      ? devices
      : devices.filter((d) => d.isReachable)

    const scanDuration = Date.now() - startTime

    const result: LocalDiscoveryResult = {
      success: true,
      devices: filteredDevices,
      totalDevices: filteredDevices.length,
      reachableCount: filteredDevices.filter((d) => d.isReachable).length,
      method: 'mdns',
      timestamp: new Date().toISOString(),
      scanDuration,
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Local discovery error:', error)
    return NextResponse.json(
      {
        success: false,
        devices: [],
        totalDevices: 0,
        reachableCount: 0,
        method: 'mdns',
        error: error instanceof Error ? error.message : 'Discovery failed',
        timestamp: new Date().toISOString(),
      } as LocalDiscoveryResult,
      { status: 500 }
    )
  }
}

/**
 * GET /api/discovery/local
 *
 * Get information about local discovery capabilities
 */
export async function GET() {
  return NextResponse.json({
    available: true,
    methods: ['mdns', 'manual'],
    supportedServiceTypes: [
      'http',
      'https',
      'mqtt',
      'homeassistant',
      'hap', // HomeKit
      'acinfinity',
      'inkbird',
      'govee',
      'ecowitt',
    ],
    defaultTimeout: 5000,
    maxTimeout: 30000,
  })
}
