/**
 * AC Infinity Authentication API Route
 *
 * POST /api/ac-infinity/auth - Get authentication token from AC Infinity
 *
 * Purpose:
 * Provides a way to manually obtain AC Infinity tokens for testing or troubleshooting.
 * In production, tokens are automatically managed by the token manager.
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "token": "abc123...",
 *   "expiresIn": "~30 days"
 * }
 *
 * Error response:
 * {
 *   "success": false,
 *   "error": "Invalid email or password"
 * }
 *
 * Security notes:
 * - This endpoint does NOT require authentication (for initial setup)
 * - Credentials are NOT stored, only used to get token
 * - Rate limiting should be implemented in production (Vercel provides this)
 */

import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// Type Definitions
// ============================================

interface AuthRequest {
  email: string
  password: string
}

interface AuthSuccessResponse {
  success: true
  token: string
  expiresIn: string
  message: string
}

interface AuthErrorResponse {
  success: false
  error: string
}

type AuthResponse = AuthSuccessResponse | AuthErrorResponse

interface ACLoginResponse {
  code: number
  msg: string
  data?: {
    appId?: string
    token?: string
    appEmail?: string
  }
}

// ============================================
// POST /api/ac-infinity/auth
// ============================================

/**
 * Authenticate with AC Infinity and get token.
 *
 * @param request - Contains email and password in body
 * @returns Authentication token or error
 */
export async function POST(request: NextRequest): Promise<NextResponse<AuthResponse>> {
  const startTime = Date.now()

  try {
    // Parse request body
    let body: unknown
    try {
      body = await request.json()
    } catch (parseError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        } satisfies AuthErrorResponse,
        { status: 400 }
      )
    }

    // Validate request body
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Request body must be a JSON object',
        } satisfies AuthErrorResponse,
        { status: 400 }
      )
    }

    const { email, password } = body as Partial<AuthRequest>

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Valid email address is required',
        } satisfies AuthErrorResponse,
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password is required',
        } satisfies AuthErrorResponse,
        { status: 400 }
      )
    }

    // Build form-urlencoded body
    // Note: Field names are case-sensitive!
    // - appEmail (lowercase 'a', not AppEmail)
    // - appPasswordl (lowercase 'a' and 'l' suffix - not a typo!)
    const formData = new URLSearchParams()
    formData.append('appEmail', email)
    formData.append('appPasswordl', password)

    // Call AC Infinity login API
    console.log(`[AC Infinity Auth] Attempting login for: ${email}`)

    const response = await fetch('http://www.acinfinityserver.com/api/user/appUserLogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
      },
      body: formData.toString(),
    })

    // Handle HTTP errors
    if (!response.ok) {
      console.error(`[AC Infinity Auth] HTTP error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        {
          success: false,
          error: `AC Infinity API HTTP error: ${response.status} ${response.statusText}`,
        } satisfies AuthErrorResponse,
        { status: 502 }
      )
    }

    // Parse response
    const data = (await response.json()) as ACLoginResponse

    // Check API response code
    if (data.code !== 200) {
      console.error(`[AC Infinity Auth] Login failed: code=${data.code}, msg=${data.msg}`)

      // Provide user-friendly error messages
      let errorMessage = data.msg || 'Login failed'

      if (data.code === 1002 || data.msg?.toLowerCase().includes('password')) {
        errorMessage = 'Invalid email or password. Please check your AC Infinity account credentials.'
      } else if (data.code === 1001 || data.msg?.toLowerCase().includes('email')) {
        errorMessage = 'Email not found. Please check your AC Infinity account email.'
      } else if (data.msg?.toLowerCase().includes('network')) {
        errorMessage = 'Network error connecting to AC Infinity servers. Please try again.'
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        } satisfies AuthErrorResponse,
        { status: 401 }
      )
    }

    // Extract token from response
    const token = data.data?.appId || data.data?.token

    if (!token) {
      console.error('[AC Infinity Auth] No token in successful response:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'Login succeeded but server did not return authentication token',
        } satisfies AuthErrorResponse,
        { status: 502 }
      )
    }

    const elapsed = Date.now() - startTime
    console.log(`[AC Infinity Auth] Login successful for ${email} (${elapsed}ms)`)

    // Return token
    return NextResponse.json(
      {
        success: true,
        token,
        expiresIn: '~30 days',
        message: 'Successfully authenticated with AC Infinity',
      } satisfies AuthSuccessResponse,
      {
        status: 200,
        headers: {
          'X-Response-Time': `${elapsed}ms`,
        },
      }
    )
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error('[AC Infinity Auth] Unexpected error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      } satisfies AuthErrorResponse,
      {
        status: 500,
        headers: {
          'X-Response-Time': `${elapsed}ms`,
        },
      }
    )
  }
}
