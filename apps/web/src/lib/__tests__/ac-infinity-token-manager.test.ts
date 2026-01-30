/**
 * Tests for AC Infinity Token Manager
 *
 * Tests token acquisition, caching, and expiration handling.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  getACInfinityToken,
  clearTokenCache,
  handleTokenExpiration,
} from '../ac-infinity-token-manager'

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

describe('AC Infinity Token Manager', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment and cache before each test
    jest.clearAllMocks()
    clearTokenCache()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('getACInfinityToken', () => {
    test('should return manual token from env var', async () => {
      process.env.AC_INFINITY_TOKEN = 'manual-token-123'

      const token = await getACInfinityToken()

      expect(token).toBe('manual-token-123')
      expect(fetch).not.toHaveBeenCalled()
    })

    test('should throw error when no token or credentials available', async () => {
      delete process.env.AC_INFINITY_TOKEN
      delete process.env.AC_INFINITY_EMAIL
      delete process.env.AC_INFINITY_PASSWORD

      await expect(getACInfinityToken()).rejects.toThrow(
        'AC Infinity authentication not configured'
      )
    })

    test('should login and cache token when credentials provided', async () => {
      delete process.env.AC_INFINITY_TOKEN
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'password123'

      // Mock successful login response
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: {
            appId: 'auto-token-456',
            appEmail: 'test@example.com',
          },
        }),
      } as Response)

      const token = await getACInfinityToken()

      expect(token).toBe('auto-token-456')
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        'http://www.acinfinityserver.com/api/user/appUserLogin',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      )
    })

    test('should use cached token on second call', async () => {
      delete process.env.AC_INFINITY_TOKEN
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'password123'

      // Mock successful login response
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: { appId: 'cached-token-789' },
        }),
      } as Response)

      // First call - should login
      const token1 = await getACInfinityToken()
      expect(token1).toBe('cached-token-789')
      expect(fetch).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const token2 = await getACInfinityToken()
      expect(token2).toBe('cached-token-789')
      expect(fetch).toHaveBeenCalledTimes(1) // Still only called once
    })

    test('should handle invalid credentials error', async () => {
      delete process.env.AC_INFINITY_TOKEN
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'wrong-password'

      // Mock failed login response (code 1002 = wrong password)
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 1002,
          msg: 'Invalid password',
        }),
      } as Response)

      await expect(getACInfinityToken()).rejects.toThrow(
        'Invalid email or password'
      )
    })

    test('should handle missing token in response', async () => {
      delete process.env.AC_INFINITY_TOKEN
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'password123'

      // Mock response without token
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: {},
        }),
      } as Response)

      await expect(getACInfinityToken()).rejects.toThrow(
        'Login succeeded but server did not return authentication token'
      )
    })

    test('should handle HTTP errors', async () => {
      delete process.env.AC_INFINITY_TOKEN
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'password123'

      // Mock HTTP error
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      await expect(getACInfinityToken()).rejects.toThrow(
        'AC Infinity login HTTP error: 500 Internal Server Error'
      )
    })
  })

  describe('handleTokenExpiration', () => {
    test('should return null for non-expired responses', async () => {
      const result = await handleTokenExpiration({
        code: 200,
        msg: 'Success',
      })

      expect(result).toBeNull()
    })

    test('should refresh token on code 1001', async () => {
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'password123'

      // Mock successful login response
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: { appId: 'refreshed-token' },
        }),
      } as Response)

      const result = await handleTokenExpiration({
        code: 1001,
        msg: 'Token expired',
      })

      expect(result).toBe('refreshed-token')
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    test('should clear cache on expiration', async () => {
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'password123'

      // First, populate cache
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: { appId: 'initial-token' },
        }),
      } as Response)

      await getACInfinityToken()
      expect(fetch).toHaveBeenCalledTimes(1)

      // Now handle expiration (should clear cache and login again)
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: { appId: 'new-token' },
        }),
      } as Response)

      const result = await handleTokenExpiration({
        code: 1001,
        msg: 'Token expired',
      })

      expect(result).toBe('new-token')
      expect(fetch).toHaveBeenCalledTimes(2) // Called again after cache clear
    })
  })

  describe('clearTokenCache', () => {
    test('should clear cached token', async () => {
      delete process.env.AC_INFINITY_TOKEN
      process.env.AC_INFINITY_EMAIL = 'test@example.com'
      process.env.AC_INFINITY_PASSWORD = 'password123'

      // Login and cache token
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: { appId: 'token-1' },
        }),
      } as Response)

      await getACInfinityToken()
      expect(fetch).toHaveBeenCalledTimes(1)

      // Clear cache
      clearTokenCache()

      // Next call should login again
      ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 200,
          msg: 'Success',
          data: { appId: 'token-2' },
        }),
      } as Response)

      await getACInfinityToken()
      expect(fetch).toHaveBeenCalledTimes(2) // Called again after clear
    })
  })
})
