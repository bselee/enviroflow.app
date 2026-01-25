/**
 * Network Info API Endpoint
 *
 * Returns information about available network interfaces
 */

import { NextResponse } from 'next/server'
import { networkInterfaces } from 'os'

/**
 * GET /api/discovery/network-info
 *
 * Get current network interface information
 */
export async function GET() {
  try {
    const interfaces = networkInterfaces()
    const result: Array<{
      name: string
      address: string
      netmask: string
      family: string
      internal: boolean
    }> = []

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue

      for (const addr of addresses) {
        // Only include IPv4 addresses
        if (addr.family === 'IPv4') {
          result.push({
            name,
            address: addr.address,
            netmask: addr.netmask,
            family: addr.family,
            internal: addr.internal,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      interfaces: result,
    })
  } catch (error) {
    console.error('Network info error:', error)
    return NextResponse.json(
      {
        success: false,
        interfaces: [],
        error: error instanceof Error ? error.message : 'Failed to get network info',
      },
      { status: 500 }
    )
  }
}
