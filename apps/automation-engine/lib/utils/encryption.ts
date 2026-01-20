/**
 * Encryption Utilities for EnviroFlow
 * Handles secure storage of controller credentials
 */

// Use Web Crypto API (available in Deno and modern browsers)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Encryption configuration
 */
const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits for GCM
const SALT_LENGTH = 16
const ITERATIONS = 100000

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt sensitive data (like controller credentials)
 *
 * @param data - Object or string to encrypt
 * @param encryptionKey - The encryption key (from environment variable)
 * @returns Base64 encoded encrypted string with salt and IV
 */
export async function encrypt(
  data: unknown,
  encryptionKey: string
): Promise<string> {
  if (!encryptionKey) {
    throw new Error('Encryption key is required')
  }

  const plaintext =
    typeof data === 'string' ? data : JSON.stringify(data)

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Derive key from password
  const key = await deriveKey(encryptionKey, salt)

  // Encrypt
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    encoder.encode(plaintext)
  )

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(
    salt.length + iv.length + encryptedData.byteLength
  )
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encryptedData), salt.length + iv.length)

  // Return as base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt sensitive data
 *
 * @param encryptedData - Base64 encoded encrypted string
 * @param encryptionKey - The encryption key (from environment variable)
 * @returns Decrypted data (parsed JSON if applicable)
 */
export async function decrypt<T = unknown>(
  encryptedData: string,
  encryptionKey: string
): Promise<T> {
  if (!encryptionKey) {
    throw new Error('Encryption key is required')
  }

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), (c) =>
    c.charCodeAt(0)
  )

  // Extract salt, iv, and encrypted data
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const data = combined.slice(SALT_LENGTH + IV_LENGTH)

  // Derive key from password
  const key = await deriveKey(encryptionKey, salt)

  // Decrypt
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    data
  )

  const plaintext = decoder.decode(decryptedData)

  // Try to parse as JSON
  try {
    return JSON.parse(plaintext) as T
  } catch {
    return plaintext as T
  }
}

/**
 * Generate a secure random encryption key
 * Use this to generate the ENCRYPTION_KEY environment variable
 */
export function generateEncryptionKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
}

/**
 * Hash sensitive data (one-way, for logging/comparison)
 */
export async function hash(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(data)
  )
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Encrypt credentials for storage in database
 * Returns object with encrypted flag for identification
 */
export async function encryptCredentials(
  credentials: Record<string, unknown>,
  encryptionKey: string
): Promise<{ encrypted: true; data: string }> {
  const encryptedData = await encrypt(credentials, encryptionKey)
  return {
    encrypted: true,
    data: encryptedData,
  }
}

/**
 * Decrypt credentials from database
 * Handles both encrypted and legacy unencrypted credentials
 */
export async function decryptCredentials<T extends Record<string, unknown>>(
  credentials: unknown,
  encryptionKey: string
): Promise<T> {
  // Handle encrypted credentials
  if (
    typeof credentials === 'object' &&
    credentials !== null &&
    'encrypted' in credentials &&
    (credentials as Record<string, unknown>).encrypted === true &&
    'data' in credentials
  ) {
    return decrypt<T>(
      (credentials as { data: string }).data,
      encryptionKey
    )
  }

  // Legacy unencrypted credentials (or already decrypted)
  return credentials as T
}

/**
 * Check if credentials are encrypted
 */
export function isEncrypted(credentials: unknown): boolean {
  return (
    typeof credentials === 'object' &&
    credentials !== null &&
    'encrypted' in credentials &&
    (credentials as Record<string, unknown>).encrypted === true
  )
}
