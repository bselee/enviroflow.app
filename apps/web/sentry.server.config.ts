/**
 * Sentry Server Configuration
 *
 * This file configures Sentry error tracking for the server-side (API routes, SSR, etc).
 * It will only initialize Sentry if SENTRY_DSN is set in environment variables.
 *
 * Setup Instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new Next.js project in Sentry
 * 3. Copy the DSN from the project settings
 * 4. Add to .env.local (server-side only, not exposed to browser):
 *    SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
 *
 * Note: Use SENTRY_DSN (not NEXT_PUBLIC_*) to keep it server-side only
 *
 * Optional Environment Variables:
 * - SENTRY_ENVIRONMENT (default: process.env.NODE_ENV)
 * - SENTRY_TRACES_SAMPLE_RATE (default: 0.1 = 10%)
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    // Your Sentry DSN
    dsn: SENTRY_DSN,

    // Environment name (e.g., 'production', 'staging', 'development')
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production (0.1 = 10%)
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Additional SDK configuration for server
    integrations: [
      // HTTP integration for tracking outgoing requests
      Sentry.httpIntegration(),
    ],

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }

      // Remove sensitive data from request
      if (event.request) {
        const { cookies, headers, ...safeRequest } = event.request;

        // Only include safe headers
        const safeHeaders: Record<string, string> = {};
        if (headers) {
          const allowedHeaders = ['user-agent', 'referer', 'content-type'];
          for (const key of allowedHeaders) {
            if (headers[key]) {
              safeHeaders[key] = headers[key];
            }
          }
        }

        event.request = {
          ...safeRequest,
          headers: safeHeaders,
        };
      }

      // Remove sensitive data from extras
      if (event.extra) {
        const { credentials, password, token, apiKey, secret, ...safeExtras } = event.extra;
        event.extra = safeExtras;
      }

      return event;
    },

    // Ignore common non-critical errors
    ignoreErrors: [
      // Expected network errors
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      // Aborted requests
      'AbortError',
      'The operation was aborted',
    ],
  });

  console.log('✓ Sentry server initialized');
} else {
  console.log('ℹ Sentry server not initialized (SENTRY_DSN not set)');
}
