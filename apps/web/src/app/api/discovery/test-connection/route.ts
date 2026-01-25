/**
 * Connection Test API Endpoint
 *
 * Tests connectivity to a specific IP address and port
 */

import { NextRequest, NextResponse } from 'next/server'

interface ConnectionTestRequest {
  ipAddress: string
  port?: number
}

/**
 * POST /api/discovery/test-connection
 *
 * Test connectivity to a specific device
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConnectionTestRequest = await request.json()
    const { ipAddress, port = 80 } = body

    // Validate IP address format
    if (!ipAddress || !isValidIPAddress(ipAddress)) {
      return NextResponse.json(
        { error: 'Invalid IP address format' },
        { status: 400 }
      )
    }

    // Validate port
    if (port < 1 || port > 65535) {
      return NextResponse.json(
        { error: 'Port must be between 1 and 65535' },
        { status: 400 }
      )
    }

    // Test connectivity with HTTP request
    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      // Try to fetch the root URL
      const protocol = port === 443 ? 'https' : 'http'
      const response = await fetch(`${protocol}://${ipAddress}:${port}`, {
        method: 'HEAD',
        signal: controller.signal,
        // Don't follow redirects, just check if the server responds
        redirect: 'manual',
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      return NextResponse.json({
        reachable: true,
        responseTime,
        statusCode: response.status,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      // If it's a network error but we got a response, it's still reachable
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({
          reachable: false,
          error: 'Connection timeout',
          responseTime,
        })
      }

      // Some errors indicate the device is there but not responding to HTTP
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error'
      const isReachable = errorMessage.includes('SSL') || errorMessage.includes('certificate')

      return NextResponse.json({
        reachable: isReachable,
        responseTime,
        error: errorMessage,
      })
    }
  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json(
      {
        reachable: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      },
      { status: 500 }
    )
  }
}

/**
 * Validate IPv4 address format
 */
function isValidIPAddress(ip: string): boolean {
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
