/**
 * Batch Controller Operations API
 *
 * POST /api/controllers/batch
 *
 * Handles bulk operations for controllers:
 * - assign_room: Assign multiple controllers to a room
 * - test_connection: Test connections for multiple controllers in parallel
 * - delete: Delete multiple controllers with cascade options
 *
 * All operations include activity logging and proper error handling.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getAdapter,
  type ControllerBrand,
} from '@enviroflow/automation-engine/adapters'
import { decryptCredentials } from '@/lib/server-encryption'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

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

// =============================================================================
// Types
// =============================================================================

interface _BatchAssignRoomRequest {
  action: 'assign_room'
  controllerIds: string[]
  data: {
    roomId: string | null
  }
}

interface _BatchTestConnectionRequest {
  action: 'test_connection'
  controllerIds: string[]
}

interface _BatchDeleteRequest {
  action: 'delete'
  controllerIds: string[]
  data: {
    deleteData: boolean
  }
}

// Union type for type-safe batch requests
// type BatchRequest = BatchAssignRoomRequest | BatchTestConnectionRequest | BatchDeleteRequest

interface ConnectionTestResult {
  controllerId: string
  controllerName: string
  success: boolean
  status: 'online' | 'offline' | 'error'
  responseTime?: number
  error?: string
  lastSeen?: string
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Assign multiple controllers to a room
 */
async function batchAssignRoom(
  userId: string,
  controllerIds: string[],
  roomId: string | null
): Promise<NextResponse> {
  const supabase = getSupabase()

  try {
    // Validate room exists if roomId is provided
    if (roomId) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('id', roomId)
        .eq('user_id', userId)
        .single()

      if (roomError || !room) {
        return NextResponse.json(
          { error: 'Room not found or unauthorized' },
          { status: 404 }
        )
      }
    }

    // Verify all controllers belong to user
    const { data: controllers, error: fetchError } = await supabase
      .from('controllers')
      .select('id, name')
      .in('id', controllerIds)
      .eq('user_id', userId)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to verify controllers', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!controllers || controllers.length !== controllerIds.length) {
      return NextResponse.json(
        { error: 'Some controllers not found or unauthorized' },
        { status: 404 }
      )
    }

    // Update all controllers
    const { error: updateError } = await supabase
      .from('controllers')
      .update({ room_id: roomId, updated_at: new Date().toISOString() })
      .in('id', controllerIds)
      .eq('user_id', userId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to assign controllers to room', details: updateError.message },
        { status: 500 }
      )
    }

    // Create activity log entry
    await supabase.from('activity_logs').insert({
      user_id: userId,
      room_id: roomId,
      action_type: 'controller_updated',
      action_data: {
        operation: 'bulk_assign_room',
        controller_count: controllerIds.length,
        controller_names: controllers.map(c => c.name),
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${controllerIds.length} controller(s) to room`,
      updatedCount: controllerIds.length,
    })
  } catch (error) {
    console.error('[Batch Assign Room] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Test connections for multiple controllers in parallel
 */
async function batchTestConnection(
  userId: string,
  controllerIds: string[]
): Promise<NextResponse> {
  const supabase = getSupabase()

  try {
    // Fetch all controllers with credentials
    const { data: controllers, error: fetchError } = await supabase
      .from('controllers')
      .select('id, name, brand, credentials, controller_id')
      .in('id', controllerIds)
      .eq('user_id', userId)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch controllers', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!controllers || controllers.length === 0) {
      return NextResponse.json(
        { error: 'No controllers found' },
        { status: 404 }
      )
    }

    // Test connections in parallel with 30s timeout per controller
    const testPromises = controllers.map(async (controller): Promise<ConnectionTestResult> => {
      const startTime = Date.now()

      try {
        // Skip CSV upload controllers
        if (controller.brand === 'csv_upload') {
          return {
            controllerId: controller.id,
            controllerName: controller.name,
            success: true,
            status: 'offline',
            responseTime: 0,
          }
        }

        // Decrypt credentials
        let credentials: unknown
        try {
          credentials = decryptCredentials(controller.credentials as string)
        } catch (_decryptError) {
          return {
            controllerId: controller.id,
            controllerName: controller.name,
            success: false,
            status: 'error',
            error: 'Failed to decrypt credentials',
            responseTime: Date.now() - startTime,
          }
        }

        // Get adapter and test connection
        const adapter = getAdapter(controller.brand as ControllerBrand)
        const result = await Promise.race([
          adapter.connect(credentials as Parameters<typeof adapter.connect>[0]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 30000)
          ),
        ]) as Awaited<ReturnType<typeof adapter.connect>>

        const responseTime = Date.now() - startTime

        if (result.success) {
          // Disconnect after successful test
          await adapter.disconnect(controller.controller_id)

          return {
            controllerId: controller.id,
            controllerName: controller.name,
            success: true,
            status: 'online',
            responseTime,
            lastSeen: new Date().toISOString(),
          }
        } else {
          return {
            controllerId: controller.id,
            controllerName: controller.name,
            success: false,
            status: 'offline',
            error: result.error || 'Connection failed',
            responseTime,
          }
        }
      } catch (error) {
        return {
          controllerId: controller.id,
          controllerName: controller.name,
          success: false,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime,
        }
      }
    })

    const results = await Promise.all(testPromises)

    // Update controller statuses in database
    const updatePromises = results.map((result) => {
      const updateData: Record<string, unknown> = {
        status: result.status,
        updated_at: new Date().toISOString(),
      }

      if (result.lastSeen) {
        updateData.last_seen = result.lastSeen
        updateData.last_error = null
      } else if (result.error) {
        updateData.last_error = result.error
      }

      return supabase
        .from('controllers')
        .update(updateData)
        .eq('id', result.controllerId)
        .eq('user_id', userId)
    })

    await Promise.all(updatePromises)

    // Calculate summary
    const onlineCount = results.filter(r => r.status === 'online').length
    const offlineCount = results.filter(r => r.status === 'offline').length
    const errorCount = results.filter(r => r.status === 'error').length

    // Create activity log
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action_type: 'controller_updated',
      action_data: {
        operation: 'bulk_connection_test',
        controller_count: results.length,
        online_count: onlineCount,
        offline_count: offlineCount,
        error_count: errorCount,
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        online: onlineCount,
        offline: offlineCount,
        errors: errorCount,
      },
    })
  } catch (error) {
    console.error('[Batch Test Connection] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Delete multiple controllers with optional cascade delete of data
 */
async function batchDelete(
  userId: string,
  controllerIds: string[],
  deleteData: boolean
): Promise<NextResponse> {
  const supabase = getSupabase()

  try {
    // Verify all controllers belong to user
    const { data: controllers, error: fetchError } = await supabase
      .from('controllers')
      .select('id, name, brand')
      .in('id', controllerIds)
      .eq('user_id', userId)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to verify controllers', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!controllers || controllers.length !== controllerIds.length) {
      return NextResponse.json(
        { error: 'Some controllers not found or unauthorized' },
        { status: 404 }
      )
    }

    // Check for associated workflows
    const { data: workflows, error: workflowError } = await supabase
      .from('workflows')
      .select('id, name')
      .eq('user_id', userId)

    if (workflowError) {
      return NextResponse.json(
        { error: 'Failed to check workflows', details: workflowError.message },
        { status: 500 }
      )
    }

    // Filter workflows that reference these controllers
    const affectedWorkflows = (workflows || []).filter((workflow) => {
      const nodes = workflow as unknown as { nodes?: Array<{ data?: { controllerId?: string } }> }
      return nodes.nodes?.some((node) =>
        controllerIds.includes(node.data?.controllerId || '')
      )
    })

    // If deleteData is true, delete associated sensor readings and schedules
    if (deleteData) {
      // Delete sensor readings
      const { error: sensorError } = await supabase
        .from('sensor_readings')
        .delete()
        .in('controller_id', controllerIds)

      if (sensorError) {
        console.error('[Batch Delete] Failed to delete sensor readings:', sensorError)
      }

      // Delete dimmer schedules
      const { error: scheduleError } = await supabase
        .from('dimmer_schedules')
        .delete()
        .in('controller_id', controllerIds)

      if (scheduleError) {
        console.error('[Batch Delete] Failed to delete dimmer schedules:', scheduleError)
      }
    }

    // Delete controllers (workflows will be handled separately by user)
    const { error: deleteError } = await supabase
      .from('controllers')
      .delete()
      .in('id', controllerIds)
      .eq('user_id', userId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete controllers', details: deleteError.message },
        { status: 500 }
      )
    }

    // Create activity log
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action_type: 'controller_removed',
      action_data: {
        operation: 'bulk_delete',
        controller_count: controllerIds.length,
        controller_names: controllers.map(c => c.name),
        deleted_data: deleteData,
        affected_workflow_count: affectedWorkflows.length,
      },
      result: 'success',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${controllerIds.length} controller(s)`,
      deletedCount: controllerIds.length,
      affectedWorkflows: affectedWorkflows.map(w => w.name),
      deletedData: deleteData,
    })
  } catch (error) {
    console.error('[Batch Delete] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()

    // Get user from auth header
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

    // Parse request body
    const body = await request.json()

    // Validate common fields
    if (!body.action) {
      return NextResponse.json(
        { error: 'Missing action field' },
        { status: 400 }
      )
    }

    if (!body.controllerIds || !Array.isArray(body.controllerIds) || body.controllerIds.length === 0) {
      return NextResponse.json(
        { error: 'controllerIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Limit batch size
    if (body.controllerIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot process more than 100 controllers at once' },
        { status: 400 }
      )
    }

    // Route to appropriate handler
    switch (body.action as string) {
      case 'assign_room':
        return await batchAssignRoom(userId, body.controllerIds as string[], body.data?.roomId)

      case 'test_connection':
        return await batchTestConnection(userId, body.controllerIds as string[])

      case 'delete':
        return await batchDelete(userId, body.controllerIds as string[], body.data?.deleteData || false)

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[Batch API] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
