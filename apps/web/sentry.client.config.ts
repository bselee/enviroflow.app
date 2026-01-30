/**
 * Sentry Client Configuration
 *
 * This file configures Sentry error tracking for the browser/client-side.
 * It will only initialize Sentry if NEXT_PUBLIC_SENTRY_DSN is set in environment variables.
 *
 * Setup Instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new Next.js project in Sentry
 * 3. Copy the DSN from the project settings
 * 4. Add to .env.local:
 *    NEXT_PUBLIC_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
 *
 * Optional Environment Variables:
 * - NEXT_PUBLIC_SENTRY_ENVIRONMENT (default: process.env.NODE_ENV)
 * - NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE (default: 0.1 = 10%)
 * - NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE (default: 0.1 = 10%)
 * - NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE (default: 1.0 = 100%)
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    // Your Sentry DSN
    dsn: SENTRY_DSN,

    // Environment name (e.g., 'production', 'staging', 'development')
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production (0.1 = 10%)
    tracesSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'
    ),

    // Capture Replay for 10% of all sessions,
    // plus 100% of sessions with an error
    replaysSessionSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1'
    ),
    replaysOnErrorSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || '1.0'
    ),

    // Additional SDK configuration
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SENTRY_DEBUG) {
        return null;
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            // Remove potential sensitive fields
            const { password, token, apiKey, credentials, ...safeData } = breadcrumb.data;
            return { ...breadcrumb, data: safeData };
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Ignore common non-critical errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      // Network errors that are expected
      'NetworkError',
      'Failed to fetch',
      // Cancelled requests
      'AbortError',
      'The operation was aborted',
      // User navigation
      'NavigationDuplicated',
    ],
  });

  console.log('✓ Sentry client initialized');
} else {
  console.log('ℹ Sentry client not initialized (NEXT_PUBLIC_SENTRY_DSN not set)');
}
