/**
 * AC Infinity Token Manager
 *
 * Handles automatic token acquisition and caching for AC Infinity API.
 * Supports multiple authentication methods in priority order:
 * 1. Manual token (AC_INFINITY_TOKEN env var)
 * 2. Cached token from database (controllers.cached_token column)
 * 3. Environment credentials (AC_INFINITY_EMAIL/PASSWORD)
 * 4. Database credentials (from registered AC Infinity controllers)
 *
 * Token lifecycle:
 * - Tokens last ~30 days but we cache for 24 hours to be safe
 * - Auto-refresh on expiration (code 1001 from API)
 * - Token cached in dedicated database columns (persists across serverless invocations)
 *
 * Database columns used:
 * - controllers.cached_token: The API token
 * - controllers.token_expires_at: Token expiration timestamp
 *
 * Usage:
 * const token = await getACInfinityToken();
 */

import { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from './server-encryption'

// ============================================
// Type Definitions
// ============================================

interface ACLoginResponse {
  code: number // 200 = success, 1001 = token expired, 1002 = wrong password
  msg: string
  data?: {
    appId?: string
    token?: string
    appEmail?: string
  }
}

interface ControllerRecord {
  id: string
  name: string
  credentials: string | Record<string, unknown>
  cached_token: string | null
  token_expires_at: string | null
}

interface DecryptedCredentials {
  email?: string
  password?: string
}

// ============================================
// Supabase Client
// ============================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase not configured')
  }

  return createClient(url, key)
}

// ============================================
// Database Token Cache
// ============================================

/**
 * Store token in database controller record (dedicated columns).
 */
async function cacheTokenInDatabase(
  controllerId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('controllers')
      .update({
        cached_token: token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', controllerId)

    if (error) {
      console.error('[AC Infinity Token] Failed to cache token in database:', error)
    } else {
      console.log('[AC Infinity Token] Token cached in database (24 hour TTL)')
    }
  } catch (error) {
    console.error('[AC Infinity Token] Error caching token:', error)
  }
}

/**
 * Clear cached token from database (for forced refresh).
 */
async function clearCachedTokenInDatabase(controllerId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()

    await supabase
      .from('controllers')
      .update({
        cached_token: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', controllerId)

    console.log('[AC Infinity Token] Cleared cached token from database')
  } catch (error) {
    console.error('[AC Infinity Token] Error clearing cached token:', error)
  }
}

// ============================================
// Database Credentials Lookup
// ============================================

/**
 * Get credentials and cached token from the first AC Infinity controller in the database.
 * Uses service role key to bypass RLS (server-side only).
 *
 * @returns Controller data with decrypted credentials or null if not found
 */
async function getControllerFromDatabase(): Promise<{
  controllerId: string
  controllerName: string
  email: string
  password: string
  cachedToken: string | null
  tokenExpiresAt: Date | null
} | null> {
  try {
    const supabase = getSupabaseAdmin()

    // First, log all controllers to debug
    const { data: allControllers, error: listError } = await supabase
      .from('controllers')
      .select('id, name, brand, credentials')
      .limit(10)

    console.log('[AC Infinity Token] All controllers in database:',
      allControllers?.map(c => ({ id: c.id, name: c.name, brand: c.brand, hasCredentials: !!c.credentials })) || 'none',
      listError ? `Error: ${listError.message}` : ''
    )

    // Get first AC Infinity controller with credentials
    const { data: controller, error } = await supabase
      .from('controllers')
      .select('id, name, credentials, cached_token, token_expires_at')
      .eq('brand', 'ac_infinity')
      .not('credentials', 'is', null)
      .limit(1)
      .single()

    console.log('[AC Infinity Token] Query result:',
      controller ? { id: controller.id, name: controller.name, hasCredentials: !!controller.credentials } : 'no match',
      error ? `Error: ${error.message} (${error.code})` : ''
    )

    if (error || !controller?.credentials) {
      if (error?.code !== 'PGRST116') {
        // PGRST116 = no rows returned (expected if no controllers)
        console.log('[AC Infinity Token] No AC Infinity controllers found in database')
      }
      return null
    }

    const record = controller as ControllerRecord

    // Decrypt credentials
    console.log('[AC Infinity Token] Attempting to decrypt credentials for controller:', record.name)

    let decrypted: DecryptedCredentials
    try {
      decrypted = decryptCredentials(record.credentials) as DecryptedCredentials
      console.log('[AC Infinity Token] Decryption result:', {
        hasEmail: !!decrypted?.email,
        hasPassword: !!decrypted?.password,
        emailLength: decrypted?.email?.length || 0,
      })
    } catch (decryptError) {
      console.error('[AC Infinity Token] Credential decryption failed:', decryptError)
      return null
    }

    if (!decrypted.email || !decrypted.password) {
      console.log('[AC Infinity Token] Controller credentials incomplete - email:', !!decrypted.email, 'password:', !!decrypted.password)
      return null
    }

    console.log(`[AC Infinity Token] Using credentials from controller: ${record.name}, email: ${decrypted.email}`)

    return {
      controllerId: record.id,
      controllerName: record.name,
      email: decrypted.email,
      password: decrypted.password,
      cachedToken: record.cached_token,
      tokenExpiresAt: record.token_expires_at ? new Date(record.token_expires_at) : null,
    }
  } catch (error) {
    console.error('[AC Infinity Token] Failed to get credentials from database:', error)
    return null
  }
}

// ============================================
// AC Infinity Login
// ============================================

/**
 * Login to AC Infinity API and get authentication token.
 *
 * @param email - AC Infinity account email
 * @param password - AC Infinity account password
 * @returns Authentication token (appId)
 * @throws Error if login fails
 */
async function loginToACInfinity(email: string, password: string): Promise<string> {
  const startTime = Date.now()

  try {
    // Build form-urlencoded body
    // Note: Field names are case-sensitive!
    // - appEmail (lowercase 'a', not AppEmail)
    // - appPasswordl (lowercase 'a' and 'l' suffix - not a typo!)
    const formData = new URLSearchParams()
    formData.append('appEmail', email)
    formData.append('appPasswordl', password)

    // Use official AC Infinity API server
    // Note: Uses HTTP (not HTTPS) - AC Infinity's API has no SSL cert
    const response = await fetch('http://www.acinfinityserver.com/api/user/appUserLogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'ACController/1.8.2 (com.acinfinity.humiture; build:489; iOS 16.5.1) Alamofire/5.4.4',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`AC Infinity login HTTP error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as ACLoginResponse

    // Check API response code
    if (data.code !== 200) {
      // Provide user-friendly error messages
      let errorMessage = data.msg || 'Login failed'

      if (data.code === 1002 || data.msg?.toLowerCase().includes('password')) {
        errorMessage = 'Invalid email or password. Please check your AC Infinity account credentials.'
      } else if (data.code === 1001 || data.msg?.toLowerCase().includes('email')) {
        errorMessage = 'Email not found. Please check your AC Infinity account email.'
      } else if (data.msg?.toLowerCase().includes('network')) {
        errorMessage = 'Network error connecting to AC Infinity servers. Please try again.'
      }

      throw new Error(errorMessage)
    }

    // Extract token from response
    // Token can be in data.appId or data.token
    const token = data.data?.appId || data.data?.token

    if (!token) {
      throw new Error('Login succeeded but server did not return authentication token')
    }

    const elapsed = Date.now() - startTime
    console.log(`[AC Infinity Token] Successfully logged in (${elapsed}ms)`)

    return token
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[AC Infinity Token] Login failed after ${elapsed}ms:`, error)
    throw error
  }
}

// ============================================
// Public API
// ============================================

// Track current controller ID for cache operations
let currentControllerId: string | null = null

/**
 * Get AC Infinity authentication token.
 *
 * Priority order:
 * 1. AC_INFINITY_TOKEN env var (manual token)
 * 2. Cached token from database (controllers.cached_token)
 * 3. Auto-login with AC_INFINITY_EMAIL/PASSWORD env vars
 * 4. Auto-login with credentials from database (registered controllers)
 *
 * Token is cached in database for 24 hours to minimize API calls
 * and persist across serverless function invocations.
 *
 * @returns Authentication token
 * @throws Error if no token/credentials available or login fails
 */
export async function getACInfinityToken(): Promise<string> {
  // Option 1: Check for manual token in env var (backward compatible)
  const manualToken = process.env.AC_INFINITY_TOKEN
  if (manualToken) {
    console.log('[AC Infinity Token] Using manual token from AC_INFINITY_TOKEN env var, length:', manualToken.length)
    return manualToken
  }
  console.log('[AC Infinity Token] No AC_INFINITY_TOKEN env var, checking other sources...')

  // Option 2 & 3 & 4: Try env credentials first, then database
  let email = process.env.AC_INFINITY_EMAIL
  let password = process.env.AC_INFINITY_PASSWORD
  let controllerId: string | null = null
  let cachedToken: string | null = null
  let tokenExpiresAt: Date | null = null

  // If no env credentials, get from database
  if (!email || !password) {
    console.log('[AC Infinity Token] No env credentials, checking database...')
    const dbController = await getControllerFromDatabase()

    if (dbController) {
      email = dbController.email
      password = dbController.password
      controllerId = dbController.controllerId
      cachedToken = dbController.cachedToken
      tokenExpiresAt = dbController.tokenExpiresAt
      currentControllerId = controllerId
    }
  }

  // Check if we have a valid cached token
  if (cachedToken && tokenExpiresAt) {
    const now = new Date()
    const bufferMs = 5 * 60 * 1000 // 5 minute buffer

    if (tokenExpiresAt.getTime() - now.getTime() > bufferMs) {
      const ttl = Math.round((tokenExpiresAt.getTime() - now.getTime()) / 1000 / 60)
      console.log(`[AC Infinity Token] Using cached token from database (expires in ${ttl} min)`)
      return cachedToken
    } else {
      console.log('[AC Infinity Token] Cached token expired or expiring soon, refreshing...')
    }
  }

  if (!email || !password) {
    throw new Error(
      'AC Infinity authentication not configured. ' +
        'Either add an AC Infinity controller in the app, or set AC_INFINITY_TOKEN or ' +
        'AC_INFINITY_EMAIL/PASSWORD environment variables.'
    )
  }

  console.log(`[AC Infinity Token] Logging in with email: ${email}, password length: ${password.length}`)

  // Login and get token
  const token = await loginToACInfinity(email, password)

  console.log(`[AC Infinity Token] Login successful, got token length: ${token.length}, first 8 chars: ${token.substring(0, 8)}...`)

  // Cache for 24 hours in database (if we have a controller ID)
  if (controllerId) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await cacheTokenInDatabase(controllerId, token, expiresAt)
  }

  return token
}

/**
 * Handle token expiration error from AC Infinity API.
 *
 * If API returns code 1001 (token expired), clear cache and try to get new token.
 * This function can be called from API routes when they detect expired token.
 *
 * @param apiResponse - Response from AC Infinity API
 * @returns New token if refresh successful, null if not expired
 * @throws Error if refresh fails
 */
export async function handleTokenExpiration(apiResponse: {
  code: number
  msg?: string
}): Promise<string | null> {
  // Check if token expired (code 1001)
  if (apiResponse.code !== 1001) {
    return null
  }

  console.log('[AC Infinity Token] Token expired (code 1001), refreshing...')

  // Clear cached token in database
  if (currentControllerId) {
    await clearCachedTokenInDatabase(currentControllerId)
  }

  // Get new token (will auto-login if credentials available)
  return await getACInfinityToken()
}

/**
 * Clear the cached token (useful for testing or forced refresh).
 * Clears from database if controller ID is known.
 */
export async function clearTokenCache(): Promise<void> {
  if (currentControllerId) {
    await clearCachedTokenInDatabase(currentControllerId)
  }
  currentControllerId = null
}
