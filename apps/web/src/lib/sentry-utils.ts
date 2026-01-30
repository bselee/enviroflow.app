/**
 * Sentry Utility Functions
 *
 * Helper functions for working with Sentry error tracking.
 * These utilities provide a consistent way to capture errors and add context.
 *
 * Usage Examples:
 *
 * 1. Capture an error with context:
 *    ```typescript
 *    import { captureError } from '@/lib/sentry-utils';
 *
 *    try {
 *      await fetchData();
 *    } catch (error) {
 *      captureError(error, {
 *        tags: { section: 'automation' },
 *        extra: { controllerId: '123' }
 *      });
 *    }
 *    ```
 *
 * 2. Set user context:
 *    ```typescript
 *    import { setUserContext } from '@/lib/sentry-utils';
 *
 *    setUserContext({ id: user.id, email: user.email });
 *    ```
 *
 * 3. Add breadcrumb for debugging:
 *    ```typescript
 *    import { addBreadcrumb } from '@/lib/sentry-utils';
 *
 *    addBreadcrumb({
 *      message: 'User clicked connect button',
 *      category: 'user-action',
 *      level: 'info',
 *      data: { controllerId: '123' }
 *    });
 *    ```
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Check if Sentry is initialized and available
 */
export function isSentryEnabled(): boolean {
  return !!Sentry.getCurrentHub().getClient();
}

/**
 * Capture an error with optional context
 */
export function captureError(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string | number | boolean>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
    fingerprint?: string[];
  }
): void {
  if (!isSentryEnabled()) {
    // Fallback to console.error if Sentry is not configured
    console.error('Error captured (Sentry not enabled):', error, context);
    return;
  }

  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level || 'error',
    fingerprint: context?.fingerprint,
  });
}

/**
 * Capture a message (not an error)
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string | number | boolean>;
    extra?: Record<string, any>;
  }
): void {
  if (!isSentryEnabled()) {
    console.log('Message captured (Sentry not enabled):', message, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: {
  id?: string;
  email?: string;
  username?: string;
} | null): void {
  if (!isSentryEnabled()) {
    return;
  }

  if (user === null) {
    Sentry.setUser(null);
  } else {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }
}

/**
 * Add a breadcrumb for debugging context
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category || 'custom',
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set a custom tag for filtering errors
 */
export function setTag(key: string, value: string | number | boolean): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.setTag(key, value);
}

/**
 * Set multiple tags at once
 */
export function setTags(tags: Record<string, string | number | boolean>): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.setTags(tags);
}

/**
 * Set custom context for additional debugging info
 */
export function setContext(name: string, context: Record<string, any>): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.setContext(name, context);
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Transaction | undefined {
  if (!isSentryEnabled()) {
    return undefined;
  }

  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: {
    tags?: Record<string, string | number | boolean>;
    extra?: Record<string, any>;
  }
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, context);
      throw error; // Re-throw to allow normal error handling
    }
  }) as T;
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUserContext(): void {
  setUserContext(null);
}
