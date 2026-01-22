/**
 * Controller API Routes
 *
 * GET    /api/controllers         - List user's controllers
 * POST   /api/controllers         - Add new controller
 * GET    /api/controllers/brands  - List supported brands
 *
 * SECURITY NOTES:
 * - Credentials are encrypted using AES-256-GCM before database storage
 * - Credentials are NEVER returned in GET responses
 * - The ENCRYPTION_KEY environment variable must be set (64 hex chars / 32 bytes)
 * - Generate encryption key with: openssl rand -hex 32
 *
 * Note: TypeScript errors about 'never' types occur because Supabase
 * doesn't have generated types for these tables yet. Run migrations first,
 * then regenerate types with: npx supabase gen types typescript
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  encryptCredentials,
  EncryptionError,
} from '@/lib/server-encryption'

// Import adapter factory and types from automation-engine workspace package
import {
  getAdapter,
  getSupportedBrands,
  isBrandSupported,
  type ControllerBrand,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type ConnectionResult,
  type ControllerCapabilities,
} from '@enviroflow/automation-engine/adapters'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// Lazy initialization of Supabase client
let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !key) {
      throw new Error('Supabase credentials not configured')
    }
    
    supabase = createClient(url, key)
  }
  return supabase
}

/**
 * Build credentials object with proper type discriminator for adapter factory.
 * The adapter factory uses a discriminated union based on the 'type' field.
 *
 * @param brand - Controller brand identifier
 * @param credentials - Raw credentials from request body
 * @returns Properly typed credentials for the adapter
 */
function buildAdapterCredentials(
  brand: ControllerBrand,
  credentials: { email?: string; password?: string }
): ACInfinityCredentials | InkbirdCredentials | CSVUploadCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: credentials.email || '',
        password: credentials.password || '',
      } satisfies ACInfinityCredentials

    case 'inkbird':
      return {
        type: 'inkbird',
        email: credentials.email || '',
        password: credentials.password || '',
      } satisfies InkbirdCredentials

    case 'csv_upload':
      return {
        type: 'csv_upload',
      } satisfies CSVUploadCredentials

    default:
      // For unsupported brands, throw early with descriptive error
      throw new Error(`Cannot build credentials for unsupported brand: ${brand}`)
  }
}

// Get supported brands from the adapter factory (single source of truth)
const SUPPORTED_BRANDS = getSupportedBrands()

/**
 * GET /api/controllers
 * List all controllers for the authenticated user
 *
 * SECURITY: Credentials are intentionally excluded from the select query.
 * They are encrypted in the database and should never be sent to the client.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()

    // Get user from auth header - Bearer token authentication only
    // SECURITY: x-user-id header bypass has been removed for production security
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide a valid Authorization Bearer token.' },
        { status: 401 }
      )
    }
    
    // Fetch controllers
    const { data, error } = await supabase
      .from('controllers')
      .select(`
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
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch controllers', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      controllers: data || [],
      count: data?.length || 0
    })
    
  } catch (error) {
    console.error('Controllers GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/controllers
 * Add a new controller
 *
 * SECURITY NOTES:
 * - Credentials are encrypted using AES-256-GCM before storage
 * - Requires ENCRYPTION_KEY environment variable
 * - Credentials are never returned in the response
 *
 * Body: {
 *   brand: 'ac_infinity' | 'inkbird' | 'csv_upload',
 *   name: string,
 *   credentials: { email, password } | {},
 *   room_id?: string,
 *   discoveredDevice?: DiscoveredDevice  // Pre-validated device from discovery
 * }
 *
 * When discoveredDevice is provided, the connection test is skipped and
 * device metadata is used directly from the discovered device info.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()

    // Get user - Bearer token authentication only
    // SECURITY: x-user-id header bypass has been removed for production security
    const authHeader = request.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse body
    const body = await request.json()
    const { brand, name, credentials, room_id, discoveredDevice } = body

    console.log('[Controllers POST] Request received:', {
      brand,
      name,
      hasCredentials: !!credentials,
      room_id,
      hasDiscoveredDevice: !!discoveredDevice,
      discoveredDeviceId: discoveredDevice?.deviceId
    })
    
    // Validate brand
    const brandInfo = SUPPORTED_BRANDS.find(b => b.id === brand)
    if (!brandInfo) {
      return NextResponse.json(
        { error: `Unsupported brand: ${brand}` },
        { status: 400 }
      )
    }
    
    if (brandInfo.status === 'coming_soon') {
      return NextResponse.json(
        { error: `${brandInfo.name} support is coming soon. Use CSV Upload as a fallback.` },
        { status: 400 }
      )
    }
    
    // Validate name
    if (!name || typeof name !== 'string' || name.length < 1) {
      return NextResponse.json(
        { error: 'Controller name is required' },
        { status: 400 }
      )
    }
    
    // Sanitize name (prevent XSS, limit length)
    const sanitizedName = name.trim().slice(0, 100)

    // Connection testing and metadata extraction via adapter factory
    let controllerId: string
    let capabilities: ControllerCapabilities | Record<string, unknown> = {}
    let model: string | undefined
    let firmwareVersion: string | undefined
    let connectionResult: ConnectionResult | null = null

    if (brand === 'ac_infinity' || brand === 'inkbird') {
      // Validate required credentials for cloud-connected controllers
      if (!credentials?.email || !credentials?.password) {
        return NextResponse.json(
          { error: 'Email and password are required for this controller type' },
          { status: 400 }
        )
      }

      // Validate email format (basic check)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(credentials.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }

      // If discoveredDevice is provided, skip connection test - device was already validated during discovery
      if (discoveredDevice && discoveredDevice.deviceId) {
        console.log(`[Controllers POST] Using pre-validated discovered device:`, {
          name: discoveredDevice.name,
          deviceId: discoveredDevice.deviceId,
          brand: discoveredDevice.brand,
          hasCapabilities: !!discoveredDevice.capabilities
        })

        // Use device metadata from discovery
        controllerId = discoveredDevice.deviceId
        model = discoveredDevice.model || undefined
        firmwareVersion = discoveredDevice.firmwareVersion || undefined

        // Use capabilities from discovered device if available, otherwise fall back to brand defaults
        // Note: Discovered device has simplified capabilities (string arrays)
        // We store them as-is since the database capabilities column accepts JSON
        if (discoveredDevice.capabilities) {
          capabilities = {
            sensors: discoveredDevice.capabilities.sensors || [],
            devices: discoveredDevice.capabilities.devices || [],
            supportsDimming: discoveredDevice.capabilities.supportsDimming || false,
            supportsScheduling: true,
            maxPorts: 4
          }
        } else {
          capabilities = brandInfo.capabilities || {}
        }
      } else {
        // No discovered device - perform connection test via adapter
        try {
          // Get the appropriate adapter for this brand
          const adapter = getAdapter(brand as ControllerBrand)

          // Build properly typed credentials for the adapter
          const adapterCredentials = buildAdapterCredentials(
            brand as ControllerBrand,
            credentials
          )

          // Test connection via the adapter - this validates credentials
          // and retrieves controller metadata from the cloud API
          connectionResult = await adapter.connect(adapterCredentials)

          if (!connectionResult.success) {
            // Connection failed - return appropriate error
            // Common reasons: invalid credentials, no devices found, API unavailable
            console.warn(`[Controllers POST] Connection failed for ${brand}:`, connectionResult.error)

            return NextResponse.json(
              {
                error: 'Connection failed',
                message: connectionResult.error || 'Unable to connect to controller. Please verify your credentials.',
                brand: brand,
              },
              { status: 400 }
            )
          }

          // Connection successful - extract metadata from the adapter response
          controllerId = connectionResult.controllerId
          capabilities = connectionResult.metadata.capabilities
          model = connectionResult.metadata.model
          firmwareVersion = connectionResult.metadata.firmwareVersion

          // Disconnect after successful test (we'll reconnect when needed for operations)
          // This prevents holding connections open unnecessarily
          await adapter.disconnect(controllerId)

        } catch (adapterError) {
          // Handle adapter-level errors (unsupported brand, network issues, etc.)
          console.error(`[Controllers POST] Adapter error for ${brand}:`, adapterError)

          const errorMessage = adapterError instanceof Error
            ? adapterError.message
            : 'An unexpected error occurred while connecting to the controller'

          // Determine appropriate status code based on error type
          const isNetworkError = errorMessage.includes('fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('ECONNREFUSED')

          return NextResponse.json(
            {
              error: isNetworkError ? 'Connection error' : 'Controller error',
              message: errorMessage,
              brand: brand,
            },
            { status: isNetworkError ? 503 : 500 }
          )
        }
      }

    } else if (brand === 'csv_upload') {
      // CSV upload doesn't require connection testing
      // Create adapter to generate a valid controller ID
      try {
        const adapter = getAdapter('csv_upload')
        const csvCredentials: CSVUploadCredentials = { type: 'csv_upload' }
        connectionResult = await adapter.connect(csvCredentials)

        controllerId = connectionResult.controllerId
        capabilities = connectionResult.metadata.capabilities
        model = 'Manual CSV Data'

      } catch (csvError) {
        // Fallback to generated ID if adapter fails
        console.warn('[Controllers POST] CSV adapter fallback:', csvError)
        controllerId = `csv_${Date.now()}_${Math.random().toString(36).substring(7)}`
        capabilities = brandInfo.capabilities || {}
        model = 'Manual CSV Data'
      }

    } else {
      // This shouldn't happen due to brand validation above, but handle gracefully
      return NextResponse.json(
        { error: 'Unsupported brand' },
        { status: 400 }
      )
    }
    
    // Encrypt credentials before storage
    // SECURITY: Never store plain-text credentials in the database
    let encryptedCredentials: string | null = null
    if (credentials && Object.keys(credentials).length > 0) {
      try {
        encryptedCredentials = encryptCredentials({
          type: brand,
          ...credentials,
        })
      } catch (error) {
        if (error instanceof EncryptionError) {
          console.error('[Controllers POST] Encryption configuration error')
          return NextResponse.json(
            {
              error: 'Server configuration error',
              message: 'Credential encryption is not properly configured. Contact administrator.',
            },
            { status: 500 }
          )
        }
        throw error
      }
    }

    // Insert into database with encrypted credentials
    console.log('[Controllers POST] Inserting controller:', {
      user_id: userId,
      brand,
      controller_id: controllerId,
      name: sanitizedName,
      hasCredentials: !!encryptedCredentials,
      capabilities: JSON.stringify(capabilities).slice(0, 200),
      model,
      firmware_version: firmwareVersion,
      room_id: room_id || null
    })

    const { data, error } = await supabase
      .from('controllers')
      .insert({
        user_id: userId,
        brand,
        controller_id: controllerId,
        name: sanitizedName,
        credentials: encryptedCredentials || JSON.stringify({ type: brand }),
        capabilities,
        model,
        firmware_version: firmwareVersion,
        is_online: brand !== 'csv_upload', // CSV is "offline" until data uploaded
        last_seen: new Date().toISOString(),
        room_id: room_id || null
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database insert error:', error)
      
      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          { error: 'A controller with this ID already exists' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to save controller', details: error.message },
        { status: 500 }
      )
    }
    
    // Remove credentials from response - never expose encrypted data to client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credentials: _, ...safeController } = data

    return NextResponse.json({
      controller: safeController,
      message: `${brandInfo.name} controller added successfully`,
      connectionVerified: brand !== 'csv_upload',
    }, { status: 201 })
    
  } catch (error) {
    console.error('Controllers POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
