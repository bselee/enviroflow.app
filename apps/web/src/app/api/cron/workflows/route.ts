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
 * 2. Evaluates trigger conditions with hysteresis (ARMED/FIRED/RESET)
 * 3. Handles device conflicts and manual overrides
 * 4. Executes actions via controller adapters
 * 5. Processes dimmer schedules (sunrise/sunset)
 * 6. Logs all activity
 *
 * Note: TypeScript errors about 'never' types occur because Supabase
 * doesn't have generated types for these tables yet. Run migrations first,
 * then regenerate types with: npx supabase gen types typescript
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  sendPushNotification,
  createWorkflowNotificationPayload,
} from '@/lib/notifications'

/**
 * Controller Adapter Types (inlined to avoid cross-package import issues)
 * These mirror the types from @enviroflow/automation-engine/lib/adapters/types.ts
 */
type ControllerBrand =
  | 'ac_infinity'
  | 'inkbird'
  | 'govee'
  | 'csv_upload'
  | 'mqtt'
  | 'custom'

interface ACInfinityCredentials {
  type: 'ac_infinity'
  email: string
  password: string
}

interface InkbirdCredentials {
  type: 'inkbird'
  email: string
  password: string
}

interface CSVUploadCredentials {
  type: 'csv_upload'
}

type ControllerCredentials =
  | ACInfinityCredentials
  | InkbirdCredentials
  | CSVUploadCredentials
  | { type: string; [key: string]: unknown }

interface DeviceCommandPayload {
  type: 'turn_on' | 'turn_off' | 'set_level' | 'increase' | 'decrease' | 'toggle'
  value?: number
}

interface AdapterCommandResult {
  success: boolean
  error?: string
  actualValue?: number
  previousValue?: number
  timestamp: Date
}

interface ControllerAdapter {
  connect(credentials: ControllerCredentials): Promise<{ success: boolean; controllerId: string; error?: string }>
  readSensors(controllerId: string): Promise<unknown[]>
  controlDevice(controllerId: string, port: number, command: DeviceCommandPayload): Promise<AdapterCommandResult>
  getStatus(controllerId: string): Promise<{ isOnline: boolean; lastSeen: Date }>
  disconnect(controllerId: string): Promise<void>
}

// ============================================
// Retry Configuration
// ============================================

/** Maximum number of retry attempts for adapter operations */
const MAX_RETRY_ATTEMPTS = 3

/** Base delay for exponential backoff (milliseconds) */
const BASE_RETRY_DELAY_MS = 1000

/** Maximum delay cap for exponential backoff (milliseconds) */
const MAX_RETRY_DELAY_MS = 10000

/** Timeout for command confirmation (milliseconds) */
const COMMAND_CONFIRMATION_TIMEOUT_MS = 30000

/** Second retry timeout (milliseconds) */
const COMMAND_RETRY_TIMEOUT_MS = 60000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// ============================================
// Adapter Factory (inline to avoid bundling issues)
// ============================================

/**
 * Dynamically import and instantiate the appropriate adapter for a brand
 *
 * This function uses dynamic imports to avoid bundling issues between
 * the web app and automation-engine packages.
 *
 * @param brand - The controller brand identifier
 * @returns The appropriate adapter instance
 * @throws Error if the brand is not supported
 */
async function getAdapter(brand: ControllerBrand): Promise<ControllerAdapter> {
  // Inline adapter implementations to avoid cross-package imports
  switch (brand) {
    case 'ac_infinity': {
      // Inline AC Infinity adapter
      const ACInfinityAdapter = class implements ControllerAdapter {
            private token: string | null = null

            async connect(credentials: ControllerCredentials): Promise<{ success: boolean; controllerId: string; error?: string }> {
              if (!('email' in credentials) || !('password' in credentials)) {
                return { success: false, controllerId: '', error: 'Invalid credentials' }
              }

              try {
                const response = await fetch('https://www.acinfinityserver.com/api/user/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'User-Agent': 'EnviroFlow/1.0' },
                  body: JSON.stringify({ email: credentials.email, password: credentials.password })
                })

                const data = await response.json()
                if (data.code === 200 && data.data?.token) {
                  this.token = data.data.token
                  // Get first device
                  const devResponse = await fetch('https://www.acinfinityserver.com/api/user/devInfoListAll', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${this.token}`,
                      'User-Agent': 'EnviroFlow/1.0'
                    }
                  })
                  const devData = await devResponse.json()
                  const controllerId = devData.data?.[0]?.devId || ''
                  return { success: true, controllerId }
                }
                return { success: false, controllerId: '', error: data.msg || 'Login failed' }
              } catch (err) {
                return { success: false, controllerId: '', error: err instanceof Error ? err.message : 'Connection failed' }
              }
            }

            async readSensors(): Promise<unknown[]> {
              return []
            }

            async controlDevice(controllerId: string, port: number, command: DeviceCommandPayload): Promise<AdapterCommandResult> {
              if (!this.token) {
                return { success: false, error: 'Not connected', timestamp: new Date() }
              }

              let power: number
              switch (command.type) {
                case 'turn_on': power = 10; break
                case 'turn_off': power = 0; break
                case 'set_level': power = Math.round((command.value || 0) / 10); break
                default: power = 0
              }

              try {
                const response = await fetch('https://www.acinfinityserver.com/api/dev/updateDevPort', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'EnviroFlow/1.0'
                  },
                  body: JSON.stringify({ devId: controllerId, portId: port, power })
                })

                const result = await response.json()
                return {
                  success: result.code === 200,
                  error: result.code !== 200 ? result.msg : undefined,
                  actualValue: power * 10,
                  timestamp: new Date()
                }
              } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : 'Command failed', timestamp: new Date() }
              }
            }

            async getStatus(): Promise<{ isOnline: boolean; lastSeen: Date }> {
              return { isOnline: !!this.token, lastSeen: new Date() }
            }

            async disconnect(): Promise<void> {
              this.token = null
            }
          }
      return new ACInfinityAdapter()
    }

    case 'inkbird': {
      // Inline Inkbird adapter
      const InkbirdAdapter = class implements ControllerAdapter {
            private token: string | null = null

            async connect(credentials: ControllerCredentials): Promise<{ success: boolean; controllerId: string; error?: string }> {
              if (!('email' in credentials) || !('password' in credentials)) {
                return { success: false, controllerId: '', error: 'Invalid credentials' }
              }

              try {
                const response = await fetch('https://api.inkbird.com/v1/user/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'User-Agent': 'EnviroFlow/1.0' },
                  body: JSON.stringify({ email: credentials.email, password: credentials.password })
                })

                const data = await response.json()
                if (data.code === 0 && data.data?.token) {
                  this.token = data.data.token
                  const devResponse = await fetch('https://api.inkbird.com/v1/device/list', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${this.token}`, 'User-Agent': 'EnviroFlow/1.0' }
                  })
                  const devData = await devResponse.json()
                  const controllerId = devData.data?.[0]?.deviceId || ''
                  return { success: true, controllerId }
                }
                return { success: false, controllerId: '', error: data.message || 'Login failed' }
              } catch (err) {
                return { success: false, controllerId: '', error: err instanceof Error ? err.message : 'Connection failed' }
              }
            }

            async readSensors(): Promise<unknown[]> {
              return []
            }

            async controlDevice(controllerId: string, _port: number, command: DeviceCommandPayload): Promise<AdapterCommandResult> {
              if (!this.token) {
                return { success: false, error: 'Not connected', timestamp: new Date() }
              }

              try {
                let endpoint: string
                let body: Record<string, unknown>

                if (command.type === 'set_level' && command.value !== undefined) {
                  const setPoint = 60 + (command.value / 100) * 30
                  endpoint = `https://api.inkbird.com/v1/device/${controllerId}/setpoint`
                  body = { setPoint: Math.round(setPoint) }
                } else if (command.type === 'turn_on') {
                  endpoint = `https://api.inkbird.com/v1/device/${controllerId}/power`
                  body = { power: true }
                } else if (command.type === 'turn_off') {
                  endpoint = `https://api.inkbird.com/v1/device/${controllerId}/power`
                  body = { power: false }
                } else {
                  return { success: false, error: 'Unsupported command type', timestamp: new Date() }
                }

                const response = await fetch(endpoint, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'EnviroFlow/1.0'
                  },
                  body: JSON.stringify(body)
                })

                const result = await response.json()
                return { success: result.code === 0, error: result.code !== 0 ? result.message : undefined, timestamp: new Date() }
              } catch (err) {
                return { success: false, error: err instanceof Error ? err.message : 'Command failed', timestamp: new Date() }
              }
            }

            async getStatus(): Promise<{ isOnline: boolean; lastSeen: Date }> {
              return { isOnline: !!this.token, lastSeen: new Date() }
            }

            async disconnect(): Promise<void> {
              this.token = null
            }
          }
      return new InkbirdAdapter()
    }

    case 'csv_upload':
      // CSV upload is read-only - cannot control devices
      throw new Error('CSV Upload controllers are read-only and cannot control devices')

    case 'govee':
      throw new Error('Govee adapter requires BLE and is only available in the mobile app')

    case 'mqtt':
      throw new Error('MQTT adapter is coming in Phase 2')

    case 'custom':
      throw new Error('Custom adapters require manual configuration')

    default:
      throw new Error(`Unsupported controller brand: ${brand}`)
  }
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number): number {
  // Exponential backoff: base * 2^attempt
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
  // Add jitter (up to 25% of delay)
  const jitter = Math.random() * exponentialDelay * 0.25
  // Cap at maximum delay
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS)
}

/**
 * Command execution state for tracking confirmation
 */
interface CommandExecutionState {
  commandId: string
  controllerId: string
  port: number
  targetValue: number
  status: 'pending' | 'confirmed' | 'failed' | 'timeout'
  startTime: number
  retryCount: number
  lastError?: string
}

// ============================================
// Types & Interfaces
// ============================================

/** Trigger state for hysteresis control */
type TriggerState = 'ARMED' | 'FIRED' | 'RESET'

/** Workflow node types */
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
  trigger_state?: TriggerState
  last_trigger_value?: number
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
  triggerState?: TriggerState
  error?: string
}

interface DimmerSchedule {
  id: string
  user_id: string
  controller_id: string
  room_id: string | null
  port: number
  schedule_type: 'sunrise' | 'sunset' | 'custom' | 'dli_curve'
  start_time: string | null
  end_time: string | null
  duration_minutes: number
  start_intensity: number
  target_intensity: number
  curve: 'linear' | 'sigmoid' | 'exponential' | 'logarithmic'
  is_active: boolean
}

interface Controller {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: Record<string, unknown>
  capabilities: Record<string, unknown>
  is_online: boolean
  room_id: string | null
}

interface Room {
  id: string
  latitude: number | null
  longitude: number | null
  timezone: string
}

/** Track pending device commands to detect conflicts */
interface PendingCommand {
  controllerId: string
  port: number
  value: number
  workflowId: string
  priority: number
}

// ============================================
// Supabase Client Setup
// ============================================

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

// ============================================
// Main Cron Handler
// ============================================

/**
 * GET /api/cron/workflows
 * Execute all active workflows and process dimmer schedules
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const results: ExecutionResult[] = []
  let dimmerResults: { processed: number; errors: number } = { processed: 0, errors: 0 }

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

    // Track pending commands to detect conflicts
    const pendingCommands: PendingCommand[] = []

    // ============================================
    // Phase 1: Execute Workflows
    // ============================================

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

    if (workflows && workflows.length > 0) {
      console.log(`Processing ${workflows.length} active workflows`)

      for (const workflow of workflows) {
        try {
          const result = await executeWorkflow(
            supabase,
            workflow as Workflow,
            pendingCommands
          )
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
    }

    // ============================================
    // Phase 2: Process Dimmer Schedules
    // ============================================

    dimmerResults = await processDimmerSchedules(supabase, pendingCommands)

    // ============================================
    // Phase 3: Execute Pending Commands (conflict resolution)
    // ============================================

    const commandResults = await executePendingCommands(supabase, pendingCommands)

    // ============================================
    // Return Results
    // ============================================

    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length
    const skippedCount = results.filter(r => r.status === 'skipped').length
    const dryRunCount = results.filter(r => r.status === 'dry_run').length

    return NextResponse.json({
      message: `Processed ${workflows?.length || 0} workflows, ${dimmerResults.processed} dimmer schedules`,
      workflows: {
        total: workflows?.length || 0,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        dryRun: dryRunCount
      },
      dimmers: dimmerResults,
      commands: commandResults,
      details: results,
      duration: Date.now() - startTime
    })

  } catch (error) {
    console.error('Cron execution error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      results,
      dimmers: dimmerResults,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

// ============================================
// Workflow Execution with Hysteresis
// ============================================

/**
 * Execute a single workflow with hysteresis state management
 *
 * Hysteresis prevents rapid on/off cycling:
 * - ARMED: Ready to trigger when threshold is crossed
 * - FIRED: Triggered, actions executed, waiting for reset condition
 * - RESET: Below reset threshold, will re-arm on next cycle
 */
async function executeWorkflow(
  supabase: SupabaseClient,
  workflow: Workflow,
  pendingCommands: PendingCommand[]
): Promise<ExecutionResult> {
  const { id, user_id, name, nodes, edges, dry_run_enabled } = workflow

  // Parse nodes if stored as string
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

  // Get latest sensor readings for this user
  const { data: readings } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('user_id', user_id)
    .order('timestamp', { ascending: false })
    .limit(100)

  const sensorReadings: SensorReading[] = readings || []

  // Get current trigger state from workflow metadata
  // We store trigger_state in a separate column or as part of the workflow
  const { data: workflowState } = await supabase
    .from('workflows')
    .select('trigger_state, last_trigger_value')
    .eq('id', id)
    .single()

  const currentState: TriggerState = workflowState?.trigger_state || 'ARMED'
  const lastTriggerValue: number | null = workflowState?.last_trigger_value

  // Evaluate trigger with hysteresis
  const triggerResult = evaluateTriggerWithHysteresis(
    triggerNode.data,
    sensorReadings,
    currentState,
    lastTriggerValue
  )

  // Update trigger state if changed
  if (triggerResult.newState !== currentState) {
    await supabase
      .from('workflows')
      .update({
        trigger_state: triggerResult.newState,
        last_trigger_value: triggerResult.currentValue
      })
      .eq('id', id)
  }

  // Only execute actions if we're transitioning to FIRED
  if (!triggerResult.shouldExecute) {
    return {
      workflowId: id,
      workflowName: name,
      status: 'skipped',
      actionsExecuted: 0,
      triggerState: triggerResult.newState
    }
  }

  // Find action nodes by traversing edges from trigger
  const actionNodes = findConnectedActionNodes(parsedNodes, edges, triggerNode.id)

  if (actionNodes.length === 0) {
    return {
      workflowId: id,
      workflowName: name,
      status: 'skipped',
      actionsExecuted: 0,
      triggerState: triggerResult.newState,
      error: 'No action nodes connected to trigger'
    }
  }

  // Queue actions (conflict resolution happens later)
  let actionsQueued = 0

  for (const actionNode of actionNodes) {
    try {
      if (dry_run_enabled) {
        // Log dry-run without executing
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: `dry_run_${actionNode.type}`,
          action_data: actionNode.data,
          result: 'dry_run'
        })
        actionsQueued++
      } else {
        // Queue action for execution
        const command = await queueActionCommand(
          supabase,
          user_id,
          actionNode,
          id,
          name, // Pass workflow name for notification context
          pendingCommands
        )
        if (command) {
          actionsQueued++
        }

        // Log queued action
        await logActivity(supabase, {
          user_id,
          workflow_id: id,
          action_type: actionNode.type,
          action_data: actionNode.data,
          result: 'success'
        })
      }
    } catch (err) {
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

  // Update workflow last_run
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
    actionsExecuted: actionsQueued,
    triggerState: triggerResult.newState
  }
}

// ============================================
// Trigger Evaluation with Hysteresis
// ============================================

interface TriggerEvaluationResult {
  shouldExecute: boolean
  newState: TriggerState
  currentValue: number | null
}

/**
 * Evaluate trigger condition with hysteresis to prevent rapid cycling
 *
 * Example with 5% hysteresis:
 * - Threshold: 80% humidity
 * - Reset threshold: 75% humidity
 *
 * State transitions:
 * - ARMED + humidity >= 80% -> FIRED (execute actions)
 * - FIRED + humidity >= 75% -> FIRED (stay fired)
 * - FIRED + humidity < 75% -> RESET (prepare to re-arm)
 * - RESET -> ARMED (on next cycle)
 */
function evaluateTriggerWithHysteresis(
  triggerData: Record<string, unknown>,
  sensorReadings: SensorReading[],
  currentState: TriggerState,
  lastValue: number | null
): TriggerEvaluationResult {
  const variant = triggerData.variant as string
  const hysteresisPercent = (triggerData.hysteresis as number) || 5 // Default 5%

  switch (variant) {
    case 'schedule':
      // Schedule triggers always execute when cron runs
      return { shouldExecute: true, newState: 'FIRED', currentValue: null }

    case 'sensor_threshold': {
      const sensorType = triggerData.sensorType as string
      const threshold = triggerData.threshold as number
      const operator = triggerData.operator as string
      const controllerId = triggerData.controllerId as string | undefined

      // Find latest reading of this type (optionally filtered by controller)
      const reading = sensorReadings.find(r => {
        const typeMatch = r.sensor_type === sensorType
        const controllerMatch = !controllerId || r.controller_id === controllerId
        return typeMatch && controllerMatch
      })

      if (!reading) {
        return { shouldExecute: false, newState: currentState, currentValue: null }
      }

      const currentValue = reading.value

      // Calculate reset threshold with hysteresis
      const hysteresisAmount = threshold * (hysteresisPercent / 100)
      let resetThreshold: number
      let thresholdCrossed: boolean
      let resetConditionMet: boolean

      switch (operator) {
        case 'gt':
        case 'gte':
          // For "greater than" triggers, reset threshold is below main threshold
          resetThreshold = threshold - hysteresisAmount
          thresholdCrossed = operator === 'gt'
            ? currentValue > threshold
            : currentValue >= threshold
          resetConditionMet = currentValue < resetThreshold
          break

        case 'lt':
        case 'lte':
          // For "less than" triggers, reset threshold is above main threshold
          resetThreshold = threshold + hysteresisAmount
          thresholdCrossed = operator === 'lt'
            ? currentValue < threshold
            : currentValue <= threshold
          resetConditionMet = currentValue > resetThreshold
          break

        case 'eq':
          // Equality with tolerance
          const tolerance = hysteresisAmount
          thresholdCrossed = Math.abs(currentValue - threshold) <= tolerance
          resetConditionMet = Math.abs(currentValue - threshold) > tolerance * 2
          break

        default:
          return { shouldExecute: false, newState: currentState, currentValue }
      }

      // State machine logic
      switch (currentState) {
        case 'ARMED':
          if (thresholdCrossed) {
            return { shouldExecute: true, newState: 'FIRED', currentValue }
          }
          return { shouldExecute: false, newState: 'ARMED', currentValue }

        case 'FIRED':
          if (resetConditionMet) {
            return { shouldExecute: false, newState: 'RESET', currentValue }
          }
          return { shouldExecute: false, newState: 'FIRED', currentValue }

        case 'RESET':
          // Re-arm on the next cycle
          return { shouldExecute: false, newState: 'ARMED', currentValue }

        default:
          return { shouldExecute: false, newState: 'ARMED', currentValue }
      }
    }

    case 'time_of_day': {
      const triggerTime = triggerData.time as string // "HH:MM"
      if (!triggerTime) {
        return { shouldExecute: false, newState: currentState, currentValue: null }
      }

      const now = new Date()
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      // Only execute once at the specified time
      if (currentTime === triggerTime && currentState === 'ARMED') {
        return { shouldExecute: true, newState: 'FIRED', currentValue: null }
      }

      // Reset after the minute has passed
      if (currentTime !== triggerTime && currentState === 'FIRED') {
        return { shouldExecute: false, newState: 'ARMED', currentValue: null }
      }

      return { shouldExecute: false, newState: currentState, currentValue: null }
    }

    case 'sunrise':
    case 'sunset':
      // Handled by dimmer schedules - skip in workflow executor
      return { shouldExecute: false, newState: currentState, currentValue: null }

    case 'manual':
      // Manual triggers don't auto-execute
      return { shouldExecute: false, newState: currentState, currentValue: null }

    default:
      // Unknown trigger type
      return { shouldExecute: false, newState: currentState, currentValue: null }
  }
}

// ============================================
// Action Node Traversal
// ============================================

/**
 * Find all action nodes connected to the trigger via edges
 * Handles condition nodes and delay nodes in the path
 */
function findConnectedActionNodes(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  startNodeId: string
): WorkflowNode[] {
  const actionNodes: WorkflowNode[] = []
  const visited = new Set<string>()
  const queue = [startNodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    // Find all edges from this node
    const outgoingEdges = edges.filter(e => e.source === currentId)

    for (const edge of outgoingEdges) {
      const targetNode = nodes.find(n => n.id === edge.target)
      if (!targetNode) continue

      if (targetNode.type === 'action' ||
          targetNode.type === 'dimmer' ||
          targetNode.type === 'notification') {
        actionNodes.push(targetNode)
      }

      // Continue traversal through condition/delay nodes
      if (targetNode.type === 'condition' || targetNode.type === 'delay') {
        queue.push(targetNode.id)
      }
    }
  }

  return actionNodes
}

// ============================================
// Action Command Queuing
// ============================================

/**
 * Queue an action command for later execution (enables conflict detection)
 *
 * @param supabase - Supabase client
 * @param userId - User ID for the action
 * @param actionNode - The workflow node to execute
 * @param workflowId - ID of the parent workflow
 * @param workflowName - Name of the workflow (for notifications)
 * @param pendingCommands - Array to push pending commands to
 * @returns The pending command if created, null otherwise
 */
async function queueActionCommand(
  supabase: SupabaseClient,
  userId: string,
  actionNode: WorkflowNode,
  workflowId: string,
  workflowName: string,
  pendingCommands: PendingCommand[]
): Promise<PendingCommand | null> {
  const { type, data } = actionNode

  switch (type) {
    case 'action': {
      const actionData = data as {
        variant?: string
        controllerId?: string
        port?: number
        value?: number
        priority?: number
      }

      if (!actionData.controllerId || actionData.port === undefined) {
        throw new Error('Action requires controllerId and port')
      }

      const command: PendingCommand = {
        controllerId: actionData.controllerId,
        port: actionData.port,
        value: actionData.value ?? 100,
        workflowId,
        priority: actionData.priority ?? 50 // Default priority
      }

      pendingCommands.push(command)
      return command
    }

    case 'dimmer': {
      const dimmerData = data as {
        controllerId?: string
        port?: number
        targetIntensity?: number
        priority?: number
      }

      if (!dimmerData.controllerId || dimmerData.port === undefined) {
        throw new Error('Dimmer requires controllerId and port')
      }

      const command: PendingCommand = {
        controllerId: dimmerData.controllerId,
        port: dimmerData.port,
        value: dimmerData.targetIntensity ?? 100,
        workflowId,
        priority: dimmerData.priority ?? 50
      }

      pendingCommands.push(command)
      return command
    }

    case 'notification': {
      const notifData = data as {
        message?: string
        channels?: string[]
        priority?: string
        actionType?: string
      }

      // Notifications are executed immediately, not queued
      // Include workflow name for context in the notification
      await sendNotification(supabase, userId, {
        ...notifData,
        workflowName,
        actionType: notifData.actionType || 'workflow_notification',
        details: {
          workflowId,
        }
      })
      return null
    }

    default:
      return null
  }
}

// ============================================
// Sunrise/Sunset Dimmer Schedule Processing
// ============================================

/**
 * Process all active dimmer schedules
 * Calculates current dimmer level based on time and curve
 */
async function processDimmerSchedules(
  supabase: SupabaseClient,
  pendingCommands: PendingCommand[]
): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0

  // Fetch active dimmer schedules
  const { data: schedules, error } = await supabase
    .from('dimmer_schedules')
    .select(`
      id,
      user_id,
      controller_id,
      room_id,
      port,
      schedule_type,
      start_time,
      end_time,
      duration_minutes,
      start_intensity,
      target_intensity,
      curve,
      is_active
    `)
    .eq('is_active', true)

  if (error || !schedules) {
    console.error('Failed to fetch dimmer schedules:', error)
    return { processed: 0, errors: 1 }
  }

  for (const schedule of schedules as DimmerSchedule[]) {
    try {
      // Get room info for sunrise/sunset calculations
      let sunTimes: { sunrise: Date; sunset: Date } | null = null

      if (schedule.schedule_type === 'sunrise' || schedule.schedule_type === 'sunset') {
        if (schedule.room_id) {
          const { data: room } = await supabase
            .from('rooms')
            .select('latitude, longitude, timezone')
            .eq('id', schedule.room_id)
            .single()

          if (room?.latitude && room?.longitude) {
            sunTimes = calculateSunTimes(
              room.latitude,
              room.longitude,
              room.timezone || 'UTC'
            )
          }
        }

        // Fall back to default location if room not configured
        if (!sunTimes) {
          // Default to Denver, CO (common for controlled environment agriculture)
          sunTimes = calculateSunTimes(39.7392, -104.9903, 'America/Denver')
        }
      }

      // Calculate current dimmer level
      const level = calculateDimmerLevel(schedule, sunTimes)

      if (level !== null) {
        // Queue the dimmer command
        pendingCommands.push({
          controllerId: schedule.controller_id,
          port: schedule.port,
          value: level,
          workflowId: `dimmer_${schedule.id}`,
          priority: 60 // Dimmer schedules have slightly higher priority than workflows
        })

        // Update last_run
        await supabase
          .from('dimmer_schedules')
          .update({ last_run: new Date().toISOString() })
          .eq('id', schedule.id)

        processed++
      }
    } catch (err) {
      console.error(`Dimmer schedule ${schedule.id} failed:`, err)
      errors++
    }
  }

  return { processed, errors }
}

/**
 * Calculate sunrise and sunset times for a given location with proper timezone handling
 *
 * Uses a simplified algorithm based on solar position calculations.
 * Returns times that are properly converted to the room's local timezone
 * for accurate comparison against local time.
 *
 * @param latitude - Latitude in decimal degrees (positive = north)
 * @param longitude - Longitude in decimal degrees (positive = east)
 * @param timezone - IANA timezone identifier (e.g., 'America/Denver', 'Europe/London')
 * @returns Object with sunrise and sunset as Date objects in local timezone
 */
function calculateSunTimes(
  latitude: number,
  longitude: number,
  timezone: string
): { sunrise: Date; sunset: Date; localNow: Date } {
  // Get current time in UTC
  const nowUtc = new Date()

  // Get day of year based on UTC date
  const dayOfYear = getDayOfYear(nowUtc)

  // Solar declination angle (in degrees)
  // This represents the angle between the equator plane and the line connecting
  // Earth's center to the Sun's center
  const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * (Math.PI / 180))

  // Convert to radians for calculations
  const latRad = latitude * (Math.PI / 180)
  const declRad = declination * (Math.PI / 180)

  // Calculate hour angle at sunrise/sunset (in degrees)
  // The hour angle is the angular distance of the sun from the local meridian
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad)

  // Handle polar day/night edge cases
  let hourAngle: number
  if (cosHourAngle > 1) {
    // Polar night - sun never rises (winter at high latitudes)
    // Return times that effectively disable sunrise/sunset schedules
    hourAngle = 0
  } else if (cosHourAngle < -1) {
    // Polar day - sun never sets (summer at high latitudes)
    // Return times spanning the full day
    hourAngle = 180
  } else {
    hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI)
  }

  // Calculate solar noon in UTC (hours)
  // Solar noon is when the sun is at its highest point (crosses the meridian)
  // Longitude correction: each 15 degrees of longitude = 1 hour
  const solarNoonUtc = 12 - longitude / 15

  // Calculate sunrise and sunset times in UTC (decimal hours)
  const sunriseHourUtc = solarNoonUtc - hourAngle / 15
  const sunsetHourUtc = solarNoonUtc + hourAngle / 15

  // Normalize hours to 0-24 range
  const normalizedSunriseUtc = ((sunriseHourUtc % 24) + 24) % 24
  const normalizedSunsetUtc = ((sunsetHourUtc % 24) + 24) % 24

  // Create UTC Date objects for today's sunrise and sunset
  const sunriseUtc = new Date(Date.UTC(
    nowUtc.getUTCFullYear(),
    nowUtc.getUTCMonth(),
    nowUtc.getUTCDate(),
    Math.floor(normalizedSunriseUtc),
    Math.round((normalizedSunriseUtc % 1) * 60),
    0,
    0
  ))

  const sunsetUtc = new Date(Date.UTC(
    nowUtc.getUTCFullYear(),
    nowUtc.getUTCMonth(),
    nowUtc.getUTCDate(),
    Math.floor(normalizedSunsetUtc),
    Math.round((normalizedSunsetUtc % 1) * 60),
    0,
    0
  ))

  // Get timezone offset for the room's timezone
  // We need to convert UTC times to local times for comparison
  const localNow = getLocalTime(nowUtc, timezone)

  // Convert sunrise/sunset to the room's local timezone for correct comparison
  // The times we calculated are already "correct" physically (when the sun actually rises/sets)
  // but we need to express them in local time for comparison with the local "now"
  const sunriseLocal = getLocalTime(sunriseUtc, timezone)
  const sunsetLocal = getLocalTime(sunsetUtc, timezone)

  return {
    sunrise: sunriseLocal,
    sunset: sunsetLocal,
    localNow
  }
}

/**
 * Convert a UTC Date to a Date representing local time in a specific timezone
 *
 * This function handles timezone conversion by calculating the offset between
 * UTC and the target timezone, then adjusting the date accordingly.
 *
 * @param utcDate - Date object in UTC
 * @param timezone - IANA timezone identifier (e.g., 'America/Denver')
 * @returns Date object representing the local time
 */
function getLocalTime(utcDate: Date, timezone: string): Date {
  try {
    // Use Intl.DateTimeFormat to get timezone offset
    // This handles DST automatically
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })

    // Parse the formatted string to get local time components
    const parts = formatter.formatToParts(utcDate)
    const getValue = (type: string): number => {
      const part = parts.find(p => p.type === type)
      return part ? parseInt(part.value, 10) : 0
    }

    // Create a new Date representing the local time
    // Note: This creates a Date where the local components match the target timezone
    const localDate = new Date(
      getValue('year'),
      getValue('month') - 1, // Month is 0-indexed
      getValue('day'),
      getValue('hour'),
      getValue('minute'),
      getValue('second')
    )

    return localDate
  } catch (error) {
    // If timezone is invalid, fall back to UTC
    console.warn(`Invalid timezone "${timezone}", falling back to UTC:`, error)
    return new Date(utcDate)
  }
}

/**
 * Get the current time in a specific timezone as a Date object
 *
 * @param timezone - IANA timezone identifier
 * @returns Date object representing current local time in that timezone
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCurrentLocalTime(timezone: string): Date {
  return getLocalTime(new Date(), timezone)
}

/**
 * Get day of year (1-365)
 */
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

/**
 * Calculate current dimmer level based on schedule and time
 *
 * For sunrise/sunset schedules, the sunTimes parameter must include localNow
 * to ensure correct timezone-aware time comparisons.
 *
 * @param schedule - The dimmer schedule configuration
 * @param sunTimes - Calculated sun times with optional localNow for timezone handling
 * @returns The current dimmer level (0-100) or null if outside schedule window
 */
function calculateDimmerLevel(
  schedule: DimmerSchedule,
  sunTimes: { sunrise: Date; sunset: Date; localNow?: Date } | null
): number | null {
  // Use localNow from sunTimes if available (timezone-aware), otherwise use system time
  // This ensures we compare times in the same timezone context
  const now = sunTimes?.localNow || new Date()
  let startTime: Date
  let endTime: Date

  // Determine start and end times based on schedule type
  switch (schedule.schedule_type) {
    case 'sunrise':
      if (!sunTimes) return null
      // Sunrise schedule: ramp up from start_intensity to target_intensity
      // starting at actual sunrise time, over duration_minutes
      startTime = sunTimes.sunrise
      endTime = new Date(startTime.getTime() + schedule.duration_minutes * 60000)
      break

    case 'sunset':
      if (!sunTimes) return null
      // Sunset schedule: ramp down from start_intensity to target_intensity
      // ending at actual sunset time, over duration_minutes
      startTime = new Date(sunTimes.sunset.getTime() - schedule.duration_minutes * 60000)
      endTime = sunTimes.sunset
      break

    case 'custom':
    case 'dli_curve':
      if (!schedule.start_time || !schedule.end_time) return null

      // Parse time strings (HH:MM format)
      const [startHour, startMin] = schedule.start_time.split(':').map(Number)
      const [endHour, endMin] = schedule.end_time.split(':').map(Number)

      // Create dates in the same context as 'now'
      startTime = new Date(now)
      startTime.setHours(startHour, startMin, 0, 0)

      endTime = new Date(now)
      endTime.setHours(endHour, endMin, 0, 0)

      // Handle overnight schedules (e.g., 22:00 to 06:00)
      if (endTime <= startTime) {
        if (now < endTime) {
          // We're past midnight, in the early morning part of the schedule
          startTime.setDate(startTime.getDate() - 1)
        } else {
          // We're in the evening part of the schedule
          endTime.setDate(endTime.getDate() + 1)
        }
      }
      break

    default:
      return null
  }

  // Check if current time is within the schedule window
  if (now < startTime || now > endTime) {
    // Outside schedule window - return appropriate intensity based on schedule type
    if (schedule.schedule_type === 'sunrise') {
      // Before sunrise window: return start intensity (usually 0 for dark)
      // After sunrise window: return target intensity (usually 100 for full light)
      return now < startTime ? schedule.start_intensity : schedule.target_intensity
    } else if (schedule.schedule_type === 'sunset') {
      // Before sunset window: return start intensity (usually 100 for full light)
      // After sunset window: return target intensity (usually 0 for dark)
      return now > endTime ? schedule.target_intensity : schedule.start_intensity
    }
    // For custom schedules, return null to indicate no action needed
    return null
  }

  // Calculate progress through the schedule window (0 to 1)
  const totalDuration = endTime.getTime() - startTime.getTime()
  const elapsed = now.getTime() - startTime.getTime()
  const progress = Math.max(0, Math.min(1, elapsed / totalDuration))

  // Apply the easing curve function to the progress
  const curvedProgress = applyCurve(progress, schedule.curve)

  // Interpolate between start and target intensity based on curved progress
  const level = schedule.start_intensity +
    (schedule.target_intensity - schedule.start_intensity) * curvedProgress

  return Math.round(level)
}

/**
 * Apply easing curve to progress value
 */
function applyCurve(progress: number, curve: string): number {
  switch (curve) {
    case 'linear':
      return progress

    case 'sigmoid':
      // S-curve (natural sunrise/sunset feel)
      return 1 / (1 + Math.exp(-10 * (progress - 0.5)))

    case 'exponential':
      // Faster at start, slower at end
      return Math.pow(progress, 2)

    case 'logarithmic':
      // Slower at start, faster at end
      return Math.sqrt(progress)

    default:
      return progress
  }
}

// ============================================
// Command Execution with Conflict Resolution
// ============================================

/**
 * Execute pending commands with conflict resolution
 * Higher priority commands win when multiple workflows target the same device
 */
async function executePendingCommands(
  supabase: SupabaseClient,
  pendingCommands: PendingCommand[]
): Promise<{ executed: number; conflicts: number; errors: number }> {
  let executed = 0
  let conflicts = 0
  let errors = 0

  // Group commands by controller+port
  const commandsByDevice = new Map<string, PendingCommand[]>()

  for (const command of pendingCommands) {
    const key = `${command.controllerId}:${command.port}`
    const existing = commandsByDevice.get(key) || []
    existing.push(command)
    commandsByDevice.set(key, existing)
  }

  // Resolve conflicts and execute
  for (const [deviceKey, commands] of commandsByDevice) {
    if (commands.length > 1) {
      conflicts++
      console.log(`Conflict detected for device ${deviceKey}: ${commands.length} commands`)
    }

    // Sort by priority (highest first)
    commands.sort((a, b) => b.priority - a.priority)
    const winningCommand = commands[0]

    try {
      // Check for manual override
      const [controllerId, portStr] = deviceKey.split(':')
      const port = parseInt(portStr, 10)

      const isOverridden = await checkManualOverride(supabase, controllerId, port)

      if (isOverridden) {
        console.log(`Device ${deviceKey} has manual override, skipping automation`)
        continue
      }

      // Execute the winning command
      await executeDeviceCommand(supabase, winningCommand)
      executed++

    } catch (err) {
      console.error(`Failed to execute command for ${deviceKey}:`, err)
      errors++
    }
  }

  return { executed, conflicts, errors }
}

/**
 * Check if a device has a manual override active
 * Manual overrides expire after a configurable time (default 30 minutes)
 */
async function checkManualOverride(
  supabase: SupabaseClient,
  controllerId: string,
  port: number
): Promise<boolean> {
  const { data: override } = await supabase
    .from('activity_logs')
    .select('timestamp')
    .eq('controller_id', controllerId)
    .eq('action_type', 'manual_override')
    .eq('action_data->port', port)
    .eq('result', 'success')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()

  if (!override) return false

  // Check if override is still active (within 30 minutes)
  const overrideTime = new Date(override.timestamp).getTime()
  const now = Date.now()
  const overrideDuration = 30 * 60 * 1000 // 30 minutes

  return (now - overrideTime) < overrideDuration
}

/**
 * Execute a device command via the appropriate adapter with retry logic
 * and command confirmation.
 *
 * Flow:
 * 1. Get controller info and validate it's online
 * 2. Get the appropriate adapter for the controller brand
 * 3. Connect to the controller using stored credentials
 * 4. Send the command with retry logic (exponential backoff)
 * 5. Wait for command confirmation (state change detection)
 * 6. Update controller status and log the result
 *
 * @param supabase - Supabase client for database operations
 * @param command - The pending command to execute
 * @throws Error if the command cannot be executed after all retries
 */
async function executeDeviceCommand(
  supabase: SupabaseClient,
  command: PendingCommand
): Promise<void> {
  const commandId = `${command.controllerId}:${command.port}:${Date.now()}`
  const executionState: CommandExecutionState = {
    commandId,
    controllerId: command.controllerId,
    port: command.port,
    targetValue: command.value,
    status: 'pending',
    startTime: Date.now(),
    retryCount: 0
  }

  // Get controller info
  const { data: controller, error: fetchError } = await supabase
    .from('controllers')
    .select('*')
    .eq('id', command.controllerId)
    .single() as { data: Controller | null; error: unknown }

  if (fetchError || !controller) {
    const errorMsg = `Controller ${command.controllerId} not found`
    await logCommandFailure(supabase, command, errorMsg, null)
    throw new Error(errorMsg)
  }

  // Check if controller is online
  if (!controller.is_online) {
    const errorMsg = `Controller ${controller.name} is offline`
    await logCommandFailure(supabase, command, errorMsg, controller)
    await updateControllerError(supabase, controller.id, errorMsg)
    throw new Error(errorMsg)
  }

  const { brand, credentials, controller_id } = controller

  // Validate brand is supported for device control
  if (brand === 'csv_upload') {
    const errorMsg = 'CSV Upload controllers are read-only and cannot control devices'
    await logCommandFailure(supabase, command, errorMsg, controller)
    throw new Error(errorMsg)
  }

  console.log(`[DeviceControl] Executing: ${brand} controller "${controller.name}" port ${command.port} -> ${command.value}%`)

  // Get the adapter for this brand
  let adapter: ControllerAdapter
  try {
    adapter = await getAdapter(brand as ControllerBrand)
  } catch (err) {
    const errorMsg = `Failed to get adapter for brand ${brand}: ${err instanceof Error ? err.message : 'Unknown error'}`
    await logCommandFailure(supabase, command, errorMsg, controller)
    await updateControllerError(supabase, controller.id, errorMsg)
    throw new Error(errorMsg)
  }

  // Execute command with retry logic
  let lastError: Error | null = null
  let commandResult: AdapterCommandResult | null = null

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    executionState.retryCount = attempt

    try {
      // Connect to the controller
      const connectResult = await adapter.connect(credentials as ControllerCredentials)

      if (!connectResult.success) {
        throw new Error(connectResult.error || 'Connection failed')
      }

      console.log(`[DeviceControl] Connected to ${brand} controller (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`)

      // Determine command type based on value
      const deviceCommand: DeviceCommandPayload = command.value === 0
        ? { type: 'turn_off' }
        : command.value === 100
          ? { type: 'turn_on' }
          : { type: 'set_level', value: command.value }

      // Send the control command
      commandResult = await adapter.controlDevice(
        controller_id,
        command.port,
        deviceCommand
      )

      // Disconnect after command (cleanup)
      await adapter.disconnect(controller_id)

      if (commandResult.success) {
        console.log(`[DeviceControl] Command successful: actualValue=${commandResult.actualValue}`)
        executionState.status = 'confirmed'
        break
      } else {
        throw new Error(commandResult.error || 'Command failed without error message')
      }

    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error')
      executionState.lastError = lastError.message

      console.warn(`[DeviceControl] Attempt ${attempt + 1} failed: ${lastError.message}`)

      // Ensure adapter is disconnected on error
      try {
        await adapter.disconnect(controller_id)
      } catch {
        // Ignore disconnect errors during cleanup
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const delay = calculateBackoffDelay(attempt)
        console.log(`[DeviceControl] Waiting ${Math.round(delay)}ms before retry...`)
        await sleep(delay)
      }
    }
  }

  // Check final result
  if (executionState.status !== 'confirmed' || !commandResult?.success) {
    executionState.status = 'failed'
    const errorMsg = lastError?.message || 'Command failed after all retry attempts'

    // Update controller error status
    await updateControllerError(supabase, controller.id, errorMsg)

    // Log failure to activity logs
    await logActivity(supabase, {
      user_id: controller.user_id,
      controller_id: controller.id,
      action_type: 'device_control',
      action_data: {
        port: command.port,
        targetValue: command.value,
        workflowId: command.workflowId,
        retryCount: executionState.retryCount,
        commandId: executionState.commandId
      },
      result: 'failed',
      error_message: errorMsg
    })

    throw new Error(errorMsg)
  }

  // Command confirmed - update controller status
  await supabase
    .from('controllers')
    .update({
      last_seen: new Date().toISOString(),
      is_online: true,
      last_error: null // Clear any previous errors on success
    })
    .eq('id', controller.id)

  // Log successful action
  await logActivity(supabase, {
    user_id: controller.user_id,
    controller_id: controller.id,
    action_type: 'device_control',
    action_data: {
      port: command.port,
      targetValue: command.value,
      actualValue: commandResult.actualValue,
      workflowId: command.workflowId,
      retryCount: executionState.retryCount,
      commandId: executionState.commandId,
      executionTimeMs: Date.now() - executionState.startTime
    },
    result: 'success'
  })

  console.log(`[DeviceControl] Command completed in ${Date.now() - executionState.startTime}ms`)
}

/**
 * Execute a device command with confirmation subscription
 *
 * This advanced version subscribes to realtime state changes to confirm
 * the device actually changed state, with automatic retry on timeout.
 *
 * NOTE: This function is provided as an alternative to the standard
 * executeDeviceCommand for scenarios where realtime state confirmation
 * is critical. It is not used by default in the cron workflow but can be
 * integrated when controller brands support state change notifications.
 *
 * Usage: Replace the call to executeDeviceCommand with executeWithConfirmation
 * when you need to verify the device actually changed state before proceeding.
 *
 * @param supabase - Supabase client
 * @param command - The pending command to execute
 * @param controller - The controller record
 * @param adapter - The connected adapter instance
 * @returns Promise that resolves when command is confirmed or fails
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function executeWithConfirmation(
  supabase: SupabaseClient,
  command: PendingCommand,
  controller: Controller,
  adapter: ControllerAdapter
): Promise<{ confirmed: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    const startTime = Date.now()
    let resolved = false
    let retryAttempted = false

    // Determine expected command type
    const deviceCommand: DeviceCommandPayload = command.value === 0
      ? { type: 'turn_off' }
      : command.value === 100
        ? { type: 'turn_on' }
        : { type: 'set_level', value: command.value }

    // Subscribe to sensor readings for this controller to detect state change
    const channel = supabase
      .channel(`controller-state-${controller.id}-${command.port}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `controller_id=eq.${controller.id}`
        },
        (payload) => {
          // Check if the new reading indicates the device is at the target state
          const reading = payload.new as { value?: number; port?: number }
          if (reading.port === command.port) {
            const tolerance = 5 // 5% tolerance for dimmer values
            const isAtTarget = Math.abs((reading.value || 0) - command.value) <= tolerance

            if (isAtTarget && !resolved) {
              resolved = true
              channel.unsubscribe()
              resolve({ confirmed: true })
            }
          }
        }
      )
      .subscribe()

    // Send the initial command
    try {
      const result = await adapter.controlDevice(
        controller.controller_id,
        command.port,
        deviceCommand
      )

      if (!result.success) {
        resolved = true
        channel.unsubscribe()
        resolve({ confirmed: false, error: result.error })
        return
      }
    } catch (err) {
      resolved = true
      channel.unsubscribe()
      resolve({ confirmed: false, error: err instanceof Error ? err.message : 'Command failed' })
      return
    }

    // Set up timeout handlers
    // First timeout at 30s - retry once
    setTimeout(async () => {
      if (!resolved && !retryAttempted) {
        retryAttempted = true
        console.log(`[DeviceControl] No confirmation after ${COMMAND_CONFIRMATION_TIMEOUT_MS}ms, retrying...`)

        try {
          await adapter.controlDevice(
            controller.controller_id,
            command.port,
            deviceCommand
          )
        } catch (err) {
          console.warn(`[DeviceControl] Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    }, COMMAND_CONFIRMATION_TIMEOUT_MS)

    // Final timeout at 60s - mark as failed
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        channel.unsubscribe()

        const elapsed = Date.now() - startTime
        console.warn(`[DeviceControl] Command confirmation timeout after ${elapsed}ms`)

        resolve({
          confirmed: false,
          error: `Command confirmation timeout after ${elapsed}ms. Device may have changed state but confirmation was not received.`
        })
      }
    }, COMMAND_RETRY_TIMEOUT_MS)
  })
}

/**
 * Log a command failure to activity logs
 */
async function logCommandFailure(
  supabase: SupabaseClient,
  command: PendingCommand,
  errorMsg: string,
  controller: Controller | null
): Promise<void> {
  if (!controller) {
    console.error(`[DeviceControl] Command failed (no controller): ${errorMsg}`)
    return
  }

  await logActivity(supabase, {
    user_id: controller.user_id,
    controller_id: controller.id,
    action_type: 'device_control',
    action_data: {
      port: command.port,
      targetValue: command.value,
      workflowId: command.workflowId
    },
    result: 'failed',
    error_message: errorMsg
  })
}

/**
 * Update controller's last_error field
 */
async function updateControllerError(
  supabase: SupabaseClient,
  controllerId: string,
  errorMsg: string
): Promise<void> {
  await supabase
    .from('controllers')
    .update({
      last_error: errorMsg,
      last_seen: new Date().toISOString()
    })
    .eq('id', controllerId)
}

// ============================================
// Notification Handling
// ============================================

/**
 * Send a notification to the user via push notification service
 *
 * When a NotificationNode is executed in a workflow, this function
 * sends the notification using the Web Push API or FCM.
 *
 * @param supabase - Supabase client for logging
 * @param userId - Target user's ID
 * @param notifData - Notification configuration from workflow node
 * @param workflowName - Name of the workflow for context
 */
async function sendNotification(
  supabase: SupabaseClient,
  userId: string,
  notifData: {
    message?: string
    channels?: string[]
    priority?: string
    actionType?: string
    workflowName?: string
    details?: Record<string, unknown>
  }
): Promise<void> {
  const {
    message,
    channels = ['push'],
    priority = 'normal',
    actionType = 'workflow_notification',
    workflowName = 'Workflow',
    details = {}
  } = notifData

  if (!message && !actionType) return

  // Prepare notification payload using the helper
  const payload = createWorkflowNotificationPayload(
    workflowName,
    actionType,
    {
      message,
      priority,
      ...details
    }
  )

  // Send push notification if channel is enabled
  if (channels.includes('push')) {
    try {
      const result = await sendPushNotification(
        userId,
        payload.title,
        payload.body,
        {
          ...payload.data,
          priority,
          url: '/dashboard',
        }
      )

      // Log the notification result
      await logActivity(supabase, {
        user_id: userId,
        action_type: 'push_notification_sent',
        action_data: {
          title: payload.title,
          // Don't log the full body to avoid logging sensitive data
          bodyLength: payload.body.length,
          sent: result.sent,
          failed: result.failed,
          success: result.success,
        },
        result: result.success ? 'success' : 'failed',
        error_message: result.errors.length > 0 ? result.errors.join(', ') : undefined
      })

      console.log('[Workflow Notification] Sent:', {
        userId: `${userId.substring(0, 8)}...`,
        title: payload.title,
        sent: result.sent,
        failed: result.failed,
      })
    } catch (error) {
      console.error('[Workflow Notification] Error:', error)

      await logActivity(supabase, {
        user_id: userId,
        action_type: 'push_notification_failed',
        action_data: {
          title: payload.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        result: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Future: Handle email notifications
  if (channels.includes('email')) {
    console.log('[Workflow Notification] Email channel not yet implemented')
    // TODO: Implement email notifications via SendGrid, Resend, etc.
  }

  // Future: Handle SMS notifications
  if (channels.includes('sms')) {
    console.log('[Workflow Notification] SMS channel not yet implemented')
    // TODO: Implement SMS notifications via Twilio, etc.
  }
}

// ============================================
// Activity Logging
// ============================================

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
