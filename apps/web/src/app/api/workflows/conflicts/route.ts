/**
 * Workflow Conflict Detection API
 * 
 * GET /api/workflows/conflicts - Check for port conflicts among active workflows
 * 
 * Returns a map of workflow IDs to their conflict status.
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

// Workflow node type (simplified for conflict detection)
interface WorkflowNode {
  id: string
  type: string
  data: Record<string, unknown>
}

// Target port reference
interface TargetPort {
  controllerId: string
  port: number
}

// Conflict info
interface ConflictInfo {
  hasConflict: boolean
  conflictingWorkflows: { id: string; name: string }[]
  conflictingPorts: string[] // "controllerId:port" format
}

/**
 * Extract target ports from action nodes
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
      
      const controllerId = data.controllerId || data.config?.controllerId
      const port = data.port ?? data.config?.port
      
      if (controllerId && port !== undefined) {
        targets.push({ controllerId, port })
      }
    }
  }
  
  return targets
}

/**
 * GET /api/workflows/conflicts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()
    
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
    
    // Fetch all active workflows for this user
    const { data: workflows, error: fetchError } = await supabase
      .from('workflows')
      .select('id, name, nodes, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
    
    if (fetchError) {
      console.error('Failed to fetch workflows:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
    }
    
    if (!workflows || workflows.length === 0) {
      return NextResponse.json({ conflicts: {} })
    }
    
    // Build port target map
    const portTargetMap = new Map<string, { id: string; name: string }[]>()
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
        portTargetMap.get(key)!.push({ id: workflow.id, name: workflow.name })
      }
    }
    
    // Build conflict map
    const conflicts: Record<string, ConflictInfo> = {}
    
    for (const workflow of workflows) {
      const targets = workflowTargets.get(workflow.id) || []
      const conflictingWorkflows: { id: string; name: string }[] = []
      const conflictingPorts: string[] = []
      
      for (const target of targets) {
        const key = `${target.controllerId}:${target.port}`
        const targeting = portTargetMap.get(key) || []
        
        if (targeting.length > 1) {
          // Multiple workflows target this port
          conflictingPorts.push(key)
          for (const other of targeting) {
            if (other.id !== workflow.id && !conflictingWorkflows.some(w => w.id === other.id)) {
              conflictingWorkflows.push(other)
            }
          }
        }
      }
      
      conflicts[workflow.id] = {
        hasConflict: conflictingWorkflows.length > 0,
        conflictingWorkflows,
        conflictingPorts: [...new Set(conflictingPorts)],
      }
    }
    
    return NextResponse.json({ conflicts })
    
  } catch (error) {
    console.error('Conflict check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
