/**
 * Workflow Detail API Routes
 *
 * GET    /api/workflows/[id]  - Get workflow with execution history
 * PUT    /api/workflows/[id]  - Update workflow (nodes, edges, is_active, trigger_state)
 * DELETE /api/workflows/[id]  - Delete workflow and associated dimmer_schedules
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// ============================================
// Node/Edge Type Definitions
// ============================================

const NodeTypes = ['trigger', 'sensor', 'condition', 'action', 'delay', 'dimmer', 'notification'] as const
type NodeType = typeof NodeTypes[number]

interface WorkflowNode {
  id: string
  type: NodeType
  position?: { x: number; y: number }
  data: Record<string, unknown>
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

// ============================================
// Validation Schemas
// ============================================

const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NodeTypes),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.record(z.unknown()).default({})
})

const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional()
})

const TriggerStateSchema = z.enum(['ARMED', 'FIRED', 'RESET'])

/**
 * Schema for updating a workflow
 */
const UpdateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(100, 'Workflow name must be 100 characters or less')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  room_id: z.string().uuid('Invalid room ID').optional().nullable(),
  nodes: z.array(WorkflowNodeSchema).optional(),
  edges: z.array(WorkflowEdgeSchema).optional(),
  is_active: z.boolean().optional(),
  dry_run_enabled: z.boolean().optional(),
  trigger_state: TriggerStateSchema.optional(),
  growth_stage: z.string().max(50).optional().nullable()
})

type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>

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
// Authentication Helper
// ============================================

async function getUserId(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      return user.id
    }
  }

  const devUserId = request.headers.get('x-user-id')
  if (devUserId && process.env.NODE_ENV !== 'production') {
    return devUserId
  }

  return null
}

function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// ============================================
// Workflow Validation
// ============================================

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const triggerNodes = nodes.filter(n => n.type === 'trigger')
  if (triggerNodes.length === 0) {
    errors.push('Workflow must have at least one trigger node')
  } else if (triggerNodes.length > 1) {
    warnings.push('Multiple trigger nodes detected. Only the first will be used.')
  }

  const actionNodes = nodes.filter(n =>
    n.type === 'action' || n.type === 'dimmer' || n.type === 'notification'
  )
  if (actionNodes.length === 0) {
    errors.push('Workflow must have at least one action node')
  }

  const adjacencyList = new Map<string, string[]>()
  const nodeIds = new Set(nodes.map(n => n.id))

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge references non-existent source: ${edge.source}`)
      continue
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge references non-existent target: ${edge.target}`)
      continue
    }
    const neighbors = adjacencyList.get(edge.source) || []
    neighbors.push(edge.target)
    adjacencyList.set(edge.source, neighbors)
  }

  if (detectCycle(adjacencyList, nodeIds)) {
    errors.push('Workflow contains a cycle. Must be a DAG.')
  }

  const deviceActions = new Map<string, WorkflowNode[]>()
  for (const node of actionNodes) {
    const data = node.data as { controllerId?: string; port?: number }
    if (data.controllerId && data.port !== undefined) {
      const key = `${data.controllerId}:${data.port}`
      const existing = deviceActions.get(key) || []
      existing.push(node)
      deviceActions.set(key, existing)
    }
  }

  for (const [deviceKey, actions] of deviceActions) {
    if (actions.length > 1) {
      warnings.push(`Multiple actions target device ${deviceKey}`)
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

function detectCycle(adjacencyList: Map<string, string[]>, nodeIds: Set<string>): boolean {
  const visited = new Set<string>()
  const stack = new Set<string>()

  function dfs(nodeId: string): boolean {
    visited.add(nodeId)
    stack.add(nodeId)
    for (const neighbor of adjacencyList.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (stack.has(neighbor)) {
        return true
      }
    }
    stack.delete(nodeId)
    return false
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId) && dfs(nodeId)) return true
  }
  return false
}

// ============================================
// Route Context Type
// ============================================

interface RouteContext {
  params: Promise<{ id: string }>
}

// ============================================
// GET /api/workflows/[id]
// ============================================

/**
 * Get workflow with execution history
 *
 * Query parameters:
 * - include_history: boolean - Include execution history (default: true)
 * - history_limit: number - Limit history entries (default: 50)
 *
 * Response:
 * {
 *   workflow: Workflow,
 *   execution_history?: ActivityLog[]
 * }
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)
    const { id: workflowId } = await context.params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isValidUUID(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID format' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const includeHistory = searchParams.get('include_history') !== 'false'
    const historyLimit = Math.min(parseInt(searchParams.get('history_limit') || '50', 10), 100)

    // Fetch workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select(`
        id,
        name,
        description,
        room_id,
        nodes,
        edges,
        is_active,
        last_run,
        last_error,
        run_count,
        dry_run_enabled,
        trigger_state,
        last_trigger_value,
        growth_stage,
        created_at,
        updated_at
      `)
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single()

    if (workflowError || !workflow) {
      if (workflowError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }
      console.error('Failed to fetch workflow:', workflowError)
      return NextResponse.json(
        { error: 'Failed to fetch workflow', details: workflowError?.message },
        { status: 500 }
      )
    }

    const response: Record<string, unknown> = { workflow }

    // Fetch execution history if requested
    if (includeHistory) {
      const { data: history, error: historyError } = await supabase
        .from('activity_logs')
        .select(`
          id,
          action_type,
          action_data,
          result,
          error_message,
          timestamp
        `)
        .eq('workflow_id', workflowId)
        .order('timestamp', { ascending: false })
        .limit(historyLimit)

      if (!historyError) {
        response.execution_history = history || []

        // Calculate stats from history
        const stats = {
          total: history?.length || 0,
          success: history?.filter(h => h.result === 'success').length || 0,
          failed: history?.filter(h => h.result === 'failed').length || 0,
          skipped: history?.filter(h => h.result === 'skipped').length || 0,
          dry_run: history?.filter(h => h.result === 'dry_run').length || 0
        }
        response.execution_stats = stats
      }
    }

    // Add computed fields
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
    const edges = Array.isArray(workflow.edges) ? workflow.edges : []

    response.workflow = {
      ...workflow,
      node_count: nodes.length,
      edge_count: edges.length,
      trigger_count: nodes.filter((n: WorkflowNode) => n.type === 'trigger').length,
      action_count: nodes.filter((n: WorkflowNode) =>
        n.type === 'action' || n.type === 'dimmer' || n.type === 'notification'
      ).length
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Workflow GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT /api/workflows/[id]
// ============================================

/**
 * Update workflow
 *
 * Request body (all fields optional):
 * {
 *   name?: string
 *   description?: string | null
 *   room_id?: string | null
 *   nodes?: WorkflowNode[]
 *   edges?: WorkflowEdge[]
 *   is_active?: boolean
 *   dry_run_enabled?: boolean
 *   trigger_state?: 'ARMED' | 'FIRED' | 'RESET'
 *   growth_stage?: string | null
 * }
 *
 * Response:
 * {
 *   workflow: Workflow,
 *   validation?: ValidationResult,
 *   message: string
 * }
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)
    const { id: workflowId } = await context.params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isValidUUID(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID format' }, { status: 400 })
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const validationResult = UpdateWorkflowSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
    }

    const input: UpdateWorkflowInput = validationResult.data

    // Fetch existing workflow
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('id, name, nodes, edges, is_active, dry_run_enabled')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // If nodes/edges are being updated, validate the new structure
    let structureValidation: ValidationResult | null = null
    if (input.nodes || input.edges) {
      const nodesToValidate = (input.nodes || existingWorkflow.nodes || []) as WorkflowNode[]
      const edgesToValidate = (input.edges || existingWorkflow.edges || []) as WorkflowEdge[]

      structureValidation = validateWorkflow(nodesToValidate, edgesToValidate)

      if (!structureValidation.valid) {
        return NextResponse.json(
          {
            error: 'Workflow structure is invalid',
            validation: structureValidation
          },
          { status: 400 }
        )
      }
    }

    // Verify room exists if being changed
    if (input.room_id) {
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', input.room_id)
        .eq('user_id', userId)
        .single()

      if (!room) {
        return NextResponse.json(
          { error: 'Room not found or does not belong to you' },
          { status: 400 }
        )
      }
    }

    // Safety check: Cannot disable dry_run while activating
    const isActivating = input.is_active === true && !existingWorkflow.is_active
    const isDisablingDryRun = input.dry_run_enabled === false
    const wasInDryRun = existingWorkflow.dry_run_enabled

    if (isActivating && isDisablingDryRun && wasInDryRun) {
      return NextResponse.json(
        {
          error: 'Cannot activate workflow and disable dry-run simultaneously. ' +
                 'First activate with dry-run, verify it works, then disable dry-run.',
          suggestion: 'Set is_active=true first, then set dry_run_enabled=false in a separate request'
        },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.room_id !== undefined) updateData.room_id = input.room_id
    if (input.nodes !== undefined) updateData.nodes = input.nodes
    if (input.edges !== undefined) updateData.edges = input.edges
    if (input.is_active !== undefined) updateData.is_active = input.is_active
    if (input.dry_run_enabled !== undefined) updateData.dry_run_enabled = input.dry_run_enabled
    if (input.trigger_state !== undefined) updateData.trigger_state = input.trigger_state
    if (input.growth_stage !== undefined) updateData.growth_stage = input.growth_stage

    // Reset trigger state if workflow is being deactivated
    if (input.is_active === false) {
      updateData.trigger_state = 'ARMED'
    }

    // Perform update
    const { data: updatedWorkflow, error: updateError } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', workflowId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update workflow:', updateError)
      return NextResponse.json(
        { error: 'Failed to update workflow', details: updateError.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        workflow_id: workflowId,
        action_type: 'workflow_updated',
        action_data: {
          fields: Object.keys(updateData),
          is_active: input.is_active,
          dry_run_enabled: input.dry_run_enabled
        },
        result: 'success',
        timestamp: new Date().toISOString()
      })

    const response: Record<string, unknown> = {
      workflow: updatedWorkflow,
      message: 'Workflow updated successfully'
    }

    if (structureValidation) {
      response.validation = structureValidation
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Workflow PUT error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE /api/workflows/[id]
// ============================================

/**
 * Delete a workflow and associated dimmer_schedules
 *
 * Response:
 * {
 *   message: string,
 *   deleted_dimmer_schedules: number
 * }
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)
    const { id: workflowId } = await context.params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isValidUUID(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID format' }, { status: 400 })
    }

    // Fetch existing workflow
    const { data: existingWorkflow, error: fetchError } = await supabase
      .from('workflows')
      .select('id, name, nodes, is_active')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Warn if deleting an active workflow
    if (existingWorkflow.is_active) {
      console.warn(`Deleting active workflow: ${existingWorkflow.name}`)
    }

    // Find associated dimmer schedules (from dimmer nodes in the workflow)
    const nodes = Array.isArray(existingWorkflow.nodes) ? existingWorkflow.nodes : []
    const dimmerNodes = nodes.filter((n: WorkflowNode) => n.type === 'dimmer')
    let deletedDimmerSchedules = 0

    // Delete any dimmer schedules that were created for this workflow
    // Note: This assumes dimmer schedules store a reference to the workflow
    // If not, we'd need to match by controller_id + port
    if (dimmerNodes.length > 0) {
      for (const dimmerNode of dimmerNodes) {
        const data = dimmerNode.data as { controllerId?: string; port?: number }
        if (data.controllerId && data.port !== undefined) {
          const { count } = await supabase
            .from('dimmer_schedules')
            .delete()
            .eq('user_id', userId)
            .eq('controller_id', data.controllerId)
            .eq('port', data.port)

          deletedDimmerSchedules += count || 0
        }
      }
    }

    // Delete the workflow (activity_logs will have workflow_id set to null via FK)
    const { error: deleteError } = await supabase
      .from('workflows')
      .delete()
      .eq('id', workflowId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Failed to delete workflow:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete workflow', details: deleteError.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action_type: 'workflow_deleted',
        action_data: {
          workflow_name: existingWorkflow.name,
          was_active: existingWorkflow.is_active,
          deleted_dimmer_schedules: deletedDimmerSchedules
        },
        result: 'success',
        timestamp: new Date().toISOString()
      })

    return NextResponse.json({
      message: `Workflow "${existingWorkflow.name}" deleted successfully`,
      deleted_dimmer_schedules: deletedDimmerSchedules
    })

  } catch (error) {
    console.error('Workflow DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
