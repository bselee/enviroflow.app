/**
 * Tests for server-side encryption module
 *
 * @module lib/__tests__/server-encryption.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock crypto module for consistent test results
const mockRandomBytes = vi.fn()

vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto')
  return {
    ...actual,
    randomBytes: (size: number) => {
      // Use real randomBytes for most calls, but allow mocking for specific tests
      if (mockRandomBytes.mock.calls.length > 0) {
        return mockRandomBytes(size)
      }
      return (actual as typeof import('crypto')).randomBytes(size)
    },
  }
})

// Store original env
const originalEnv = process.env

describe('server-encryption', () => {
  beforeEach(() => {
    // Reset modules to get fresh state
    vi.resetModules()
    mockRandomBytes.mockReset()

    // Set up valid encryption key for tests
    process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: 'a'.repeat(64), // Valid 64-char hex key
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('encryptCredentials', () => {
    it('should encrypt credentials successfully', async () => {
      const { encryptCredentials } = await import('../server-encryption')

      const credentials = { email: 'test@example.com', password: 'secret123' }
      const encrypted = encryptCredentials(credentials)

      expect(encrypted).toBeDefined()
      expect(encrypted.startsWith('aes256gcm:')).toBe(true)
      expect(encrypted).not.toContain('test@example.com')
      expect(encrypted).not.toContain('secret123')
    })

    it('should produce different output for same input (random IV)', async () => {
      const { encryptCredentials } = await import('../server-encryption')

      const credentials = { email: 'test@example.com', password: 'secret123' }
      const encrypted1 = encryptCredentials(credentials)
      const encrypted2 = encryptCredentials(credentials)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should throw EncryptionError for invalid input', async () => {
      const { encryptCredentials, EncryptionError } = await import('../server-encryption')

      // @ts-expect-error Testing invalid input
      expect(() => encryptCredentials(null)).toThrow(EncryptionError)
      // @ts-expect-error Testing invalid input
      expect(() => encryptCredentials('string')).toThrow(EncryptionError)
    })

    it('should throw EncryptionError when ENCRYPTION_KEY is missing', async () => {
      delete process.env.ENCRYPTION_KEY
      vi.resetModules()

      const { encryptCredentials, EncryptionError } = await import('../server-encryption')

      expect(() => encryptCredentials({ key: 'value' })).toThrow(EncryptionError)
      expect(() => encryptCredentials({ key: 'value' })).toThrow('ENCRYPTION_KEY')
    })

    it('should throw EncryptionError for invalid ENCRYPTION_KEY format', async () => {
      process.env.ENCRYPTION_KEY = 'not-valid-hex'
      vi.resetModules()

      const { encryptCredentials, EncryptionError } = await import('../server-encryption')

      expect(() => encryptCredentials({ key: 'value' })).toThrow(EncryptionError)
      expect(() => encryptCredentials({ key: 'value' })).toThrow('64 hexadecimal')
    })
  })

  describe('decryptCredentials', () => {
    it('should decrypt encrypted credentials correctly', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../server-encryption')

      const original = { email: 'test@example.com', password: 'secret123', nested: { value: 42 } }
      const encrypted = encryptCredentials(original)
      const decrypted = decryptCredentials(encrypted)

      expect(decrypted).toEqual(original)
    })

    it('should handle already-parsed objects (passthrough)', async () => {
      const { decryptCredentials } = await import('../server-encryption')

      const obj = { email: 'test@example.com', password: 'secret' }
      const result = decryptCredentials(obj)

      expect(result).toBe(obj)
    })

    it('should handle legacy base64 format', async () => {
      const { decryptCredentials } = await import('../server-encryption')

      const original = { email: 'test@example.com' }
      const legacyEncrypted = 'encrypted:' + Buffer.from(JSON.stringify(original)).toString('base64')
      const result = decryptCredentials(legacyEncrypted)

      expect(result).toEqual(original)
    })

    it('should handle raw JSON string', async () => {
      const { decryptCredentials } = await import('../server-encryption')

      const original = { email: 'test@example.com' }
      const result = decryptCredentials(JSON.stringify(original))

      expect(result).toEqual(original)
    })

    it('should return empty object for invalid input', async () => {
      const { decryptCredentials } = await import('../server-encryption')

      expect(decryptCredentials('invalid-string')).toEqual({})
      // @ts-expect-error Testing invalid input
      expect(decryptCredentials(123)).toEqual({})
    })

    it('should throw EncryptionError for corrupted AES data', async () => {
      const { decryptCredentials, EncryptionError } = await import('../server-encryption')

      const corrupted = 'aes256gcm:' + Buffer.from('corrupted-data').toString('base64')

      expect(() => decryptCredentials(corrupted)).toThrow(EncryptionError)
    })
  })

  describe('reencryptCredentials', () => {
    it('should re-encrypt from legacy format to AES-256-GCM', async () => {
      const { reencryptCredentials, isModernEncryption, decryptCredentials } = await import('../server-encryption')

      const original = { email: 'test@example.com' }
      const legacyEncrypted = 'encrypted:' + Buffer.from(JSON.stringify(original)).toString('base64')

      const reencrypted = reencryptCredentials(legacyEncrypted)

      expect(isModernEncryption(reencrypted)).toBe(true)
      expect(decryptCredentials(reencrypted)).toEqual(original)
    })
  })

  describe('isModernEncryption', () => {
    it('should return true for AES-256-GCM format', async () => {
      const { isModernEncryption, encryptCredentials } = await import('../server-encryption')

      const encrypted = encryptCredentials({ key: 'value' })
      expect(isModernEncryption(encrypted)).toBe(true)
    })

    it('should return false for legacy formats', async () => {
      const { isModernEncryption } = await import('../server-encryption')

      expect(isModernEncryption('encrypted:base64data')).toBe(false)
      expect(isModernEncryption('{"key":"value"}')).toBe(false)
      expect(isModernEncryption('random-string')).toBe(false)
    })
  })

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', async () => {
      const { generateEncryptionKey } = await import('../server-encryption')

      const key = generateEncryptionKey()

      expect(key).toHaveLength(64)
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true)
    })

    it('should generate unique keys each time', async () => {
      const { generateEncryptionKey } = await import('../server-encryption')

      const key1 = generateEncryptionKey()
      const key2 = generateEncryptionKey()

      expect(key1).not.toBe(key2)
    })
  })

  describe('generateRecoveryCodes', () => {
    it('should generate the default number of codes (8)', async () => {
      const { generateRecoveryCodes } = await import('../server-encryption')

      const codes = generateRecoveryCodes()

      expect(codes).toHaveLength(8)
    })

    it('should generate codes with correct format (XXXX-XXXX)', async () => {
      const { generateRecoveryCodes } = await import('../server-encryption')

      const codes = generateRecoveryCodes()

      for (const code of codes) {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      }
    })

    it('should generate unique codes within a batch', async () => {
      const { generateRecoveryCodes } = await import('../server-encryption')

      const codes = generateRecoveryCodes(20)
      const uniqueCodes = new Set(codes)

      expect(uniqueCodes.size).toBe(20)
    })

    it('should only use unambiguous characters', async () => {
      const { generateRecoveryCodes } = await import('../server-encryption')

      const codes = generateRecoveryCodes(50)
      const allChars = codes.join('').replace(/-/g, '')

      // Should not contain 0, O, 1, I, L
      expect(allChars).not.toMatch(/[0O1IL]/i)
    })

    it('should respect custom parameters', async () => {
      const { generateRecoveryCodes } = await import('../server-encryption')

      const codes = generateRecoveryCodes(5, 6, 3)

      expect(codes).toHaveLength(5)
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{6}$/)
      }
    })

    it('should throw for invalid count', async () => {
      const { generateRecoveryCodes, EncryptionError } = await import('../server-encryption')

      expect(() => generateRecoveryCodes(0)).toThrow(EncryptionError)
      expect(() => generateRecoveryCodes(101)).toThrow(EncryptionError)
    })

    it('should throw for invalid segment length', async () => {
      const { generateRecoveryCodes, EncryptionError } = await import('../server-encryption')

      expect(() => generateRecoveryCodes(8, 1)).toThrow(EncryptionError)
      expect(() => generateRecoveryCodes(8, 11)).toThrow(EncryptionError)
    })

    it('should throw for invalid segments count', async () => {
      const { generateRecoveryCodes, EncryptionError } = await import('../server-encryption')

      expect(() => generateRecoveryCodes(8, 4, 0)).toThrow(EncryptionError)
      expect(() => generateRecoveryCodes(8, 4, 6)).toThrow(EncryptionError)
    })
  })

  describe('EncryptionError', () => {
    it('should have correct name and message', async () => {
      const { EncryptionError } = await import('../server-encryption')

      const error = new EncryptionError('Test message')

      expect(error.name).toBe('EncryptionError')
      expect(error.message).toBe('Test message')
      expect(error instanceof Error).toBe(true)
    })
  })

  describe('roundtrip encryption', () => {
    it('should handle various data types', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../server-encryption')

      const testCases = [
        { string: 'hello' },
        { number: 42 },
        { boolean: true },
        { null: null },
        { array: [1, 2, 3] },
        { nested: { deep: { value: 'test' } } },
        { special: 'unicode: \u00e9\u00e8\u00ea emoji: \ud83d\ude00' },
        { empty: {} },
      ]

      for (const testCase of testCases) {
        const encrypted = encryptCredentials(testCase)
        const decrypted = decryptCredentials(encrypted)
        expect(decrypted).toEqual(testCase)
      }
    })

    it('should handle large payloads', async () => {
      const { encryptCredentials, decryptCredentials } = await import('../server-encryption')

      const largePayload = {
        data: 'x'.repeat(100000),
        array: Array.from({ length: 1000 }, (_, i) => i),
      }

      const encrypted = encryptCredentials(largePayload)
      const decrypted = decryptCredentials(encrypted)

      expect(decrypted).toEqual(largePayload)
    })
  })
})
