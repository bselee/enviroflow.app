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
 * Convert simplified capabilities (from discovery) to proper ControllerCapabilities format.
 *
 * Discovery returns simplified capabilities like: { sensors: ["temperature", "humidity"], devices: ["fan"] }
 * Database expects full objects like: { sensors: [{port: 0, type: "temperature", unit: "F"}], ... }
 *
 * @param simplified - Simplified capabilities from discovered device
 * @param brand - Controller brand for defaults
 * @returns Properly structured ControllerCapabilities
 */
function buildCapabilitiesFromDiscovered(
  simplified: { sensors?: string[]; devices?: string[]; supportsDimming?: boolean } | undefined,
  brand: ControllerBrand
): ControllerCapabilities {
  // Valid sensor types from SensorType union
  type ValidSensorType = 'temperature' | 'humidity' | 'vpd' | 'co2' | 'light' | 'ph' | 'ec' | 'soil_moisture' | 'pressure'
  const validSensorTypes = new Set<string>(['temperature', 'humidity', 'vpd', 'co2', 'light', 'ph', 'ec', 'soil_moisture', 'pressure'])

  // Default sensor unit mappings
  const sensorUnits: Record<string, string> = {
    temperature: '°F',
    humidity: '%',
    vpd: 'kPa',
    co2: 'ppm',
    pressure: 'hPa',
    light: 'lux',
    ph: 'pH',
    ec: 'μS/cm',
    soil_moisture: '%',
  }

  // Valid device types from DeviceType union
  type ValidDeviceType = 'fan' | 'light' | 'heater' | 'cooler' | 'humidifier' | 'dehumidifier' | 'outlet' | 'pump' | 'valve'
  const validDeviceTypes = new Set<string>(['fan', 'light', 'heater', 'cooler', 'humidifier', 'dehumidifier', 'outlet', 'pump', 'valve'])

  // Default device info
  const deviceDefaults: Record<string, { supportsDimming: boolean; minLevel: number; maxLevel: number }> = {
    fan: { supportsDimming: true, minLevel: 0, maxLevel: 10 },
    light: { supportsDimming: true, minLevel: 0, maxLevel: 10 },
    heater: { supportsDimming: false, minLevel: 0, maxLevel: 1 },
    cooler: { supportsDimming: true, minLevel: 0, maxLevel: 10 },
    humidifier: { supportsDimming: false, minLevel: 0, maxLevel: 1 },
    dehumidifier: { supportsDimming: false, minLevel: 0, maxLevel: 1 },
    outlet: { supportsDimming: false, minLevel: 0, maxLevel: 1 },
    pump: { supportsDimming: false, minLevel: 0, maxLevel: 1 },
    valve: { supportsDimming: false, minLevel: 0, maxLevel: 1 },
  }

  // Build sensors array from simplified types (filter to valid types only)
  const sensors = (simplified?.sensors || [])
    .filter(sensorType => validSensorTypes.has(sensorType))
    .map((sensorType, index) => ({
      port: index,
      type: sensorType as ValidSensorType,
      unit: sensorUnits[sensorType] || '',
      name: sensorType.charAt(0).toUpperCase() + sensorType.slice(1).replace('_', ' '),
    }))

  // Build devices array from simplified types (filter to valid types only)
  const devices = (simplified?.devices || [])
    .filter(deviceType => validDeviceTypes.has(deviceType))
    .map((deviceType, index) => {
      const defaults = deviceDefaults[deviceType] || { supportsDimming: false, minLevel: 0, maxLevel: 1 }
      return {
        port: index + 1,
        type: deviceType as ValidDeviceType,
        name: deviceType.charAt(0).toUpperCase() + deviceType.slice(1).replace('_', ' '),
        supportsDimming: defaults.supportsDimming,
        minLevel: defaults.minLevel,
        maxLevel: defaults.maxLevel,
      }
    })

  // Check if any device supports dimming
  const supportsDimming = simplified?.supportsDimming || devices.some(d => d.supportsDimming)

  // Brand-specific defaults
  const maxPorts = brand === 'ac_infinity' ? 4 : brand === 'inkbird' ? 2 : 4

  return {
    sensors,
    devices,
    supportsDimming,
    supportsScheduling: true,
    maxPorts,
  }
}

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

    // is_online is already a boolean in the database
    const controllers = data || []

    return NextResponse.json({
      controllers,
      count: controllers.length
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

        // Convert simplified capabilities from discovery to proper ControllerCapabilities format
        // Discovery returns string arrays like ["temperature", "humidity"] but database needs full objects
        capabilities = buildCapabilitiesFromDiscovered(
          discoveredDevice.capabilities,
          brand as ControllerBrand
        )
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
            // Connection failed - log detailed info for dev team
            console.error(`[Controllers POST] CONNECTION FAILED`, {
              timestamp: new Date().toISOString(),
              brand,
              userId,
              email: credentials.email,
              error: connectionResult.error,
              metadata: connectionResult.metadata,
              // Log request context for debugging
              context: {
                hasDiscoveredDevice: !!discoveredDevice,
                controllerName: name,
              }
            })

            // Classify error for better user guidance
            const errorMsg = connectionResult.error || ''
            const isCredentialError = errorMsg.toLowerCase().includes('password') ||
              errorMsg.toLowerCase().includes('email') ||
              errorMsg.toLowerCase().includes('authentication')

            return NextResponse.json(
              {
                error: 'Connection failed',
                errorType: isCredentialError ? 'credentials' : 'connection',
                message: connectionResult.error || 'Unable to connect to controller.',
                brand: brand,
                guidance: isCredentialError
                  ? 'Double-check your email and password. Try logging into the official app to verify your credentials.'
                  : 'Check that your controller is powered on and connected to WiFi.',
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

          // Classify error for better user guidance
          const lowerMsg = errorMessage.toLowerCase()
          const isNetworkError = lowerMsg.includes('fetch') ||
            lowerMsg.includes('network') ||
            lowerMsg.includes('econnrefused') ||
            lowerMsg.includes('timeout')
          const isCredentialError = lowerMsg.includes('password') ||
            lowerMsg.includes('email') ||
            lowerMsg.includes('authentication') ||
            lowerMsg.includes('invalid')

          // Provide user-friendly error with guidance
          let userMessage = errorMessage
          let guidance = ''
          let errorType = 'unknown'

          if (isCredentialError) {
            errorType = 'credentials'
            userMessage = 'Invalid credentials. Please check your email and password.'
            guidance = 'Try logging into the official app to verify your credentials work.'
          } else if (isNetworkError) {
            errorType = 'network'
            userMessage = 'Could not connect to the controller service.'
            guidance = 'Check your internet connection and try again. The controller service may be temporarily unavailable.'
          } else {
            errorType = 'server'
            userMessage = 'An error occurred while connecting to the controller.'
            guidance = 'Please try again. If the problem persists, the controller service may be experiencing issues.'
          }

          return NextResponse.json(
            {
              error: isNetworkError ? 'Connection error' : 'Controller error',
              errorType,
              message: userMessage,
              brand: brand,
              guidance,
            },
            { status: isNetworkError ? 503 : 400 }
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
              errorType: 'configuration',
              message: 'Credential encryption is not properly configured.',
              guidance: 'This is a server configuration issue. Please contact support or check the ENCRYPTION_KEY environment variable.',
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
        is_online: brand !== 'csv_upload',
        last_seen: new Date().toISOString(),
        room_id: room_id || null
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database insert error:', error)

      if (error.code === '23505') { // Unique violation
        return NextResponse.json(
          {
            error: 'Controller already exists',
            errorType: 'validation',
            message: 'A controller with this ID is already registered to your account.',
            guidance: 'This device may have already been added. Check your controllers list.',
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          error: 'Failed to save controller',
          errorType: 'server',
          message: 'Could not save the controller to the database.',
          guidance: 'Please try again. If this persists, contact support.',
        },
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
    // Log detailed error server-side only
    console.error('Controllers POST error:', error)

    // Return user-friendly error without exposing internals
    return NextResponse.json(
      {
        error: 'Server error',
        errorType: 'server',
        message: 'An unexpected error occurred. Please try again.',
        guidance: 'If this problem persists, please contact support.',
      },
      { status: 500 }
    )
  }
}
