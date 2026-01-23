/**
 * Simple in-memory rate limiter for API endpoints
 *
 * Uses a sliding window algorithm to track requests per user.
 * For production deployments with multiple instances, consider using
 * Redis or Upstash for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
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

/**
 * Check if a request is within rate limits
 *
 * @param identifier - Unique identifier (typically user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export function checkRateLimit(
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
export function resetRateLimit(identifier: string, keyPrefix?: string): void {
  const key = keyPrefix ? `${keyPrefix}:${identifier}` : identifier
  rateLimitStore.delete(key)
}
