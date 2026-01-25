/**
 * Error Classification and Logging System
 *
 * Provides structured error categorization and logging to the activity_logs table.
 * This module enhances error guidance by:
 * 1. Classifying errors into actionable categories
 * 2. Logging errors for support analysis
 * 3. Providing context-aware error details
 *
 * Usage:
 * ```typescript
 * import { classifyAndLogError } from '@/lib/error-classifier';
 *
 * const errorContext = await classifyAndLogError(error, {
 *   brand: 'ac_infinity',
 *   context: 'connection',
 *   controllerId: 'controller-id',
 *   userId: 'user-id'
 * });
 * ```
 */

import { createServerClient } from '@/lib/supabase';
import type { ControllerBrand } from '@/types';

// ============================================
// Types
// ============================================

/**
 * Error category types for classification
 */
export type ErrorType =
  | 'credentials'
  | 'network'
  | 'offline'
  | 'rate_limit'
  | 'server';

/**
 * Context information about where/how the error occurred
 */
export interface ErrorContext {
  /** Classified error type */
  type: ErrorType;
  /** Original error object or message */
  originalError: Error | string | { error?: string; message?: string; status?: number };
  /** Controller brand (for brand-specific guidance) */
  brand?: ControllerBrand;
  /** Whether this error can be retried */
  retryable: boolean;
  /** HTTP status code if available */
  statusCode?: number;
  /** Additional context about the error */
  context?: 'connection' | 'sensors' | 'discovery' | 'device_control' | 'general';
  /** Controller ID if relevant */
  controllerId?: string;
  /** Room ID if relevant */
  roomId?: string;
  /** Workflow ID if relevant */
  workflowId?: string;
  /** User ID for logging */
  userId?: string;
  /** Request metadata */
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    attemptNumber?: number;
  };
}

/**
 * Classification result with guidance
 */
export interface ClassifiedError {
  type: ErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// ============================================
// Error Classification Logic
// ============================================

/**
 * Classifies an error into one of 5 main categories
 */
export function classifyError(
  error: Error | string | { error?: string; message?: string; status?: number },
  statusCode?: number
): ErrorType {
  const message = typeof error === 'string'
    ? error.toLowerCase()
    : error instanceof Error
      ? error.message.toLowerCase()
      : (error.error || error.message || '').toLowerCase();

  const status = statusCode || (typeof error === 'object' && 'status' in error ? error.status : undefined);

  // 1. CREDENTIALS - Authentication/authorization failures
  if (
    status === 401 ||
    status === 403 ||
    message.includes('invalid credentials') ||
    message.includes('invalid email') ||
    message.includes('invalid password') ||
    message.includes('authentication failed') ||
    message.includes('login failed') ||
    message.includes('unauthorized') ||
    message.includes('invalid token') ||
    message.includes('session expired') ||
    message.includes('credentials') ||
    message.includes('email not found') ||
    message.includes('password incorrect') ||
    message.includes('invalid api key')
  ) {
    return 'credentials';
  }

  // 2. NETWORK - Connection and network issues
  if (
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('connection refused') ||
    message.includes('dns') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('getaddrinfo') ||
    message.includes('unable to connect') ||
    message.includes('connection error') ||
    message.includes('no internet') ||
    message.includes('network error')
  ) {
    return 'network';
  }

  // 3. OFFLINE - Device/controller is unreachable
  if (
    status === 503 ||
    message.includes('offline') ||
    message.includes('unreachable') ||
    message.includes('not connected') ||
    message.includes('controller is offline') ||
    message.includes('device offline') ||
    message.includes('controller not found') ||
    message.includes('device not found') ||
    message.includes('not available') ||
    message.includes('disconnected')
  ) {
    return 'offline';
  }

  // 4. RATE_LIMIT - Too many requests
  if (
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('slow down') ||
    message.includes('throttled') ||
    message.includes('quota exceeded')
  ) {
    return 'rate_limit';
  }

  // 5. SERVER - Server-side errors (default for 5xx codes)
  if (
    status && status >= 500 ||
    message.includes('internal server error') ||
    message.includes('service unavailable') ||
    message.includes('bad gateway') ||
    message.includes('gateway timeout') ||
    message.includes('server error')
  ) {
    return 'server';
  }

  // Default to server error if we can't classify it more specifically
  return 'server';
}

/**
 * Extracts error message from various error formats
 */
export function extractErrorMessage(
  error: Error | string | { error?: string; message?: string }
): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return error.error || error.message || 'An unexpected error occurred';
}

/**
 * Determines if an error is retryable based on its type
 */
export function isRetryable(errorType: ErrorType): boolean {
  const retryableTypes: ErrorType[] = ['network', 'offline', 'rate_limit', 'server'];
  return retryableTypes.includes(errorType);
}

/**
 * Get recommended retry delay in seconds
 */
export function getRetryDelay(errorType: ErrorType): number {
  switch (errorType) {
    case 'credentials':
      return 0; // No automatic retry - user must fix credentials
    case 'network':
      return 5;
    case 'offline':
      return 30;
    case 'rate_limit':
      return 60;
    case 'server':
      return 30;
    default:
      return 10;
  }
}

// ============================================
// Activity Logging
// ============================================

/**
 * Logs an error to the activity_logs table for support analysis
 *
 * This provides:
 * - User-level error tracking
 * - Support debugging information
 * - Error pattern analysis
 *
 * @param errorContext - Complete error context
 * @returns Promise that resolves when log is created (fire-and-forget)
 */
export async function logErrorToActivity(
  errorContext: ErrorContext
): Promise<void> {
  try {
    const client = createServerClient();
    if (!client) {
      console.warn('Cannot log error: Supabase client not available');
      return;
    }

    const { userId, controllerId, roomId, workflowId, metadata } = errorContext;

    // Don't log if we don't have a user ID
    if (!userId) {
      console.warn('Cannot log error: userId is required');
      return;
    }

    const errorMessage = extractErrorMessage(errorContext.originalError);

    // Prepare log data
    const logData = {
      user_id: userId,
      controller_id: controllerId || null,
      room_id: roomId || null,
      workflow_id: workflowId || null,
      action_type: `error_${errorContext.type}`,
      details: {
        error_type: errorContext.type,
        error_message: errorMessage,
        status_code: errorContext.statusCode,
        brand: errorContext.brand,
        context: errorContext.context,
        retryable: errorContext.retryable,
        retry_delay: getRetryDelay(errorContext.type),
        attempt_number: metadata?.attemptNumber,
        timestamp: new Date().toISOString(),
      },
      result: 'failed' as const,
      error_message: errorMessage,
      ip_address: metadata?.ipAddress || null,
      user_agent: metadata?.userAgent || null,
    };

    // Insert into activity_logs (fire and forget)
    const { error: insertError } = await client
      .from('activity_logs')
      .insert(logData);

    if (insertError) {
      console.error('Failed to log error to activity_logs:', insertError);
    }
  } catch (err) {
    // Don't throw - logging failures shouldn't break the main flow
    console.error('Error in logErrorToActivity:', err);
  }
}

/**
 * Classifies an error and logs it to activity_logs in one operation
 *
 * This is the main entry point for error handling.
 *
 * @example
 * ```typescript
 * try {
 *   await connectToController(credentials);
 * } catch (error) {
 *   const errorContext = await classifyAndLogError(error, {
 *     brand: 'ac_infinity',
 *     context: 'connection',
 *     controllerId: controller.id,
 *     userId: user.id,
 *     metadata: { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
 *   });
 *
 *   return Response.json({
 *     success: false,
 *     error: errorContext.message,
 *     errorType: errorContext.type,
 *     retryable: errorContext.retryable
 *   }, { status: errorContext.statusCode || 500 });
 * }
 * ```
 */
export async function classifyAndLogError(
  error: Error | string | { error?: string; message?: string; status?: number },
  options: {
    brand?: ControllerBrand;
    context?: 'connection' | 'sensors' | 'discovery' | 'device_control' | 'general';
    controllerId?: string;
    roomId?: string;
    workflowId?: string;
    userId?: string;
    statusCode?: number;
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      attemptNumber?: number;
    };
  } = {}
): Promise<ErrorContext> {
  const statusCode = options.statusCode ||
    (typeof error === 'object' && 'status' in error ? error.status : undefined);

  const type = classifyError(error, statusCode);
  const message = extractErrorMessage(error);
  const retryable = isRetryable(type);

  const errorContext: ErrorContext = {
    type,
    originalError: error,
    brand: options.brand,
    retryable,
    statusCode,
    context: options.context || 'general',
    controllerId: options.controllerId,
    roomId: options.roomId,
    workflowId: options.workflowId,
    userId: options.userId,
    metadata: options.metadata,
  };

  // Log to activity_logs (async, non-blocking)
  if (options.userId) {
    logErrorToActivity(errorContext).catch(err => {
      console.error('Failed to log error:', err);
    });
  }

  return errorContext;
}

// ============================================
// Brand-Specific Helpers
// ============================================

/**
 * Get brand-specific error insights
 */
export function getBrandErrorInsights(
  errorType: ErrorType,
  brand?: ControllerBrand
): {
  commonCauses: string[];
  quickFixes: string[];
} {
  if (!brand) {
    return { commonCauses: [], quickFixes: [] };
  }

  const insights: Record<ControllerBrand, Record<ErrorType, { commonCauses: string[]; quickFixes: string[] }>> = {
    ac_infinity: {
      credentials: {
        commonCauses: [
          'Password recently changed in AC Infinity app',
          'Email address typo',
          'Account not activated',
        ],
        quickFixes: [
          'Log into AC Infinity app to verify credentials',
          'Try resetting password if forgotten',
          'Check spam folder for activation email',
        ],
      },
      network: {
        commonCauses: [
          'AC Infinity API temporarily down',
          'Firewall blocking API access',
          'DNS resolution issue',
        ],
        quickFixes: [
          'Check status.acinfinity.com',
          'Try from different network',
          'Disable VPN temporarily',
        ],
      },
      offline: {
        commonCauses: [
          'Controller on 5GHz WiFi instead of 2.4GHz',
          'Controller power cycled recently',
          'WiFi signal too weak',
        ],
        quickFixes: [
          'Switch controller to 2.4GHz network',
          'Move controller closer to router',
          'Check WiFi indicator on controller screen',
        ],
      },
      rate_limit: {
        commonCauses: [
          'Too many refresh attempts',
          'Multiple apps using same account',
        ],
        quickFixes: [
          'Wait 60 seconds before retrying',
          'Reduce polling frequency',
        ],
      },
      server: {
        commonCauses: [
          'AC Infinity cloud service outage',
          'Controller firmware update in progress',
        ],
        quickFixes: [
          'Wait 5-10 minutes and retry',
          'Check AC Infinity app for service status',
        ],
      },
    },
    inkbird: {
      credentials: {
        commonCauses: ['Inkbird not yet supported'],
        quickFixes: ['Use CSV Upload for now'],
      },
      network: { commonCauses: [], quickFixes: [] },
      offline: { commonCauses: [], quickFixes: [] },
      rate_limit: { commonCauses: [], quickFixes: [] },
      server: { commonCauses: [], quickFixes: [] },
    },
    ecowitt: {
      credentials: {
        commonCauses: [
          'Application key not generated',
          'API key copied incorrectly',
        ],
        quickFixes: [
          'Generate new API key in Ecowitt app',
          'Copy-paste API key carefully',
        ],
      },
      network: {
        commonCauses: [
          'Ecowitt API rate limiting',
          'Gateway not reporting data',
        ],
        quickFixes: [
          'Wait a few minutes and retry',
          'Check gateway status in Ecowitt app',
        ],
      },
      offline: {
        commonCauses: [
          'Gateway WiFi disconnected',
          'Gateway powered off',
          'Sensors out of range',
        ],
        quickFixes: [
          'Check gateway WiFi LED indicator',
          'Power cycle the gateway',
          'Move sensors closer to gateway',
        ],
      },
      rate_limit: { commonCauses: [], quickFixes: [] },
      server: { commonCauses: [], quickFixes: [] },
    },
    csv_upload: {
      credentials: { commonCauses: [], quickFixes: [] },
      network: { commonCauses: [], quickFixes: [] },
      offline: { commonCauses: [], quickFixes: [] },
      rate_limit: { commonCauses: [], quickFixes: [] },
      server: { commonCauses: [], quickFixes: [] },
    },
    govee: {
      credentials: { commonCauses: [], quickFixes: [] },
      network: { commonCauses: [], quickFixes: [] },
      offline: { commonCauses: [], quickFixes: [] },
      rate_limit: { commonCauses: [], quickFixes: [] },
      server: { commonCauses: [], quickFixes: [] },
    },
    mqtt: {
      credentials: {
        commonCauses: [
          'Incorrect broker credentials',
          'Broker not accepting connections',
        ],
        quickFixes: [
          'Verify username/password',
          'Check broker is running',
        ],
      },
      network: {
        commonCauses: [
          'WebSocket port blocked',
          'Broker URL incorrect',
        ],
        quickFixes: [
          'Verify ws:// or wss:// protocol',
          'Check firewall settings',
        ],
      },
      offline: {
        commonCauses: [
          'MQTT broker offline',
          'Topic not publishing',
        ],
        quickFixes: [
          'Restart MQTT broker',
          'Check broker logs',
        ],
      },
      rate_limit: { commonCauses: [], quickFixes: [] },
      server: { commonCauses: [], quickFixes: [] },
    },
    custom: {
      credentials: { commonCauses: [], quickFixes: [] },
      network: { commonCauses: [], quickFixes: [] },
      offline: { commonCauses: [], quickFixes: [] },
      rate_limit: { commonCauses: [], quickFixes: [] },
      server: { commonCauses: [], quickFixes: [] },
    },
  };

  return insights[brand]?.[errorType] || { commonCauses: [], quickFixes: [] };
}
