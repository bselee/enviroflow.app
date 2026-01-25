/**
 * Example API Route with Error Classification and Logging
 *
 * This is a reference implementation showing how to use the error
 * classification and logging system in API routes.
 *
 * DELETE THIS FILE - it's for documentation purposes only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { classifyAndLogError } from '@/lib/error-classifier';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const client = createServerClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get user for logging
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { controllerId, brand } = body;

    // Simulate some operation that might fail
    // In real code, this would be an adapter call, API request, etc.
    try {
      // ... your actual operation here
      throw new Error('Controller is offline');
    } catch (error: unknown) {
      // Classify and log the error
      const errorContext = await classifyAndLogError(error as Error | string, {
        brand: brand || 'ac_infinity',
        context: 'connection',
        controllerId,
        userId: user.id,
        metadata: {
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          attemptNumber: 1,
        },
      });

      // Return structured error response
      return NextResponse.json(
        {
          success: false,
          error: errorContext.originalError instanceof Error
            ? errorContext.originalError.message
            : String(errorContext.originalError),
          errorType: errorContext.type,
          retryable: errorContext.retryable,
          retryAfter: errorContext.retryable ? getRetryDelay(errorContext.type) : undefined,
        },
        { status: errorContext.statusCode || 500 }
      );
    }

    // Success response
    return NextResponse.json({
      success: true,
      data: { /* your data */ },
    });
  } catch (error) {
    // Top-level error handler
    console.error('Unhandled error in API route:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

// Helper to get retry delay (you can also import this from error-classifier)
function getRetryDelay(errorType: string): number {
  switch (errorType) {
    case 'network': return 5;
    case 'offline': return 30;
    case 'rate_limit': return 60;
    case 'server': return 30;
    default: return 10;
  }
}
