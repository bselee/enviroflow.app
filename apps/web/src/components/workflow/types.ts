/**
 * TypeScript type definitions for the Workflow Builder
 *
 * These types define the structure of workflow nodes, edges, and their configurations.
 * Workflows are stored as JSONB in the database with nodes and edges arrays.
 */

import type { Edge, XYPosition, Position } from "@xyflow/react";
import type { SensorType } from "@/types";

// Re-export SensorType for consumers of this module
export type { SensorType };

// ============================================================================
// Trigger Node Types
// ============================================================================

/** Types of triggers that can initiate a workflow */
export type TriggerType = "schedule" | "sensor_threshold" | "manual";

/** Configuration for schedule-based triggers */
export interface ScheduleTriggerConfig {
  triggerType: "schedule";
  /** Cron expression for advanced scheduling (e.g., "0 6 * * *" for 6am daily) */
  cronExpression?: string;
  /** Simple time string for basic scheduling (HH:MM format) */
  simpleTime?: string;
  /** Days of week for simple scheduling (0 = Sunday, 6 = Saturday) */
  daysOfWeek?: number[];
}

/** Configuration for sensor threshold triggers */
export interface SensorThresholdTriggerConfig {
  triggerType: "sensor_threshold";
  /** ID of the controller to monitor */
  controllerId?: string;
  /** Type of sensor to monitor */
  sensorType?: SensorType;
  /** Comparison operator */
  operator?: ComparisonOperator;
  /** Threshold value to compare against */
  threshold?: number;
}

/** Configuration for manual triggers */
export interface ManualTriggerConfig {
  triggerType: "manual";
}

/** Union type for all trigger configurations */
export type TriggerConfig = ScheduleTriggerConfig | SensorThresholdTriggerConfig | ManualTriggerConfig;

/** Data payload for TriggerNode */
export interface TriggerNodeData {
  label: string;
  config: TriggerConfig;
}

/** Comparison operators for threshold comparisons */
export type ComparisonOperator = ">" | "<" | "=" | ">=" | "<=";

/** Configuration for sensor nodes */
export interface SensorNodeConfig {
  /** ID of the controller to read from */
  controllerId?: string;
  /** Controller name for display purposes */
  controllerName?: string;
  /** Type of sensor reading to monitor */
  sensorType?: SensorType;
  /** Comparison operator for threshold */
  operator?: ComparisonOperator;
  /** Threshold value that triggers the condition */
  threshold?: number;
  /** Reset threshold for hysteresis (prevents rapid on/off cycling) */
  resetThreshold?: number;
  /** Unit of measurement for display */
  unit?: string;
}

/** Data payload for SensorNode */
export interface SensorNodeData {
  label: string;
  config: SensorNodeConfig;
  /** Current live sensor value (updated via realtime subscription) */
  currentValue?: number;
}

// ============================================================================
// Condition Node Types
// ============================================================================

/** Logic type for condition nodes */
export type LogicType = "AND" | "OR";

/** Configuration for condition nodes */
export interface ConditionNodeConfig {
  /** Logic type for combining multiple inputs */
  logicType: LogicType;
}

/** Data payload for ConditionNode */
export interface ConditionNodeData {
  label: string;
  config: ConditionNodeConfig;
}

// ============================================================================
// Action Node Types
// ============================================================================

/** Device types that can be controlled */
export type DeviceType =
  | "fan"
  | "light"
  | "heater"
  | "cooler"
  | "humidifier"
  | "dehumidifier"
  | "outlet"
  | "pump"
  | "valve";

/** Action types available for device control */
export type ActionVariant =
  | "set_speed"        // Fan speed 0-100%
  | "on_off"           // Simple on/off toggle
  | "set_level"        // Generic level 0-100%
  | "set_temperature"; // Temperature setpoint

/** Configuration for action nodes */
export interface ActionNodeConfig {
  /** ID of the controller to send commands to */
  controllerId?: string;
  /** Controller name for display */
  controllerName?: string;
  /** Port number on the controller */
  port?: number;
  /** Type of device being controlled */
  deviceType?: DeviceType;
  /** Action to perform */
  action?: ActionVariant;
  /** Value for set_speed/set_level (0-100) */
  value?: number;
  /** For on_off action: true = turn on, false = turn off */
  turnOn?: boolean;
  /** For set_temperature action */
  temperature?: number;
}

/** Current device state (populated at runtime) */
export interface DeviceState {
  isOn: boolean;
  level?: number;
  temperature?: number;
}

/** Data payload for ActionNode */
export interface ActionNodeData {
  label: string;
  config: ActionNodeConfig;
  /** Current device state (read-only, populated at runtime) */
  currentState?: DeviceState;
}

/** Labels for device types */
export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  fan: "Fan",
  light: "Light",
  heater: "Heater",
  cooler: "Cooler",
  humidifier: "Humidifier",
  dehumidifier: "Dehumidifier",
  outlet: "Outlet",
  pump: "Pump",
  valve: "Valve",
};

/** Labels for action variants */
export const ACTION_VARIANT_LABELS: Record<ActionVariant, string> = {
  set_speed: "Set Speed",
  on_off: "On/Off",
  set_level: "Set Level",
  set_temperature: "Set Temperature",
};

// ============================================================================
// Dimmer Node Types
// ============================================================================

/** Dimmer curve types for light transitions */
export type DimmerCurve = "linear" | "sigmoid" | "exponential" | "logarithmic";

/** Configuration for dimmer nodes */
export interface DimmerNodeConfig {
  /** ID of the controller */
  controllerId?: string;
  /** Controller name for display */
  controllerName?: string;
  /** Port number on the controller */
  port?: number;
  /** Sunrise time in HH:MM format */
  sunriseTime?: string;
  /** Sunset time in HH:MM format */
  sunsetTime?: string;
  /** Minimum light level (0-100) */
  minLevel?: number;
  /** Maximum light level (0-100) */
  maxLevel?: number;
  /** Transition curve type */
  curve?: DimmerCurve;
}

/** Data payload for DimmerNode */
export interface DimmerNodeData {
  label: string;
  config: DimmerNodeConfig;
  /** Current calculated level (read-only, populated at runtime) */
  currentLevel?: number;
}

/** Labels for dimmer curves */
export const DIMMER_CURVE_LABELS: Record<DimmerCurve, string> = {
  linear: "Linear",
  sigmoid: "S-Curve (Natural)",
  exponential: "Fast Start",
  logarithmic: "Fast End",
};

// ============================================================================
// Notification Node Types
// ============================================================================

/** Notification priority levels */
export type NotificationPriority = "low" | "normal" | "high" | "critical";

/** Notification delivery channels */
export type NotificationChannel = "push" | "email" | "sms";

/** Available variables for notification message templates */
export const MESSAGE_VARIABLES = [
  { variable: "{{sensor.temperature}}", label: "Temperature" },
  { variable: "{{sensor.humidity}}", label: "Humidity" },
  { variable: "{{sensor.vpd}}", label: "VPD" },
  { variable: "{{sensor.co2}}", label: "CO2" },
  { variable: "{{controller.name}}", label: "Controller Name" },
  { variable: "{{room.name}}", label: "Room Name" },
  { variable: "{{time}}", label: "Current Time" },
  { variable: "{{date}}", label: "Current Date" },
] as const;

/** Configuration for notification nodes */
export interface NotificationNodeConfig {
  /** Message template with variable placeholders */
  message?: string;
  /** Notification priority level */
  priority?: NotificationPriority;
  /** Notification channels to use */
  channels?: NotificationChannel[];
}

/** Data payload for NotificationNode */
export interface NotificationNodeData {
  label: string;
  config: NotificationNodeConfig;
}

/** Labels for notification priority */
export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

/** Labels for notification channels */
export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  push: "Push Notification",
  email: "Email",
  sms: "SMS",
};

// ============================================================================
// Verified Action Node Types
// ============================================================================

/** Configuration for verified action nodes */
export interface VerifiedActionNodeConfig {
  /** ID of the controller to send commands to */
  controllerId: string;
  /** Controller name for display */
  controllerName: string;
  /** Port number on the controller */
  port: number;
  /** Port name for display */
  portName: string;
  /** Action to perform */
  action: 'on' | 'off' | 'set_level';
  /** Level for set_level action (0-10) */
  level?: number;
  /** Timeout in seconds to wait for verification */
  verifyTimeout: number;
  /** Maximum retry attempts on failure */
  retryCount: number;
  /** Whether to rollback on verification failure */
  rollbackOnFailure: boolean;
}

/** Data payload for VerifiedActionNode */
export interface VerifiedActionNodeData {
  label: string;
  config: VerifiedActionNodeConfig;
}

// ============================================================================
// Port Condition Node Types
// ============================================================================

/** Port condition operators */
export type PortConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than';

/** Configuration for port condition nodes */
export interface PortConditionNodeConfig {
  /** ID of the controller to monitor */
  controllerId: string;
  /** Controller name for display */
  controllerName: string;
  /** Port number on the controller */
  port: number;
  /** Port name for display */
  portName: string;
  /** Condition to evaluate */
  condition: 'is_on' | 'is_off' | 'level_equals' | 'level_above' | 'level_below' | 'mode_equals';
  /** Target level for level comparisons (0-10) */
  targetLevel?: number;
  /** Target mode for mode comparison */
  targetMode?: string;
}

/** Data payload for PortConditionNode */
export interface PortConditionNodeData {
  label: string;
  config: PortConditionNodeConfig;
}

// ============================================================================
// Mode Programming Node Types
// ============================================================================

/** Device mode types for AC Infinity controllers */
export type DeviceModeType = "off" | "on" | "auto" | "vpd" | "timer" | "cycle" | "schedule";

/** Configuration for Auto mode */
export interface AutoModeConfig {
  tempHighTrigger: number;
  tempHighEnabled: boolean;
  tempLowTrigger: number;
  tempLowEnabled: boolean;
  humidityHighTrigger: number;
  humidityHighEnabled: boolean;
  humidityLowTrigger: number;
  humidityLowEnabled: boolean;
  levelLow: number;
  levelHigh: number;
  transition: boolean;
}

/** Configuration for VPD mode */
export interface VpdModeConfig {
  vpdHighTrigger: number;
  vpdHighEnabled: boolean;
  vpdLowTrigger: number;
  vpdLowEnabled: boolean;
  levelLow: number;
  levelHigh: number;
  transition: boolean;
}

/** Configuration for Timer mode */
export interface TimerModeConfig {
  durationOn: number; // seconds
  durationOff: number; // seconds
  level: number;
}

/** Configuration for Cycle mode */
export interface CycleModeConfig {
  durationOn: number; // seconds
  durationOff: number; // seconds
  level: number;
}

/** Configuration for Schedule mode */
export interface ScheduleModeConfig {
  schedules: Array<{
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    level: number;
    days: number[]; // 0-6 (Sun-Sat)
  }>;
}

/** Configuration for Mode Programming node */
export interface ModeNodeConfig {
  controllerId: string;
  controllerName: string;
  port: number;
  portName: string;
  mode: DeviceModeType;
  autoConfig?: AutoModeConfig;
  vpdConfig?: VpdModeConfig;
  timerConfig?: TimerModeConfig;
  cycleConfig?: CycleModeConfig;
  scheduleConfig?: ScheduleModeConfig;
  priority: number; // execution order for multi-port workflows
}

/** Data payload for ModeNode */
export interface ModeNodeData {
  label: string;
  config: ModeNodeConfig;
}

/** Labels for device modes */
export const MODE_LABELS: Record<DeviceModeType, string> = {
  off: "Off",
  on: "On",
  auto: "Auto",
  vpd: "VPD",
  timer: "Timer",
  cycle: "Cycle",
  schedule: "Schedule",
};

// ============================================================================
// Workflow Node Types
// ============================================================================

/** All possible node types in the workflow */
export type WorkflowNodeType =
  | "trigger"
  | "sensor"
  | "condition"
  | "action"
  | "dimmer"
  | "notification"
  | "mode"
  | "verified_action"
  | "port_condition";

/** Union of all node data types */
export type WorkflowNodeData =
  | TriggerNodeData
  | SensorNodeData
  | ConditionNodeData
  | ActionNodeData
  | DimmerNodeData
  | NotificationNodeData
  | ModeNodeData
  | VerifiedActionNodeData
  | PortConditionNodeData;

/** Extended Node type with workflow-specific data */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: XYPosition;
  data: WorkflowNodeData;
  sourcePosition?: Position;
  targetPosition?: Position;
  selected?: boolean;
  dragging?: boolean;
  width?: number;
  height?: number;
}

/** Typed edge for workflows */
export type WorkflowEdge = Edge;

// ============================================================================
// Workflow Definition
// ============================================================================

/** Complete workflow definition as stored in the database */
export interface WorkflowDefinition {
  /** Unique identifier */
  id: string;
  /** User-defined name */
  name: string;
  /** Optional description */
  description?: string;
  /** Whether the workflow is currently active */
  isActive: boolean;
  /** Room ID this workflow belongs to */
  roomId?: string;
  /** Array of nodes in the workflow */
  nodes: WorkflowNode[];
  /** Array of edges connecting nodes */
  edges: WorkflowEdge[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** User ID of the owner */
  userId: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/** State for the node properties panel */
export interface NodePropertiesPanelState {
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Whether the panel is open */
  isOpen: boolean;
}

/** State for the workflow builder */
export interface WorkflowBuilderState {
  /** Current workflow being edited */
  workflow: WorkflowDefinition | null;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether the workflow is being saved */
  isSaving: boolean;
  /** Error message if save failed */
  saveError: string | null;
}

// ============================================================================
// Sensor Display Helpers
// ============================================================================

/** Human-readable labels for sensor types */
export const SENSOR_TYPE_LABELS: Record<SensorType, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
  vpd: "VPD",
  co2: "CO2",
  light: "Light Intensity",
  soil_moisture: "Soil Moisture",
  ph: "pH",
  ec: "EC",
  pressure: "Pressure",
  water_level: "Water Level",
  wind_speed: "Wind Speed",
  pm25: "PM2.5",
  uv: "UV Index",
  solar_radiation: "Solar Radiation",
  rain: "Rainfall",
};

/** Default units for sensor types */
export const SENSOR_TYPE_UNITS: Record<SensorType, string> = {
  temperature: "°F",
  humidity: "%",
  vpd: "kPa",
  co2: "ppm",
  light: "PPFD",
  soil_moisture: "%",
  ph: "",
  ec: "mS/cm",
  pressure: "hPa",
  water_level: "%",
  wind_speed: "mph",
  pm25: "µg/m³",
  uv: "",
  solar_radiation: "W/m²",
  rain: "mm",
};

/** Operator labels for display */
export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  ">": "greater than",
  "<": "less than",
  "=": "equals",
  ">=": "greater than or equal to",
  "<=": "less than or equal to",
};
