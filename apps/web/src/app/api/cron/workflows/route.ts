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
    // Verify cron secret (optional security)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Unauthorized cron request')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    
    const supabase = getSupabase()
    
    // Fetch all active workflows with their rooms
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
        room_id
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
        const result = await executeWorkflow(supabase, workflow as Workflow)
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
  const { id, user_id, name, nodes, edges, dry_run_enabled } = workflow
  
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
  
  // Check if trigger condition is met
  const shouldExecute = evaluateTrigger(triggerData, sensorReadings)
  
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
        // Execute real action
        await executeAction(supabase, user_id, actionNode)
        
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
  
  // Update workflow last_run (increment run_count via SQL trigger or manual increment)
  const { data: currentWorkflow } = await supabase
    .from('workflows')
    .select('run_count')
    .eq('id', id)
    .single()
  
  await supabase
    .from('workflows')
    .update({
      last_run: new Date().toISOString(),
      run_count: (currentWorkflow?.run_count || 0) + 1
    })
    .eq('id', id)
  
  return {
    workflowId: id,
    workflowName: name,
    status: dry_run_enabled ? 'dry_run' : 'success',
    actionsExecuted
  }
}

/**
 * Evaluate trigger condition
 */
function evaluateTrigger(
  triggerData: Record<string, unknown>,
  sensorReadings: SensorReading[]
): boolean {
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
    case 'sunset':
      // TODO: Calculate sunrise/sunset based on location
      // For now, skip these triggers
      return false
    
    case 'manual':
      // Manual triggers don't auto-execute
      return false
    
    default:
      return true
  }
}

/**
 * Execute an action node
 */
async function executeAction(
  supabase: SupabaseClient,
  userId: string,
  actionNode: WorkflowNode
): Promise<void> {
  const { type, data } = actionNode
  
  switch (type) {
    case 'action': {
      const actionData = data as {
        variant?: string
        controllerId?: string
        port?: number
        value?: number
      }
      
      // Get controller info
      if (!actionData.controllerId) {
        throw new Error('No controller specified for action')
      }
      
      const { data: controller } = await supabase
        .from('controllers')
        .select('*')
        .eq('id', actionData.controllerId)
        .eq('user_id', userId)
        .single()
      
      if (!controller) {
        throw new Error('Controller not found')
      }
      
      // TODO: Call adapter to control device
      // const adapter = getAdapter(controller.brand)
      // await adapter.connect(controller.credentials)
      // await adapter.controlDevice(controller.controller_id, actionData.port, { type: 'set_level', value: actionData.value })
      
      console.log(`Action: Set ${controller.name} port ${actionData.port} to ${actionData.value}`)
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
        channels?: string[]
        priority?: string
      }
      
      // TODO: Send push notification via FCM/APNS
      console.log(`Notification: ${notifData.message}`)
      
      // Store notification in database
      await supabase
        .from('activity_logs')
        .insert({
          user_id: userId,
          action_type: 'notification_sent',
          action_data: notifData,
          result: 'success'
        })
      break
    }
    
    default:
      console.log(`Unknown action type: ${type}`)
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
