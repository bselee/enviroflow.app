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
import { calculateDimmingValue, type DimmerCurveType } from '@/lib/dimming-curves'

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
  type: 'trigger' | 'sensor' | 'condition' | 'action' | 'delay' | 'dimmer' | 'notification' | 'mode' | 'verified_action' | 'port_condition' | 'variable' | 'debounce'
  data: Record<string, unknown>
}

// Delay Node Configuration
interface DelayNodeConfig {
  duration: number
  unit: 'seconds' | 'minutes' | 'hours'
}

// Variable Node Configuration
interface VariableNodeConfig {
  name: string
  scope: 'workflow' | 'global'
  operation: 'set' | 'get' | 'increment' | 'decrement'
  valueType: 'number' | 'string' | 'boolean'
  value?: number | string | boolean
  amount?: number
}

// Debounce Node Configuration
interface DebounceNodeConfig {
  cooldownSeconds: number
  executeOnLead: boolean
  executeOnTrail: boolean
}

// Execution state for paused workflows (delay nodes)
interface ExecutionState {
  paused_at_node: string
  resume_after: string // ISO timestamp
  next_nodes: string[] // Nodes to execute after resume
  workflow_variables: Record<string, number | string | boolean> // Runtime variable storage
}

// Device Programming Node Configurations
interface ModeNodeConfig {
  controllerId: string
  port: number
  mode: 'off' | 'on' | 'auto' | 'vpd' | 'timer' | 'cycle' | 'schedule'
  level?: number
  tempTriggerHigh?: number
  tempTriggerLow?: number
  humidityTriggerHigh?: number
  humidityTriggerLow?: number
  vpdTriggerHigh?: number
  vpdTriggerLow?: number
  deviceBehavior?: 'cooling' | 'heating' | 'humidify' | 'dehumidify'
  maxLevel?: number
  minLevel?: number
  transitionEnabled?: boolean
  transitionSpeed?: number
  bufferEnabled?: boolean
  bufferValue?: number
  timerType?: 'on' | 'off'
  timerDuration?: number
  cycleOnDuration?: number
  cycleOffDuration?: number
  scheduleStartTime?: string
  scheduleEndTime?: string
  scheduleDays?: number[]
  leafTempOffset?: number
}

interface VerifiedActionNodeConfig {
  controllerId: string
  port: number
  action: 'on' | 'off' | 'set_level'
  level?: number
  verifyTimeout?: number
  retryCount?: number
  rollbackOnFailure?: boolean
}

interface PortConditionNodeConfig {
  controllerId: string
  port: number
  condition: 'is_on' | 'is_off' | 'level_equals' | 'level_above' | 'level_below' | 'mode_equals'
  targetLevel?: number
  targetMode?: string
}

interface DimmerNodeConfig {
  controllerId: string
  port: number
  sunriseTime?: string
  sunsetTime?: string
  minLevel?: number
  maxLevel?: number
  curve?: DimmerCurveType
}

// Port state snapshot structure
interface PortStateSnapshot {
  port: number
  level: number
  isOn: boolean
  mode: string
  modeId: number
  capturedAt: Date
  rawData?: Record<string, unknown>
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
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
  execution_state: ExecutionState | null
  room?: {
    name: string
  } | null
}

interface SensorReading {
  controller_id: string
  sensor_type: string
  value: number
  timestamp: string
  port?: number
  user_id?: string
}

interface ExecutionResult {
  workflowId: string
  workflowName: string
  status: 'success' | 'failed' | 'skipped' | 'dry_run' | 'conflict'
  actionsExecuted: number
  error?: string
  conflictsWith?: string[] // IDs of conflicting workflows
}

// Target port reference for conflict detection
interface TargetPort {
  controllerId: string
  port: number
  nodeId: string
  nodeType: string
}

/**
 * Extract all target ports from action nodes in a workflow.
 * Used for conflict detection.
 */
function extractTargetPorts(nodes: WorkflowNode[]): TargetPort[] {
  const targets: TargetPort[] = []
  
  for (const node of nodes) {
    if (['action', 'dimmer', 'mode', 'verified_action'].includes(node.type)) {
      const data = node.data as { 
        controllerId?: string
        port?: number
        config?: { controllerId?: string; port?: number }
      }
      
      // Handle both direct properties and nested config
      const controllerId = data.controllerId || data.config?.controllerId
      const port = data.port ?? data.config?.port
      
      if (controllerId && port !== undefined) {
        targets.push({
          controllerId,
          port,
          nodeId: node.id,
          nodeType: node.type,
        })
      }
    }
  }
  
  return targets
}

/**
 * Check if two workflows have conflicting target ports.
 * Returns the list of conflicting port keys (controllerId:port).
 */
function findPortConflicts(targets1: TargetPort[], targets2: TargetPort[]): string[] {
  const keys1 = new Set(targets1.map(t => `${t.controllerId}:${t.port}`))
  const conflicts: string[] = []
  
  for (const t of targets2) {
    const key = `${t.controllerId}:${t.port}`
    if (keys1.has(key)) {
      conflicts.push(key)
    }
  }
  
  return conflicts
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
        execution_state,
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
    
    // Build conflict detection map: port key -> workflow IDs targeting it
    const portTargetMap = new Map<string, { workflowId: string; workflowName: string }[]>()
    const workflowTargets = new Map<string, TargetPort[]>()
    
    for (const workflow of workflows) {
      const parsedNodes: WorkflowNode[] = typeof workflow.nodes === 'string' 
        ? JSON.parse(workflow.nodes) 
        : workflow.nodes || []
      
      const targets = extractTargetPorts(parsedNodes)
      workflowTargets.set(workflow.id, targets)
      
      for (const target of targets) {
        const key = `${target.controllerId}:${target.port}`
        if (!portTargetMap.has(key)) {
          portTargetMap.set(key, [])
        }
        portTargetMap.get(key)!.push({ 
          workflowId: workflow.id, 
          workflowName: workflow.name 
        })
      }
    }
    
    // Find conflicting workflows (same port targeted by multiple workflows)
    const conflictingWorkflows = new Set<string>()
    const workflowConflicts = new Map<string, string[]>() // workflowId -> conflicting workflow names
    
    for (const [portKey, targetingWorkflows] of portTargetMap.entries()) {
      if (targetingWorkflows.length > 1) {
        // Multiple workflows target the same port - mark all as conflicting
        console.warn(`[CONFLICT] Port ${portKey} targeted by ${targetingWorkflows.length} workflows: ${targetingWorkflows.map(w => w.workflowName).join(', ')}`)
        
        for (const wf of targetingWorkflows) {
          conflictingWorkflows.add(wf.workflowId)
          
          // Track which other workflows this one conflicts with
          const others = targetingWorkflows
            .filter(o => o.workflowId !== wf.workflowId)
            .map(o => o.workflowName)
          
          const existing = workflowConflicts.get(wf.workflowId) || []
          workflowConflicts.set(wf.workflowId, [...new Set([...existing, ...others])])
        }
      }
    }
    
    if (conflictingWorkflows.size > 0) {
      console.warn(`[CONFLICT DETECTION] ${conflictingWorkflows.size} workflows blocked due to port conflicts`)
    }
    
    // Execute each workflow
    for (const workflow of workflows) {
      try {
        // Check for conflicts BEFORE execution
        if (conflictingWorkflows.has(workflow.id)) {
          const conflictNames = workflowConflicts.get(workflow.id) || []
          console.warn(`[BLOCKED] Workflow "${workflow.name}" conflicts with: ${conflictNames.join(', ')}`)
          
          // Log the conflict
          await supabase.from('activity_logs').insert({
            user_id: workflow.user_id,
            workflow_id: workflow.id,
            action_type: 'workflow_conflict',
            action_data: {
              conflictsWith: conflictNames,
              blockedPorts: workflowTargets.get(workflow.id)?.map(t => `${t.controllerId}:${t.port}`),
            },
            result: 'blocked',
            error_message: `Workflow blocked: port conflict with ${conflictNames.join(', ')}`,
          })
          
          results.push({
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'conflict',
            actionsExecuted: 0,
            error: `Port conflict with: ${conflictNames.join(', ')}`,
            conflictsWith: conflictNames,
          })
          continue
        }
        
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
    const conflictCount = results.filter(r => r.status === 'conflict').length
    
    return NextResponse.json({
      message: `Processed ${workflows.length} workflows`,
      results: {
        total: workflows.length,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        dryRun: dryRunCount,
        conflict: conflictCount
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
  const { id, user_id, name, nodes, dry_run_enabled, room, execution_state } = workflow

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

  // Initialize runtime variable storage
  let workflowVariables: Record<string, number | string | boolean> = {}
  
  // Check if workflow is paused (from a delay node)
  if (execution_state?.paused_at_node && execution_state?.resume_after) {
    const resumeTime = new Date(execution_state.resume_after)
    const now = new Date()
    
    if (now < resumeTime) {
      // Not yet time to resume
      return {
        workflowId: id,
        workflowName: name,
        status: 'skipped',
        actionsExecuted: 0,
        error: `Paused until ${resumeTime.toISOString()}`
      }
    }
    
    // Time to resume - restore variables and continue from where we left off
    workflowVariables = execution_state.workflow_variables || {}
    console.log(`[Workflow ${name}] Resuming from delay node ${execution_state.paused_at_node}`)
    
    // Clear the execution state and resume
    await supabase
      .from('workflows')
      .update({ execution_state: null })
      .eq('id', id)
    
    // Parse edges and continue from the paused node
    const parsedEdges: WorkflowEdge[] = typeof workflow.edges === 'string'
      ? JSON.parse(workflow.edges)
      : workflow.edges || []
    
    // Execute from the saved next nodes
    return await executeFromNodes(
      supabase,
      workflow,
      parsedNodes,
      parsedEdges,
      execution_state.next_nodes,
      workflowVariables,
      roomName
    )
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
  
  // TriggerNode stores data as { config: { triggerType, ... } } (new UI)
  // Legacy may use { variant, ... } at top level - both supported
  const triggerData = triggerNode.data as Record<string, unknown>

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
  
  // Parse edges for graph traversal
  const parsedEdges: WorkflowEdge[] = typeof workflow.edges === 'string'
    ? JSON.parse(workflow.edges)
    : workflow.edges || []

  // Execute workflow by traversing the graph starting from trigger
  return await executeFromNodes(
    supabase,
    workflow,
    parsedNodes,
    parsedEdges,
    [triggerNode.id],
    workflowVariables,
    roomName
  )
}

/**
 * Execute workflow from specific starting nodes (used for both initial and resumed execution)
 */
async function executeFromNodes(
  supabase: SupabaseClient,
  workflow: Workflow,
  parsedNodes: WorkflowNode[],
  parsedEdges: WorkflowEdge[],
  startingNodes: string[],
  workflowVariables: Record<string, number | string | boolean>,
  roomName?: string
): Promise<ExecutionResult> {
  const { id, user_id, name, dry_run_enabled } = workflow
  
  let actionsExecuted = 0
  const visited = new Set<string>()
  const nodesToExecute: string[] = [...startingNodes]

  while (nodesToExecute.length > 0) {
    const currentNodeId = nodesToExecute.shift()!

    // Skip if already visited (prevent cycles)
    if (visited.has(currentNodeId)) continue
    visited.add(currentNodeId)

    const currentNode = parsedNodes.find(n => n.id === currentNodeId)
    if (!currentNode) continue

    // Skip trigger node (already evaluated)
    if (currentNode.type === 'trigger') {
      // Find all edges from trigger and add their targets to execution queue
      const nextEdges = parsedEdges.filter(e => e.source === currentNodeId)
      nodesToExecute.push(...nextEdges.map(e => e.target))
      continue
    }

    // FIX #12: Handle condition nodes (AND/OR branching logic)
    if (currentNode.type === 'condition') {
      const conditionConfig = (currentNode.data.config || currentNode.data) as { logicType?: 'AND' | 'OR' }
      const logicType = conditionConfig.logicType || 'AND'
      const incomingEdges = parsedEdges.filter(e => e.target === currentNodeId)
      let conditionResult: boolean
      if (logicType === 'AND') {
        conditionResult = incomingEdges.length > 0 && incomingEdges.every(e => visited.has(e.source))
      } else {
        conditionResult = true
      }
      const branchToFollow = conditionResult ? 'true' : 'false'
      const branchEdges = parsedEdges.filter(e => e.source === currentNodeId && e.sourceHandle === branchToFollow)
      if (branchEdges.length > 0) {
        nodesToExecute.push(...branchEdges.map(e => e.target))
      } else {
        const fallbackEdges = parsedEdges.filter(e => e.source === currentNodeId && !e.sourceHandle)
        if (conditionResult && fallbackEdges.length > 0) {
          nodesToExecute.push(...fallbackEdges.map(e => e.target))
        }
      }
      await logActivity(supabase, { user_id, workflow_id: id, action_type: 'condition_evaluated', action_data: { logicType, result: conditionResult, branch: branchToFollow, incomingCount: incomingEdges.length }, result: 'success' })
      continue
    }

    // FIX #13: Handle sensor nodes
    if (currentNode.type === 'sensor') {
      const sensorConfig = (currentNode.data.config || currentNode.data) as {
        controllerId?: string; sensorId?: string; sensorSource?: 'controller' | 'standalone'
        sensorType?: string; port?: number; operator?: string; threshold?: number
      }
      try {
        let sensorReading: SensorReading | undefined
        if (sensorConfig.sensorId && (sensorConfig.sensorSource === 'standalone' || !sensorConfig.controllerId)) {
          const { data: readings } = await supabase.from('sensor_readings').select('*').eq('sensor_id', sensorConfig.sensorId).eq('sensor_type', sensorConfig.sensorType || '').order('timestamp', { ascending: false }).limit(1)
          sensorReading = readings?.[0] as SensorReading | undefined
        } else if (sensorConfig.controllerId) {
          let query = supabase.from('sensor_readings').select('*').eq('controller_id', sensorConfig.controllerId).eq('sensor_type', sensorConfig.sensorType || '').order('timestamp', { ascending: false }).limit(1)
          if (sensorConfig.port !== undefined) { query = query.eq('port', sensorConfig.port) }
          const { data: readings } = await query
          sensorReading = readings?.[0] as SensorReading | undefined
        }
        if (!sensorReading) { await logActivity(supabase, { user_id, workflow_id: id, action_type: 'sensor_evaluated', action_data: { ...sensorConfig, result: false, reason: 'no_reading' }, result: 'skipped' }); continue }
        const value = sensorReading.value
        const threshold = sensorConfig.threshold
        const operator = sensorConfig.operator
        let conditionMet = false
        if (threshold !== undefined && operator) { switch (operator) { case '>': conditionMet = value > threshold; break; case '<': conditionMet = value < threshold; break; case '>=': conditionMet = value >= threshold; break; case '<=': conditionMet = value <= threshold; break; case '=': conditionMet = value === threshold; break; default: conditionMet = false } } else { conditionMet = true }
        await logActivity(supabase, { user_id, workflow_id: id, action_type: 'sensor_evaluated', action_data: { sensorType: sensorConfig.sensorType, controllerId: sensorConfig.controllerId, sensorId: sensorConfig.sensorId, value, operator, threshold, result: conditionMet }, result: 'success' })
        if (conditionMet) { const nextEdges = parsedEdges.filter(e => e.source === currentNodeId && !e.sourceHandle); nodesToExecute.push(...nextEdges.map(e => e.target)) }
      } catch (err) { console.error('[Sensor node error]', err); await logActivity(supabase, { user_id, workflow_id: id, action_type: 'sensor_evaluated', action_data: sensorConfig, result: 'failed', error_message: err instanceof Error ? err.message : 'Unknown error' }) }
      continue
    }

    // Handle delay nodes - pause execution and save state
    if (currentNode.type === 'delay') {
      const delayConfig = currentNode.data.config as DelayNodeConfig
      const delayMs = calculateDelayMs(delayConfig)
      
      if (delayMs > 0) {
        const resumeAfter = new Date(Date.now() + delayMs)
        
        // Get next nodes to execute after delay
        const nextEdges = parsedEdges.filter(e => e.source === currentNodeId && !e.sourceHandle)
        const nextNodes = nextEdges.map(e => e.target)
        
        // Save execution state
        const executionState: ExecutionState = {
          paused_at_node: currentNodeId,
          resume_after: resumeAfter.toISOString(),
          next_nodes: nextNodes,
          workflow_variables: workflowVariables
        }
        
        await supabase
          .from('workflows')
          .update({ execution_state: executionState })
          .eq('id', id)
        
        // Log the delay
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: 'delay_started',
          action_data: {
            duration: delayConfig.duration,
            unit: delayConfig.unit,
            resume_after: resumeAfter.toISOString()
          },
          result: 'success'
        })
        
        console.log(`[Workflow ${name}] Paused at delay node, resuming at ${resumeAfter.toISOString()}`)
        
        // Return early - workflow will resume on next cron run after delay
        return {
          workflowId: id,
          workflowName: name,
          status: 'success',
          actionsExecuted,
          error: `Paused for ${delayConfig.duration} ${delayConfig.unit}`
        }
      }
      
      // Zero delay - continue immediately
      const nextEdges = parsedEdges.filter(e => e.source === currentNodeId && !e.sourceHandle)
      nodesToExecute.push(...nextEdges.map(e => e.target))
      continue
    }

    // Handle variable nodes
    if (currentNode.type === 'variable') {
      const varConfig = currentNode.data.config as VariableNodeConfig
      
      try {
        await handleVariableNode(supabase, user_id, id, varConfig, workflowVariables)
        
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: 'variable_operation',
          action_data: {
            name: varConfig.name,
            scope: varConfig.scope,
            operation: varConfig.operation,
            value: workflowVariables[`${varConfig.scope}.${varConfig.name}`]
          },
          result: 'success'
        })
      } catch (err) {
        console.error(`[Workflow ${name}] Variable operation error:`, err)
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: 'variable_operation',
          action_data: varConfig,
          result: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error'
        })
      }
      
      // Continue to next nodes
      const nextEdges = parsedEdges.filter(e => e.source === currentNodeId && !e.sourceHandle)
      nodesToExecute.push(...nextEdges.map(e => e.target))
      continue
    }

    // Handle debounce nodes
    if (currentNode.type === 'debounce') {
      const debounceConfig = currentNode.data.config as DebounceNodeConfig
      
      try {
        const shouldContinue = await handleDebounceNode(supabase, id, currentNodeId, debounceConfig)
        
        if (!shouldContinue) {
          console.log(`[Workflow ${name}] Debounce blocked execution (cooldown active)`)
          await logActivity(supabase, {
            user_id,
            workflow_id: id,
            action_type: 'debounce_blocked',
            action_data: debounceConfig,
            result: 'skipped'
          })
          
          // Don't add next nodes - stop execution at debounce
          continue
        }
        
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: 'debounce_passed',
          action_data: debounceConfig,
          result: 'success'
        })
      } catch (err) {
        console.error(`[Workflow ${name}] Debounce check error:`, err)
      }
      
      // Continue to next nodes
      const nextEdges = parsedEdges.filter(e => e.source === currentNodeId && !e.sourceHandle)
      nodesToExecute.push(...nextEdges.map(e => e.target))
      continue
    }

    // Handle port_condition nodes specially (branching logic)
    if (currentNode.type === 'port_condition') {
      const conditionConfig = currentNode.data.config as PortConditionNodeConfig

      try {
        // Evaluate the condition
        const conditionResult = await evaluatePortCondition(supabase, conditionConfig)

        console.log(
          `[Workflow ${name}] Port condition on controller ${conditionConfig.controllerId} port ${conditionConfig.port}:`,
          `${conditionConfig.condition} = ${conditionResult}`
        )

        // Find the edge with matching sourceHandle ('true' or 'false')
        const branchToFollow = conditionResult ? 'true' : 'false'
        const branchEdge = parsedEdges.find(
          e => e.source === currentNodeId && e.sourceHandle === branchToFollow
        )

        if (branchEdge) {
          // Follow the matching branch
          nodesToExecute.push(branchEdge.target)
        } else {
          console.warn(
            `[Workflow ${name}] No edge found for port_condition branch: ${branchToFollow}`
          )
        }

        // Log the condition evaluation
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: 'port_condition_evaluated',
          action_data: {
            ...conditionConfig,
            result: conditionResult,
            branch: branchToFollow
          },
          result: 'success'
        })

      } catch (err) {
        console.error(`[Workflow ${name}] Port condition evaluation error:`, err)

        // Log failure and default to false branch
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: 'port_condition_evaluated',
          action_data: {
            controllerId: conditionConfig.controllerId,
            port: conditionConfig.port,
            condition: conditionConfig.condition,
            targetLevel: conditionConfig.targetLevel,
            targetMode: conditionConfig.targetMode
          },
          result: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error'
        })

        // Default to false branch on error
        const falseBranchEdge = parsedEdges.find(
          e => e.source === currentNodeId && e.sourceHandle === 'false'
        )
        if (falseBranchEdge) {
          nodesToExecute.push(falseBranchEdge.target)
        }
      }

      continue
    }

    // Execute action nodes
    if (['action', 'dimmer', 'notification', 'mode', 'verified_action'].includes(currentNode.type)) {
      try {
        if (dry_run_enabled) {
          // Log dry-run
          await logActivity(supabase, {
            user_id,
            workflow_id: id,
            action_type: `dry_run_${currentNode.type}`,
            action_data: currentNode.data,
            result: 'dry_run'
          })
        } else {
          // Execute real action with workflow context
          await executeAction(supabase, user_id, currentNode, {
            workflowId: id,
            workflowName: name,
            roomName,
          })

          // Log success
          await logActivity(supabase, {
            user_id,
            workflow_id: id,
            action_type: currentNode.type,
            action_data: currentNode.data,
            result: 'success'
          })
        }
        actionsExecuted++
      } catch (err) {
        // Log failure
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: currentNode.type,
          action_data: currentNode.data,
          result: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    // Add next nodes to execution queue
    const nextEdges = parsedEdges.filter(e => e.source === currentNodeId && !e.sourceHandle)
    nodesToExecute.push(...nextEdges.map(e => e.target))
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
  const config = triggerData.config as Record<string, unknown> | undefined
  const variant = (config?.triggerType as string) || (triggerData.variant as string)
  const getField = (field: string): unknown => {
    return config?.[field] !== undefined ? config[field] : triggerData[field]
  }

  switch (variant) {
    case 'schedule': {
      const simpleTime = getField('simpleTime') as string | undefined
      const cronExpression = getField('cronExpression') as string | undefined
      const daysOfWeek = getField('daysOfWeek') as number[] | undefined
      if (!simpleTime && !cronExpression) { console.warn('[Schedule Trigger] No time configured - skipping'); return false }
      if (cronExpression && !simpleTime) { console.warn('[Schedule Trigger] cronExpression not supported - skipping'); return false }
      if (simpleTime) {
        const now = new Date()
        const tp = simpleTime.split(':')
        const tH = parseInt(tp[0], 10), tM = parseInt(tp[1], 10)
        if (isNaN(tH) || isNaN(tM)) return false
        if (daysOfWeek && daysOfWeek.length > 0 && daysOfWeek.length < 7) {
          if (!daysOfWeek.includes(now.getDay())) return false
        }
        const tgt = tH * 60 + tM
        const cur = now.getHours() * 60 + now.getMinutes()
        const d = Math.abs(cur - tgt)
        return Math.min(d, 1440 - d) <= 1
      }
      return false
    }

    case 'sensor_threshold': {
      const sensorType = getField('sensorType') as string
      const threshold = getField('threshold') as number
      const operator = getField('operator') as string
      const controllerId = getField('controllerId') as string | undefined
      // FIX #5: Support standalone sensors via sensorId
      const sensorId = getField('sensorId') as string | undefined
      const sensorSource = getField('sensorSource') as string | undefined
      const port = getField('port') as number | undefined

      // Find latest reading of this type
      let reading: SensorReading | undefined

      if (sensorId && (sensorSource === 'standalone' || !controllerId)) {
        // Standalone sensor: query by sensor_id
        reading = sensorReadings.find(r =>
          r.sensor_type === sensorType &&
          (r as unknown as Record<string, unknown>).sensor_id === sensorId
        )
      } else if (controllerId) {
        reading = sensorReadings.find(r =>
          r.sensor_type === sensorType &&
          r.controller_id === controllerId &&
          (port === undefined || r.port === port)
        )
      } else {
        reading = sensorReadings.find(r => r.sensor_type === sensorType)
      }

      if (!reading) return false

      switch (operator) {
        case 'gt': return reading.value > threshold
        case 'lt': return reading.value < threshold
        case 'gte': return reading.value >= threshold
        case 'lte': return reading.value <= threshold
        case 'eq': return reading.value === threshold
        // Also support the standard operators used in UI
        case '>': return reading.value > threshold
        case '<': return reading.value < threshold
        case '>=': return reading.value >= threshold
        case '<=': return reading.value <= threshold
        case '=': return reading.value === threshold
        default: return false
      }
    }

    case 'time_of_day': {
      const triggerTime = (getField('time') as string) // "HH:MM"
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
      const offsetMinutes = (getField('offsetMinutes') as number) || 0

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

    case 'mqtt': {
      // MQTT triggers are evaluated based on cached MQTT messages
      // The actual MQTT subscription and caching happens via a separate service
      const topic = getField('topic') as string
      const jsonPath = getField('jsonPath') as string
      const threshold = getField('threshold') as number
      const operator = getField('operator') as string

      if (!topic) {
        console.warn('[MQTT Trigger] No topic configured')
        return false
      }

      // Get cached MQTT message for this topic
      // In a full implementation, this would query a mqtt_messages cache table
      // For now, we check if the trigger has a lastMessage in its config
      const lastMessage = getField('lastMessage') as string
      if (!lastMessage) {
        // No message received yet
        return false
      }

      // If no condition is set, trigger on any message
      if (!jsonPath || threshold === undefined) {
        return true
      }

      // Parse the message and extract value using JSONPath
      try {
        const payload = JSON.parse(lastMessage)
        const value = extractJsonPath(payload, jsonPath)
        
        if (value === undefined || typeof value !== 'number') {
          console.warn(`[MQTT Trigger] JSONPath ${jsonPath} did not return a number`)
          return false
        }

        // Evaluate condition
        switch (operator) {
          case '>': return value > threshold
          case '<': return value < threshold
          case '>=': return value >= threshold
          case '<=': return value <= threshold
          case '=': return value === threshold
          default: return false
        }
      } catch (parseError) {
        console.warn('[MQTT Trigger] Failed to parse message:', parseError)
        return false
      }
    }

    default:
      console.warn(`[Trigger] Unknown trigger type`)
      return false
  }
}

/**
 * Extract a value from a JSON object using a simple JSONPath-like expression.
 * Supports: $.field, $.nested.field, $.array[0], $.array[0].field
 */
function extractJsonPath(obj: unknown, path: string): unknown {
  if (!path || typeof obj !== 'object' || obj === null) {
    return undefined
  }

  // Remove leading $. if present
  const normalizedPath = path.startsWith('$.') ? path.slice(2) : path

  const parts = normalizedPath.split(/\.|\[|\]/).filter(Boolean)
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    
    if (typeof current !== 'object') {
      return undefined
    }

    // Handle array index
    const index = parseInt(part, 10)
    if (!isNaN(index) && Array.isArray(current)) {
      current = current[index]
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }

  return current
}

/**
 * Evaluate port condition node.
 * Checks the current state of a port against a specified condition.
 *
 * @param supabase - Supabase client instance
 * @param config - Port condition node configuration
 * @returns Promise<boolean> indicating whether the condition is met (true) or not (false)
 */
async function evaluatePortCondition(
  supabase: SupabaseClient,
  config: PortConditionNodeConfig
): Promise<boolean> {
  try {
    // Get current port state from controller_ports table (cached data from polling)
    const { data: portState, error } = await supabase
      .from('controller_ports')
      .select('*')
      .eq('controller_id', config.controllerId)
      .eq('port_number', config.port)
      .single()

    if (error || !portState) {
      console.warn(
        `[Port Condition] Port state not found for controller ${config.controllerId} port ${config.port}:`,
        error?.message || 'No data'
      )
      // Default to false branch when port state is not found
      return false
    }

    // Evaluate the condition based on current port state
    switch (config.condition) {
      case 'is_on':
        // Port is considered "on" if is_on flag is true OR power_level > 0
        return portState.is_on === true || (portState.power_level ?? 0) > 0

      case 'is_off':
        // Port is considered "off" if is_on flag is false AND power_level is 0
        return portState.is_on === false || (portState.power_level ?? 0) === 0

      case 'level_equals':
        // Compare power level to target (with tolerance of ±1 for precision)
        if (config.targetLevel === undefined) return false
        const levelDiff = Math.abs((portState.power_level ?? 0) - config.targetLevel)
        return levelDiff <= 1

      case 'level_above':
        // Check if power level is above target
        return (portState.power_level ?? 0) > (config.targetLevel ?? 0)

      case 'level_below':
        // Check if power level is below target
        return (portState.power_level ?? 0) < (config.targetLevel ?? 10)

      case 'mode_equals':
        // Compare current mode to target mode
        if (!config.targetMode) return false
        // Get mode name from mode_id using the helper function
        const currentMode = mapModeIdToName(portState.current_mode ?? 0)
        return currentMode === config.targetMode

      default:
        console.warn(`[Port Condition] Unknown condition type: ${config.condition}`)
        return false
    }
  } catch (error) {
    console.error('[Port Condition] Error evaluating condition:', error)
    // Default to false branch on error
    return false
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
      const dimmerData = data.config as {
        controllerId?: string
        port?: number
        sunriseTime?: string
        sunsetTime?: string
        minLevel?: number
        maxLevel?: number
        curve?: 'linear' | 'sigmoid' | 'exponential' | 'logarithmic'
      }

      if (dimmerData) {
        await executeDimmerNode(supabase, userId, dimmerData, context)
      }
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

    case 'mode': {
      const modeData = data.config as ModeNodeConfig
      if (modeData) {
        await executeModeNode(supabase, userId, modeData, context)
      }
      break
    }

    case 'verified_action': {
      const verifiedActionData = data.config as VerifiedActionNodeConfig
      if (verifiedActionData) {
        await executeVerifiedActionNode(supabase, userId, verifiedActionData, context)
      }
      break
    }

    default:
      // port_condition nodes are handled during graph traversal, not as actions
      if (type !== 'port_condition') {
        console.log(`Unknown action type: ${type}`)
      }
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

// ============================================
// Flow Control Node Handlers (Delay, Variable, Debounce)
// ============================================

/**
 * Calculate delay in milliseconds from DelayNodeConfig
 */
function calculateDelayMs(config: DelayNodeConfig): number {
  const { duration, unit } = config
  switch (unit) {
    case 'seconds':
      return duration * 1000
    case 'minutes':
      return duration * 60 * 1000
    case 'hours':
      return duration * 60 * 60 * 1000
    default:
      return 0
  }
}

/**
 * Handle variable node operations (set, get, increment, decrement)
 */
async function handleVariableNode(
  supabase: SupabaseClient,
  userId: string,
  workflowId: string,
  config: VariableNodeConfig,
  workflowVariables: Record<string, number | string | boolean>
): Promise<void> {
  const { name, scope, operation, valueType, value, amount } = config
  const varKey = `${scope}.${name}`
  
  if (scope === 'global') {
    // Global variables are stored in the database
    switch (operation) {
      case 'set': {
        await upsertGlobalVariable(supabase, userId, name, valueType, value)
        workflowVariables[varKey] = value!
        break
      }
      case 'get': {
        const globalValue = await getGlobalVariable(supabase, userId, name)
        if (globalValue !== undefined) {
          workflowVariables[varKey] = globalValue
        }
        break
      }
      case 'increment': {
        const current = await getGlobalVariable(supabase, userId, name)
        const newValue = (typeof current === 'number' ? current : 0) + (amount || 1)
        await upsertGlobalVariable(supabase, userId, name, 'number', newValue)
        workflowVariables[varKey] = newValue
        break
      }
      case 'decrement': {
        const current = await getGlobalVariable(supabase, userId, name)
        const newValue = (typeof current === 'number' ? current : 0) - (amount || 1)
        await upsertGlobalVariable(supabase, userId, name, 'number', newValue)
        workflowVariables[varKey] = newValue
        break
      }
    }
  } else {
    // Workflow-scoped variables are stored in memory (persisted in execution_state during delays)
    switch (operation) {
      case 'set':
        workflowVariables[varKey] = value!
        break
      case 'get':
        // Already in memory, nothing to do
        break
      case 'increment': {
        const current = workflowVariables[varKey]
        workflowVariables[varKey] = (typeof current === 'number' ? current : 0) + (amount || 1)
        break
      }
      case 'decrement': {
        const current = workflowVariables[varKey]
        workflowVariables[varKey] = (typeof current === 'number' ? current : 0) - (amount || 1)
        break
      }
    }
  }
}

/**
 * Get a global variable from the database
 */
async function getGlobalVariable(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<number | string | boolean | undefined> {
  const { data, error } = await supabase
    .from('workflow_variables')
    .select('value_type, value_number, value_string, value_boolean')
    .eq('user_id', userId)
    .eq('scope', 'global')
    .eq('name', name)
    .single()
  
  if (error || !data) return undefined
  
  switch (data.value_type) {
    case 'number':
      return data.value_number
    case 'string':
      return data.value_string
    case 'boolean':
      return data.value_boolean
    default:
      return undefined
  }
}

/**
 * Upsert a global variable to the database
 */
async function upsertGlobalVariable(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  valueType: string,
  value: number | string | boolean | undefined
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    workflow_id: null, // Global variables are not tied to a specific workflow
    scope: 'global',
    name,
    value_type: valueType,
    value_number: valueType === 'number' ? value : null,
    value_string: valueType === 'string' ? value : null,
    value_boolean: valueType === 'boolean' ? value : null,
    updated_at: new Date().toISOString()
  }
  
  await supabase
    .from('workflow_variables')
    .upsert(row, {
      onConflict: 'user_id,workflow_id,scope,name'
    })
}

/**
 * Handle debounce node - check if cooldown has passed
 * Returns true if execution should continue, false if blocked by cooldown
 */
async function handleDebounceNode(
  supabase: SupabaseClient,
  workflowId: string,
  nodeId: string,
  config: DebounceNodeConfig
): Promise<boolean> {
  const { cooldownSeconds, executeOnLead } = config
  const now = new Date()
  
  // Check last execution time
  const { data: debounceState, error } = await supabase
    .from('debounce_state')
    .select('last_executed_at, execution_count')
    .eq('workflow_id', workflowId)
    .eq('node_id', nodeId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is OK for first execution
    console.error('Failed to check debounce state:', error)
    return true // Allow execution on error
  }
  
  if (!debounceState) {
    // First execution - record and allow if executeOnLead is true
    if (executeOnLead) {
      await supabase
        .from('debounce_state')
        .insert({
          workflow_id: workflowId,
          node_id: nodeId,
          last_executed_at: now.toISOString(),
          execution_count: 1
        })
      return true
    }
    return false
  }
  
  // Check if cooldown has passed
  const lastExecuted = new Date(debounceState.last_executed_at)
  const cooldownMs = cooldownSeconds * 1000
  const timeSinceLast = now.getTime() - lastExecuted.getTime()
  
  if (timeSinceLast < cooldownMs) {
    // Still in cooldown - block execution
    return false
  }
  
  // Cooldown passed - update and allow
  await supabase
    .from('debounce_state')
    .update({
      last_executed_at: now.toISOString(),
      execution_count: debounceState.execution_count + 1
    })
    .eq('workflow_id', workflowId)
    .eq('node_id', nodeId)
  
  return true
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

// ============================================
// Device Programming Node Execution Handlers
// ============================================

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Helper: Capture current port state
 * Uses the adapter's getPortState method to get complete state snapshot
 */
async function capturePortState(
  supabase: SupabaseClient,
  controllerId: string,
  port: number
): Promise<PortStateSnapshot | null> {
  try {
    // Get controller with decrypted credentials
    const { data: controller, error: controllerError } = await supabase
      .from('controllers')
      .select('*')
      .eq('id', controllerId)
      .single()

    if (controllerError || !controller) {
      console.error('[capturePortState] Controller not found:', controllerError)
      return null
    }

    // Decrypt credentials
    let decryptedCredentials: Record<string, unknown>
    try {
      decryptedCredentials = decryptCredentials(controller.credentials)
    } catch (error) {
      console.error('[capturePortState] Failed to decrypt credentials:', error)
      return null
    }

    // Get adapter and connect
    const brand = controller.brand as ControllerBrand
    if (!isBrandSupported(brand)) {
      console.error('[capturePortState] Unsupported brand:', brand)
      return null
    }

    const adapter = getAdapter(brand)
    const adapterCredentials = buildAdapterCredentials(brand, decryptedCredentials)

    const connectionResult = await adapter.connect(adapterCredentials)
    if (!connectionResult.success) {
      console.error('[capturePortState] Connection failed:', connectionResult.error)
      return null
    }

    try {
      // Use precision control adapter if available
      if ('getPortState' in adapter && typeof adapter.getPortState === 'function') {
        const state = await (adapter as any).getPortState(controller.controller_id, port)
        return state
      }

      // Fallback: query from database
      const { data: portData } = await supabase
        .from('controller_ports')
        .select('*')
        .eq('controller_id', controllerId)
        .eq('port_number', port)
        .single()

      if (portData) {
        return {
          port: portData.port_number,
          level: portData.power_level || 0,
          isOn: portData.is_on || false,
          mode: mapModeIdToName(portData.current_mode || 0),
          modeId: portData.current_mode || 0,
          capturedAt: new Date(),
          rawData: portData
        }
      }

      return null
    } finally {
      await adapter.disconnect(controller.controller_id)
    }
  } catch (error) {
    console.error('[capturePortState] Error:', error)
    return null
  }
}

/**
 * Helper: Map mode ID to mode name
 */
function mapModeIdToName(modeId: number): string {
  const map: Record<number, string> = {
    0: 'off',
    1: 'on',
    2: 'auto',
    3: 'timer',
    4: 'cycle',
    5: 'schedule',
    6: 'vpd',
  }
  return map[modeId] || 'off'
}

/**
 * Helper: Log to command_history table
 */
async function logCommandHistory(
  supabase: SupabaseClient,
  entry: {
    controller_id: string
    user_id?: string
    port: number
    command_type: string
    target_value?: number
    state_before: PortStateSnapshot | null
    state_after?: PortStateSnapshot | null
    success: boolean
    error_message?: string
    verification_passed?: boolean
    verification_attempts?: number
    rollback_attempted?: boolean
    rollback_success?: boolean
    execution_duration_ms?: number
    verification_duration_ms?: number
    total_duration_ms?: number
    api_call_count?: number
    source?: 'user' | 'workflow' | 'schedule' | 'api'
    workflow_id?: string
  }
): Promise<void> {
  try {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    await supabase
      .from('command_history')
      .insert({
        command_id: commandId,
        controller_id: entry.controller_id,
        user_id: entry.user_id,
        port: entry.port,
        command_type: entry.command_type,
        target_value: entry.target_value,
        state_before: entry.state_before,
        state_after: entry.state_after || null,
        success: entry.success,
        error_message: entry.error_message,
        verification_passed: entry.verification_passed,
        verification_attempts: entry.verification_attempts || 0,
        rollback_attempted: entry.rollback_attempted || false,
        rollback_success: entry.rollback_success,
        execution_duration_ms: entry.execution_duration_ms,
        verification_duration_ms: entry.verification_duration_ms,
        total_duration_ms: entry.total_duration_ms,
        api_call_count: entry.api_call_count || 1,
        source: entry.source || 'workflow',
        workflow_id: entry.workflow_id,
        executed_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('[logCommandHistory] Failed to log command:', error)
  }
}

/**
 * Helper: Verify that mode was applied correctly
 */
function verifyModeApplied(
  config: ModeNodeConfig,
  state: PortStateSnapshot | null
): boolean {
  if (!state) return false

  // Check if mode matches
  if (state.mode !== config.mode) {
    return false
  }

  // For 'on' mode, verify level
  if (config.mode === 'on' && config.level !== undefined) {
    // Allow ±1 tolerance
    if (Math.abs(state.level - config.level) > 1) {
      return false
    }
  }

  // For 'off' mode, verify device is off
  if (config.mode === 'off' && state.isOn) {
    return false
  }

  return true
}

/**
 * Helper: Verify that action was executed correctly
 */
function verifyAction(
  config: VerifiedActionNodeConfig,
  state: PortStateSnapshot | null
): boolean {
  if (!state) return false

  switch (config.action) {
    case 'on':
      return state.isOn === true
    case 'off':
      return state.isOn === false
    case 'set_level':
      if (config.level === undefined) return false
      // Allow ±1 tolerance (0-10 scale)
      return Math.abs(state.level - config.level) <= 1
    default:
      return false
  }
}

/**
 * Execute MODE node - Program device modes
 */
async function executeModeNode(
  supabase: SupabaseClient,
  userId: string,
  config: ModeNodeConfig,
  context: ActionContext
): Promise<void> {
  const startTime = Date.now()

  console.log(`[MODE Node] Setting port ${config.port} to mode ${config.mode}`)

  try {
    // Step 1: Get controller and decrypt credentials
    const { data: controller, error: controllerError } = await supabase
      .from('controllers')
      .select('*')
      .eq('id', config.controllerId)
      .eq('user_id', userId)
      .single()

    if (controllerError || !controller) {
      throw new Error(`Controller not found: ${controllerError?.message || 'Unknown error'}`)
    }

    // Handle offline controllers gracefully (per PRD: skip and continue)
    if (controller.status === 'offline') {
      console.warn(`[MODE Node] Controller ${controller.name} is offline - skipping`)
      await logActivity(supabase, {
        user_id: userId,
        workflow_id: context.workflowId,
        controller_id: config.controllerId,
        action_type: 'mode_node_skipped',
        action_data: { port: config.port, mode: config.mode, reason: 'controller_offline' },
        result: 'skipped'
      })
      return
    }

    // Step 2: Capture state before
    const stateBefore = await capturePortState(supabase, config.controllerId, config.port)

    // Step 3: Get adapter and connect
    let decryptedCredentials: Record<string, unknown>
    try {
      decryptedCredentials = decryptCredentials(controller.credentials)
    } catch (error) {
      throw new Error('Failed to decrypt credentials')
    }

    const brand = controller.brand as ControllerBrand
    if (!isBrandSupported(brand)) {
      throw new Error(`Unsupported controller brand: ${brand}`)
    }

    const adapter = getAdapter(brand)
    const adapterCredentials = buildAdapterCredentials(brand, decryptedCredentials)

    const connectionResult = await adapter.connect(adapterCredentials)
    if (!connectionResult.success) {
      throw new Error(`Failed to connect: ${connectionResult.error}`)
    }

    let verified = false
    let attempts = 0
    const maxAttempts = 3
    let stateAfter: PortStateSnapshot | null = null

    try {
      // Step 4: Build mode configuration payload
      const modePayload = {
        mode: config.mode,
        level: config.level,
        tempTriggerHigh: config.tempTriggerHigh,
        tempTriggerLow: config.tempTriggerLow,
        humidityTriggerHigh: config.humidityTriggerHigh,
        humidityTriggerLow: config.humidityTriggerLow,
        vpdTriggerHigh: config.vpdTriggerHigh,
        vpdTriggerLow: config.vpdTriggerLow,
        deviceBehavior: config.deviceBehavior,
        maxLevel: config.maxLevel,
        minLevel: config.minLevel,
        transitionEnabled: config.transitionEnabled,
        transitionSpeed: config.transitionSpeed,
        bufferEnabled: config.bufferEnabled,
        bufferValue: config.bufferValue,
        timerType: config.timerType,
        timerDuration: config.timerDuration,
        cycleOnDuration: config.cycleOnDuration,
        cycleOffDuration: config.cycleOffDuration,
        scheduleStartTime: config.scheduleStartTime,
        scheduleEndTime: config.scheduleEndTime,
        scheduleDays: config.scheduleDays,
        leafTempOffset: config.leafTempOffset,
      }

      // Retry loop with exponential backoff
      while (attempts < maxAttempts && !verified) {
        attempts++

        // Step 5: Set port mode via adapter
        if ('setPortMode' in adapter && typeof adapter.setPortMode === 'function') {
          const result = await (adapter as any).setPortMode(
            controller.controller_id,
            config.port,
            modePayload
          )

          if (!result.success) {
            console.warn(`[MODE Node] Attempt ${attempts} failed:`, result.error)
            if (attempts < maxAttempts) {
              // Exponential backoff: 1s, 2s, 4s
              await sleep(1000 * Math.pow(2, attempts - 1))
              continue
            }
            throw new Error(result.error || 'Failed to set mode')
          }
        } else {
          throw new Error('Adapter does not support setPortMode')
        }

        // Step 6: Wait and verify
        await sleep(2000)
        stateAfter = await capturePortState(supabase, config.controllerId, config.port)
        verified = verifyModeApplied(config, stateAfter)

        if (!verified && attempts < maxAttempts) {
          console.warn(`[MODE Node] Verification failed on attempt ${attempts}, retrying...`)
          await sleep(1000)
        }
      }

      // Step 7: Handle verification failure with rollback
      if (!verified && stateBefore && stateBefore.mode !== config.mode) {
        console.warn(`[MODE Node] Verification failed after ${maxAttempts} attempts, attempting rollback`)

        // Rollback to previous mode
        const rollbackPayload = { mode: stateBefore.mode }
        if ('setPortMode' in adapter && typeof adapter.setPortMode === 'function') {
          await (adapter as any).setPortMode(
            controller.controller_id,
            config.port,
            rollbackPayload
          )
        }

        await sleep(2000)

        // Retry original command once after rollback
        if ('setPortMode' in adapter && typeof adapter.setPortMode === 'function') {
          const retryResult = await (adapter as any).setPortMode(
            controller.controller_id,
            config.port,
            modePayload
          )

          if (retryResult.success) {
            await sleep(2000)
            stateAfter = await capturePortState(supabase, config.controllerId, config.port)
            verified = verifyModeApplied(config, stateAfter)
          }
        }
      }

      const executionDuration = Date.now() - startTime

      // Step 8: Log to command_history
      await logCommandHistory(supabase, {
        controller_id: config.controllerId,
        user_id: userId,
        port: config.port,
        command_type: 'set_mode',
        state_before: stateBefore,
        state_after: stateAfter,
        success: verified,
        verification_passed: verified,
        verification_attempts: attempts,
        rollback_attempted: !verified && stateBefore !== null,
        execution_duration_ms: executionDuration,
        total_duration_ms: executionDuration,
        source: 'workflow',
        workflow_id: context.workflowId
      })

      if (!verified) {
        throw new Error('Mode verification failed after retries and rollback')
      }

      console.log(`[MODE Node] Successfully set port ${config.port} to mode ${config.mode}`)

    } finally {
      await adapter.disconnect(controller.controller_id)
    }

  } catch (error) {
    console.error('[MODE Node] Error:', error)
    throw error
  }
}

/**
 * Execute VERIFIED_ACTION node - Execute actions with verification
 */
async function executeVerifiedActionNode(
  supabase: SupabaseClient,
  userId: string,
  config: VerifiedActionNodeConfig,
  context: ActionContext
): Promise<void> {
  const startTime = Date.now()
  const verifyTimeout = config.verifyTimeout || 2
  const retryCount = config.retryCount || 3
  const rollbackOnFailure = config.rollbackOnFailure !== false

  console.log(`[VERIFIED_ACTION Node] Executing ${config.action} on port ${config.port}`)

  try {
    // Step 1: Get controller
    const { data: controller, error: controllerError } = await supabase
      .from('controllers')
      .select('*')
      .eq('id', config.controllerId)
      .eq('user_id', userId)
      .single()

    if (controllerError || !controller) {
      throw new Error(`Controller not found: ${controllerError?.message || 'Unknown error'}`)
    }

    // Handle offline controllers gracefully
    if (controller.status === 'offline') {
      console.warn(`[VERIFIED_ACTION Node] Controller ${controller.name} is offline - skipping`)
      await logActivity(supabase, {
        user_id: userId,
        workflow_id: context.workflowId,
        controller_id: config.controllerId,
        action_type: 'verified_action_skipped',
        action_data: { port: config.port, action: config.action, reason: 'controller_offline' },
        result: 'skipped'
      })
      return
    }

    // Step 2: Capture state before
    const stateBefore = await capturePortState(supabase, config.controllerId, config.port)

    // Step 3: Get adapter
    let decryptedCredentials: Record<string, unknown>
    try {
      decryptedCredentials = decryptCredentials(controller.credentials)
    } catch (error) {
      throw new Error('Failed to decrypt credentials')
    }

    const brand = controller.brand as ControllerBrand
    const adapter = getAdapter(brand)
    const adapterCredentials = buildAdapterCredentials(brand, decryptedCredentials)

    const connectionResult = await adapter.connect(adapterCredentials)
    if (!connectionResult.success) {
      throw new Error(`Failed to connect: ${connectionResult.error}`)
    }

    let verified = false
    let attempts = 0
    let stateAfter: PortStateSnapshot | null = null

    try {
      // Step 4: Execute action with retries
      while (attempts < retryCount && !verified) {
        attempts++

        // Build device command
        let command: DeviceCommand
        if (config.action === 'on') {
          command = { type: 'turn_on' }
        } else if (config.action === 'off') {
          command = { type: 'turn_off' }
        } else if (config.action === 'set_level' && config.level !== undefined) {
          command = { type: 'set_level', value: config.level * 10 } // Convert 0-10 to 0-100
        } else {
          throw new Error('Invalid action configuration')
        }

        // Execute command
        const commandResult = await adapter.controlDevice(
          controller.controller_id,
          config.port,
          command
        )

        if (!commandResult.success) {
          console.warn(`[VERIFIED_ACTION Node] Attempt ${attempts} failed:`, commandResult.error)
          if (attempts < retryCount) {
            await sleep(1000 * attempts) // Linear backoff
            continue
          }
          throw new Error(commandResult.error || 'Command failed')
        }

        // Wait and verify
        await sleep(verifyTimeout * 1000)
        stateAfter = await capturePortState(supabase, config.controllerId, config.port)
        verified = verifyAction(config, stateAfter)

        if (!verified && attempts < retryCount) {
          console.warn(`[VERIFIED_ACTION Node] Verification failed on attempt ${attempts}, retrying...`)
        }
      }

      // Step 5: Rollback on failure if requested
      if (!verified && rollbackOnFailure && stateBefore) {
        console.warn(`[VERIFIED_ACTION Node] Verification failed, attempting rollback`)

        const rollbackCommand: DeviceCommand = {
          type: 'set_level',
          value: stateBefore.level * 10
        }

        await adapter.controlDevice(controller.controller_id, config.port, rollbackCommand)
      }

      const executionDuration = Date.now() - startTime

      // Step 6: Log to command_history
      await logCommandHistory(supabase, {
        controller_id: config.controllerId,
        user_id: userId,
        port: config.port,
        command_type: config.action,
        target_value: config.level,
        state_before: stateBefore,
        state_after: stateAfter,
        success: verified,
        verification_passed: verified,
        verification_attempts: attempts,
        rollback_attempted: !verified && rollbackOnFailure,
        execution_duration_ms: executionDuration,
        total_duration_ms: executionDuration,
        source: 'workflow',
        workflow_id: context.workflowId
      })

      if (!verified) {
        throw new Error('Action verification failed after retries')
      }

      console.log(`[VERIFIED_ACTION Node] Successfully executed ${config.action} on port ${config.port}`)

    } finally {
      await adapter.disconnect(controller.controller_id)
    }

  } catch (error) {
    console.error('[VERIFIED_ACTION Node] Error:', error)
    throw error
  }
}

/**
 * Execute DIMMER node - Gradual light dimming with sunrise/sunset simulation
 *
 * This node implements smooth light transitions over a configurable period:
 * - Sunrise: Gradually ramp from minLevel to maxLevel
 * - Daytime: Maintain maxLevel
 * - Sunset: Gradually ramp from maxLevel to minLevel
 * - Night: Maintain minLevel
 *
 * The transition uses step-based dimming with configurable curves (linear, sigmoid, etc.)
 * to simulate natural lighting conditions.
 */
async function executeDimmerNode(
  supabase: SupabaseClient,
  userId: string,
  config: DimmerNodeConfig,
  context: ActionContext
): Promise<void> {
  const startTime = Date.now()

  console.log(`[DIMMER Node] Executing dimmer schedule for port ${config.port}`)

  try {
    // Validate configuration
    if (!config.controllerId || config.port === undefined) {
      throw new Error('Invalid dimmer configuration: missing controllerId or port')
    }

    if (!config.sunriseTime || !config.sunsetTime) {
      throw new Error('Invalid dimmer configuration: missing sunrise or sunset time')
    }

    if (config.minLevel === undefined || config.maxLevel === undefined) {
      throw new Error('Invalid dimmer configuration: missing min or max level')
    }

    // Default curve to sigmoid (natural S-curve) if not specified
    const curve = config.curve || 'sigmoid'

    // Parse times (HH:MM format)
    const [sunriseHours, sunriseMinutes] = config.sunriseTime.split(':').map(Number)
    const [sunsetHours, sunsetMinutes] = config.sunsetTime.split(':').map(Number)

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const sunriseTimeMinutes = sunriseHours * 60 + sunriseMinutes
    const sunsetTimeMinutes = sunsetHours * 60 + sunsetMinutes

    // Calculate target level based on current time
    let targetLevel: number
    let transitionPhase: 'sunrise' | 'daytime' | 'sunset' | 'night'

    // Default transition duration: 30 minutes for sunrise/sunset
    const transitionDurationMinutes = 30

    if (currentMinutes < sunriseTimeMinutes) {
      // Before sunrise - night mode
      targetLevel = config.minLevel
      transitionPhase = 'night'
    } else if (currentMinutes < sunriseTimeMinutes + transitionDurationMinutes) {
      // During sunrise transition
      const elapsedMinutes = currentMinutes - sunriseTimeMinutes
      const elapsedMs = elapsedMinutes * 60 * 1000
      const durationMs = transitionDurationMinutes * 60 * 1000

      targetLevel = calculateDimmingValue(
        config.minLevel,
        config.maxLevel,
        elapsedMs,
        durationMs,
        curve
      )
      transitionPhase = 'sunrise'
    } else if (currentMinutes < sunsetTimeMinutes) {
      // Daytime - maintain max level
      targetLevel = config.maxLevel
      transitionPhase = 'daytime'
    } else if (currentMinutes < sunsetTimeMinutes + transitionDurationMinutes) {
      // During sunset transition
      const elapsedMinutes = currentMinutes - sunsetTimeMinutes
      const elapsedMs = elapsedMinutes * 60 * 1000
      const durationMs = transitionDurationMinutes * 60 * 1000

      targetLevel = calculateDimmingValue(
        config.maxLevel,
        config.minLevel,
        elapsedMs,
        durationMs,
        curve
      )
      transitionPhase = 'sunset'
    } else {
      // After sunset - night mode
      targetLevel = config.minLevel
      transitionPhase = 'night'
    }

    console.log(
      `[DIMMER Node] Phase: ${transitionPhase}, Target level: ${targetLevel}%, ` +
      `Curve: ${curve}, Time: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
    )

    // Get controller
    const { data: controller, error: controllerError } = await supabase
      .from('controllers')
      .select('*')
      .eq('id', config.controllerId)
      .eq('user_id', userId)
      .single()

    if (controllerError || !controller) {
      throw new Error(`Controller not found: ${controllerError?.message || 'Unknown error'}`)
    }

    // Handle offline controllers gracefully
    if (controller.status === 'offline') {
      console.warn(`[DIMMER Node] Controller ${controller.name} is offline - skipping`)
      await logActivity(supabase, {
        user_id: userId,
        workflow_id: context.workflowId,
        controller_id: config.controllerId,
        action_type: 'dimmer_skipped',
        action_data: {
          port: config.port,
          phase: transitionPhase,
          targetLevel,
          reason: 'controller_offline'
        },
        result: 'skipped'
      })
      return
    }

    // Check current port state to avoid unnecessary commands
    const { data: portState } = await supabase
      .from('controller_ports')
      .select('power_level')
      .eq('controller_id', config.controllerId)
      .eq('port_number', config.port)
      .single()

    // Round to nearest integer for comparison (AC Infinity uses 0-10 scale)
    const targetLevelScaled = Math.round(targetLevel / 10) // Convert 0-100 to 0-10
    const currentLevelScaled = portState ? Math.round((portState.power_level || 0)) : null

    // Skip if already at target level (within tolerance of ±0.5 on 0-10 scale)
    if (currentLevelScaled !== null && Math.abs(currentLevelScaled - targetLevelScaled) < 1) {
      console.log(
        `[DIMMER Node] Port ${config.port} already at target level ${targetLevelScaled} ` +
        `(current: ${currentLevelScaled}) - skipping command`
      )

      await logActivity(supabase, {
        user_id: userId,
        workflow_id: context.workflowId,
        controller_id: config.controllerId,
        action_type: 'dimmer_skipped',
        action_data: {
          port: config.port,
          phase: transitionPhase,
          targetLevel,
          currentLevel: currentLevelScaled * 10,
          reason: 'already_at_target'
        },
        result: 'skipped'
      })
      return
    }

    // Execute the control command
    await executeDeviceControl(
      supabase,
      userId,
      controller,
      config.port,
      'set_level',
      targetLevel
    )

    const executionDuration = Date.now() - startTime

    // Log success
    await logActivity(supabase, {
      user_id: userId,
      workflow_id: context.workflowId,
      controller_id: config.controllerId,
      action_type: 'dimmer_executed',
      action_data: {
        port: config.port,
        phase: transitionPhase,
        targetLevel,
        previousLevel: currentLevelScaled ? currentLevelScaled * 10 : null,
        curve,
        sunriseTime: config.sunriseTime,
        sunsetTime: config.sunsetTime,
        executionDurationMs: executionDuration
      },
      result: 'success'
    })

    console.log(
      `[DIMMER Node] Successfully set port ${config.port} to ${targetLevel}% ` +
      `(phase: ${transitionPhase}) in ${executionDuration}ms`
    )

  } catch (error) {
    console.error('[DIMMER Node] Error:', error)

    // Log failure
    await logActivity(supabase, {
      user_id: userId,
      workflow_id: context.workflowId,
      controller_id: config.controllerId,
      action_type: 'dimmer_executed',
      action_data: {
        port: config.port,
        sunriseTime: config.sunriseTime,
        sunsetTime: config.sunsetTime
      },
      result: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    })

    throw error
  }
}
