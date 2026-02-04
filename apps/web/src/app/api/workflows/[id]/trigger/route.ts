/**
 * Manual Workflow Trigger API
 * 
 * POST /api/workflows/[id]/trigger - Dry-run simulation of a workflow
 * 
 * This endpoint allows users to manually trigger a workflow dry-run simulation
 * outside of the normal cron schedule. It traverses the workflow graph and counts
 * actions that WOULD be triggered, but does NOT send actual device control commands.
 * Useful for testing and validating workflow logic before enabling.
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

// Minimal workflow types for execution
interface WorkflowNode {
  id: string
  type: string
  data: Record<string, unknown>
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
}

interface ExecutionResult {
  success: boolean
  dryRun: boolean
  nodesExecuted: number
  actionsTriggered: number
  skippedReason?: string
  error?: string
}

/**
 * POST /api/workflows/[id]/trigger
 * 
 * Manually triggers a workflow dry-run simulation.
 * Traverses the workflow graph from the trigger node and counts actions
 * that would be executed, without sending actual device commands.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    const supabase = getSupabase()
    const { id: workflowId } = await params
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Fetch the workflow
    const { data: workflow, error: fetchError } = await supabase
      .from('workflows')
      .select('id, user_id, name, description, nodes, edges, is_active, room_id, dry_run_enabled')
      .eq('id', workflowId)
      .eq('user_id', user.id)
      .single()
    
    if (fetchError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }
    
    // Parse nodes
    const parsedNodes: WorkflowNode[] = typeof workflow.nodes === 'string'
      ? JSON.parse(workflow.nodes)
      : workflow.nodes || []
    
    if (parsedNodes.length === 0) {
      return NextResponse.json({
        success: false,
        dryRun: true,
        nodesExecuted: 0,
        actionsTriggered: 0,
        skippedReason: 'No nodes in workflow',
      })
    }
    
    // Find trigger node (starting point)
    const triggerNode = parsedNodes.find(n => n.type === 'trigger')
    
    if (!triggerNode) {
      return NextResponse.json({
        success: false,
        dryRun: true,
        nodesExecuted: 0,
        actionsTriggered: 0,
        skippedReason: 'No trigger node found',
      })
    }
    
    // Parse edges for graph traversal
    const parsedEdges: WorkflowEdge[] = typeof workflow.edges === 'string'
      ? JSON.parse(workflow.edges)
      : workflow.edges || []
    
    // Execute the workflow by traversing from the trigger node
    const result = await executeWorkflowManually(
      supabase,
      workflow,
      parsedNodes,
      parsedEdges,
      triggerNode.id,
      user.id
    )
    
    // Log the manual execution using correct activity_logs schema columns:
    // action_type (NOT event_type), result (NOT status), error_message (NOT message), details (JSONB)
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      workflow_id: workflowId,
      action_type: 'manual_trigger_dry_run',
      result: result.success ? 'dry_run' : 'failed',
      error_message: result.error || null,
      details: {
        nodesExecuted: result.nodesExecuted,
        actionsTriggered: result.actionsTriggered,
        skippedReason: result.skippedReason,
        duration: Date.now() - startTime,
        dryRun: true,
      },
    })
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Manual trigger error:', error)
    return NextResponse.json(
      {
        success: false,
        dryRun: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        nodesExecuted: 0,
        actionsTriggered: 0,
      },
      { status: 500 }
    )
  }
}

/**
 * Execute workflow starting from a specific node, bypassing trigger conditions.
 * This is a DRY RUN simulation: it traverses the graph and counts actions
 * but does NOT send actual device control commands.
 */
async function executeWorkflowManually(
  supabase: SupabaseClient,
  workflow: {
    id: string
    name: string
    dry_run_enabled?: boolean
    room_id?: string
  },
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  startNodeId: string,
  userId: string
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    success: true,
    dryRun: true,
    nodesExecuted: 0,
    actionsTriggered: 0,
  }
  
  // Build adjacency list for traversal
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge.target)
  }
  
  // BFS traversal from start node
  const visited = new Set<string>()
  const queue: string[] = [startNodeId]
  
  // Build node lookup
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  
  while (queue.length > 0) {
    const currentId = queue.shift()!
    
    if (visited.has(currentId)) continue
    visited.add(currentId)
    
    const node = nodeMap.get(currentId)
    if (!node) continue
    
    result.nodesExecuted++
    
    // Process node based on type
    switch (node.type) {
      case 'trigger':
        // For manual trigger, we skip the condition check and proceed
        console.log(`[DryRun] Trigger node ${currentId} - bypassing condition check`)
        break
        
      case 'action':
      case 'dimmer':
        // Dry run: count the action but do NOT send actual device commands
        result.actionsTriggered++
        console.log(`[DryRun] Action node ${currentId} - would execute action (not sent)`)
        break
        
      case 'condition':
        // For dry-run, follow all paths (cannot evaluate real sensor conditions)
        console.log(`[DryRun] Condition node ${currentId} - following all paths`)
        break
        
      case 'delay':
        // For dry-run, skip delays
        console.log(`[DryRun] Delay node ${currentId} - skipping delay`)
        break
        
      case 'notification':
        // Dry run: count as action but do not send
        result.actionsTriggered++
        console.log(`[DryRun] Notification node ${currentId} - would send notification (not sent)`)
        break
        
      case 'variable':
      case 'debounce':
        // Process flow control nodes
        console.log(`[DryRun] Flow control node ${currentId}`)
        break
        
      default:
        console.log(`[DryRun] Unknown node type: ${node.type}`)
    }
    
    // Queue connected nodes
    const nextNodes = adjacency.get(currentId) || []
    for (const nextId of nextNodes) {
      if (!visited.has(nextId)) {
        queue.push(nextId)
      }
    }
  }
  
  return result
}
