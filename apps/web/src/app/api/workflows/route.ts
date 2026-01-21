/**
 * Workflows API Routes
 *
 * GET  /api/workflows  - List all workflows for authenticated user
 * POST /api/workflows  - Create a new workflow
 *
 * Workflows are automation rules built with React Flow (nodes + edges).
 * They support:
 * - Trigger nodes (schedule, sensor threshold, time of day, sunrise/sunset, manual)
 * - Action nodes (set fan, set light, toggle outlet, dimmer, notification)
 * - Condition nodes (logical operators, comparisons)
 * - Delay nodes (wait before action)
 *
 * Workflow validation ensures:
 * - No cycles (DAG structure)
 * - No conflicting actions on the same device
 * - Required nodes exist (trigger, at least one action)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// ============================================
// Node/Edge Type Definitions
// ============================================

/** Valid node types in workflows */
const NodeTypes = ['trigger', 'sensor', 'condition', 'action', 'delay', 'dimmer', 'notification'] as const
type NodeType = typeof NodeTypes[number]

/** Workflow node structure */
interface WorkflowNode {
  id: string
  type: NodeType
  position?: { x: number; y: number }
  data: Record<string, unknown>
}

/** Workflow edge structure */
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

/**
 * Schema for workflow node
 */
const WorkflowNodeSchema = z.object({
  id: z.string().min(1, 'Node ID is required'),
  type: z.enum(NodeTypes, { errorMap: () => ({ message: 'Invalid node type' }) }),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).optional(),
  data: z.record(z.unknown()).default({})
})

/**
 * Schema for workflow edge
 */
const WorkflowEdgeSchema = z.object({
  id: z.string().min(1, 'Edge ID is required'),
  source: z.string().min(1, 'Edge source is required'),
  target: z.string().min(1, 'Edge target is required'),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional()
})

/**
 * Schema for creating a new workflow
 */
const CreateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(100, 'Workflow name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  room_id: z.string().uuid('Invalid room ID').optional().nullable(),
  nodes: z.array(WorkflowNodeSchema).min(1, 'At least one node is required'),
  edges: z.array(WorkflowEdgeSchema).default([]),
  is_active: z.boolean().default(false),
  dry_run_enabled: z.boolean().default(true),
  growth_stage: z.string().max(50).optional().nullable()
})

type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>

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

/**
 * Extract and validate user ID from request.
 * Uses Bearer token authentication only.
 *
 * SECURITY: x-user-id header bypass has been removed. All authentication
 * must go through Supabase Auth with a valid Bearer token.
 */
async function getUserId(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  // Bearer token authentication only
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (!error && user) {
      return user.id
    }
  }

  return null
}

// ============================================
// Workflow Validation Functions
// ============================================

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate workflow structure (DAG, required nodes, conflicts)
 */
function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for trigger node
  const triggerNodes = nodes.filter(n => n.type === 'trigger')
  if (triggerNodes.length === 0) {
    errors.push('Workflow must have at least one trigger node')
  } else if (triggerNodes.length > 1) {
    warnings.push('Multiple trigger nodes detected. Only the first will be used for scheduling.')
  }

  // Check for action nodes
  const actionNodes = nodes.filter(n =>
    n.type === 'action' || n.type === 'dimmer' || n.type === 'notification'
  )
  if (actionNodes.length === 0) {
    errors.push('Workflow must have at least one action node')
  }

  // Build adjacency list for cycle detection
  const adjacencyList = new Map<string, string[]>()
  const nodeIds = new Set(nodes.map(n => n.id))

  for (const edge of edges) {
    // Validate edge references exist
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge references non-existent source node: ${edge.source}`)
      continue
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge references non-existent target node: ${edge.target}`)
      continue
    }

    const neighbors = adjacencyList.get(edge.source) || []
    neighbors.push(edge.target)
    adjacencyList.set(edge.source, neighbors)
  }

  // Detect cycles using DFS
  const hasCycle = detectCycle(adjacencyList, nodeIds)
  if (hasCycle) {
    errors.push('Workflow contains a cycle. Workflows must be directed acyclic graphs (DAGs).')
  }

  // Check for conflicting device actions
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
      warnings.push(
        `Multiple actions target the same device (${deviceKey}). ` +
        `Only one action will execute based on priority.`
      )
    }
  }

  // Check for unreachable nodes
  const reachableNodes = findReachableNodes(triggerNodes[0]?.id, adjacencyList)
  const unreachableNodes = nodes.filter(n =>
    n.type !== 'trigger' && !reachableNodes.has(n.id)
  )
  if (unreachableNodes.length > 0) {
    warnings.push(
      `${unreachableNodes.length} node(s) are not reachable from the trigger: ` +
      unreachableNodes.map(n => n.id).join(', ')
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Detect cycles in the workflow graph using DFS
 */
function detectCycle(
  adjacencyList: Map<string, string[]>,
  nodeIds: Set<string>
): boolean {
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function dfs(nodeId: string): boolean {
    visited.add(nodeId)
    recursionStack.add(nodeId)

    const neighbors = adjacencyList.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (recursionStack.has(neighbor)) {
        return true // Back edge found - cycle detected
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true
    }
  }

  return false
}

/**
 * Find all nodes reachable from a starting node
 */
function findReachableNodes(
  startNodeId: string | undefined,
  adjacencyList: Map<string, string[]>
): Set<string> {
  const reachable = new Set<string>()
  if (!startNodeId) return reachable

  const queue = [startNodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)

    const neighbors = adjacencyList.get(current) || []
    queue.push(...neighbors)
  }

  return reachable
}

// ============================================
// GET /api/workflows
// ============================================

/**
 * List all workflows for the authenticated user
 *
 * Query parameters:
 * - room_id: string - Filter by room ID
 * - is_active: boolean - Filter by active status
 * - include_stats: boolean - Include execution statistics (default: true)
 *
 * Response:
 * {
 *   workflows: Workflow[],
 *   count: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Provide Authorization header or x-user-id for testing.' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const isActive = searchParams.get('is_active')
    const includeStats = searchParams.get('include_stats') !== 'false'

    // Build query
    let query = supabase
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
        growth_stage,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: workflows, error: workflowsError } = await query

    if (workflowsError) {
      console.error('Failed to fetch workflows:', workflowsError)
      return NextResponse.json(
        { error: 'Failed to fetch workflows', details: workflowsError.message },
        { status: 500 }
      )
    }

    let enrichedWorkflows = workflows || []

    // Include execution stats if requested
    if (includeStats && enrichedWorkflows.length > 0) {
      const workflowIds = enrichedWorkflows.map(w => w.id)

      // Get recent activity counts
      const { data: activityCounts } = await supabase
        .from('activity_logs')
        .select('workflow_id, result')
        .in('workflow_id', workflowIds)
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (activityCounts) {
        // Aggregate stats per workflow
        const statsMap = new Map<string, { success: number; failed: number; total: number }>()

        for (const log of activityCounts) {
          if (!log.workflow_id) continue
          const stats = statsMap.get(log.workflow_id) || { success: 0, failed: 0, total: 0 }
          stats.total++
          if (log.result === 'success') stats.success++
          else if (log.result === 'failed') stats.failed++
          statsMap.set(log.workflow_id, stats)
        }

        enrichedWorkflows = enrichedWorkflows.map(workflow => ({
          ...workflow,
          stats_7d: statsMap.get(workflow.id) || { success: 0, failed: 0, total: 0 }
        }))
      }
    }

    // Add node/edge counts for quick overview
    enrichedWorkflows = enrichedWorkflows.map(workflow => {
      const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
      const edges = Array.isArray(workflow.edges) ? workflow.edges : []

      return {
        ...workflow,
        node_count: nodes.length,
        edge_count: edges.length,
        trigger_count: nodes.filter((n: WorkflowNode) => n.type === 'trigger').length,
        action_count: nodes.filter((n: WorkflowNode) =>
          n.type === 'action' || n.type === 'dimmer' || n.type === 'notification'
        ).length
      }
    })

    return NextResponse.json({
      workflows: enrichedWorkflows,
      count: enrichedWorkflows.length
    })

  } catch (error) {
    console.error('Workflows GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// POST /api/workflows
// ============================================

/**
 * Create a new workflow
 *
 * Request body:
 * {
 *   name: string (required)
 *   description?: string
 *   room_id?: string
 *   nodes: WorkflowNode[] (required, at least one trigger and one action)
 *   edges: WorkflowEdge[]
 *   is_active?: boolean (default: false)
 *   dry_run_enabled?: boolean (default: true)
 *   growth_stage?: string
 * }
 *
 * Response:
 * {
 *   workflow: Workflow,
 *   validation: { valid: boolean, errors: string[], warnings: string[] },
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const userId = await getUserId(request, supabase)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationResult = CreateWorkflowSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      )
    }

    const input: CreateWorkflowInput = validationResult.data

    // Validate workflow structure (DAG, cycles, conflicts)
    const structureValidation = validateWorkflow(
      input.nodes as WorkflowNode[],
      input.edges as WorkflowEdge[]
    )

    if (!structureValidation.valid) {
      return NextResponse.json(
        {
          error: 'Workflow structure is invalid',
          validation: structureValidation
        },
        { status: 400 }
      )
    }

    // If room_id provided, verify it exists and belongs to user
    if (input.room_id) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', input.room_id)
        .eq('user_id', userId)
        .single()

      if (roomError || !room) {
        return NextResponse.json(
          { error: 'Room not found or does not belong to you' },
          { status: 400 }
        )
      }
    }

    // Check workflow limit (e.g., 50 workflows per user for free tier)
    const { count: workflowCount, error: countError } = await supabase
      .from('workflows')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (!countError && workflowCount !== null && workflowCount >= 50) {
      return NextResponse.json(
        { error: 'Workflow limit reached. Maximum 50 workflows per account.' },
        { status: 403 }
      )
    }

    // Enforce dry_run_enabled = true if activating workflow for first time
    // This prevents accidental device control on creation
    const isDryRunRequired = input.is_active && !input.dry_run_enabled
    const effectiveDryRun = isDryRunRequired ? true : input.dry_run_enabled

    if (isDryRunRequired) {
      structureValidation.warnings.push(
        'Dry-run mode has been enabled for safety. Test your workflow before disabling dry-run.'
      )
    }

    // Create the workflow
    const { data: workflow, error: insertError } = await supabase
      .from('workflows')
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description || null,
        room_id: input.room_id || null,
        nodes: input.nodes,
        edges: input.edges,
        is_active: input.is_active,
        dry_run_enabled: effectiveDryRun,
        growth_stage: input.growth_stage || null,
        run_count: 0,
        trigger_state: 'ARMED'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create workflow:', insertError)
      return NextResponse.json(
        { error: 'Failed to create workflow', details: insertError.message },
        { status: 500 }
      )
    }

    // Log the activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        workflow_id: workflow.id,
        room_id: input.room_id || null,
        action_type: 'workflow_created',
        action_data: {
          name: input.name,
          node_count: input.nodes.length,
          is_active: input.is_active,
          dry_run: effectiveDryRun
        },
        result: 'success',
        timestamp: new Date().toISOString()
      })

    return NextResponse.json(
      {
        workflow: {
          ...workflow,
          node_count: input.nodes.length,
          edge_count: input.edges.length
        },
        validation: structureValidation,
        message: `Workflow "${input.name}" created successfully${
          effectiveDryRun ? ' (dry-run mode enabled)' : ''
        }`
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Workflows POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
