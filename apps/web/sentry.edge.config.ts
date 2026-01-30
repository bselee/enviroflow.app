/**
 * Sentry Edge Runtime Configuration
 *
 * This file configures Sentry error tracking for Edge Runtime (middleware, edge functions).
 * It will only initialize Sentry if SENTRY_DSN is set in environment variables.
 *
 * Setup Instructions:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new Next.js project in Sentry
 * 3. Copy the DSN from the project settings
 * 4. Add to .env.local (server-side only):
 *    SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
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

    // Environment name
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        const { authorization, cookie, ...safeHeaders } = event.request.headers;
        event.request.headers = safeHeaders;
      }

      return event;
    },
  });

  console.log('✓ Sentry edge initialized');
} else {
  console.log('ℹ Sentry edge not initialized (SENTRY_DSN not set)');
}
