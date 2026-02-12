/**
 * Rate limiter with Upstash Redis backend and in-memory fallback
 *
 * When UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set,
 * uses Upstash Redis for distributed rate limiting across multiple instances.
 * Otherwise falls back to an in-memory sliding window (single-instance only).
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// =============================================================================
// Types (unchanged public API)
// =============================================================================

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   */
  maxRequests: number

  /**
   * Time window in milliseconds
   */
  windowMs: number

  /**
   * Optional identifier prefix (e.g., 'sensor-read', 'workflow-run')
   */
  keyPrefix?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// =============================================================================
// Upstash Redis backend
// =============================================================================

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    redis = new Redis({ url, token })
    return redis
  }
  return null
}

/**
 * Cache of Ratelimit instances keyed by "maxRequests:windowMs"
 * so we reuse the same limiter for identical configs.
 */
const upstashLimiters = new Map<string, Ratelimit>()

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  const r = getRedis()
  if (!r) return null

  const cacheKey = `${config.maxRequests}:${config.windowMs}`
  let limiter = upstashLimiters.get(cacheKey)
  if (!limiter) {
    // Convert ms to Upstash duration string
    const windowSec = Math.max(1, Math.round(config.windowMs / 1000))
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSec} s`),
      prefix: 'enviroflow:rl',
      ephemeralCache: new Map(),
    })
    upstashLimiters.set(cacheKey, limiter)
  }
  return limiter
}

// =============================================================================
// In-memory fallback (for local dev / single instance)
// =============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetAt < now) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => rateLimitStore.delete(key))
  }, 5 * 60 * 1000)
}

function inMemoryCheck(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier
  const now = Date.now()

  let entry = rateLimitStore.get(key)

  // If no entry exists or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs
    }
    rateLimitStore.set(key, entry)

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: entry.resetAt
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetAt
    }
  }

  // Increment count
  entry.count++

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetAt
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if a request is within rate limits.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * are set, otherwise falls back to in-memory.
 *
 * @param identifier - Unique identifier (typically user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(config)
  if (limiter) {
    const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier
    try {
      const result = await limiter.limit(key)
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      }
    } catch (err) {
      // On Redis failure, fall back to in-memory so the app stays available
      console.warn('[rate-limit] Upstash Redis error, falling back to in-memory:', err)
      return inMemoryCheck(identifier, config)
    }
  }
  return inMemoryCheck(identifier, config)
}

/**
 * Create rate limit response headers
 *
 * @param result - Rate limit result
 * @returns Headers object with rate limit info
 */
export function createRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or manual override
 *
 * @param identifier - Unique identifier to reset
 * @param keyPrefix - Optional key prefix
 */
export async function resetRateLimit(identifier: string, keyPrefix?: string): Promise<void> {
  const key = keyPrefix ? `${keyPrefix}:${identifier}` : identifier

  // Clear in-memory
  rateLimitStore.delete(key)

  // Clear Redis if available
  const r = getRedis()
  if (r) {
    try {
      await r.del(`enviroflow:rl:${key}`)
    } catch {
      // Ignore Redis errors on reset
    }
  }
}

/**
 * Peek at current rate limit status without consuming a token
 *
 * Unlike checkRateLimit, this does NOT increment the counter.
 * Use this for status/info endpoints that should not count as a request.
 *
 * @param identifier - Unique identifier (typically user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with current status (does not modify state)
 */
export function peekRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  // If no entry exists or window expired, all tokens are available
  if (!entry || entry.resetAt < now) {
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: now + config.windowMs,
    }
  }

  return {
    success: entry.count < config.maxRequests,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    reset: entry.resetAt,
  }
}
