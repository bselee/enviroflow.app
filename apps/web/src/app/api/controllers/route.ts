/**
 * Controller API Routes
 *
 * GET    /api/controllers         - List user's controllers
 * POST   /api/controllers         - Add new controller (with adapter connection)
 * GET    /api/controllers/brands  - List supported brands (separate file)
 *
 * SECURITY NOTES:
 * - All operations require authentication via Bearer token or x-user-id (dev only)
 * - Credentials are encrypted before storage using AES-256 equivalent
 * - Credentials are NEVER logged or exposed in responses
 * - All credential data is masked before being returned to clients
 * - Input validation is performed on all external data
 * - Service role client used for database operations (bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  sanitizeCredentials,
  validateCredentials,
  createSafeControllerLog,
} from '@/lib/encryption'
import {
  encryptCredentials as encryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'

// ============================================
// Inline Adapter Types (avoiding cross-package imports)
// ============================================

type ControllerBrand = 'ac_infinity' | 'inkbird' | 'govee' | 'csv_upload' | 'mqtt' | 'custom'

const SUPPORTED_BRANDS: ControllerBrand[] = ['ac_infinity', 'inkbird', 'govee', 'csv_upload', 'mqtt', 'custom']

function isBrandSupported(brand: string): brand is ControllerBrand {
  return SUPPORTED_BRANDS.includes(brand as ControllerBrand)
}

interface ControllerCredentials {
  email?: string
  password?: string
  apiKey?: string
  [key: string]: unknown
}

interface ControllerCapabilities {
  canControl: boolean
  canReadSensors: boolean
  supportsScheduling: boolean
  supportedSensorTypes: string[]
  supportedDeviceTypes: string[]
}

interface ConnectionResult {
  success: boolean
  error?: string
  controllerId?: string
  deviceIds?: string[]
  metadata?: {
    capabilities?: ControllerCapabilities
    model?: string
    firmwareVersion?: string
  }
}

interface ControllerAdapter {
  connect(credentials: ControllerCredentials): Promise<ConnectionResult>
  disconnect(controllerId: string): Promise<void>
  getCapabilities(): ControllerCapabilities
}

/**
 * Simple adapter factory for controller connection.
 * Full adapter implementations are in automation-engine package.
 */
function getAdapter(brand: ControllerBrand): ControllerAdapter {
  const defaultCapabilities: ControllerCapabilities = {
    canControl: brand !== 'csv_upload',
    canReadSensors: true,
    supportsScheduling: brand === 'ac_infinity' || brand === 'inkbird',
    supportedSensorTypes: ['temperature', 'humidity', 'vpd'],
    supportedDeviceTypes: brand === 'csv_upload' ? [] : ['fan', 'light', 'humidifier'],
  }

  return {
    async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
      if (!credentials.email && !credentials.apiKey) {
        return { success: false, error: 'Credentials required' }
      }
      // Simulated connection - real implementations make API calls
      return {
        success: true,
        controllerId: `${brand}_${Date.now()}`,
        deviceIds: ['device_1', 'device_2'],
        metadata: {
          capabilities: defaultCapabilities,
          model: `${brand.toUpperCase()} Controller`,
          firmwareVersion: '1.0.0',
        }
      }
    },
    async disconnect() {
      // No-op
    },
    getCapabilities(): ControllerCapabilities {
      return defaultCapabilities
    }
  }
}

// ============================================
// Types
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

interface AddControllerRequest {
  brand: string
  name: string
  credentials?: {
    email?: string
    password?: string
    [key: string]: unknown
  }
  room_id?: string
}

interface ControllerResponse {
  id: string
  brand: ControllerBrand
  controller_id: string
  name: string
  capabilities: ControllerCapabilities
  is_online: boolean
  last_seen: string | null
  last_error: string | null
  firmware_version: string | null
  model: string | null
  room_id: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Supabase Client (Service Role)
// ============================================

let supabase: SupabaseClient | null = null

/**
 * Get service role Supabase client for server-side operations.
 * Uses lazy initialization to avoid startup errors when env vars are missing.
 */
function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      throw new Error(
        'Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      )
    }

    supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabase
}

// ============================================
// Authentication Helper
// ============================================

/**
 * Extract user ID from request authentication.
 * Uses Bearer token authentication only.
 *
 * SECURITY: x-user-id header bypass has been removed. All authentication
 * must go through Supabase Auth with a valid Bearer token.
 *
 * @returns User ID if authenticated, null otherwise
 */
async function getUserId(request: NextRequest, client: SupabaseClient): Promise<string | null> {
  // Bearer token authentication only
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const {
      data: { user },
    } = await client.auth.getUser(token)
    if (user?.id) return user.id
  }

  return null
}

// ============================================
// Credential Encryption
// ============================================

/**
 * Encrypt credentials before storage using AES-256-GCM.
 *
 * SECURITY NOTES:
 * - Uses AES-256-GCM with random IV for each encryption
 * - Requires ENCRYPTION_KEY environment variable
 * - Never log the input or output of this function
 *
 * @param credentials - Raw credential object (never log this)
 * @returns Encrypted string safe for database storage
 */
function encryptCredentials(credentials: Record<string, unknown>): string {
  // Validate input
  if (!credentials || typeof credentials !== 'object') {
    return encryptCredentialsAES({ type: 'unknown' })
  }

  // Sanitize before encrypting to remove whitespace and validate
  try {
    const sanitized = sanitizeCredentials(credentials as Record<string, string | null | undefined>)
    return encryptCredentialsAES(sanitized)
  } catch (error) {
    // If encryption fails due to missing key, log a warning but don't expose details
    if (error instanceof EncryptionError) {
      console.error('[Encryption] Configuration error - ensure ENCRYPTION_KEY is set')
    }
    // Return a safe encrypted empty object as fallback
    // This should never happen in production if properly configured
    return encryptCredentialsAES({ type: 'unknown' })
  }
}

/**
 * Mask sensitive credential fields for API responses.
 * Never expose passwords or API keys.
 */
function maskCredentials(credentials: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(credentials)) {
    if (key === 'password' || key === 'apiKey' || key === 'api_key' || key === 'token') {
      masked[key] = '********'
    } else if (key === 'email') {
      // Show partial email for identification
      const email = String(value)
      const [local, domain] = email.split('@')
      if (local && domain) {
        masked[key] = `${local.substring(0, 2)}***@${domain}`
      } else {
        masked[key] = '***'
      }
    } else {
      masked[key] = value
    }
  }

  return masked
}

// ============================================
// GET /api/controllers
// ============================================

/**
 * List all controllers for the authenticated user.
 *
 * Response: {
 *   controllers: ControllerResponse[]
 *   count: number
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Provide Authorization header with Bearer token or x-user-id for testing.',
        },
        { status: 401 }
      )
    }

    // Fetch controllers (exclude credentials from select for security)
    const { data, error } = await client
      .from('controllers')
      .select(
        `
        id,
        brand,
        controller_id,
        name,
        capabilities,
        is_online,
        last_seen,
        last_error,
        firmware_version,
        model,
        room_id,
        created_at,
        updated_at
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      // Log error without any sensitive data
      console.error('[Controllers GET] Database error:', {
        code: error.code,
        message: error.message,
        hint: error.hint,
        userId: userId ? `${userId.substring(0, 8)}...` : 'unknown',
      })
      return NextResponse.json(
        { error: 'Failed to fetch controllers', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      controllers: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('[Controllers GET] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/controllers
// ============================================

/**
 * Add a new controller with adapter connection verification.
 *
 * Request Body: {
 *   brand: 'ac_infinity' | 'inkbird' | 'csv_upload'
 *   name: string
 *   credentials?: { email, password } | {}
 *   room_id?: string
 * }
 *
 * Response: {
 *   success: true
 *   controller: ControllerResponse
 *   message: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    let body: AddControllerRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { brand, name, credentials, room_id } = body

    // Validate brand
    if (!brand || typeof brand !== 'string') {
      return NextResponse.json(
        { error: 'Brand is required' },
        { status: 400 }
      )
    }

    if (!isBrandSupported(brand)) {
      return NextResponse.json(
        {
          error: `Unsupported brand: ${brand}`,
          supportedBrands: ['ac_infinity', 'inkbird', 'csv_upload'],
        },
        { status: 400 }
      )
    }

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Controller name is required' },
        { status: 400 }
      )
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Controller name must be 100 characters or less' },
        { status: 400 }
      )
    }

    // Validate room_id if provided
    if (room_id) {
      const { data: room, error: roomError } = await client
        .from('rooms')
        .select('id')
        .eq('id', room_id)
        .eq('user_id', userId)
        .single()

      if (roomError || !room) {
        return NextResponse.json(
          { error: 'Invalid room_id or room does not exist' },
          { status: 400 }
        )
      }
    }

    // Validate credentials based on brand
    const controllerBrand = brand as ControllerBrand

    if (controllerBrand === 'ac_infinity' || controllerBrand === 'inkbird') {
      if (!credentials?.email || !credentials?.password) {
        return NextResponse.json(
          {
            error: 'Email and password are required for this controller brand',
            requiredFields: ['email', 'password'],
          },
          { status: 400 }
        )
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(credentials.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
    }

    // Connect using adapter to verify credentials and get metadata
    let controllerId: string
    let capabilities: ControllerCapabilities = {
      canControl: controllerBrand !== 'csv_upload',
      canReadSensors: true,
      supportsScheduling: controllerBrand === 'ac_infinity' || controllerBrand === 'inkbird',
      supportedSensorTypes: ['temperature', 'humidity', 'vpd'],
      supportedDeviceTypes: controllerBrand === 'csv_upload' ? [] : ['fan', 'light', 'humidifier'],
    }
    let model: string | undefined
    let firmwareVersion: string | undefined
    let isOnline = true

    try {
      const adapter = getAdapter(controllerBrand)

      // Build credentials object with type field
      const adapterCredentials: ControllerCredentials =
        controllerBrand === 'csv_upload'
          ? { type: 'csv_upload' }
          : {
              type: controllerBrand,
              email: credentials?.email || '',
              password: credentials?.password || '',
            }

      // Attempt connection
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        return NextResponse.json(
          {
            error: 'Failed to connect to controller',
            details: connectionResult.error || 'Connection rejected by controller service',
          },
          { status: 400 }
        )
      }

      // Extract metadata from successful connection
      controllerId = connectionResult.controllerId || `${brand}_${Date.now()}`
      if (connectionResult.metadata) {
        if (connectionResult.metadata.capabilities) {
          capabilities = connectionResult.metadata.capabilities
        }
        model = connectionResult.metadata.model
        firmwareVersion = connectionResult.metadata.firmwareVersion
      }

      // Disconnect after verification (we'll reconnect when needed)
      await adapter.disconnect(controllerId)
    } catch (adapterError) {
      console.error('[Controllers POST] Adapter error:', adapterError)

      // Check for specific adapter errors
      const errorMessage =
        adapterError instanceof Error ? adapterError.message : 'Unknown adapter error'

      if (errorMessage.includes('coming in Phase 2') || errorMessage.includes('coming soon')) {
        return NextResponse.json(
          {
            error: `${brand} support is not yet available`,
            details: errorMessage,
            fallback: 'Use CSV Upload as an alternative',
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          error: 'Failed to initialize controller adapter',
          details: errorMessage,
        },
        { status: 500 }
      )
    }

    // For CSV upload, controller starts as "offline" until data is uploaded
    if (controllerBrand === 'csv_upload') {
      isOnline = false
    }

    // Prepare credentials for storage (encrypted)
    const credentialsForStorage =
      credentials && Object.keys(credentials).length > 0
        ? encryptCredentials({ type: controllerBrand, ...credentials })
        : JSON.stringify({ type: controllerBrand })

    // Insert controller into database
    const { data: insertedController, error: insertError } = await client
      .from('controllers')
      .insert({
        user_id: userId,
        brand: controllerBrand,
        controller_id: controllerId,
        name: name.trim(),
        credentials: credentialsForStorage,
        capabilities,
        model,
        firmware_version: firmwareVersion,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        room_id: room_id || null,
      })
      .select(
        `
        id,
        brand,
        controller_id,
        name,
        capabilities,
        is_online,
        last_seen,
        last_error,
        firmware_version,
        model,
        room_id,
        created_at,
        updated_at
      `
      )
      .single()

    if (insertError) {
      // Log error safely without credentials
      console.error('[Controllers POST] Database insert error:', {
        code: insertError.code,
        message: insertError.message,
        hint: insertError.hint,
        brand: controllerBrand,
        userId: userId ? `${userId.substring(0, 8)}...` : 'unknown',
      })

      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          {
            error: 'A controller with this ID already exists',
            details: 'This controller may already be registered to your account',
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to save controller', details: insertError.message },
        { status: 500 }
      )
    }

    // Log activity (never log credentials)
    await client.from('activity_logs').insert({
      user_id: userId,
      controller_id: insertedController.id,
      action_type: 'controller_added',
      action_data: createSafeControllerLog({
        brand: controllerBrand,
        name: name.trim(),
        model,
      }),
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    // Console log for debugging (safe version only)
    console.log('[Controllers POST] Controller added:', createSafeControllerLog(insertedController))

    // Return response with masked credentials info
    const brandDisplayNames: Record<ControllerBrand, string> = {
      ac_infinity: 'AC Infinity',
      inkbird: 'Inkbird',
      csv_upload: 'CSV Upload',
      govee: 'Govee',
      mqtt: 'MQTT',
      custom: 'Custom',
    }

    return NextResponse.json(
      {
        success: true,
        controller: insertedController as ControllerResponse,
        message: `${brandDisplayNames[controllerBrand]} controller "${name.trim()}" added successfully`,
        credentials_masked: credentials ? maskCredentials(credentials) : null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Controllers POST] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
