/**
 * EnviroFlow Workflow Executor Edge Function
 *
 * This function is triggered by a cron job (every 60 seconds) to execute
 * active workflows. It walks through each workflow's node graph, evaluates
 * conditions, and executes actions on connected controllers.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Types
interface Controller {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: Record<string, unknown>
  capabilities: Record<string, unknown> | null
  is_online: boolean
  last_seen: string | null
}

interface WorkflowRoom {
  controller_id: string
  controllers: Controller
}

interface WorkflowNode {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'delay'
  position: { x: number; y: number }
  data: {
    label: string
    variant?: string
    sensorType?: string
    operator?: string
    threshold?: number
    port?: number
    level?: number
    deviceType?: string
    duration?: number
    [key: string]: unknown
  }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  data?: {
    branch?: 'true' | 'false'
  }
}

interface Workflow {
  id: string
  user_id: string
  name: string
  description: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  workflow_rooms: WorkflowRoom[]
}

interface SensorReading {
  port: number
  type: string
  value: number
  unit: string
  timestamp: Date
}

interface ExecutionResult {
  workflowId: string
  workflowName: string
  success: boolean
  controllersProcessed: number
  actionsExecuted: number
  errors: string[]
}

// Logger utility
function log(level: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString()
  console.log(JSON.stringify({
    timestamp,
    level,
    source: 'workflow-executor',
    message,
    data,
  }))
}

// Controller adapter abstraction
class AdapterManager {
  private tokens = new Map<string, string>()
  private readonly acInfinityApi = 'https://www.acinfinityserver.com'

  async connect(controller: Controller): Promise<void> {
    if (controller.brand === 'ac_infinity') {
      await this.connectACInfinity(controller)
    }
    // Other adapters would be handled here
  }

  private async connectACInfinity(controller: Controller): Promise<void> {
    const credentials = controller.credentials as {
      email?: string
      password?: string
      encrypted?: boolean
      data?: string
    }

    // Handle encrypted credentials
    let email: string | undefined
    let password: string | undefined

    if (credentials.encrypted && credentials.data) {
      // In production, decrypt credentials using ENCRYPTION_KEY
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY')
      if (encryptionKey) {
        // TODO: Implement decryption
        log('warn', 'Encrypted credentials not yet fully implemented')
      }
      return
    } else {
      email = credentials.email
      password = credentials.password
    }

    if (!email || !password) {
      throw new Error('AC Infinity credentials missing')
    }

    const response = await fetch(`${this.acInfinityApi}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appEmail: email,
        appPasswordl: password, // Note: typo in actual API
      }),
    })

    if (!response.ok) {
      throw new Error(`AC Infinity login failed: ${response.status}`)
    }

    const data = await response.json()
    if (data.code !== 200) {
      throw new Error(`AC Infinity login failed: ${data.msg}`)
    }

    this.tokens.set(controller.controller_id, data.data.token)
    log('debug', 'AC Infinity connected', { controllerId: controller.controller_id })
  }

  async readSensors(controller: Controller): Promise<SensorReading[]> {
    if (controller.brand === 'ac_infinity') {
      return this.readACInfinitySensors(controller)
    }
    return []
  }

  private async readACInfinitySensors(controller: Controller): Promise<SensorReading[]> {
    const token = this.tokens.get(controller.controller_id)
    if (!token) {
      throw new Error('Controller not connected')
    }

    const response = await fetch(`${this.acInfinityApi}/api/dev/getDevSetting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: token,
      },
      body: JSON.stringify({ devId: controller.controller_id }),
    })

    if (!response.ok) {
      throw new Error(`Failed to read sensors: ${response.status}`)
    }

    const data = await response.json()
    const portData = data.data?.portData || []
    const readings: SensorReading[] = []
    const now = new Date()

    const sensorTypeMap: Record<number, string> = {
      1: 'temperature',
      2: 'humidity',
      3: 'vpd',
    }

    for (const port of portData) {
      if (port.devType !== 10 || port.value === null || port.value === undefined) {
        continue
      }

      const sensorType = sensorTypeMap[port.sensorType] || 'unknown'
      let value = port.value

      // VPD is stored as kPa * 10
      if (port.sensorType === 3) {
        value = value / 10
      }

      readings.push({
        port: port.port,
        type: sensorType,
        value,
        unit: sensorType === 'temperature' ? 'F' : sensorType === 'humidity' ? '%' : 'kPa',
        timestamp: now,
      })
    }

    return readings
  }

  async controlDevice(
    controller: Controller,
    port: number,
    level: number
  ): Promise<boolean> {
    if (controller.brand === 'ac_infinity') {
      return this.controlACInfinityDevice(controller, port, level)
    }
    return false
  }

  private async controlACInfinityDevice(
    controller: Controller,
    port: number,
    level: number
  ): Promise<boolean> {
    const token = this.tokens.get(controller.controller_id)
    if (!token) {
      throw new Error('Controller not connected')
    }

    // Map 0-100 to AC Infinity's 0-10 scale
    const power = Math.round(level / 10)

    const response = await fetch(`${this.acInfinityApi}/api/dev/updateDevPort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: token,
      },
      body: JSON.stringify({
        devId: controller.controller_id,
        port,
        speak: power,
        loadState: power > 0 ? 1 : 0,
      }),
    })

    return response.ok
  }

  disconnect(controller: Controller): void {
    this.tokens.delete(controller.controller_id)
  }
}

// Workflow execution engine
class WorkflowEngine {
  private supabase: SupabaseClient
  private adapters: AdapterManager
  private sensorCache = new Map<string, SensorReading[]>()

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
    this.adapters = new AdapterManager()
  }

  async executeWorkflows(): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = []

    // Fetch all active workflows with their rooms and controllers
    const { data: workflows, error } = await this.supabase
      .from('workflows')
      .select(`
        *,
        workflow_rooms (
          controller_id,
          controllers (*)
        )
      `)
      .eq('is_active', true)

    if (error) {
      log('error', 'Failed to fetch workflows', { error: error.message })
      throw error
    }

    log('info', `Found ${workflows?.length || 0} active workflows`)

    for (const workflow of workflows || []) {
      const result = await this.executeWorkflow(workflow as Workflow)
      results.push(result)
    }

    return results
  }

  private async executeWorkflow(workflow: Workflow): Promise<ExecutionResult> {
    const result: ExecutionResult = {
      workflowId: workflow.id,
      workflowName: workflow.name,
      success: true,
      controllersProcessed: 0,
      actionsExecuted: 0,
      errors: [],
    }

    log('info', `Executing workflow: ${workflow.name}`, { workflowId: workflow.id })

    const nodes = workflow.nodes || []
    const edges = workflow.edges || []

    // Find trigger node
    const triggerNode = nodes.find((n) => n.type === 'trigger')
    if (!triggerNode) {
      log('warn', 'No trigger node found', { workflowId: workflow.id })
      result.errors.push('No trigger node found')
      return result
    }

    // Check if trigger condition is met
    const shouldExecute = await this.evaluateTrigger(triggerNode)
    if (!shouldExecute) {
      log('debug', 'Trigger condition not met', { workflowId: workflow.id })
      return result
    }

    // Execute for each connected controller
    const rooms = workflow.workflow_rooms || []
    for (const room of rooms) {
      const controller = room.controllers
      if (!controller) {
        log('warn', 'Room has no controller', { roomControllerId: room.controller_id })
        continue
      }

      if (!controller.is_online) {
        log('info', 'Controller offline, skipping', { controllerId: controller.id })
        continue
      }

      try {
        // Connect to controller
        await this.adapters.connect(controller)

        // Walk node graph from trigger
        const actionsExecuted = await this.walkNodes(
          triggerNode,
          nodes,
          edges,
          controller,
          workflow
        )

        result.actionsExecuted += actionsExecuted
        result.controllersProcessed++

        // Log success
        await this.logActivity(workflow, controller, 'workflow_executed', 'success', {
          trigger: triggerNode.data.label,
          actionsExecuted,
        })

        // Disconnect
        this.adapters.disconnect(controller)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        log('error', 'Error executing workflow for controller', {
          workflowId: workflow.id,
          controllerId: controller.id,
          error: errorMsg,
        })
        result.errors.push(`Controller ${controller.name}: ${errorMsg}`)
        result.success = false

        await this.logActivity(workflow, controller, 'workflow_executed', 'failed', {
          error: errorMsg,
        })
      }
    }

    return result
  }

  private async evaluateTrigger(triggerNode: WorkflowNode): Promise<boolean> {
    const variant = triggerNode.data.variant

    // Timer triggers always execute (cron handles timing)
    if (variant === 'timer') {
      return true
    }

    // Schedule triggers check time-based conditions
    if (variant === 'schedule') {
      // TODO: Implement schedule checking
      return true
    }

    // Manual triggers only execute on manual invocation
    if (variant === 'manual') {
      return false // Not triggered by cron
    }

    // Sensor triggers would check threshold
    if (variant === 'sensor') {
      // Sensor triggers are handled inline during graph walk
      return true
    }

    return true
  }

  private async walkNodes(
    currentNode: WorkflowNode,
    allNodes: WorkflowNode[],
    edges: WorkflowEdge[],
    controller: Controller,
    workflow: Workflow
  ): Promise<number> {
    let actionsExecuted = 0

    // Find outgoing edges from current node
    const outgoingEdges = edges.filter((e) => e.source === currentNode.id)

    for (const edge of outgoingEdges) {
      const nextNode = allNodes.find((n) => n.id === edge.target)
      if (!nextNode) continue

      // Execute based on node type
      if (nextNode.type === 'action') {
        const success = await this.executeAction(nextNode, controller)
        if (success) actionsExecuted++

        // Continue to nodes after action
        actionsExecuted += await this.walkNodes(
          nextNode,
          allNodes,
          edges,
          controller,
          workflow
        )
      } else if (nextNode.type === 'condition') {
        const conditionMet = await this.evaluateCondition(nextNode, controller)

        // Find the correct branch to follow
        const conditionEdges = edges.filter((e) => e.source === nextNode.id)

        for (const condEdge of conditionEdges) {
          const branchType = condEdge.data?.branch
          const shouldFollow =
            (conditionMet && branchType === 'true') ||
            (!conditionMet && branchType === 'false') ||
            !branchType // No branch specified, always follow

          if (shouldFollow) {
            const branchNode = allNodes.find((n) => n.id === condEdge.target)
            if (branchNode) {
              actionsExecuted += await this.walkNodes(
                branchNode,
                allNodes,
                edges,
                controller,
                workflow
              )
            }
          }
        }
      } else if (nextNode.type === 'delay') {
        // Handle delay nodes (skip for now in cron context)
        const duration = nextNode.data.duration || 0
        if (duration > 0 && duration <= 30) {
          // Only wait for short delays
          await new Promise((resolve) => setTimeout(resolve, duration * 1000))
        }

        // Continue after delay
        actionsExecuted += await this.walkNodes(
          nextNode,
          allNodes,
          edges,
          controller,
          workflow
        )
      } else {
        // Unknown node type, continue walking
        actionsExecuted += await this.walkNodes(
          nextNode,
          allNodes,
          edges,
          controller,
          workflow
        )
      }
    }

    return actionsExecuted
  }

  private async executeAction(
    actionNode: WorkflowNode,
    controller: Controller
  ): Promise<boolean> {
    const variant = actionNode.data.variant
    const port = actionNode.data.port
    const level = actionNode.data.level ?? 50

    log('info', `Executing action: ${actionNode.data.label}`, {
      variant,
      port,
      level,
      controllerId: controller.id,
    })

    if (port === undefined) {
      log('warn', 'Action node missing port', { nodeId: actionNode.id })
      return false
    }

    let targetLevel: number

    switch (variant) {
      case 'set_fan':
      case 'set_light':
      case 'set_heater':
      case 'set_humidifier':
      case 'set_dehumidifier':
        targetLevel = level
        break
      case 'turn_on':
        targetLevel = 100
        break
      case 'turn_off':
        targetLevel = 0
        break
      default:
        targetLevel = level
    }

    try {
      const success = await this.adapters.controlDevice(controller, port, targetLevel)
      log('info', `Action ${success ? 'succeeded' : 'failed'}`, {
        action: variant,
        port,
        level: targetLevel,
      })
      return success
    } catch (error) {
      log('error', 'Action execution failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  private async evaluateCondition(
    conditionNode: WorkflowNode,
    controller: Controller
  ): Promise<boolean> {
    const sensorType = conditionNode.data.sensorType
    const operator = conditionNode.data.operator || '>'
    const threshold = conditionNode.data.threshold ?? 0

    if (!sensorType) {
      log('warn', 'Condition node missing sensorType', { nodeId: conditionNode.id })
      return false
    }

    // Get cached sensors or read fresh
    let sensors = this.sensorCache.get(controller.controller_id)
    if (!sensors) {
      sensors = await this.adapters.readSensors(controller)
      this.sensorCache.set(controller.controller_id, sensors)
    }

    const reading = sensors.find((s) => s.type === sensorType)
    if (!reading) {
      log('debug', 'No sensor reading found for condition', {
        sensorType,
        controllerId: controller.controller_id,
      })
      return false
    }

    const value = reading.value
    let result: boolean

    switch (operator) {
      case '>':
        result = value > threshold
        break
      case '<':
        result = value < threshold
        break
      case '>=':
        result = value >= threshold
        break
      case '<=':
        result = value <= threshold
        break
      case '==':
        result = value === threshold
        break
      case '!=':
        result = value !== threshold
        break
      default:
        result = false
    }

    log('debug', 'Condition evaluated', {
      sensorType,
      value,
      operator,
      threshold,
      result,
    })

    return result
  }

  private async logActivity(
    workflow: Workflow,
    controller: Controller,
    action: string,
    result: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('activity_logs').insert({
        user_id: workflow.user_id,
        workflow_id: workflow.id,
        controller_id: controller.id,
        action,
        result,
        metadata,
      })
    } catch (error) {
      log('error', 'Failed to log activity', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  clearSensorCache(): void {
    this.sensorCache.clear()
  }
}

// Main handler
serve(async (req: Request) => {
  const startTime = Date.now()

  // CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    log('info', 'Workflow executor starting')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })

    // Execute workflows
    const engine = new WorkflowEngine(supabase)
    const results = await engine.executeWorkflows()

    const duration = Date.now() - startTime
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

    log('info', 'Workflow execution completed', {
      duration,
      workflowsProcessed: results.length,
      totalErrors,
    })

    return new Response(
      JSON.stringify({
        success: totalErrors === 0,
        duration,
        results,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log('error', 'Workflow executor failed', { error: errorMessage })

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }
})
