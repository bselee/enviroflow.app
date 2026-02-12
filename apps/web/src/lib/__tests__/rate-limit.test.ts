/**
 * Rate Limiter Unit Tests
 *
 * Tests the in-memory sliding window rate limiter (Upstash env vars not set).
 * When UPSTASH_REDIS_REST_URL/TOKEN are absent, the module falls back to in-memory.
 */

// Mock Upstash modules so Jest doesn't trip on their ESM exports
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: jest.fn(),
}))
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(),
}))

import {
  checkRateLimit,
  createRateLimitHeaders,
  resetRateLimit,
  peekRateLimit,
  type RateLimitConfig,
} from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  const config: RateLimitConfig = {
    maxRequests: 3,
    windowMs: 60_000,
    keyPrefix: 'test',
  }

  afterEach(async () => {
    await resetRateLimit('user-1', 'test')
    await resetRateLimit('user-2', 'test')
  })

  it('allows the first request', async () => {
    const result = await checkRateLimit('user-1', config)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(2)
    expect(result.limit).toBe(3)
  })

  it('decrements remaining on each request', async () => {
    await checkRateLimit('user-1', config)
    const result = await checkRateLimit('user-1', config)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('blocks after max requests exhausted', async () => {
    await checkRateLimit('user-1', config)
    await checkRateLimit('user-1', config)
    await checkRateLimit('user-1', config)
    const result = await checkRateLimit('user-1', config)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('isolates different users', async () => {
    await checkRateLimit('user-1', config)
    await checkRateLimit('user-1', config)
    await checkRateLimit('user-1', config)

    const result = await checkRateLimit('user-2', config)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('uses keyPrefix to namespace limits', async () => {
    const configA: RateLimitConfig = { maxRequests: 1, windowMs: 60_000, keyPrefix: 'api-a' }
    const configB: RateLimitConfig = { maxRequests: 1, windowMs: 60_000, keyPrefix: 'api-b' }

    await checkRateLimit('user-1', configA)
    const resultB = await checkRateLimit('user-1', configB)
    expect(resultB.success).toBe(true) // different prefix = different bucket

    await resetRateLimit('user-1', 'api-a')
    await resetRateLimit('user-1', 'api-b')
  })

  it('works without keyPrefix', async () => {
    const noPrefix: RateLimitConfig = { maxRequests: 2, windowMs: 60_000 }
    const result = await checkRateLimit('user-plain', noPrefix)
    expect(result.success).toBe(true)
    await resetRateLimit('user-plain')
  })

  it('resets after window expires', async () => {
    jest.useFakeTimers()
    try {
      await checkRateLimit('user-1', config)
      await checkRateLimit('user-1', config)
      await checkRateLimit('user-1', config)

      // Should be blocked
      expect((await checkRateLimit('user-1', config)).success).toBe(false)

      // Advance time past the window
      jest.advanceTimersByTime(61_000)

      // Should be allowed again
      const result = await checkRateLimit('user-1', config)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('returns correct reset timestamp', async () => {
    const before = Date.now()
    const result = await checkRateLimit('user-1', config)
    const after = Date.now()

    expect(result.reset).toBeGreaterThanOrEqual(before + config.windowMs)
    expect(result.reset).toBeLessThanOrEqual(after + config.windowMs)
  })
})

describe('peekRateLimit', () => {
  const config: RateLimitConfig = {
    maxRequests: 3,
    windowMs: 60_000,
    keyPrefix: 'peek-test',
  }

  afterEach(async () => {
    await resetRateLimit('user-1', 'peek-test')
  })

  it('does not consume a token', async () => {
    await checkRateLimit('user-1', config) // consume 1

    const peek1 = peekRateLimit('user-1', config)
    const peek2 = peekRateLimit('user-1', config)

    expect(peek1.remaining).toBe(2)
    expect(peek2.remaining).toBe(2) // unchanged
  })

  it('reports full capacity when no requests made', () => {
    const result = peekRateLimit('user-1', config)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(3) // full
  })

  it('reports failure when limit exceeded', async () => {
    await checkRateLimit('user-1', config)
    await checkRateLimit('user-1', config)
    await checkRateLimit('user-1', config)

    const result = peekRateLimit('user-1', config)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe('createRateLimitHeaders', () => {
  it('returns correct headers', () => {
    const headers = createRateLimitHeaders({
      success: true,
      limit: 100,
      remaining: 99,
      reset: 1234567890,
    })

    expect(headers).toEqual({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': '1234567890',
    })
  })

  it('works when limit exceeded', () => {
    const headers = createRateLimitHeaders({
      success: false,
      limit: 10,
      remaining: 0,
      reset: 9999999999,
    })

    expect(headers['X-RateLimit-Remaining']).toBe('0')
  })
})

describe('resetRateLimit', () => {
  const config: RateLimitConfig = { maxRequests: 1, windowMs: 60_000, keyPrefix: 'reset-test' }

  it('resets exhausted limit', async () => {
    await checkRateLimit('user-1', config)
    expect((await checkRateLimit('user-1', config)).success).toBe(false)

    await resetRateLimit('user-1', 'reset-test')

    expect((await checkRateLimit('user-1', config)).success).toBe(true)
  })
})
