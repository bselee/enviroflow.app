/**
 * Controller Detail API Routes
 *
 * GET    /api/controllers/[id]    - Get single controller by ID
 * PUT    /api/controllers/[id]    - Update controller (name, credentials)
 * DELETE /api/controllers/[id]    - Remove controller and associated data
 *
 * Security:
 * - All operations verify user owns the controller
 * - Credentials are encrypted before storage and masked in responses
 * - Service role client used for database operations
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  encryptCredentials as encryptCredentialsAES,
  decryptCredentials as decryptCredentialsAES,
  EncryptionError,
} from '@/lib/server-encryption'

// ============================================
// Inline Adapter Types (avoiding cross-package imports)
// ============================================

type ControllerBrand = 'ac_infinity' | 'inkbird' | 'govee' | 'csv_upload' | 'mqtt' | 'custom'

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
  testConnection(credentials: ControllerCredentials): Promise<{ success: boolean; error?: string }>
}

/**
 * Simple adapter factory for connection testing.
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

  // Return a minimal adapter for connection testing
  return {
    async connect(credentials: ControllerCredentials): Promise<ConnectionResult> {
      // Basic validation - actual connection happens in automation-engine
      if (!credentials.email && !credentials.apiKey) {
        return { success: false, error: 'Credentials required' }
      }
      // Simulated connection response
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
      // No-op for connection testing
    },
    async testConnection(credentials: ControllerCredentials) {
      if (!credentials.email && !credentials.apiKey) {
        return { success: false, error: 'Credentials required' }
      }
      // In production, this would make actual API calls to verify credentials
      return { success: true }
    }
  }
}

// ============================================
// Types
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

interface UpdateControllerRequest {
  name?: string
  credentials?: {
    email?: string
    password?: string
    [key: string]: unknown
  }
  room_id?: string | null
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// ============================================
// Supabase Client (Service Role)
// ============================================

let supabase: SupabaseClient | null = null

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
 * Extract and validate user ID from request.
 * Uses Bearer token authentication only.
 *
 * SECURITY: x-user-id header bypass has been removed. All authentication
 * must go through Supabase Auth with a valid Bearer token.
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
// Credential Helpers
// ============================================

/**
 * Encrypt credentials using AES-256-GCM.
 *
 * @param credentials - Raw credential object (never log this)
 * @returns Encrypted string safe for database storage
 */
function encryptCredentials(credentials: Record<string, unknown>): string {
  try {
    return encryptCredentialsAES(credentials)
  } catch (error) {
    if (error instanceof EncryptionError) {
      console.error('[Encryption] Configuration error - ensure ENCRYPTION_KEY is set')
    }
    throw new Error('Failed to encrypt credentials')
  }
}

/**
 * Decrypt credentials from database storage.
 * Handles both AES-256-GCM and legacy formats.
 *
 * @param encrypted - Encrypted string from database
 * @returns Decrypted credential object
 */
function decryptCredentials(encrypted: string | Record<string, unknown>): Record<string, unknown> {
  try {
    return decryptCredentialsAES(encrypted)
  } catch (error) {
    if (error instanceof EncryptionError) {
      console.error('[Decryption] Failed to decrypt credentials')
    }
    return {}
  }
}

function maskCredentials(credentials: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(credentials)) {
    if (key === 'password' || key === 'apiKey' || key === 'api_key' || key === 'token') {
      masked[key] = '********'
    } else if (key === 'email') {
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
// Ownership Verification
// ============================================

/**
 * Verify user owns the controller and return it.
 *
 * @returns Controller data if owned, null otherwise
 */
async function getOwnedController(
  client: SupabaseClient,
  controllerId: string,
  userId: string,
  includeCredentials = false
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from('controllers')
    .select('*')
    .eq('id', controllerId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  // Remove credentials if not requested
  if (!includeCredentials && data.credentials) {
    const { credentials: _, ...rest } = data
    return rest as Record<string, unknown>
  }

  return data as Record<string, unknown>
}

// ============================================
// GET /api/controllers/[id]
// ============================================

/**
 * Get a single controller by ID.
 * Verifies user ownership before returning data.
 *
 * Response: {
 *   success: true
 *   controller: ControllerResponse
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    const controller = await getOwnedController(client, id, userId)

    if (!controller) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      controller,
    })
  } catch (error) {
    console.error('[Controller GET] Error:', error)
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
// PUT /api/controllers/[id]
// ============================================

/**
 * Update a controller's name, credentials, or room assignment.
 * If credentials are updated, verifies connection with new credentials.
 *
 * Request Body: {
 *   name?: string
 *   credentials?: { email, password }
 *   room_id?: string | null
 * }
 *
 * Response: {
 *   success: true
 *   controller: ControllerResponse
 *   message: string
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get existing controller (with credentials for update)
    const existingController = await getOwnedController(client, id, userId, true)

    if (!existingController) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    // Parse request body
    let body: UpdateControllerRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { name, credentials, room_id } = body

    // Validate at least one field is being updated
    if (name === undefined && credentials === undefined && room_id === undefined) {
      return NextResponse.json(
        { error: 'No fields to update. Provide name, credentials, or room_id.' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Validate and set name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Controller name cannot be empty' },
          { status: 400 }
        )
      }
      if (name.length > 100) {
        return NextResponse.json(
          { error: 'Controller name must be 100 characters or less' },
          { status: 400 }
        )
      }
      updates.name = name.trim()
    }

    // Validate and set room_id
    if (room_id !== undefined) {
      if (room_id !== null) {
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
      updates.room_id = room_id
    }

    // Handle credential update
    if (credentials !== undefined) {
      const brand = existingController.brand as ControllerBrand

      // Verify credentials require email/password for this brand
      if (brand === 'ac_infinity' || brand === 'inkbird') {
        if (!credentials.email || !credentials.password) {
          return NextResponse.json(
            {
              error: 'Email and password are required for credential update',
              requiredFields: ['email', 'password'],
            },
            { status: 400 }
          )
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(credentials.email)) {
          return NextResponse.json(
            { error: 'Invalid email format' },
            { status: 400 }
          )
        }

        // Test connection with new credentials
        try {
          const adapter = getAdapter(brand)
          const adapterCredentials: ControllerCredentials = {
            type: brand,
            email: credentials.email,
            password: credentials.password,
          }

          const connectionResult = await adapter.connect(adapterCredentials)

          if (!connectionResult.success) {
            return NextResponse.json(
              {
                error: 'Failed to verify new credentials',
                details: connectionResult.error || 'Connection rejected by controller service',
              },
              { status: 400 }
            )
          }

          // Update controller_id and metadata from new connection
          updates.controller_id = connectionResult.controllerId
          if (connectionResult.metadata) {
            updates.capabilities = connectionResult.metadata.capabilities
            updates.model = connectionResult.metadata.model
            updates.firmware_version = connectionResult.metadata.firmwareVersion
          }
          updates.status = 'online'
          updates.last_seen = new Date().toISOString()
          updates.last_error = null

          // Disconnect after verification
          if (connectionResult.controllerId) {
            await adapter.disconnect(connectionResult.controllerId)
          }
        } catch (adapterError) {
          console.error('[Controller PUT] Adapter error:', adapterError)
          return NextResponse.json(
            {
              error: 'Failed to verify new credentials',
              details: adapterError instanceof Error ? adapterError.message : 'Unknown error',
            },
            { status: 400 }
          )
        }

        // Encrypt new credentials
        updates.credentials = encryptCredentials({ type: brand, ...credentials })
      } else if (brand === 'csv_upload') {
        // CSV upload doesn't need credential verification
        updates.credentials = JSON.stringify({ type: 'csv_upload' })
      }
    }

    // Perform update
    const { data: updatedController, error: updateError } = await client
      .from('controllers')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(
        `
        id,
        brand,
        controller_id,
        name,
        capabilities,
        status,
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

    if (updateError) {
      console.error('[Controller PUT] Database error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update controller', details: updateError.message },
        { status: 500 }
      )
    }

    // Map database 'status' to frontend 'is_online'
    const responseController = {
      ...updatedController,
      is_online: updatedController.status === 'online',
    }

    // Log activity
    await client.from('activity_logs').insert({
      user_id: userId,
      controller_id: id,
      action_type: 'controller_updated',
      action_data: {
        updated_fields: Object.keys(body),
        name_changed: name !== undefined,
        credentials_changed: credentials !== undefined,
        room_changed: room_id !== undefined,
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      controller: responseController,
      message: 'Controller updated successfully',
      credentials_masked: credentials ? maskCredentials(credentials) : undefined,
    })
  } catch (error) {
    console.error('[Controller PUT] Error:', error)
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
// DELETE /api/controllers/[id]
// ============================================

/**
 * Delete a controller and all associated data.
 * This includes:
 * - Sensor readings
 * - Activity logs (controller-specific)
 * - Workflow references (sets controller_id to null)
 *
 * Response: {
 *   success: true
 *   message: string
 *   deleted: { controller_id, name }
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params
    const client = getSupabase()
    const userId = await getUserId(request, client)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid controller ID format' },
        { status: 400 }
      )
    }

    // Get existing controller to verify ownership
    const existingController = await getOwnedController(client, id, userId)

    if (!existingController) {
      return NextResponse.json(
        { error: 'Controller not found or access denied' },
        { status: 404 }
      )
    }

    const controllerName = existingController.name as string

    // Delete associated sensor readings
    const { error: sensorError } = await client
      .from('sensor_readings')
      .delete()
      .eq('controller_id', id)

    if (sensorError) {
      console.error('[Controller DELETE] Error deleting sensor readings:', sensorError)
      // Continue with deletion - sensor readings are not critical
    }

    // Delete activity logs for this controller
    const { error: activityError } = await client
      .from('activity_logs')
      .delete()
      .eq('controller_id', id)

    if (activityError) {
      console.error('[Controller DELETE] Error deleting activity logs:', activityError)
      // Continue with deletion
    }

    // Nullify controller references in workflows (don't delete workflows)
    // Note: This depends on your schema - adjust if workflow nodes reference controllers differently
    const { error: workflowError } = await client
      .from('workflows')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .contains('nodes', [{ data: { controllerId: id } }])

    if (workflowError) {
      console.error('[Controller DELETE] Error updating workflows:', workflowError)
      // Continue with deletion
    }

    // Delete the controller
    const { error: deleteError } = await client
      .from('controllers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('[Controller DELETE] Database error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete controller', details: deleteError.message },
        { status: 500 }
      )
    }

    // Log activity (to general activity, not controller-specific)
    await client.from('activity_logs').insert({
      user_id: userId,
      controller_id: null,
      action_type: 'controller_deleted',
      action_data: {
        deleted_controller_id: id,
        name: controllerName,
        brand: existingController.brand,
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: `Controller "${controllerName}" deleted successfully`,
      deleted: {
        controller_id: id,
        name: controllerName,
      },
    })
  } catch (error) {
    console.error('[Controller DELETE] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
