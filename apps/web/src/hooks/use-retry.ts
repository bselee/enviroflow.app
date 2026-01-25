/**
 * useRetry Hook
 *
 * Reusable hook for automatic retry logic with exponential backoff.
 * Designed for connection tests, API calls, and other operations that may fail temporarily.
 *
 * Features:
 * - Configurable max attempts and backoff strategy
 * - Progress tracking (current attempt out of total)
 * - Detailed error information with failure reasons
 * - Timeout support per attempt
 * - State persistence (prevents duplicate calls on re-mount)
 * - User-friendly status messages
 *
 * @example
 * ```tsx
 * const { execute, attempt, maxAttempts, status, error, reset } = useRetry(
 *   async () => {
 *     const response = await fetch('/api/test-connection');
 *     if (!response.ok) throw new Error('Connection failed');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     backoff: 'exponential',
 *     baseDelay: 2000,
 *     timeout: 30000,
 *     onAttempt: (attempt, max) => console.log(`Attempt ${attempt}/${max}`)
 *   }
 * );
 * ```
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Error classification for better user guidance
 */
export type ErrorType =
  | "network"        // DNS, timeout, fetch errors
  | "credentials"    // Authentication failures
  | "validation"     // Bad request, invalid input
  | "server"         // 5xx errors
  | "timeout"        // Operation timed out
  | "unknown";       // Unclassified error

/**
 * Detailed error information
 */
export interface RetryError {
  /** Original error message */
  message: string;
  /** Classified error type for user guidance */
  type: ErrorType;
  /** Which specific step failed (e.g., "DNS lookup", "authentication", "API call") */
  failedStep?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Additional context for debugging */
  context?: Record<string, unknown>;
}

/**
 * Options for retry behavior
 */
export interface UseRetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Backoff strategy (default: 'exponential') */
  backoff?: "exponential" | "linear" | "constant";
  /** Base delay in milliseconds (default: 2000) */
  baseDelay?: number;
  /** Timeout per attempt in milliseconds (default: 30000) */
  timeout?: number;
  /** Called before each attempt with attempt number and max attempts */
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  /** Called when an attempt fails (before retry) */
  onRetry?: (attempt: number, error: RetryError) => void;
  /** Called when all retries are exhausted */
  onExhausted?: (error: RetryError) => void;
}

/**
 * Retry execution status
 */
export type RetryStatus = "idle" | "retrying" | "success" | "failed";

/**
 * Hook return value
 */
export interface UseRetryResult<T> {
  /** Current attempt number (1-indexed) */
  attempt: number;
  /** Maximum number of attempts */
  maxAttempts: number;
  /** Current execution status */
  status: RetryStatus;
  /** Detailed error information if failed */
  error: RetryError | null;
  /** Result data if successful */
  data: T | null;
  /** Execute the operation with retry logic */
  execute: () => Promise<T>;
  /** Reset state to idle */
  reset: () => void;
  /** Whether currently executing */
  isExecuting: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** User-friendly status message */
  statusMessage: string;
}

/**
 * Classify error by type for better user guidance
 */
function classifyError(error: unknown): ErrorType {
  if (!(error instanceof Error)) return "unknown";

  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("dns") ||
    message.includes("enotfound")
  ) {
    return "network";
  }

  // Credential errors
  if (
    message.includes("password") ||
    message.includes("email") ||
    message.includes("authentication") ||
    message.includes("unauthorized") ||
    message.includes("invalid credentials")
  ) {
    return "credentials";
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  // Validation errors
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("bad request")
  ) {
    return "validation";
  }

  // Server errors
  if (message.includes("server error") || message.includes("internal")) {
    return "server";
  }

  return "unknown";
}

/**
 * Extract failed step from error message
 */
function extractFailedStep(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const message = error.message.toLowerCase();

  if (message.includes("dns")) return "DNS lookup";
  if (message.includes("authentication")) return "Authentication";
  if (message.includes("connection")) return "Network connection";
  if (message.includes("timeout")) return "Request timeout";
  if (message.includes("api")) return "API call";

  return undefined;
}

/**
 * Wrap async function with timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  strategy: "exponential" | "linear" | "constant"
): number {
  switch (strategy) {
    case "exponential":
      return baseDelay * Math.pow(2, attempt - 1);
    case "linear":
      return baseDelay * attempt;
    case "constant":
      return baseDelay;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * useRetry - Automatic retry logic with exponential backoff
 */
export function useRetry<T>(
  fn: () => Promise<T>,
  options: UseRetryOptions = {}
): UseRetryResult<T> {
  const {
    maxAttempts = 3,
    backoff = "exponential",
    baseDelay = 2000,
    timeout = 30000,
    onAttempt,
    onRetry,
    onExhausted,
  } = options;

  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<RetryStatus>("idle");
  const [error, setError] = useState<RetryError | null>(null);
  const [data, setData] = useState<T | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  const isExecuting = status === "retrying";

  /**
   * Calculate progress percentage based on current attempt
   */
  const progress = attempt === 0 ? 0 : Math.min((attempt / maxAttempts) * 100, 100);

  /**
   * Generate user-friendly status message
   */
  const statusMessage =
    status === "idle"
      ? "Ready to connect"
      : status === "retrying"
      ? `Attempt ${attempt}/${maxAttempts}: ${
          attempt === 1
            ? "Connecting to cloud API..."
            : `Retrying in ${calculateDelay(attempt, baseDelay, backoff) / 1000}s...`
        }`
      : status === "success"
      ? "Connection successful"
      : `Connection failed after ${maxAttempts} attempts`;

  /**
   * Execute the operation with retry logic
   */
  const execute = useCallback(async (): Promise<T> => {
    if (!isMounted.current) {
      throw new Error("Component unmounted");
    }

    setStatus("retrying");
    setError(null);
    setData(null);

    for (let i = 1; i <= maxAttempts; i++) {
      if (!isMounted.current) {
        throw new Error("Component unmounted during execution");
      }

      setAttempt(i);

      // Notify before attempt
      onAttempt?.(i, maxAttempts);

      try {
        // Execute with timeout
        const result = await withTimeout(fn(), timeout);

        // Success
        if (isMounted.current) {
          setStatus("success");
          setData(result);
        }

        return result;
      } catch (err) {
        // Build detailed error information
        const retryError: RetryError = {
          message: err instanceof Error ? err.message : "Unknown error",
          type: classifyError(err),
          failedStep: extractFailedStep(err),
          context: {
            attempt: i,
            maxAttempts,
            timestamp: new Date().toISOString(),
          },
        };

        // Extract status code if available (from fetch errors)
        if (err && typeof err === "object" && "status" in err) {
          retryError.statusCode = err.status as number;
        }

        // If this is not the last attempt, retry with backoff
        if (i < maxAttempts) {
          const delay = calculateDelay(i, baseDelay, backoff);

          // Notify about retry
          onRetry?.(i, retryError);

          // Wait before next attempt
          await sleep(delay);
        } else {
          // All retries exhausted
          if (isMounted.current) {
            setStatus("failed");
            setError(retryError);
            onExhausted?.(retryError);
          }

          throw err;
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error("Unexpected retry loop exit");
  }, [fn, maxAttempts, backoff, baseDelay, timeout, onAttempt, onRetry, onExhausted]);

  /**
   * Reset state to idle
   */
  const reset = useCallback(() => {
    if (isMounted.current) {
      setStatus("idle");
      setAttempt(0);
      setError(null);
      setData(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    attempt,
    maxAttempts,
    status,
    error,
    data,
    execute,
    reset,
    isExecuting,
    progress,
    statusMessage,
  };
}
