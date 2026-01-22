/**
 * Server-Side Credential Encryption
 *
 * Provides AES-256-GCM encryption for sensitive credentials stored in the database.
 *
 * SECURITY NOTES:
 * - Uses AES-256-GCM with random IV for each encryption
 * - Requires ENCRYPTION_KEY environment variable (32 bytes / 64 hex chars)
 * - Never log the encryption key or decrypted credentials
 * - IV is prepended to ciphertext for storage
 *
 * Environment variable format:
 * ENCRYPTION_KEY=<64 hex characters representing 32 bytes>
 *
 * Generate a key with: openssl rand -hex 32
 *
 * @module lib/server-encryption
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

/**
 * Encryption algorithm used for credentials
 */
const ALGORITHM = 'aes-256-gcm'

/**
 * IV length in bytes (96 bits recommended for GCM)
 */
const IV_LENGTH = 12

/**
 * Auth tag length in bytes (128 bits for maximum security)
 */
const AUTH_TAG_LENGTH = 16

/**
 * Prefix to identify encrypted data in storage
 */
const ENCRYPTED_PREFIX = 'aes256gcm:'

/**
 * Error thrown when encryption operations fail
 */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncryptionError'
  }
}

/**
 * Gets the encryption key from environment variable.
 * Validates key format and length.
 *
 * @returns Buffer containing the 32-byte encryption key
 * @throws EncryptionError if key is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY

  if (!keyHex) {
    console.error('[Encryption] ENCRYPTION_KEY is not set in environment')
    throw new EncryptionError(
      'ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: openssl rand -hex 32'
    )
  }

  // Trim any whitespace that might have been added
  const trimmedKey = keyHex.trim()

  // Validate hex format
  if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
    console.error('[Encryption] ENCRYPTION_KEY invalid format', {
      length: trimmedKey.length,
      expectedLength: 64,
      startsWithQuote: trimmedKey.startsWith('"') || trimmedKey.startsWith("'"),
      endsWithQuote: trimmedKey.endsWith('"') || trimmedKey.endsWith("'"),
    })
    throw new EncryptionError(
      'ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)'
    )
  }

  return Buffer.from(trimmedKey, 'hex')
}

/**
 * Encrypts credential data using AES-256-GCM.
 *
 * Output format: aes256gcm:<iv>:<authTag>:<ciphertext>
 * All components are base64 encoded.
 *
 * @param credentials - Object containing credential data to encrypt
 * @returns Encrypted string safe for database storage
 * @throws EncryptionError if encryption fails
 *
 * @example
 * const encrypted = encryptCredentials({ email: "user@example.com", password: "secret" })
 * // Returns "aes256gcm:abc123...:def456...:ghi789..."
 */
export function encryptCredentials(credentials: Record<string, unknown>): string {
  if (!credentials || typeof credentials !== 'object') {
    throw new EncryptionError('Invalid credentials object provided')
  }

  try {
    const key = getEncryptionKey()

    // Generate random IV for this encryption
    const iv = randomBytes(IV_LENGTH)

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })

    // Encrypt the JSON string
    const plaintext = JSON.stringify(credentials)
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])

    // Get the authentication tag
    const authTag = cipher.getAuthTag()

    // Combine IV + authTag + ciphertext and encode as base64
    const combined = Buffer.concat([iv, authTag, encrypted])
    return `${ENCRYPTED_PREFIX}${combined.toString('base64')}`
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error
    }
    // Never include actual error details that might leak key information
    throw new EncryptionError('Failed to encrypt credentials')
  }
}

/**
 * Decrypts credential data encrypted with encryptCredentials.
 *
 * Handles multiple formats for backwards compatibility:
 * 1. aes256gcm:<base64> - New AES-256-GCM format
 * 2. encrypted:<base64> - Legacy base64 format (deprecated)
 * 3. Raw JSON string - Unencrypted (legacy)
 * 4. Plain object - Already parsed (passthrough)
 *
 * @param encrypted - Encrypted string from database or object
 * @returns Decrypted credential object
 * @throws EncryptionError if decryption fails
 *
 * @example
 * const credentials = decryptCredentials("aes256gcm:abc123...")
 * // Returns { email: "user@example.com", password: "secret" }
 */
export function decryptCredentials(
  encrypted: string | Record<string, unknown>
): Record<string, unknown> {
  // Handle already-parsed objects
  if (typeof encrypted === 'object' && encrypted !== null) {
    return encrypted
  }

  if (typeof encrypted !== 'string') {
    return {}
  }

  // Handle AES-256-GCM encrypted format
  if (encrypted.startsWith(ENCRYPTED_PREFIX)) {
    try {
      const key = getEncryptionKey()

      // Decode the combined data
      const combined = Buffer.from(
        encrypted.substring(ENCRYPTED_PREFIX.length),
        'base64'
      )

      // Extract IV, auth tag, and ciphertext
      const iv = combined.subarray(0, IV_LENGTH)
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
      const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      })
      decipher.setAuthTag(authTag)

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ])

      return JSON.parse(decrypted.toString('utf8'))
    } catch (error) {
      // Never expose decryption error details
      throw new EncryptionError('Failed to decrypt credentials')
    }
  }

  // Handle legacy base64 format (deprecated - will be migrated)
  if (encrypted.startsWith('encrypted:')) {
    try {
      const base64 = encrypted.substring(10)
      const json = Buffer.from(base64, 'base64').toString('utf-8')
      return JSON.parse(json)
    } catch {
      return {}
    }
  }

  // Handle raw JSON (legacy unencrypted)
  try {
    return JSON.parse(encrypted)
  } catch {
    return {}
  }
}

/**
 * Re-encrypts credentials from legacy format to AES-256-GCM.
 * Use this for migrating existing credentials.
 *
 * @param encrypted - Encrypted string in any supported format
 * @returns Newly encrypted string in AES-256-GCM format
 *
 * @example
 * const newEncrypted = reencryptCredentials("encrypted:base64data...")
 * // Returns "aes256gcm:newformat..."
 */
export function reencryptCredentials(
  encrypted: string | Record<string, unknown>
): string {
  const decrypted = decryptCredentials(encrypted)
  return encryptCredentials(decrypted)
}

/**
 * Checks if credentials are encrypted with AES-256-GCM.
 *
 * @param encrypted - Encrypted string to check
 * @returns true if using current encryption format
 */
export function isModernEncryption(encrypted: string): boolean {
  return encrypted.startsWith(ENCRYPTED_PREFIX)
}

/**
 * Generates a new encryption key for use in ENCRYPTION_KEY env var.
 * This should only be used during initial setup.
 *
 * @returns 64-character hex string suitable for ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Generates cryptographically secure recovery codes.
 * Uses crypto.randomBytes for secure random generation.
 *
 * @param count - Number of codes to generate (default: 8)
 * @param length - Length of each code segment (default: 4)
 * @param segments - Number of segments per code (default: 2)
 * @returns Array of recovery codes in format "XXXX-XXXX"
 *
 * @example
 * const codes = generateRecoveryCodes(8, 4, 2)
 * // Returns ["AB12-CD34", "EF56-GH78", ...]
 */
export function generateRecoveryCodes(
  count: number = 8,
  length: number = 4,
  segments: number = 2
): string[] {
  // Use alphanumeric characters that are unambiguous (no 0/O, 1/I/l confusion)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const codes: string[] = []

  for (let i = 0; i < count; i++) {
    const codeSegments: string[] = []

    for (let s = 0; s < segments; s++) {
      const randomBuffer = randomBytes(length)
      let segment = ''

      for (let j = 0; j < length; j++) {
        segment += chars[randomBuffer[j] % chars.length]
      }

      codeSegments.push(segment)
    }

    codes.push(codeSegments.join('-'))
  }

  return codes
}
