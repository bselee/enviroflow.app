/**
 * Workflow Executor Cron Endpoint
 * 
 * GET /api/cron/workflows - Execute all active workflows (called by Vercel Cron)
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/workflows",
 *     "schedule": "* * * * *"
 *   }]
 * }
 * 
 * This endpoint:
 * 1. Fetches all active workflows
 * 2. For each workflow, evaluates trigger conditions
 * 3. Executes actions if conditions are met
 * 4. Logs all activity
 * 
 * Note: TypeScript errors about 'never' types occur because Supabase
 * doesn't have generated types for these tables yet. Run migrations first,
 * then regenerate types with: npx supabase gen types typescript
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCachedSunTimes, isWithinTimeWindow, getOffsetTime } from '@/lib/sun-calculator'
import { decryptCredentials, EncryptionError } from '@/lib/server-encryption'
import {
  sendPushNotification,
  createWorkflowNotification,
  type NotificationPriority,
} from '@/lib/push-notification-service'

// Import adapter factory and types from automation-engine workspace package
import {
  getAdapter,
  isBrandSupported,
  type ControllerBrand,
  type ControllerCredentials,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type DeviceCommand,
  type CommandType,
} from '@enviroflow/automation-engine/adapters'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// Lazy Supabase client
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

// Workflow node types
interface WorkflowNode {
  id: string
  type: 'trigger' | 'sensor' | 'condition' | 'action' | 'delay' | 'dimmer' | 'notification'
  data: Record<string, unknown>
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
}

interface Workflow {
  id: string
  user_id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  dry_run_enabled: boolean
  room_id: string | null
  room?: {
    name: string
  } | null
}

interface SensorReading {
  controller_id: string
  sensor_type: string
  value: number
  timestamp: string
}

interface ExecutionResult {
  workflowId: string
  workflowName: string
  status: 'success' | 'failed' | 'skipped' | 'dry_run'
  actionsExecuted: number
  error?: string
}

/**
 * GET /api/cron/workflows
 * Execute all active workflows
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const results: ExecutionResult[] = []
  
  try {
    // Verify cron secret (REQUIRED for security)
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET environment variable is not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const supabase = getSupabase()
    
    // Fetch all active workflows with their rooms (including room name for notifications)
    const { data: workflows, error: fetchError } = await supabase
      .from('workflows')
      .select(`
        id,
        user_id,
        name,
        nodes,
        edges,
        is_active,
        dry_run_enabled,
        room_id,
        room:rooms(name)
      `)
      .eq('is_active', true)
    
    if (fetchError) {
      console.error('Failed to fetch workflows:', fetchError)
      return NextResponse.json({
        error: 'Failed to fetch workflows',
        details: fetchError.message
      }, { status: 500 })
    }
    
    if (!workflows || workflows.length === 0) {
      return NextResponse.json({
        message: 'No active workflows',
        executed: 0,
        duration: Date.now() - startTime
      })
    }
    
    console.log(`Processing ${workflows.length} active workflows`)
    
    // Execute each workflow
    for (const workflow of workflows) {
      try {
        // Transform Supabase join result to expected Workflow shape
        // Supabase returns room as an array for single relations in some query patterns
        const workflowData: Workflow = {
          ...workflow,
          room: Array.isArray(workflow.room) ? workflow.room[0] : workflow.room,
        } as Workflow
        const result = await executeWorkflow(supabase, workflowData)
        results.push(result)
      } catch (err) {
        console.error(`Workflow ${workflow.id} failed:`, err)
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: 'failed',
          actionsExecuted: 0,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    const dryRunCount = results.filter(r => r.status === 'dry_run').length
    
    return NextResponse.json({
      message: `Processed ${workflows.length} workflows`,
      results: {
        total: workflows.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        dryRun: dryRunCount
      },
      details: results,
      duration: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('Cron execution error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      results,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

/**
 * Execute a single workflow
 */
async function executeWorkflow(
  supabase: SupabaseClient,
  workflow: Workflow
): Promise<ExecutionResult> {
  const { id, user_id, name, nodes, dry_run_enabled, room } = workflow

  // Extract room name for notification context
  const roomName = room?.name || undefined
  
  // Parse nodes
  const parsedNodes: WorkflowNode[] = typeof nodes === 'string' 
    ? JSON.parse(nodes) 
    : nodes || []
  
  if (parsedNodes.length === 0) {
    return {
      workflowId: id,
      workflowName: name,
      status: 'skipped',
      actionsExecuted: 0,
      error: 'No nodes in workflow'
    }
  }
  
  // Find trigger node
  const triggerNode = parsedNodes.find(n => n.type === 'trigger')
  
  if (!triggerNode) {
    return {
      workflowId: id,
      workflowName: name,
      status: 'skipped',
      actionsExecuted: 0,
      error: 'No trigger node found'
    }
  }
  
  // Evaluate trigger condition
  const triggerData = triggerNode.data as {
    variant?: string
    time?: string
    sensorType?: string
    threshold?: number
    operator?: string
  }
  
  // Get latest sensor readings for this user
  const { data: readings } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('user_id', user_id)
    .order('timestamp', { ascending: false })
    .limit(50)
  
  const sensorReadings: SensorReading[] = readings || []

  // Build trigger context with room information for location-based triggers
  const triggerContext: TriggerContext = {
    roomId: workflow.room_id,
  }

  // Check if trigger condition is met (async for sunrise/sunset calculations)
  const shouldExecute = await evaluateTrigger(triggerData, sensorReadings, triggerContext)

  if (!shouldExecute) {
    return {
      workflowId: id,
      workflowName: name,
      status: 'skipped',
      actionsExecuted: 0
    }
  }
  
  // Find action nodes
  const actionNodes = parsedNodes.filter(n => 
    n.type === 'action' || n.type === 'dimmer' || n.type === 'notification'
  )
  
  if (actionNodes.length === 0) {
    return {
      workflowId: id,
      workflowName: name,
      status: 'skipped',
      actionsExecuted: 0,
      error: 'No action nodes found'
    }
  }
  
  // Execute actions (or simulate in dry-run mode)
  let actionsExecuted = 0
  
  for (const actionNode of actionNodes) {
    try {
      if (dry_run_enabled) {
        // Log dry-run
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: `dry_run_${actionNode.type}`,
          action_data: actionNode.data,
          result: 'dry_run'
        })
      } else {
        // Execute real action with workflow context for notifications
        await executeAction(supabase, user_id, actionNode, {
          workflowId: id,
          workflowName: name,
          roomName,
        })

        // Log success
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: actionNode.type,
          action_data: actionNode.data,
          result: 'success'
        })
      }
      actionsExecuted++
    } catch (err) {
      // Log failure
      await logActivity(supabase, {
        user_id,
        workflow_id: id,
        action_type: actionNode.type,
        action_data: actionNode.data,
        result: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }
  
  // Atomically update last_run and increment run_count via RPC function.
  // This prevents race conditions when multiple workflow executions occur concurrently.
  // See migration: 20260121_workflow_functions.sql for the function definition.
  const { error: rpcError } = await supabase.rpc('increment_workflow_run', {
    p_workflow_id: id,
    p_last_run: new Date().toISOString()
  })

  if (rpcError) {
    // Log the error but don't fail the workflow execution - the actions succeeded
    console.warn(
      `[Workflow Executor] Failed to update run statistics for workflow ${id}:`,
      rpcError.message
    )
  }
  
  return {
    workflowId: id,
    workflowName: name,
    status: dry_run_enabled ? 'dry_run' : 'success',
    actionsExecuted
  }
}

/**
 * Trigger evaluation context containing room information for location-based triggers.
 */
interface TriggerContext {
  roomId: string | null;
}

/**
 * Evaluate trigger condition.
 * Now async to support sunrise/sunset calculations which require database lookups.
 *
 * @param triggerData - The trigger node's data configuration
 * @param sensorReadings - Recent sensor readings for threshold triggers
 * @param context - Additional context including room_id for location-based triggers
 * @returns Promise<boolean> indicating whether the trigger condition is met
 */
async function evaluateTrigger(
  triggerData: Record<string, unknown>,
  sensorReadings: SensorReading[],
  context: TriggerContext
): Promise<boolean> {
  const variant = triggerData.variant as string

  switch (variant) {
    case 'schedule':
      // Always execute for cron-based schedules
      return true

    case 'sensor_threshold': {
      const sensorType = triggerData.sensorType as string
      const threshold = triggerData.threshold as number
      const operator = triggerData.operator as string

      // Find latest reading of this type
      const reading = sensorReadings.find(r => r.sensor_type === sensorType)
      if (!reading) return false

      switch (operator) {
        case 'gt': return reading.value > threshold
        case 'lt': return reading.value < threshold
        case 'gte': return reading.value >= threshold
        case 'lte': return reading.value <= threshold
        case 'eq': return reading.value === threshold
        default: return false
      }
    }

    case 'time_of_day': {
      const triggerTime = triggerData.time as string // "HH:MM"
      if (!triggerTime) return false

      const now = new Date()
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      // Check if within 1 minute window
      return currentTime === triggerTime
    }

    case 'sunrise':
    case 'sunset': {
      // Sunrise/sunset triggers require a room with coordinates
      if (!context.roomId) {
        console.warn('Sunrise/sunset trigger requires a room_id with coordinates')
        return false
      }

      // Get cached sun times for the room's location (converted to room's timezone)
      // The convertToLocalTimezone: true option ensures times are in the room's local timezone
      const sunTimesResult = await getCachedSunTimes(context.roomId, {
        convertToLocalTimezone: true,
      })

      if (!sunTimesResult.success || !sunTimesResult.data) {
        // Log the error but don't fail the workflow - just skip this trigger
        console.warn(
          `Failed to get sun times for room ${context.roomId}: ${sunTimesResult.error}`
        )
        return false
      }

      const { sunrise, sunset, timezone } = sunTimesResult.data

      // Get optional offset from trigger data (e.g., -30 for 30 minutes before)
      const offsetMinutes = (triggerData.offsetMinutes as number) || 0

      // Calculate the target time with offset (still in local timezone)
      const targetTime = variant === 'sunrise'
        ? getOffsetTime(sunrise, offsetMinutes)
        : getOffsetTime(sunset, offsetMinutes)

      // Check if current time is within 1 minute of the target
      // Pass the timezone so isWithinTimeWindow can convert current time to the same timezone
      const isTriggered = isWithinTimeWindow(targetTime, 1, timezone)

      if (isTriggered) {
        // Format time for logging (shows local time for clarity)
        const localTimeStr = `${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')}`
        console.log(
          `${variant} trigger fired for room ${context.roomId} ` +
          `(target: ${localTimeStr} ${timezone || 'UTC'}, offset: ${offsetMinutes} min)`
        )
      }

      return isTriggered
    }

    case 'manual':
      // Manual triggers don't auto-execute
      return false

    default:
      return true
  }
}

/**
 * Context for action execution, providing workflow and room information.
 */
interface ActionContext {
  workflowId: string
  workflowName: string
  roomName?: string
}

/**
 * Execute an action node.
 *
 * @param supabase - Supabase client instance
 * @param userId - User ID for authorization and logging
 * @param actionNode - The action node to execute
 * @param context - Workflow context for notifications
 */
async function executeAction(
  supabase: SupabaseClient,
  userId: string,
  actionNode: WorkflowNode,
  context: ActionContext
): Promise<void> {
  const { type, data } = actionNode
  const { workflowName, roomName } = context

  switch (type) {
    case 'action': {
      const actionData = data as {
        variant?: string
        controllerId?: string
        port?: number
        value?: number
      }

      // Get controller info with encrypted credentials
      if (!actionData.controllerId) {
        throw new Error('No controller specified for action')
      }

      const { data: controller, error: controllerError } = await supabase
        .from('controllers')
        .select('*')
        .eq('id', actionData.controllerId)
        .eq('user_id', userId)
        .single()

      if (controllerError || !controller) {
        throw new Error(`Controller not found: ${controllerError?.message || 'Unknown error'}`)
      }

      // Execute the device control action via the adapter
      await executeDeviceControl(
        supabase,
        userId,
        controller,
        actionData.port ?? 1,
        actionData.variant,
        actionData.value
      )
      break
    }

    case 'dimmer': {
      const dimmerData = data as {
        controllerId?: string
        port?: number
        targetIntensity?: number
        durationMinutes?: number
        curve?: string
      }

      // TODO: Start gradual dimming sequence
      console.log(`Dimmer: Ramp to ${dimmerData.targetIntensity}% over ${dimmerData.durationMinutes} min`)
      break
    }

    case 'notification': {
      const notifData = data as {
        message?: string
        actionType?: string
        channels?: string[]
        priority?: 'high' | 'normal'
      }

      // Determine the notification type for formatting
      const actionType = notifData.actionType || 'schedule_triggered'

      // Create formatted notification payload using the service helper
      const notification = createWorkflowNotification(
        workflowName,
        actionType,
        roomName,
        {
          message: notifData.message || `${workflowName} notification`,
        }
      )

      // Override priority if specified in the workflow node
      const priority: NotificationPriority = notifData.priority || notification.priority || 'normal'

      // Send push notification via the push notification service
      console.log(
        `[Workflow Executor] Sending notification for workflow "${workflowName}":`,
        `title="${notification.title}", priority=${priority}`
      )

      const result = await sendPushNotification({
        userId,
        title: notification.title,
        body: notification.body,
        category: notification.category,
        priority,
        data: {
          ...notification.data,
          workflowId: context.workflowId,
        },
      })

      // Log notification result
      await logActivity(supabase, {
        user_id: userId,
        workflow_id: context.workflowId,
        action_type: 'notification_sent',
        action_data: {
          title: notification.title,
          category: notification.category,
          priority,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          channels: notifData.channels,
        },
        result: result.success ? 'success' : 'failed',
        error_message: result.success ? undefined : result.errors?.join(', '),
      })

      if (!result.success && result.errors && result.errors.length > 0) {
        console.warn(
          `[Workflow Executor] Notification delivery issues for user ${userId.substring(0, 8)}...:`,
          result.errors.join(', ')
        )
      }

      break
    }

    default:
      console.log(`Unknown action type: ${type}`)
  }
}

/**
 * Database controller record structure
 */
interface DBController {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: string | Record<string, unknown>
  status: 'online' | 'offline' | 'error' | 'initializing'
  last_seen: string | null
  last_error: string | null
}

/**
 * Build properly typed credentials for the adapter factory.
 * The adapter factory uses a discriminated union based on the 'type' field.
 *
 * @param brand - Controller brand identifier
 * @param rawCredentials - Decrypted credentials object
 * @returns Properly typed credentials for the adapter
 */
function buildAdapterCredentials(
  brand: ControllerBrand,
  rawCredentials: Record<string, unknown>
): ControllerCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: (rawCredentials.email as string) || '',
        password: (rawCredentials.password as string) || '',
      } satisfies ACInfinityCredentials

    case 'inkbird':
      return {
        type: 'inkbird',
        email: (rawCredentials.email as string) || '',
        password: (rawCredentials.password as string) || '',
      } satisfies InkbirdCredentials

    case 'csv_upload':
      return {
        type: 'csv_upload',
      } satisfies CSVUploadCredentials

    default:
      throw new Error(`Cannot build credentials for unsupported brand: ${brand}`)
  }
}

/**
 * Map action variant to device command type.
 * Translates workflow action variants to adapter command types.
 *
 * @param variant - Action variant from workflow node (e.g., 'set_fan', 'toggle_outlet')
 * @param value - Optional value for the command (0-100 scale)
 * @returns DeviceCommand object for the adapter
 */
function mapActionToCommand(
  variant: string | undefined,
  value: number | undefined
): DeviceCommand {
  switch (variant) {
    case 'set_fan':
    case 'set_light':
    case 'set_level':
      return {
        type: 'set_level' as CommandType,
        value: value ?? 0,
      }

    case 'toggle_outlet':
      // If value is provided, use it to determine on/off; otherwise toggle
      if (value !== undefined) {
        return {
          type: value > 0 ? 'turn_on' : 'turn_off' as CommandType,
        }
      }
      return {
        type: 'toggle' as CommandType,
      }

    case 'turn_on':
      return {
        type: 'turn_on' as CommandType,
      }

    case 'turn_off':
      return {
        type: 'turn_off' as CommandType,
      }

    default:
      // Default to set_level for unknown variants
      return {
        type: 'set_level' as CommandType,
        value: value ?? 0,
      }
  }
}

/**
 * Execute device control via the adapter factory.
 *
 * This function:
 * 1. Validates the controller brand is supported
 * 2. Decrypts stored credentials (only when needed)
 * 3. Connects to the controller via the appropriate adapter
 * 4. Sends the control command
 * 5. Updates controller status in the database
 * 6. Logs the action result
 * 7. Disconnects from the controller
 *
 * SECURITY NOTES:
 * - Credentials are decrypted only at the moment of use
 * - Decrypted credentials are never logged
 * - Connection is closed after operation to minimize exposure
 *
 * @param supabase - Supabase client instance
 * @param userId - User ID for authorization and logging
 * @param controller - Database controller record with encrypted credentials
 * @param port - Device port number to control
 * @param variant - Action variant (set_fan, set_light, toggle_outlet, etc.)
 * @param value - Value for the command (0-100 scale, optional)
 * @throws Error if control operation fails
 */
async function executeDeviceControl(
  supabase: SupabaseClient,
  userId: string,
  controller: DBController,
  port: number,
  variant: string | undefined,
  value: number | undefined
): Promise<void> {
  const { id: dbControllerId, brand, controller_id: controllerId, name, credentials } = controller

  // Step 1: Validate brand is supported for device control
  if (!isBrandSupported(brand)) {
    throw new Error(`Unsupported controller brand: ${brand}`)
  }

  // CSV upload controllers cannot control devices
  if (brand === 'csv_upload') {
    throw new Error('CSV upload controllers do not support device control')
  }

  // Step 2: Decrypt credentials (only at the moment of use)
  let decryptedCredentials: Record<string, unknown>
  try {
    decryptedCredentials = decryptCredentials(credentials)
  } catch (error) {
    if (error instanceof EncryptionError) {
      // Log encryption configuration error but don't expose details
      console.error(
        `[Workflow Executor] Encryption error for controller ${dbControllerId}:`,
        'Credentials cannot be decrypted. Check ENCRYPTION_KEY configuration.'
      )
      throw new Error('Controller credentials cannot be decrypted. Contact administrator.')
    }
    throw error
  }

  // Validate we have the required credential fields
  if (!decryptedCredentials.email || !decryptedCredentials.password) {
    throw new Error('Controller credentials are incomplete. Please reconfigure the controller.')
  }

  // Step 3: Get the appropriate adapter for this brand
  const adapter = getAdapter(brand as ControllerBrand)

  // Build properly typed credentials for the adapter
  const adapterCredentials = buildAdapterCredentials(
    brand as ControllerBrand,
    decryptedCredentials
  )

  // Step 4: Connect to the controller
  console.log(`[Workflow Executor] Connecting to ${brand} controller "${name}" (${controllerId})`)

  const connectionResult = await adapter.connect(adapterCredentials)

  if (!connectionResult.success) {
    // Update controller status to offline
    await supabase
      .from('controllers')
      .update({
        status: 'offline',
        last_error: connectionResult.error || 'Connection failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbControllerId)

    throw new Error(`Failed to connect to controller: ${connectionResult.error}`)
  }

  try {
    // Step 5: Build and send the control command
    const command = mapActionToCommand(variant, value)

    console.log(
      `[Workflow Executor] Sending command to ${name} port ${port}:`,
      `type=${command.type}, value=${command.value ?? 'N/A'}`
    )

    const commandResult = await adapter.controlDevice(controllerId, port, command)

    // Step 6: Update controller status based on result
    const updateData: Record<string, unknown> = {
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (commandResult.success) {
      updateData.status = 'online'
      updateData.last_error = null

      console.log(
        `[Workflow Executor] Command successful on ${name} port ${port}:`,
        `actualValue=${commandResult.actualValue ?? 'N/A'}`
      )

      // Log successful action to activity_logs
      await logActivity(supabase, {
        user_id: userId,
        controller_id: dbControllerId,
        action_type: `device_control_${variant || 'set_level'}`,
        action_data: {
          controller_name: name,
          port,
          command_type: command.type,
          requested_value: value,
          actual_value: commandResult.actualValue,
          previous_value: commandResult.previousValue,
        },
        result: 'success',
      })
    } else {
      // Command failed but connection was successful
      updateData.status = 'error'
      updateData.last_error = commandResult.error || 'Command failed'

      console.warn(
        `[Workflow Executor] Command failed on ${name} port ${port}:`,
        commandResult.error
      )

      // Log failed action
      await logActivity(supabase, {
        user_id: userId,
        controller_id: dbControllerId,
        action_type: `device_control_${variant || 'set_level'}`,
        action_data: {
          controller_name: name,
          port,
          command_type: command.type,
          requested_value: value,
        },
        result: 'failed',
        error_message: commandResult.error || 'Command failed',
      })

      throw new Error(`Device control failed: ${commandResult.error}`)
    }

    await supabase
      .from('controllers')
      .update(updateData)
      .eq('id', dbControllerId)

  } finally {
    // Step 7: Always disconnect after operation
    try {
      await adapter.disconnect(controllerId)
      console.log(`[Workflow Executor] Disconnected from ${name}`)
    } catch (disconnectError) {
      // Log but don't throw - operation may have succeeded
      console.warn(
        `[Workflow Executor] Error disconnecting from ${name}:`,
        disconnectError instanceof Error ? disconnectError.message : 'Unknown error'
      )
    }
  }
}

/**
 * Log activity to database
 */
async function logActivity(
  supabase: SupabaseClient,
  log: {
    user_id: string
    workflow_id?: string
    room_id?: string
    controller_id?: string
    action_type: string
    action_data: Record<string, unknown>
    result: 'success' | 'failed' | 'skipped' | 'dry_run'
    error_message?: string
  }
): Promise<void> {
  try {
    await supabase
      .from('activity_logs')
      .insert({
        ...log,
        timestamp: new Date().toISOString()
      })
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}
