/**
 * Workflow Types for EnviroFlow
 * Defines all types related to automation workflows
 */

import type { SensorType, DeviceType } from './controller'

// React Flow compatible node/edge types
export interface Position {
  x: number
  y: number
}

export type NodeType = 'trigger' | 'condition' | 'action' | 'delay'

export type TriggerVariant = 'timer' | 'sensor' | 'schedule' | 'manual'

export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export type ActionVariant =
  | 'set_fan'
  | 'set_light'
  | 'set_heater'
  | 'set_humidifier'
  | 'set_dehumidifier'
  | 'turn_on'
  | 'turn_off'

export interface TriggerNodeData {
  label: string
  variant: TriggerVariant
  // Timer trigger
  interval?: number // seconds
  // Sensor trigger
  sensorType?: SensorType
  operator?: ConditionOperator
  threshold?: number
  // Schedule trigger
  cronExpression?: string
  timezone?: string
}

export interface ConditionNodeData {
  label: string
  sensorType: SensorType
  operator: ConditionOperator
  threshold: number
  unit?: string
}

export interface ActionNodeData {
  label: string
  variant: ActionVariant
  deviceType?: DeviceType
  port?: number
  level?: number // 0-100 for dimmers
}

export interface DelayNodeData {
  label: string
  duration: number // seconds
}

export type WorkflowNodeData =
  | TriggerNodeData
  | ConditionNodeData
  | ActionNodeData
  | DelayNodeData

export interface WorkflowNode {
  id: string
  type: NodeType
  position: Position
  data: WorkflowNodeData
  // React Flow properties
  draggable?: boolean
  selectable?: boolean
  connectable?: boolean
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  // Condition edges can have labels
  label?: string
  // For condition nodes: 'true' or 'false' branch
  data?: {
    branch?: 'true' | 'false'
  }
}

export interface Workflow {
  id: string
  user_id: string
  name: string
  description: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowRoom {
  id: string
  workflow_id: string
  controller_id: string
  created_at: string
}

export interface DimmerConfig {
  id: string
  workflow_id: string
  controller_id: string
  dimmer_port: number
  sunrise_time: string // HH:MM:SS format
  sunrise_duration: number // minutes
  sunrise_curve: 'linear' | 'sigmoid' | 'exponential'
  sunset_time: string
  sunset_duration: number
  sunset_curve: 'linear' | 'sigmoid' | 'exponential'
  target_intensity: number // 0-100
  is_active: boolean
  created_at: string
  updated_at?: string
}

// Database row types
export interface WorkflowRow {
  id: string
  user_id: string
  name: string
  description: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// Insert/Update types
export interface WorkflowInsert {
  user_id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active?: boolean
}

export interface WorkflowUpdate {
  name?: string
  description?: string
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
  is_active?: boolean
}

export interface DimmerConfigInsert {
  workflow_id: string
  controller_id: string
  dimmer_port: number
  sunrise_time: string
  sunrise_duration?: number
  sunrise_curve?: 'linear' | 'sigmoid' | 'exponential'
  sunset_time: string
  sunset_duration?: number
  sunset_curve?: 'linear' | 'sigmoid' | 'exponential'
  target_intensity?: number
  is_active?: boolean
}

export interface DimmerConfigUpdate {
  dimmer_port?: number
  sunrise_time?: string
  sunrise_duration?: number
  sunrise_curve?: 'linear' | 'sigmoid' | 'exponential'
  sunset_time?: string
  sunset_duration?: number
  sunset_curve?: 'linear' | 'sigmoid' | 'exponential'
  target_intensity?: number
  is_active?: boolean
}

// Workflow with joined data
export interface WorkflowWithRooms extends Workflow {
  workflow_rooms: Array<{
    controller_id: string
    controllers: {
      id: string
      brand: string
      controller_id: string
      name: string
      credentials: Record<string, unknown>
      capabilities: Record<string, unknown> | null
      is_online: boolean
      last_seen: string | null
    }
  }>
}
