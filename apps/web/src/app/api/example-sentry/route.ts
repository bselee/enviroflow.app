/**
 * Example API Route - Sentry Integration
 *
 * This example demonstrates how to use Sentry in API routes.
 * DELETE THIS FILE after reviewing the integration pattern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { captureError, addBreadcrumb, setTag } from '@/lib/sentry-utils';

export async function GET(request: NextRequest) {
  try {
    // Add breadcrumb for debugging context
    addBreadcrumb({
      message: 'Example API called',
      category: 'api',
      level: 'info',
      data: {
        url: request.url,
        method: request.method,
      },
    });

    // Set tag for filtering in Sentry
    setTag('api_route', '/api/example-sentry');

    // Example: Simulate an error
    const testError = request.nextUrl.searchParams.get('test_error');
    if (testError === 'true') {
      throw new Error('This is a test error for Sentry');
    }

    return NextResponse.json({
      success: true,
      message: 'Sentry is configured correctly',
      sentryEnabled: process.env.SENTRY_DSN ? true : false,
    });
  } catch (error) {
    // Capture error with context
    captureError(error, {
      tags: {
        api_route: '/api/example-sentry',
        error_type: 'api_error',
      },
      extra: {
        url: request.url,
        method: request.method,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
