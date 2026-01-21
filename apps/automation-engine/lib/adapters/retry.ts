/**
 * Retry Utility with Exponential Backoff and Circuit Breaker
 *
 * Provides resilient HTTP requests for controller adapters with:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Request timeout handling
 * - Detailed error classification
 */

// ============================================
// Types
// ============================================

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number
  /** Initial delay in ms (default: 1000) */
  initialDelayMs: number
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs: number
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number
  /** Request timeout in ms (default: 10000) */
  timeoutMs: number
  /** Add random jitter to delays (default: true) */
  jitter: boolean
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number
  /** Time in ms before attempting to close circuit (default: 60000) */
  resetTimeoutMs: number
}

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerState {
  state: CircuitState
  failures: number
  lastFailure: Date | null
  lastSuccess: Date | null
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: string
  attempts: number
  totalTimeMs: number
  circuitState: CircuitState
}

export type ErrorType =
  | 'network'        // Network connectivity issues
  | 'timeout'        // Request timed out
  | 'auth'           // Authentication failed
  | 'rate_limit'     // Rate limited by server
  | 'server_error'   // Server returned 5xx
  | 'client_error'   // Server returned 4xx (non-auth)
  | 'parse_error'    // Response parsing failed
  | 'unknown'        // Unknown error

export interface ClassifiedError {
  type: ErrorType
  message: string
  statusCode?: number
  retryable: boolean
  originalError?: Error
}

// ============================================
// Default Configurations
// ============================================

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  timeoutMs: 15000,
  jitter: true,
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
}

// ============================================
// Circuit Breaker State Management
// ============================================

const circuitBreakers = new Map<string, CircuitBreakerState>()

/**
 * Get or create circuit breaker state for a service
 */
export function getCircuitBreaker(serviceId: string): CircuitBreakerState {
  if (!circuitBreakers.has(serviceId)) {
    circuitBreakers.set(serviceId, {
      state: 'closed',
      failures: 0,
      lastFailure: null,
      lastSuccess: null,
    })
  }
  return circuitBreakers.get(serviceId)!
}

/**
 * Update circuit breaker after a failure
 */
export function recordFailure(
  serviceId: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
): CircuitState {
  const breaker = getCircuitBreaker(serviceId)
  breaker.failures++
  breaker.lastFailure = new Date()

  if (breaker.failures >= config.failureThreshold) {
    breaker.state = 'open'
  }

  return breaker.state
}

/**
 * Update circuit breaker after a success
 */
export function recordSuccess(serviceId: string): CircuitState {
  const breaker = getCircuitBreaker(serviceId)
  breaker.failures = 0
  breaker.state = 'closed'
  breaker.lastSuccess = new Date()
  return breaker.state
}

/**
 * Check if circuit breaker allows requests
 */
export function canMakeRequest(
  serviceId: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
): boolean {
  const breaker = getCircuitBreaker(serviceId)

  if (breaker.state === 'closed') {
    return true
  }

  if (breaker.state === 'open') {
    // Check if enough time has passed to try again
    if (breaker.lastFailure) {
      const timeSinceFailure = Date.now() - breaker.lastFailure.getTime()
      if (timeSinceFailure >= config.resetTimeoutMs) {
        breaker.state = 'half-open'
        return true
      }
    }
    return false
  }

  // Half-open: allow one request to test
  return true
}

/**
 * Reset circuit breaker (useful for testing or manual intervention)
 */
export function resetCircuitBreaker(serviceId: string): void {
  circuitBreakers.delete(serviceId)
}

// ============================================
// Error Classification
// ============================================

/**
 * Classify an error to determine if it's retryable
 */
export function classifyError(error: unknown, statusCode?: number): ClassifiedError {
  // Network errors
  if (error instanceof TypeError &&
      (error.message.includes('fetch') ||
       error.message.includes('network') ||
       error.message.includes('ECONNREFUSED') ||
       error.message.includes('ENOTFOUND') ||
       error.message.includes('ETIMEDOUT'))) {
    return {
      type: 'network',
      message: 'Network connection failed',
      retryable: true,
      originalError: error,
    }
  }

  // Timeout errors
  if (error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('timeout'))) {
    return {
      type: 'timeout',
      message: 'Request timed out',
      retryable: true,
      originalError: error,
    }
  }

  // HTTP status code based classification
  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      return {
        type: 'auth',
        message: 'Authentication failed',
        statusCode,
        retryable: false, // Don't retry auth errors
      }
    }

    if (statusCode === 429) {
      return {
        type: 'rate_limit',
        message: 'Rate limited by server',
        statusCode,
        retryable: true, // Retry with longer delay
      }
    }

    if (statusCode >= 500) {
      return {
        type: 'server_error',
        message: `Server error: ${statusCode}`,
        statusCode,
        retryable: true,
      }
    }

    if (statusCode >= 400) {
      return {
        type: 'client_error',
        message: `Client error: ${statusCode}`,
        statusCode,
        retryable: false,
      }
    }
  }

  // Parse errors
  if (error instanceof SyntaxError) {
    return {
      type: 'parse_error',
      message: 'Failed to parse response',
      retryable: false,
      originalError: error,
    }
  }

  // Unknown errors
  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'Unknown error',
    retryable: true, // Default to retryable for unknown errors
    originalError: error instanceof Error ? error : undefined,
  }
}

// ============================================
// Retry Logic
// ============================================

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs)

  if (config.jitter) {
    // Add random jitter (0.5 to 1.5 of the delay)
    const jitterMultiplier = 0.5 + Math.random()
    return Math.floor(cappedDelay * jitterMultiplier)
  }

  return cappedDelay
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Execute a fetch request with retry logic and circuit breaker
 */
export async function fetchWithRetry<T>(
  serviceId: string,
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {},
  circuitConfig: Partial<CircuitBreakerConfig> = {}
): Promise<RetryResult<T>> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const cbConfig = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...circuitConfig }

  const startTime = Date.now()
  let attempts = 0
  let lastError: ClassifiedError | null = null

  // Check circuit breaker
  if (!canMakeRequest(serviceId, cbConfig)) {
    return {
      success: false,
      error: 'Circuit breaker is open. Service temporarily unavailable.',
      attempts: 0,
      totalTimeMs: 0,
      circuitState: 'open',
    }
  }

  while (attempts <= retryConfig.maxRetries) {
    attempts++

    try {
      const response = await fetchWithTimeout(url, options, retryConfig.timeoutMs)

      // Check for non-OK responses
      if (!response.ok) {
        lastError = classifyError(null, response.status)

        // Try to get error message from response body
        try {
          const errorBody = await response.json()
          if (errorBody.message || errorBody.error || errorBody.msg) {
            lastError.message = errorBody.message || errorBody.error || errorBody.msg
          }
        } catch {
          // Ignore parse errors for error response
        }

        if (!lastError.retryable) {
          // Record failure and return immediately for non-retryable errors
          recordFailure(serviceId, cbConfig)
          return {
            success: false,
            error: lastError.message,
            attempts,
            totalTimeMs: Date.now() - startTime,
            circuitState: getCircuitBreaker(serviceId).state,
          }
        }

        // Wait and retry for retryable errors
        if (attempts <= retryConfig.maxRetries) {
          const delay = lastError.type === 'rate_limit'
            ? calculateDelay(attempts + 1, retryConfig) // Extra delay for rate limits
            : calculateDelay(attempts - 1, retryConfig)
          await sleep(delay)
          continue
        }
      }

      // Parse successful response
      const data = await response.json() as T
      recordSuccess(serviceId)

      return {
        success: true,
        data,
        attempts,
        totalTimeMs: Date.now() - startTime,
        circuitState: 'closed',
      }

    } catch (error) {
      lastError = classifyError(error)

      if (!lastError.retryable || attempts > retryConfig.maxRetries) {
        recordFailure(serviceId, cbConfig)
        return {
          success: false,
          error: lastError.message,
          attempts,
          totalTimeMs: Date.now() - startTime,
          circuitState: getCircuitBreaker(serviceId).state,
        }
      }

      // Wait before retrying
      const delay = calculateDelay(attempts - 1, retryConfig)
      await sleep(delay)
    }
  }

  // All retries exhausted
  recordFailure(serviceId, cbConfig)
  return {
    success: false,
    error: lastError?.message || 'Max retries exceeded',
    attempts,
    totalTimeMs: Date.now() - startTime,
    circuitState: getCircuitBreaker(serviceId).state,
  }
}

/**
 * High-level wrapper for adapter API calls
 */
export async function adapterFetch<T>(
  adapterName: string,
  url: string,
  options: RequestInit = {},
  retryConfig?: Partial<RetryConfig>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const result = await fetchWithRetry<T>(
    `adapter:${adapterName}`,
    url,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EnviroFlow/1.0',
        ...options.headers,
      },
    },
    retryConfig
  )

  if (result.success && result.data) {
    return { success: true, data: result.data }
  }

  return { success: false, error: result.error }
}
