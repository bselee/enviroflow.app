/**
 * User Input Sanitization
 *
 * Sanitizes user-provided text input to prevent XSS, HTML injection,
 * and other security issues when storing user content.
 *
 * Note: React automatically escapes content in JSX, but server-side
 * sanitization provides defense-in-depth and protects data exports.
 *
 * @module lib/sanitize-input
 */

/**
 * Maximum lengths for various input types
 */
export const MAX_LENGTHS = {
  name: 100,
  description: 500,
  shortText: 255,
  longText: 2000,
} as const

/**
 * HTML entity map for encoding special characters
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param text - Raw text input
 * @returns Text with HTML entities escaped
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char)
}

/**
 * Remove HTML tags from text (strip tags)
 *
 * @param text - Text that may contain HTML
 * @returns Text with HTML tags removed
 */
export function stripHtmlTags(text: string): string {
  // Remove script and style tags with content
  let result = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove all remaining HTML tags
  result = result.replace(/<[^>]*>/g, '')

  // Decode common HTML entities back to text
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")

  return result
}

/**
 * Normalize whitespace in text
 *
 * @param text - Text with potentially irregular whitespace
 * @returns Text with normalized whitespace
 */
export function normalizeWhitespace(text: string): string {
  // Replace multiple spaces/tabs with single space
  let result = text.replace(/[ \t]+/g, ' ')

  // Replace multiple newlines with single newline
  result = result.replace(/\n{3,}/g, '\n\n')

  // Trim leading/trailing whitespace
  result = result.trim()

  return result
}

/**
 * Remove control characters from text
 *
 * @param text - Text that may contain control characters
 * @returns Text with control characters removed
 */
export function removeControlChars(text: string): string {
  // Remove ASCII control characters except tab, newline, carriage return
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Sanitize options for customizing behavior
 */
export interface SanitizeOptions {
  /** Maximum length (truncates if exceeded) */
  maxLength?: number
  /** Allow newlines in output (default: false for names) */
  allowNewlines?: boolean
  /** Strip HTML tags instead of escaping (default: true) */
  stripHtml?: boolean
  /** Trim leading/trailing whitespace (default: true) */
  trim?: boolean
}

/**
 * Sanitize user text input
 *
 * Default behavior:
 * - Strips HTML tags (defense in depth)
 * - Removes control characters
 * - Normalizes whitespace
 * - Trims leading/trailing whitespace
 * - Enforces maximum length
 *
 * @param input - Raw user input
 * @param options - Sanitization options
 * @returns Sanitized text safe for storage
 *
 * @example
 * sanitizeText("<script>alert('xss')</script>Hello", { maxLength: 100 })
 * // Returns "Hello"
 *
 * sanitizeText("  Multiple   spaces  ", { maxLength: 100 })
 * // Returns "Multiple spaces"
 */
export function sanitizeText(
  input: unknown,
  options: SanitizeOptions = {}
): string {
  // Handle non-string input
  if (typeof input !== 'string') {
    return ''
  }

  const {
    maxLength = MAX_LENGTHS.shortText,
    allowNewlines = false,
    stripHtml = true,
    trim = true,
  } = options

  let result = input

  // Remove control characters first
  result = removeControlChars(result)

  // Handle HTML
  if (stripHtml) {
    result = stripHtmlTags(result)
  }

  // Handle newlines
  if (!allowNewlines) {
    result = result.replace(/[\r\n]+/g, ' ')
  }

  // Normalize whitespace
  result = normalizeWhitespace(result)

  // Trim if requested
  if (trim) {
    result = result.trim()
  }

  // Enforce max length
  if (result.length > maxLength) {
    result = result.substring(0, maxLength)
    // Trim any partial word at the end
    const lastSpace = result.lastIndexOf(' ')
    if (lastSpace > maxLength * 0.8) {
      result = result.substring(0, lastSpace)
    }
    result = result.trim()
  }

  return result
}

/**
 * Sanitize a name field (controller name, room name, etc.)
 *
 * Names are single-line text with strict sanitization:
 * - No HTML tags
 * - No newlines
 * - Max 100 characters
 * - Trimmed whitespace
 *
 * @param name - Raw name input
 * @returns Sanitized name
 *
 * @example
 * sanitizeName("<b>My Room</b>")
 * // Returns "My Room"
 */
export function sanitizeName(name: unknown): string {
  return sanitizeText(name, {
    maxLength: MAX_LENGTHS.name,
    allowNewlines: false,
    stripHtml: true,
    trim: true,
  })
}

/**
 * Sanitize a description field
 *
 * Descriptions allow newlines but still strip HTML:
 * - No HTML tags
 * - Newlines allowed
 * - Max 500 characters
 *
 * @param description - Raw description input
 * @returns Sanitized description
 */
export function sanitizeDescription(description: unknown): string {
  return sanitizeText(description, {
    maxLength: MAX_LENGTHS.description,
    allowNewlines: true,
    stripHtml: true,
    trim: true,
  })
}

/**
 * Validate that a name is non-empty after sanitization
 *
 * @param name - Sanitized name
 * @returns true if name is valid (non-empty)
 */
export function isValidName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_LENGTHS.name
}

/**
 * Sanitize object properties by name pattern
 *
 * Automatically sanitizes properties ending in '_name' or '_description'
 *
 * @param obj - Object with potential user input fields
 * @returns Object with sanitized string fields
 */
export function sanitizeUserInput<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (key.endsWith('_name') || key === 'name') {
        result[key] = sanitizeName(value)
      } else if (key.endsWith('_description') || key === 'description') {
        result[key] = sanitizeDescription(value)
      } else {
        // For other string fields, apply basic sanitization
        result[key] = sanitizeText(value, { maxLength: MAX_LENGTHS.longText })
      }
    } else {
      result[key] = value
    }
  }

  return result as T
}
