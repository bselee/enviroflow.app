/**
 * Controller Discovery API Route
 *
 * POST /api/controllers/discover
 *
 * Discovers devices registered with a cloud controller service (AC Infinity, Inkbird).
 * This endpoint queries the brand's cloud API using the provided credentials
 * and returns a list of all devices associated with the account.
 *
 * SECURITY NOTES:
 * - Credentials are NOT stored - they are only used for the discovery request
 * - The endpoint validates input to prevent injection attacks
 * - Rate limiting implemented: 10 requests per minute per IP to prevent brute-forcing
 * - Authentication is optional but enables checking for already-registered devices
 *
 * REQUEST:
 * {
 *   brand: 'ac_infinity' | 'inkbird',
 *   email: string,
 *   password: string
 * }
 *
 * RESPONSE:
 * {
 *   success: boolean,
 *   devices: DiscoveredDevice[],
 *   totalDevices: number,
 *   alreadyRegisteredCount: number,
 *   error?: string,
 *   source: 'cloud_api',
 *   timestamp: string
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// -----------------------------------------------------------------------------
// Rate Limiting
// -----------------------------------------------------------------------------
// In-memory rate limiter to prevent credential brute-forcing.
// For MVP, this is sufficient. In production with multiple instances,
// upgrade to Redis or a distributed rate limiting solution.
// -----------------------------------------------------------------------------

interface RateLimitRecord {
  /** Number of requests made in the current window */
  count: number
  /** Timestamp (ms) when the rate limit window resets */
  resetAt: number
}

/**
 * In-memory store for rate limit tracking.
 * Key: IP address, Value: request count and window reset time.
 *
 * NOTE: This store is per-process. In a multi-instance deployment (e.g., serverless),
 * each instance maintains its own store. For true rate limiting across instances,
 * use Redis or a similar distributed store.
 */
const rateLimitStore = new Map<string, RateLimitRecord>()

/** Rate limit window duration in milliseconds (1 minute) */
const RATE_LIMIT_WINDOW_MS = 60_000

/** Maximum requests allowed per IP within the rate limit window */
const RATE_LIMIT_MAX_REQUESTS = 10

/** Probability of running cleanup on each request (10%) */
const CLEANUP_PROBABILITY = 0.1

/**
 * Checks if a request from the given IP address is within rate limits.
 *
 * Uses a sliding window approach where each IP gets a fresh window
 * after the previous one expires. Implements probabilistic cleanup
 * to prevent unbounded memory growth.
 *
 * @param ip - The client IP address to check
 * @returns Object indicating whether the request is allowed, and if not, the retry delay
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  // Probabilistic cleanup of expired entries to prevent memory leaks.
  // Running on ~10% of requests balances memory efficiency with performance.
  if (Math.random() < CLEANUP_PROBABILITY) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }

  // New IP or expired window: start fresh
  if (!record || record.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  // Check if rate limit exceeded
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  // Increment counter and allow
  record.count++
  return { allowed: true }
}

/**
 * Extracts the client IP address from request headers.
 *
 * Checks standard proxy headers in order of preference:
 * 1. x-forwarded-for (most common, may contain comma-separated list)
 * 2. x-real-ip (Nginx default)
 * 3. Falls back to 'unknown' if no IP can be determined
 *
 * @param request - The incoming Next.js request
 * @returns The client IP address or 'unknown'
 */
function getClientIp(request: NextRequest): string {
  // x-forwarded-for may contain multiple IPs: "client, proxy1, proxy2"
  // The first one is the original client IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim()
    if (firstIp) {
      return firstIp
    }
  }

  // x-real-ip is typically set by Nginx reverse proxies
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Fallback when no proxy headers are present (e.g., local development)
  return 'unknown'
}

// Import adapter factory from automation-engine workspace package
import {
  getDiscoverableAdapter,
  supportsDiscovery,
  type ControllerBrand,
  type DiscoveredDevice,
} from '@enviroflow/automation-engine/adapters'

// Lazy Supabase client initialization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>
let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }

    supabase = createClient(url, key)
  }
  return supabase
}

// Request validation schema
const discoveryRequestSchema = z.object({
  brand: z.enum(['ac_infinity', 'inkbird']),
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

/**
 * POST /api/controllers/discover
 *
 * Discover devices from a cloud controller service.
 * Rate limited to 10 requests per minute per IP to prevent credential brute-forcing.
 */
export async function POST(request: NextRequest) {
  // Rate limit check - must be first to prevent abuse
  const clientIp = getClientIp(request)
  const rateCheck = checkRateLimit(clientIp)

  if (!rateCheck.allowed) {
    // Log rate limit violations for security monitoring
    console.warn(
      `[Discovery] Rate limit exceeded: ip=${clientIp}, ` +
      `retryAfter=${rateCheck.retryAfter}s`
    )

    return NextResponse.json(
      {
        success: false,
        devices: [],
        totalDevices: 0,
        alreadyRegisteredCount: 0,
        error: 'Too many requests',
        message: 'Please wait before trying again.',
        source: 'cloud_api',
        timestamp: new Date().toISOString(),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.retryAfter),
        },
      }
    )
  }

  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = discoveryRequestSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ')

      return NextResponse.json(
        {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: 'Invalid request',
          details: errors,
          source: 'cloud_api',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    const { brand, email, password } = validationResult.data

    // Verify the brand supports discovery
    if (!supportsDiscovery(brand as ControllerBrand)) {
      return NextResponse.json(
        {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: `Brand "${brand}" does not support cloud discovery`,
          source: 'cloud_api',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    // Get the discoverable adapter for this brand
    const adapter = getDiscoverableAdapter(brand as ControllerBrand)

    // Perform discovery using the adapter
    const discoveryResult = await adapter.discoverDevices({
      brand: brand as ControllerBrand,
      email,
      password,
    })

    if (!discoveryResult.success) {
      // Log discovery failures for monitoring (without credentials)
      console.warn(`[Discovery] Failed for brand=${brand}:`, discoveryResult.error)

      return NextResponse.json(
        {
          success: false,
          devices: [],
          totalDevices: 0,
          alreadyRegisteredCount: 0,
          error: discoveryResult.error || 'Discovery failed',
          source: 'cloud_api',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      )
    }

    // Check for user authentication to mark already-registered devices
    let userId: string | null = null
    const authHeader = request.headers.get('authorization')

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const supabase = getSupabase()
        const token = authHeader.substring(7)
        const { data: { user } } = await supabase.auth.getUser(token)
        userId = user?.id || null
      } catch (authError) {
        // Auth errors are non-fatal - just proceed without marking registered devices
        console.warn('[Discovery] Auth check failed:', authError)
      }
    }

    // If user is authenticated, check which devices are already registered
    let registeredControllerIds: Set<string> = new Set()

    if (userId) {
      try {
        const supabase = getSupabase()
        const { data: existingControllers } = await supabase
          .from('controllers')
          .select('controller_id')
          .eq('user_id', userId)
          .eq('brand', brand)

        if (existingControllers) {
          registeredControllerIds = new Set(
            existingControllers.map(c => c.controller_id)
          )
        }
      } catch (dbError) {
        // DB errors are non-fatal - just proceed without marking registered devices
        console.warn('[Discovery] DB lookup failed:', dbError)
      }
    }

    // Map discovered devices and mark registered ones
    // Note: We're creating a frontend-friendly response, converting Date to string
    const devices = discoveryResult.devices.map(device => ({
      deviceId: device.deviceId,
      deviceCode: device.deviceCode,
      name: device.name,
      brand: device.brand,
      model: device.model,
      deviceType: device.deviceType,
      isOnline: device.isOnline,
      // Convert Date to ISO string for JSON serialization
      lastSeen: device.lastSeen instanceof Date
        ? device.lastSeen.toISOString()
        : device.lastSeen,
      firmwareVersion: device.firmwareVersion,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      isAlreadyRegistered: registeredControllerIds.has(device.deviceId),
      capabilities: device.capabilities,
    }))

    const alreadyRegisteredCount = devices.filter(d => d.isAlreadyRegistered).length

    // Log successful discovery for analytics (without credentials)
    console.log(
      `[Discovery] Success: brand=${brand}, ` +
      `total=${devices.length}, ` +
      `registered=${alreadyRegisteredCount}, ` +
      `userId=${userId ? 'authenticated' : 'anonymous'}`
    )

    return NextResponse.json({
      success: true,
      devices,
      totalDevices: devices.length,
      alreadyRegisteredCount,
      source: 'cloud_api',
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    // Log unexpected errors
    console.error('[Discovery] Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        devices: [],
        totalDevices: 0,
        alreadyRegisteredCount: 0,
        error: 'Internal server error during discovery',
        details: error instanceof Error ? error.message : 'Unknown error',
        source: 'cloud_api',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/controllers/discover
 *
 * Returns information about discovery capabilities.
 * This endpoint does not require authentication.
 */
export async function GET() {
  return NextResponse.json({
    description: 'Device discovery endpoint for cloud-connected controllers',
    supportedBrands: ['ac_infinity', 'inkbird'],
    method: 'POST',
    requiredFields: {
      brand: 'Controller brand (ac_infinity, inkbird)',
      email: 'Account email address',
      password: 'Account password',
    },
    optionalHeaders: {
      Authorization: 'Bearer token to check for already-registered devices',
    },
    rateLimit: {
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
      windowDescription: '1 minute',
    },
    notes: [
      'Credentials are used only for discovery and are NOT stored',
      'Authentication enables marking devices already added to your account',
      'Discovery queries the cloud API, not local network',
      `Rate limited to ${RATE_LIMIT_MAX_REQUESTS} requests per minute per IP`,
    ],
  })
}
