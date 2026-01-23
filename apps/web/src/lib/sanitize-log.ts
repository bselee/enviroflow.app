/**
 * Sanitize sensitive data before logging
 *
 * This utility removes sensitive information from log messages to prevent
 * accidental exposure in server logs, error tracking systems, etc.
 */

/**
 * List of sensitive field names to redact
 */
const SENSITIVE_FIELDS = [
  'password',
  'apiKey',
  'api_key',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'credentials',
  'authorization',
  'cookie',
  'session',
  'private_key',
  'privateKey',
  'encryptionKey',
  'encryption_key',
];

/**
 * Regex patterns for sensitive data
 */
const SENSITIVE_PATTERNS = [
  // Email addresses
  /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  // API keys (common formats)
  /[a-zA-Z0-9_-]{32,}/g,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  // UUIDs (can be sensitive in some contexts)
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
];

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => lowerField.includes(sensitive));
}

/**
 * Redact a sensitive string value
 */
function redactValue(value: string): string {
  if (value.length <= 4) {
    return '***';
  }
  // Show first 2 and last 2 characters
  return `${value.slice(0, 2)}...${value.slice(-2)}`;
}

/**
 * Sanitize an object by redacting sensitive fields
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH]';
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      // Redact sensitive fields
      if (typeof value === 'string') {
        sanitized[key] = redactValue(value);
      } else if (value !== null && value !== undefined) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      // Keep non-sensitive primitives as-is
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize a string by masking sensitive patterns
 */
function sanitizeString(str: string): string {
  let sanitized = str;

  // Mask email addresses
  sanitized = sanitized.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, user, domain) => {
      const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : '***';
      return `${maskedUser}@${domain}`;
    }
  );

  // Mask Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer ***');

  // Mask long alphanumeric strings (likely API keys)
  sanitized = sanitized.replace(/\b[a-zA-Z0-9_-]{32,}\b/g, '***');

  return sanitized;
}

/**
 * Sanitize log data before logging
 *
 * @param data - The data to sanitize (string, object, Error, etc.)
 * @returns Sanitized version safe for logging
 */
export function sanitizeLog(data: unknown): unknown {
  // Handle Error objects
  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeString(data.message),
      stack: data.stack ? sanitizeString(data.stack) : undefined,
    };
  }

  // Handle strings
  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  // Handle objects
  if (typeof data === 'object' && data !== null) {
    return sanitizeObject(data);
  }

  // Primitives (numbers, booleans, etc.)
  return data;
}

/**
 * Create a sanitized error message for logging
 *
 * @param message - Log message
 * @param data - Optional data to include
 * @returns Sanitized log message
 */
export function createSafeLogMessage(message: string, data?: unknown): string {
  const sanitizedMessage = sanitizeString(message);

  if (data === undefined) {
    return sanitizedMessage;
  }

  const sanitizedData = sanitizeLog(data);
  return `${sanitizedMessage} ${JSON.stringify(sanitizedData)}`;
}

/**
 * Safe console.error that sanitizes input
 */
export function safeError(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeLog(arg));
  console.error(sanitizeString(message), ...sanitizedArgs);
}

/**
 * Safe console.warn that sanitizes input
 */
export function safeWarn(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeLog(arg));
  console.warn(sanitizeString(message), ...sanitizedArgs);
}

/**
 * Safe console.log that sanitizes input
 */
export function safeLog(message: string, ...args: unknown[]): void {
  const sanitizedArgs = args.map(arg => sanitizeLog(arg));
  console.log(sanitizeString(message), ...sanitizedArgs);
}
