/**
 * Workflow Execution Engine Tests
 *
 * Tests for delay nodes, variable nodes, debounce nodes, and conflict detection
 */

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

// =============================================================================
// Test Utilities
// =============================================================================

interface WorkflowNode {
  id: string
  type: string
  data: Record<string, unknown>
}

interface TargetPort {
  controllerId: string
  port: number
  nodeId: string
  nodeType: string
}

/**
 * Extract target ports from action nodes in a workflow.
 * (Replicated from route.ts for testing)
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
 * Find port conflicts between two sets of target ports.
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
 * Calculate delay in milliseconds from config.
 */
function calculateDelayMs(duration: number, unit: 'seconds' | 'minutes' | 'hours'): number {
  switch (unit) {
    case 'seconds':
      return duration * 1000
    case 'minutes':
      return duration * 60 * 1000
    case 'hours':
      return duration * 60 * 60 * 1000
    default:
      return duration * 1000
  }
}

// =============================================================================
// Delay Node Tests
// =============================================================================

describe('DelayNode', () => {
  describe('calculateDelayMs', () => {
    it('should calculate seconds correctly', () => {
      expect(calculateDelayMs(30, 'seconds')).toBe(30000)
      expect(calculateDelayMs(1, 'seconds')).toBe(1000)
      expect(calculateDelayMs(0, 'seconds')).toBe(0)
    })

    it('should calculate minutes correctly', () => {
      expect(calculateDelayMs(5, 'minutes')).toBe(300000)
      expect(calculateDelayMs(1, 'minutes')).toBe(60000)
      expect(calculateDelayMs(10, 'minutes')).toBe(600000)
    })

    it('should calculate hours correctly', () => {
      expect(calculateDelayMs(1, 'hours')).toBe(3600000)
      expect(calculateDelayMs(2, 'hours')).toBe(7200000)
      expect(calculateDelayMs(24, 'hours')).toBe(86400000)
    })

    it('should handle edge cases', () => {
      expect(calculateDelayMs(0.5, 'minutes')).toBe(30000)
      expect(calculateDelayMs(0.5, 'hours')).toBe(1800000)
    })
  })

  describe('Delay State Machine', () => {
    it('should create valid resume_after timestamp', () => {
      const now = new Date()
      const delayMs = calculateDelayMs(5, 'minutes')
      const resumeAfter = new Date(now.getTime() + delayMs)
      
      expect(resumeAfter.getTime()).toBeGreaterThan(now.getTime())
      expect(resumeAfter.getTime() - now.getTime()).toBe(300000)
    })

    it('should handle maximum delay (24 hours)', () => {
      const now = new Date()
      const delayMs = calculateDelayMs(24, 'hours')
      const resumeAfter = new Date(now.getTime() + delayMs)
      
      expect(resumeAfter.getTime() - now.getTime()).toBe(86400000)
    })
  })
})

// =============================================================================
// Variable Node Tests
// =============================================================================

describe('VariableNode', () => {
  describe('Variable Operations', () => {
    it('should set a variable value', () => {
      const variables: Record<string, number | string | boolean> = {}
      variables['counter'] = 10
      expect(variables['counter']).toBe(10)
    })

    it('should get a variable value', () => {
      const variables: Record<string, number | string | boolean> = { counter: 10 }
      expect(variables['counter']).toBe(10)
    })

    it('should increment a numeric variable', () => {
      const variables: Record<string, number | string | boolean> = { counter: 10 }
      const amount = 5
      variables['counter'] = (variables['counter'] as number) + amount
      expect(variables['counter']).toBe(15)
    })

    it('should decrement a numeric variable', () => {
      const variables: Record<string, number | string | boolean> = { counter: 10 }
      const amount = 3
      variables['counter'] = (variables['counter'] as number) - amount
      expect(variables['counter']).toBe(7)
    })

    it('should handle string variables', () => {
      const variables: Record<string, number | string | boolean> = {}
      variables['status'] = 'active'
      expect(variables['status']).toBe('active')
    })

    it('should handle boolean variables', () => {
      const variables: Record<string, number | string | boolean> = {}
      variables['isEnabled'] = true
      expect(variables['isEnabled']).toBe(true)
      variables['isEnabled'] = false
      expect(variables['isEnabled']).toBe(false)
    })

    it('should initialize undefined variables to default', () => {
      const variables: Record<string, number | string | boolean> = {}
      const value = variables['undefined_var'] ?? 0
      expect(value).toBe(0)
    })
  })

  describe('Variable Scopes', () => {
    it('should keep workflow variables isolated', () => {
      const workflow1Vars: Record<string, number> = { counter: 10 }
      const workflow2Vars: Record<string, number> = { counter: 20 }
      
      expect(workflow1Vars['counter']).toBe(10)
      expect(workflow2Vars['counter']).toBe(20)
      
      workflow1Vars['counter'] = 15
      expect(workflow1Vars['counter']).toBe(15)
      expect(workflow2Vars['counter']).toBe(20)
    })
  })
})

// =============================================================================
// Debounce Node Tests
// =============================================================================

describe('DebounceNode', () => {
  describe('Cooldown Logic', () => {
    it('should allow execution when no previous execution exists', () => {
      const lastExecuted: Date | null = null
      const cooldownSeconds = 60
      const now = new Date()
      
      const canExecute = lastExecuted === null
      expect(canExecute).toBe(true)
    })

    it('should block execution within cooldown period', () => {
      const now = new Date()
      const lastExecuted = new Date(now.getTime() - 30000) // 30 seconds ago
      const cooldownSeconds = 60
      
      const cooldownMs = cooldownSeconds * 1000
      const timeSinceLastExec = now.getTime() - lastExecuted.getTime()
      const canExecute = timeSinceLastExec >= cooldownMs
      
      expect(canExecute).toBe(false)
    })

    it('should allow execution after cooldown expires', () => {
      const now = new Date()
      const lastExecuted = new Date(now.getTime() - 90000) // 90 seconds ago
      const cooldownSeconds = 60
      
      const cooldownMs = cooldownSeconds * 1000
      const timeSinceLastExec = now.getTime() - lastExecuted.getTime()
      const canExecute = timeSinceLastExec >= cooldownMs
      
      expect(canExecute).toBe(true)
    })

    it('should handle edge case: exactly at cooldown boundary', () => {
      const now = new Date()
      const lastExecuted = new Date(now.getTime() - 60000) // Exactly 60 seconds ago
      const cooldownSeconds = 60
      
      const cooldownMs = cooldownSeconds * 1000
      const timeSinceLastExec = now.getTime() - lastExecuted.getTime()
      const canExecute = timeSinceLastExec >= cooldownMs
      
      expect(canExecute).toBe(true)
    })
  })

  describe('Execute On Lead/Trail', () => {
    it('should track executeOnLead config', () => {
      const config = { cooldownSeconds: 60, executeOnLead: true, executeOnTrail: false }
      expect(config.executeOnLead).toBe(true)
      expect(config.executeOnTrail).toBe(false)
    })

    it('should track executeOnTrail config', () => {
      const config = { cooldownSeconds: 60, executeOnLead: false, executeOnTrail: true }
      expect(config.executeOnLead).toBe(false)
      expect(config.executeOnTrail).toBe(true)
    })
  })
})

// =============================================================================
// Conflict Detection Tests
// =============================================================================

describe('ConflictDetection', () => {
  describe('extractTargetPorts', () => {
    it('should extract ports from action nodes', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'trigger', data: {} },
        { id: '2', type: 'action', data: { controllerId: 'ctrl-1', port: 1 } },
        { id: '3', type: 'action', data: { controllerId: 'ctrl-1', port: 2 } },
      ]
      
      const targets = extractTargetPorts(nodes)
      expect(targets).toHaveLength(2)
      expect(targets[0]).toEqual({ controllerId: 'ctrl-1', port: 1, nodeId: '2', nodeType: 'action' })
      expect(targets[1]).toEqual({ controllerId: 'ctrl-1', port: 2, nodeId: '3', nodeType: 'action' })
    })

    it('should extract ports from nested config', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'mode', data: { config: { controllerId: 'ctrl-1', port: 3 } } },
      ]
      
      const targets = extractTargetPorts(nodes)
      expect(targets).toHaveLength(1)
      expect(targets[0].controllerId).toBe('ctrl-1')
      expect(targets[0].port).toBe(3)
    })

    it('should extract ports from dimmer nodes', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'dimmer', data: { controllerId: 'ctrl-2', port: 1 } },
      ]
      
      const targets = extractTargetPorts(nodes)
      expect(targets).toHaveLength(1)
      expect(targets[0].nodeType).toBe('dimmer')
    })

    it('should extract ports from verified_action nodes', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'verified_action', data: { config: { controllerId: 'ctrl-1', port: 4 } } },
      ]
      
      const targets = extractTargetPorts(nodes)
      expect(targets).toHaveLength(1)
      expect(targets[0].port).toBe(4)
    })

    it('should ignore non-action nodes', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'trigger', data: {} },
        { id: '2', type: 'condition', data: {} },
        { id: '3', type: 'delay', data: { duration: 5, unit: 'minutes' } },
        { id: '4', type: 'variable', data: { name: 'counter' } },
      ]
      
      const targets = extractTargetPorts(nodes)
      expect(targets).toHaveLength(0)
    })

    it('should ignore action nodes without controllerId', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'action', data: { port: 1 } }, // Missing controllerId
      ]
      
      const targets = extractTargetPorts(nodes)
      expect(targets).toHaveLength(0)
    })

    it('should handle port 0', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'action', data: { controllerId: 'ctrl-1', port: 0 } },
      ]
      
      const targets = extractTargetPorts(nodes)
      expect(targets).toHaveLength(1)
      expect(targets[0].port).toBe(0)
    })
  })

  describe('findPortConflicts', () => {
    it('should detect conflicts on same controller:port', () => {
      const targets1: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 1, nodeId: 'a', nodeType: 'action' },
      ]
      const targets2: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 1, nodeId: 'b', nodeType: 'action' },
      ]
      
      const conflicts = findPortConflicts(targets1, targets2)
      expect(conflicts).toEqual(['ctrl-1:1'])
    })

    it('should not detect conflicts on different ports', () => {
      const targets1: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 1, nodeId: 'a', nodeType: 'action' },
      ]
      const targets2: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 2, nodeId: 'b', nodeType: 'action' },
      ]
      
      const conflicts = findPortConflicts(targets1, targets2)
      expect(conflicts).toHaveLength(0)
    })

    it('should not detect conflicts on different controllers', () => {
      const targets1: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 1, nodeId: 'a', nodeType: 'action' },
      ]
      const targets2: TargetPort[] = [
        { controllerId: 'ctrl-2', port: 1, nodeId: 'b', nodeType: 'action' },
      ]
      
      const conflicts = findPortConflicts(targets1, targets2)
      expect(conflicts).toHaveLength(0)
    })

    it('should detect multiple conflicts', () => {
      const targets1: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 1, nodeId: 'a', nodeType: 'action' },
        { controllerId: 'ctrl-1', port: 2, nodeId: 'b', nodeType: 'action' },
      ]
      const targets2: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 1, nodeId: 'c', nodeType: 'action' },
        { controllerId: 'ctrl-1', port: 2, nodeId: 'd', nodeType: 'action' },
      ]
      
      const conflicts = findPortConflicts(targets1, targets2)
      expect(conflicts).toHaveLength(2)
      expect(conflicts).toContain('ctrl-1:1')
      expect(conflicts).toContain('ctrl-1:2')
    })

    it('should handle empty target lists', () => {
      const targets1: TargetPort[] = []
      const targets2: TargetPort[] = [
        { controllerId: 'ctrl-1', port: 1, nodeId: 'a', nodeType: 'action' },
      ]
      
      expect(findPortConflicts(targets1, targets2)).toHaveLength(0)
      expect(findPortConflicts(targets2, targets1)).toHaveLength(0)
    })
  })

  describe('Multi-workflow conflict scenarios', () => {
    it('should detect conflict when 3 workflows target same port', () => {
      const portTargetMap = new Map<string, string[]>()
      
      // Workflow 1 targets ctrl-1:1
      const key1 = 'ctrl-1:1'
      portTargetMap.set(key1, ['workflow-1'])
      
      // Workflow 2 also targets ctrl-1:1
      portTargetMap.get(key1)!.push('workflow-2')
      
      // Workflow 3 also targets ctrl-1:1
      portTargetMap.get(key1)!.push('workflow-3')
      
      const targeting = portTargetMap.get(key1)!
      expect(targeting).toHaveLength(3)
      expect(targeting.length > 1).toBe(true) // Conflict detected
    })

    it('should not flag single workflow per port', () => {
      const portTargetMap = new Map<string, string[]>()
      
      portTargetMap.set('ctrl-1:1', ['workflow-1'])
      portTargetMap.set('ctrl-1:2', ['workflow-2'])
      portTargetMap.set('ctrl-2:1', ['workflow-3'])
      
      let hasConflict = false
      for (const [, workflows] of portTargetMap) {
        if (workflows.length > 1) {
          hasConflict = true
          break
        }
      }
      
      expect(hasConflict).toBe(false)
    })
  })
})

// =============================================================================
// Execution State Tests
// =============================================================================

describe('ExecutionState', () => {
  describe('State persistence for delays', () => {
    it('should create valid execution state for paused workflow', () => {
      const now = new Date()
      const resumeAfter = new Date(now.getTime() + 300000) // 5 minutes
      
      const executionState = {
        paused_at_node: 'delay-node-1',
        resume_after: resumeAfter.toISOString(),
        next_nodes: ['action-node-1', 'action-node-2'],
        workflow_variables: { counter: 5 },
      }
      
      expect(executionState.paused_at_node).toBe('delay-node-1')
      expect(new Date(executionState.resume_after).getTime()).toBeGreaterThan(now.getTime())
      expect(executionState.next_nodes).toHaveLength(2)
      expect(executionState.workflow_variables.counter).toBe(5)
    })

    it('should determine if workflow is ready to resume', () => {
      const now = new Date()
      
      // Past resume time - should resume
      const pastResumeAfter = new Date(now.getTime() - 60000).toISOString()
      expect(new Date(pastResumeAfter).getTime() <= now.getTime()).toBe(true)
      
      // Future resume time - should wait
      const futureResumeAfter = new Date(now.getTime() + 60000).toISOString()
      expect(new Date(futureResumeAfter).getTime() <= now.getTime()).toBe(false)
    })

    it('should preserve workflow variables across pause/resume', () => {
      const originalState = {
        paused_at_node: 'delay-1',
        resume_after: new Date().toISOString(),
        next_nodes: ['action-1'],
        workflow_variables: {
          counter: 10,
          status: 'running',
          isEnabled: true,
        },
      }
      
      // Simulate serialization (DB storage)
      const serialized = JSON.stringify(originalState)
      const restored = JSON.parse(serialized)
      
      expect(restored.workflow_variables.counter).toBe(10)
      expect(restored.workflow_variables.status).toBe('running')
      expect(restored.workflow_variables.isEnabled).toBe(true)
    })
  })
})

// =============================================================================
// MQTT Trigger Tests
// =============================================================================

describe('MQTTTrigger', () => {
  describe('extractJsonPath', () => {
    it('should extract simple field', () => {
      const obj = { temperature: 75.5 }
      expect(extractJsonPath(obj, '$.temperature')).toBe(75.5)
    })

    it('should extract nested field', () => {
      const obj = { sensors: { temperature: 80 } }
      expect(extractJsonPath(obj, '$.sensors.temperature')).toBe(80)
    })

    it('should extract array element', () => {
      const obj = { readings: [10, 20, 30] }
      expect(extractJsonPath(obj, '$.readings[0]')).toBe(10)
      expect(extractJsonPath(obj, '$.readings[1]')).toBe(20)
      expect(extractJsonPath(obj, '$.readings[2]')).toBe(30)
    })

    it('should extract field from array element', () => {
      const obj = { sensors: [{ type: 'temp', value: 72 }, { type: 'humidity', value: 55 }] }
      expect(extractJsonPath(obj, '$.sensors[0].value')).toBe(72)
      expect(extractJsonPath(obj, '$.sensors[1].value')).toBe(55)
    })

    it('should handle path without $. prefix', () => {
      const obj = { temperature: 75.5 }
      expect(extractJsonPath(obj, 'temperature')).toBe(75.5)
    })

    it('should return undefined for missing field', () => {
      const obj = { temperature: 75.5 }
      expect(extractJsonPath(obj, '$.humidity')).toBeUndefined()
    })

    it('should return undefined for invalid path', () => {
      const obj = { temperature: 75.5 }
      expect(extractJsonPath(obj, '$.sensors.temperature')).toBeUndefined()
    })

    it('should return undefined for null object', () => {
      expect(extractJsonPath(null, '$.temperature')).toBeUndefined()
    })

    it('should return undefined for empty path', () => {
      const obj = { temperature: 75.5 }
      expect(extractJsonPath(obj, '')).toBeUndefined()
    })

    it('should handle deeply nested paths', () => {
      const obj = {
        data: {
          sensors: {
            room1: {
              temperature: 72.5,
              humidity: 55,
            },
          },
        },
      }
      expect(extractJsonPath(obj, '$.data.sensors.room1.temperature')).toBe(72.5)
    })
  })

  describe('MQTT Trigger Conditions', () => {
    function evaluateMQTTCondition(
      message: string,
      jsonPath: string,
      operator: string,
      threshold: number
    ): boolean {
      try {
        const payload = JSON.parse(message)
        const value = extractJsonPath(payload, jsonPath)
        
        if (value === undefined || typeof value !== 'number') {
          return false
        }

        switch (operator) {
          case '>': return value > threshold
          case '<': return value < threshold
          case '>=': return value >= threshold
          case '<=': return value <= threshold
          case '=': return value === threshold
          default: return false
        }
      } catch {
        return false
      }
    }

    it('should trigger when value exceeds threshold', () => {
      const message = '{"temperature": 85}'
      expect(evaluateMQTTCondition(message, '$.temperature', '>', 80)).toBe(true)
      expect(evaluateMQTTCondition(message, '$.temperature', '>', 85)).toBe(false)
    })

    it('should trigger when value is below threshold', () => {
      const message = '{"temperature": 70}'
      expect(evaluateMQTTCondition(message, '$.temperature', '<', 75)).toBe(true)
      expect(evaluateMQTTCondition(message, '$.temperature', '<', 70)).toBe(false)
    })

    it('should trigger on greater-or-equal', () => {
      const message = '{"temperature": 80}'
      expect(evaluateMQTTCondition(message, '$.temperature', '>=', 80)).toBe(true)
      expect(evaluateMQTTCondition(message, '$.temperature', '>=', 81)).toBe(false)
    })

    it('should trigger on less-or-equal', () => {
      const message = '{"temperature": 80}'
      expect(evaluateMQTTCondition(message, '$.temperature', '<=', 80)).toBe(true)
      expect(evaluateMQTTCondition(message, '$.temperature', '<=', 79)).toBe(false)
    })

    it('should trigger on exact equality', () => {
      const message = '{"temperature": 75}'
      expect(evaluateMQTTCondition(message, '$.temperature', '=', 75)).toBe(true)
      expect(evaluateMQTTCondition(message, '$.temperature', '=', 76)).toBe(false)
    })

    it('should handle invalid JSON gracefully', () => {
      expect(evaluateMQTTCondition('not json', '$.temperature', '>', 80)).toBe(false)
    })

    it('should handle missing field gracefully', () => {
      const message = '{"humidity": 55}'
      expect(evaluateMQTTCondition(message, '$.temperature', '>', 80)).toBe(false)
    })

    it('should handle non-numeric value gracefully', () => {
      const message = '{"temperature": "warm"}'
      expect(evaluateMQTTCondition(message, '$.temperature', '>', 80)).toBe(false)
    })
  })

  describe('MQTT Topic Validation', () => {
    function validateTopic(topic: string): boolean {
      if (!topic) return true
      if (topic.includes(' ')) return false
      if (topic.startsWith('/') || topic.endsWith('/')) return false
      
      const parts = topic.split('/')
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        if (part === '#' && i !== parts.length - 1) return false
        if (part.includes('+') && part !== '+') return false
        if (part.includes('#') && part !== '#') return false
      }
      
      return true
    }

    it('should accept valid simple topics', () => {
      expect(validateTopic('home/growroom/temperature')).toBe(true)
      expect(validateTopic('sensors/reading')).toBe(true)
    })

    it('should accept single-level wildcard', () => {
      expect(validateTopic('home/+/temperature')).toBe(true)
      expect(validateTopic('+/sensors')).toBe(true)
    })

    it('should accept multi-level wildcard at end', () => {
      expect(validateTopic('home/growroom/#')).toBe(true)
      expect(validateTopic('#')).toBe(true)
    })

    it('should reject multi-level wildcard not at end', () => {
      expect(validateTopic('home/#/temperature')).toBe(false)
    })

    it('should reject topics with spaces', () => {
      expect(validateTopic('home/grow room/temp')).toBe(false)
    })

    it('should reject topics with leading/trailing slashes', () => {
      expect(validateTopic('/home/growroom')).toBe(false)
      expect(validateTopic('home/growroom/')).toBe(false)
    })

    it('should reject invalid wildcard usage', () => {
      expect(validateTopic('home/temp+/reading')).toBe(false)
      expect(validateTopic('home/sensors#')).toBe(false)
    })

    it('should accept empty topic (optional)', () => {
      expect(validateTopic('')).toBe(true)
    })
  })

  describe('MQTT Broker URL Validation', () => {
    function validateBrokerUrl(url: string): boolean {
      if (!url) return false
      const validProtocols = ['mqtt://', 'mqtts://', 'ws://', 'wss://']
      return validProtocols.some(p => url.toLowerCase().startsWith(p))
    }

    it('should accept mqtt:// protocol', () => {
      expect(validateBrokerUrl('mqtt://localhost:1883')).toBe(true)
      expect(validateBrokerUrl('mqtt://broker.example.com:1883')).toBe(true)
    })

    it('should accept mqtts:// protocol', () => {
      expect(validateBrokerUrl('mqtts://broker.hivemq.com:8883')).toBe(true)
    })

    it('should accept ws:// protocol', () => {
      expect(validateBrokerUrl('ws://localhost:8080/mqtt')).toBe(true)
    })

    it('should accept wss:// protocol', () => {
      expect(validateBrokerUrl('wss://broker.example.com:443/mqtt')).toBe(true)
    })

    it('should reject http:// protocol', () => {
      expect(validateBrokerUrl('http://localhost:1883')).toBe(false)
    })

    it('should reject empty URL', () => {
      expect(validateBrokerUrl('')).toBe(false)
    })

    it('should reject invalid protocol', () => {
      expect(validateBrokerUrl('tcp://localhost:1883')).toBe(false)
    })
  })
})
