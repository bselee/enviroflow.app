/**
 * Standardized API Error Response System
 *
 * Provides consistent error responses across all API routes.
 * All API routes should use these utilities instead of manually constructing error responses.
 *
 * Usage:
 * ```typescript
 * import { createErrorResponse, createValidationErrorResponse } from '@/lib/api-error-response';
 *
 * // Simple error
 * return createErrorResponse('Unauthorized', 401);
 *
 * // Error with details
 * return createErrorResponse('Connection failed', 400, {
 *   errorType: 'connection',
 *   message: 'Unable to connect to controller',
 *   guidance: 'Check that your controller is powered on',
 * });
 *
 * // Validation error
 * return createValidationErrorResponse([
 *   { field: 'email', message: 'Invalid email format' }
 * ]);
 * ```
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// ============================================
// Types
// ============================================

/**
 * Error type categorization for client-side handling
 */
export type ApiErrorType =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'connection'
  | 'credentials'
  | 'network'
  | 'offline'
  | 'server'
  | 'configuration'
  | 'timeout'
  | 'unknown';

/**
 * Standardized error response structure
 */
export interface ApiErrorResponse {
  /** Always false for error responses */
  success: false;
  /** Main error message (user-friendly) */
  error: string;
  /** Error type for client-side categorization */
  errorType?: ApiErrorType;
  /** Detailed error message (optional) */
  message?: string;
  /** User guidance for resolving the error */
  guidance?: string;
  /** Additional error details */
  details?: unknown;
  /** Brand context (for controller-specific errors) */
  brand?: string;
  /** Timestamp when error occurred */
  timestamp?: string;
}

/**
 * Validation error field
 */
export interface ValidationError {
  field: string;
  message: string;
}

// ============================================
// Error Response Creators
// ============================================

/**
 * Create a standardized error response
 *
 * @param error - Main error message
 * @param status - HTTP status code
 * @param options - Additional error details
 * @returns NextResponse with standardized error structure
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  options?: {
    errorType?: ApiErrorType;
    message?: string;
    guidance?: string;
    details?: unknown;
    brand?: string;
    headers?: HeadersInit;
  }
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error,
    ...(options?.errorType && { errorType: options.errorType }),
    ...(options?.message && { message: options.message }),
    ...(options?.guidance && { guidance: options.guidance }),
    ...(options?.details && { details: options.details }),
    ...(options?.brand && { brand: options.brand }),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    status,
    headers: options?.headers,
  });
}

/**
 * Create a validation error response
 *
 * @param errors - Array of validation errors
 * @param message - Optional custom message
 * @returns NextResponse with 400 status
 */
export function createValidationErrorResponse(
  errors: ValidationError[],
  message?: string
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    'Validation failed',
    400,
    {
      errorType: 'validation',
      message: message || 'Please check your input and try again',
      details: errors,
    }
  );
}

/**
 * Create an authentication error response
 *
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 */
export function createAuthErrorResponse(
  message?: string
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    'Unauthorized',
    401,
    {
      errorType: 'authentication',
      message: message || 'Valid Authorization Bearer token required',
      guidance: 'Please log in and try again',
    }
  );
}

/**
 * Create an authorization error response (forbidden)
 *
 * @param message - Optional custom message
 * @returns NextResponse with 403 status
 */
export function createForbiddenErrorResponse(
  message?: string
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    'Forbidden',
    403,
    {
      errorType: 'authorization',
      message: message || 'You do not have permission to access this resource',
    }
  );
}

/**
 * Create a not found error response
 *
 * @param resource - Name of the resource that wasn't found
 * @returns NextResponse with 404 status
 */
export function createNotFoundErrorResponse(
  resource: string = 'Resource'
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    `${resource} not found`,
    404,
    {
      errorType: 'not_found',
      message: `The requested ${resource.toLowerCase()} does not exist or has been removed`,
    }
  );
}

/**
 * Create a conflict error response
 *
 * @param message - Conflict description
 * @param guidance - Optional guidance for resolving the conflict
 * @returns NextResponse with 409 status
 */
export function createConflictErrorResponse(
  message: string,
  guidance?: string
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    'Conflict',
    409,
    {
      errorType: 'conflict',
      message,
      guidance,
    }
  );
}

/**
 * Create a rate limit error response
 *
 * @param retryAfter - Seconds until retry is allowed
 * @returns NextResponse with 429 status
 */
export function createRateLimitErrorResponse(
  retryAfter: number = 60
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    'Too many requests',
    429,
    {
      errorType: 'rate_limit',
      message: 'You have made too many requests. Please wait before trying again.',
      guidance: `Please wait ${retryAfter} seconds before retrying`,
      headers: {
        'Retry-After': String(retryAfter),
      },
    }
  );
}

/**
 * Create a server error response
 *
 * @param message - Optional custom message (defaults to generic message)
 * @param error - Original error for logging
 * @returns NextResponse with 500 status
 */
export function createServerErrorResponse(
  message?: string,
  error?: unknown
): NextResponse<ApiErrorResponse> {
  // Log the error server-side for debugging
  if (error) {
    console.error('[API Error]', error);
  }

  return createErrorResponse(
    'Internal server error',
    500,
    {
      errorType: 'server',
      message: message || 'An unexpected error occurred. Please try again.',
      guidance: 'If this problem persists, please contact support',
    }
  );
}

/**
 * Create a service unavailable error response
 *
 * @param service - Name of the unavailable service
 * @param retryAfter - Optional retry delay in seconds
 * @returns NextResponse with 503 status
 */
export function createServiceUnavailableErrorResponse(
  service: string = 'Service',
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    `${service} unavailable`,
    503,
    {
      errorType: 'server',
      message: `${service} is temporarily unavailable`,
      guidance: retryAfter
        ? `Please try again in ${retryAfter} seconds`
        : 'Please try again in a few moments',
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
    }
  );
}

// ============================================
// Error Converters
// ============================================

/**
 * Convert a Zod validation error to a standardized response
 *
 * @param error - Zod error object
 * @returns NextResponse with validation errors
 */
export function fromZodError(error: ZodError): NextResponse<ApiErrorResponse> {
  const validationErrors: ValidationError[] = error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));

  return createValidationErrorResponse(validationErrors);
}

/**
 * Convert a generic error to a standardized response
 *
 * @param error - Error object or string
 * @param context - Optional context for better error messages
 * @returns NextResponse with appropriate status and error type
 */
export function fromError(
  error: unknown,
  context?: {
    brand?: string;
    operation?: string;
  }
): NextResponse<ApiErrorResponse> {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return fromZodError(error);
  }

  // Extract error message
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred';

  // Classify the error type
  const lowerMessage = errorMessage.toLowerCase();
  let errorType: ApiErrorType = 'unknown';
  let status = 500;
  let guidance: string | undefined;

  // Authentication/Authorization
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('invalid token') ||
    lowerMessage.includes('session expired')
  ) {
    errorType = 'authentication';
    status = 401;
    guidance = 'Please log in and try again';
  } else if (
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('permission')
  ) {
    errorType = 'authorization';
    status = 403;
  }
  // Credentials
  else if (
    lowerMessage.includes('invalid credentials') ||
    lowerMessage.includes('invalid password') ||
    lowerMessage.includes('invalid email') ||
    lowerMessage.includes('authentication failed') ||
    lowerMessage.includes('login failed')
  ) {
    errorType = 'credentials';
    status = 400;
    guidance = context?.brand
      ? `Double-check your ${context.brand} credentials and try again`
      : 'Double-check your credentials and try again';
  }
  // Network/Connection
  else if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('connection')
  ) {
    errorType = 'network';
    status = 503;
    guidance = 'Check your internet connection and try again';
  }
  // Offline
  else if (
    lowerMessage.includes('offline') ||
    lowerMessage.includes('unreachable') ||
    lowerMessage.includes('not connected')
  ) {
    errorType = 'offline';
    status = 503;
    guidance = 'Check that the device is powered on and connected';
  }
  // Not Found
  else if (lowerMessage.includes('not found')) {
    errorType = 'not_found';
    status = 404;
  }
  // Rate Limit
  else if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests')
  ) {
    errorType = 'rate_limit';
    status = 429;
    guidance = 'Please wait before trying again';
  }
  // Configuration
  else if (
    lowerMessage.includes('configuration') ||
    lowerMessage.includes('not configured') ||
    lowerMessage.includes('encryption')
  ) {
    errorType = 'configuration';
    status = 500;
    guidance = 'Server configuration error. Please contact support.';
  }

  return createErrorResponse(errorMessage, status, {
    errorType,
    guidance,
    brand: context?.brand,
  });
}

// ============================================
// Success Response Creator
// ============================================

/**
 * Standardized success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
  [key: string]: unknown;
}

/**
 * Create a standardized success response
 *
 * @param data - Response data
 * @param status - HTTP status code (default 200)
 * @returns NextResponse with success structure
 */
export function createSuccessResponse<T = unknown>(
  data?: T,
  status: number = 200,
  message?: string
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };

  return NextResponse.json(response, { status });
}

// ============================================
// Type Guards
// ============================================

/**
 * Type guard to check if a response is an error response
 */
export function isApiErrorResponse(
  response: unknown
): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response
  );
}

/**
 * Type guard to check if a response is a success response
 */
export function isApiSuccessResponse<T = unknown>(
  response: unknown
): response is ApiSuccessResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true
  );
}
