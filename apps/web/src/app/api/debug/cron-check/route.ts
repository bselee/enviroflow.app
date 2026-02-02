/**
 * Debug endpoint to check cron configuration
 *
 * GET /api/debug/cron-check
 *
 * Returns info about CRON_SECRET configuration (without exposing the secret)
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET

  // Collect all headers
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
      headers[key] = value ? `${value.substring(0, 15)}...(${value.length} chars)` : 'null'
    } else {
      headers[key] = value.substring(0, 100)
    }
  })

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    cronSecretConfigured: !!cronSecret,
    cronSecretLength: cronSecret?.length || 0,
    cronSecretPrefix: cronSecret ? cronSecret.substring(0, 4) + '...' : 'NOT SET',
    headersReceived: headers,
    authHeaderPresent: !!request.headers.get('authorization'),
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    nodeEnv: process.env.NODE_ENV || 'unknown',
  })
}
