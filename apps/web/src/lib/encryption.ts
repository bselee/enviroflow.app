/**
 * Credential Encryption Helpers
 *
 * This module provides helper functions for handling sensitive credential data.
 *
 * SECURITY NOTES:
 * - Actual encryption of credentials at rest is handled by Supabase Vault on the server side
 * - These helpers are for masking/display purposes and client-side handling
 * - Never log or expose raw credentials in any form
 * - Always use HTTPS for credential transmission
 *
 * @module lib/encryption
 */

/**
 * Represents a credential object with key-value pairs
 * Values can be strings (actual credentials) or null/undefined
 */
interface CredentialObject {
  [key: string]: string | null | undefined;
}

/**
 * Result of masking credentials - values are replaced with masked versions
 */
interface MaskedCredentials {
  [key: string]: string;
}

/**
 * Masks a single credential value, showing only the last N characters
 *
 * @param value - The credential value to mask
 * @param visibleChars - Number of characters to show at the end (default: 4)
 * @returns Masked string in format "****xxxx" or empty string if no value
 *
 * @example
 * maskCredentialValue("mysecretpassword123") // Returns "****3123"
 * maskCredentialValue("api_key_abc") // Returns "****_abc"
 * maskCredentialValue("ab") // Returns "**" (short values fully masked)
 * maskCredentialValue(null) // Returns ""
 */
export function maskCredentialValue(
  value: string | null | undefined,
  visibleChars: number = 4
): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  // For very short values, mask entirely
  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }

  const lastChars = value.slice(-visibleChars);
  return `****${lastChars}`;
}

/**
 * Masks all credential values in an object
 *
 * Useful for logging or displaying controller credentials safely.
 * Each value is masked to show only the last 4 characters.
 *
 * @param credentials - Object containing credential key-value pairs
 * @returns New object with all values masked
 *
 * @example
 * maskCredentials({ email: "user@example.com", password: "secret123" })
 * // Returns { email: "****.com", password: "****t123" }
 */
export function maskCredentials(
  credentials: CredentialObject | null | undefined
): MaskedCredentials {
  if (!credentials || typeof credentials !== 'object') {
    return {};
  }

  const masked: MaskedCredentials = {};

  for (const [key, value] of Object.entries(credentials)) {
    // Always mask credential-like fields
    if (isCredentialField(key)) {
      masked[key] = maskCredentialValue(value);
    } else if (typeof value === 'string') {
      // For non-credential fields, still mask if they look sensitive
      masked[key] = isSensitiveValue(value)
        ? maskCredentialValue(value)
        : value;
    } else {
      masked[key] = value ?? '';
    }
  }

  return masked;
}

/**
 * Determines if a field name suggests it contains sensitive data
 *
 * @param fieldName - The name of the field to check
 * @returns true if the field name suggests sensitive content
 */
function isCredentialField(fieldName: string): boolean {
  const sensitivePatterns = [
    'password',
    'secret',
    'token',
    'key',
    'credential',
    'auth',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'private',
  ];

  const lowerName = fieldName.toLowerCase();
  return sensitivePatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Determines if a value looks like it might be sensitive
 * (e.g., API keys, tokens with specific formats)
 *
 * @param value - The value to check
 * @returns true if the value appears to be sensitive
 */
function isSensitiveValue(value: string): boolean {
  // Check for common API key/token patterns
  const sensitivePatterns = [
    /^(sk|pk)[-_][a-zA-Z0-9]+$/i,     // Stripe-style keys: sk_live_xxx
    /^(xai|gsk|eyJ)[a-zA-Z0-9]+/i,    // Grok, Supabase, JWT patterns
    /^[a-f0-9]{32,}$/i,                // Long hex strings (potential secrets)
    /^Bearer\s+.+$/i,                  // Bearer tokens
  ];

  return sensitivePatterns.some(pattern => pattern.test(value));
}

/**
 * Redacts all credential fields from an object entirely
 *
 * Use this when you need to log or return data but want
 * to completely remove sensitive fields rather than mask them.
 *
 * @param data - Object that may contain credential fields
 * @returns New object with credential fields removed
 *
 * @example
 * redactCredentials({ name: "My Controller", password: "secret" })
 * // Returns { name: "My Controller" }
 */
export function redactCredentials<T extends Record<string, unknown>>(
  data: T
): Partial<T> {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    if (!isCredentialField(key)) {
      result[key as keyof T] = value as T[keyof T];
    }
  }

  return result;
}

/**
 * Sanitizes a credential object before storage
 *
 * Trims whitespace and performs basic validation.
 * Does NOT encrypt - that's handled by Supabase Vault.
 *
 * @param credentials - Raw credential object from user input
 * @returns Sanitized credential object ready for storage
 * @throws Error if credentials are invalid
 */
export function sanitizeCredentials(
  credentials: CredentialObject
): CredentialObject {
  if (!credentials || typeof credentials !== 'object') {
    return {};
  }

  const sanitized: CredentialObject = {};

  for (const [key, value] of Object.entries(credentials)) {
    if (typeof value === 'string') {
      // Trim whitespace
      const trimmed = value.trim();

      // Validate email format if this looks like an email field
      if (key.toLowerCase().includes('email') && trimmed) {
        if (!isValidEmail(trimmed)) {
          throw new Error(`Invalid email format for field: ${key}`);
        }
      }

      sanitized[key] = trimmed;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Basic email validation
 *
 * @param email - Email string to validate
 * @returns true if the email format is valid
 */
function isValidEmail(email: string): boolean {
  // RFC 5322 simplified pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Checks if credentials object has all required fields
 *
 * @param credentials - Credential object to validate
 * @param requiredFields - Array of field names that must be present and non-empty
 * @returns Object with success status and optional error message
 */
export function validateCredentials(
  credentials: CredentialObject | null | undefined,
  requiredFields: string[]
): { valid: boolean; error?: string } {
  if (!credentials) {
    return { valid: false, error: 'No credentials provided' };
  }

  for (const field of requiredFields) {
    const value = credentials[field];

    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return {
        valid: false,
        error: `Missing required credential: ${field}`
      };
    }
  }

  return { valid: true };
}

/**
 * Creates a safe-to-log version of a controller object
 *
 * Removes or masks all sensitive fields while preserving
 * non-sensitive metadata for debugging purposes.
 *
 * @param controller - Controller object that may contain credentials
 * @returns Safe version of the controller for logging
 */
export function createSafeControllerLog(
  controller: Record<string, unknown>
): Record<string, unknown> {
  const safeFields = [
    'id',
    'brand',
    'controller_id',
    'name',
    'capabilities',
    'status',
    'last_seen',
    'model',
    'firmware_version',
    'room_id',
    'created_at',
    'updated_at',
  ];

  const safe: Record<string, unknown> = {};

  for (const field of safeFields) {
    if (field in controller) {
      safe[field] = controller[field];
    }
  }

  // Indicate credentials exist without exposing them
  if ('credentials' in controller && controller.credentials) {
    safe.credentials = '[REDACTED]';
  }

  return safe;
}
