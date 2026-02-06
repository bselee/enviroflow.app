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
export type TriggerType = "schedule" | "sensor_threshold" | "manual" | "mqtt";

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
  /** ID of standalone sensor (alternative to controllerId) */
  sensorId?: string;
  /** Whether this references a controller sensor or standalone sensor */
  sensorSource?: 'controller' | 'standalone';
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

/** Configuration for MQTT-based triggers */
export interface MQTTTriggerConfig {
  triggerType: "mqtt";
  /** Reference to an MQTT controller (credentials stored encrypted in controllers table) */
  controllerId?: string;
  /** Controller name for display purposes only */
  controllerName?: string;
  /** MQTT topic to subscribe to (supports wildcards: + for single level, # for multi-level) */
  topic?: string;
  /** JSONPath expression to extract value from payload (e.g., $.temperature) */
  jsonPath?: string;
  /** Comparison operator for threshold */
  operator?: ComparisonOperator;
  /** Threshold value to compare against extracted value */
  threshold?: number;
  /** Last received message (for preview in UI) */
  lastMessage?: string;
  /** Last received timestamp */
  lastReceivedAt?: string;
}

/** Union type for all trigger configurations */
export type TriggerConfig = ScheduleTriggerConfig | SensorThresholdTriggerConfig | ManualTriggerConfig | MQTTTriggerConfig;

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
  /** ID of standalone sensor (alternative to controllerId) */
  sensorId?: string;
  /** Standalone sensor name for display */
  sensorName?: string;
  /** Whether this references a controller sensor or standalone sensor */
  sensorSource?: 'controller' | 'standalone';
  /** Type of sensor reading to monitor */
  sensorType?: SensorType;
  /** Port number for multi-port sensors (e.g., Ecowitt CH1, CH2) */
  port?: number;
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
// Dimmer Node Types (Light Schedule with Sunrise/Sunset Simulation)
// ============================================================================

/** Dimmer curve types for light transitions */
export type DimmerCurve = "linear" | "sigmoid" | "exponential" | "logarithmic";

/**
 * Configuration for dimmer nodes - Light schedule with optional ramp
 *
 * Timeline example with onTime="06:00", offTime="22:00", sunriseMinutes=30, sunsetMinutes=30:
 * - 05:30 - Sunrise begins (ramp from minLevel)
 * - 06:00 - Fully ON (maxLevel reached)
 * - 22:00 - Sunset begins (ramp from maxLevel)
 * - 22:30 - Fully OFF (minLevel reached)
 */
export interface DimmerNodeConfig {
  /** ID of the controller */
  controllerId?: string;
  /** Controller name for display */
  controllerName?: string;
  /** Port number on the controller */
  port?: number;

  // Schedule times
  /** Time when lights reach maxLevel (HH:MM format) */
  onTime?: string;
  /** Time when lights start ramping to minLevel (HH:MM format) */
  offTime?: string;

  // Level settings (0-100%)
  /** Level when "off" / night (0-100) */
  minLevel?: number;
  /** Level when fully "on" / day (0-100) */
  maxLevel?: number;

  // Sunrise/Sunset ramp settings
  /** Minutes to ramp up BEFORE onTime (sunrise simulation) */
  sunriseMinutes?: number;
  /** Minutes to ramp down AFTER offTime (sunset simulation) */
  sunsetMinutes?: number;
  /** Transition curve type */
  curve?: DimmerCurve;

  // Days of week (empty = everyday)
  days?: number[];
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
// Mode Programming Node Types (AC Infinity Port Programming Model)
// See: docs/spec/enviroflow-port-programming.md
// ============================================================================

/** Device mode types for AC Infinity controllers - 8 modes per port */
export type DeviceModeType =
  | "off"           // Device off (runs at offLevel)
  | "on"            // Device runs continuously at onLevel
  | "auto"          // Climate mode - reacts to temp/humidity triggers
  | "vpd"           // Climate mode - reacts to VPD triggers
  | "timer_to_on"   // Countdown → turns ON
  | "timer_to_off"  // Countdown → turns OFF
  | "cycle"         // Repeating ON/OFF durations
  | "schedule";     // Daily ON/OFF clock times

/** Device types for port assignment */
export type PortDeviceType =
  | "inline_fan"
  | "clip_fan"
  | "light"
  | "humidifier"
  | "dehumidifier"
  | "heater"
  | "ac"
  | "outlet"
  | "heatmat"
  | "pump";

/** Control type - PWM (0-10 variable) vs Outlet (binary ON/OFF) */
export type ControlType = "pwm" | "outlet";

/**
 * Configuration for Auto mode - The Core Climate Engine
 * Has 4 independent triggers that can ALL fire simultaneously
 */
export interface AutoModeConfig {
  // High Temp trigger - activates when temp >= setpoint (e.g., for cooling)
  tempHighTrigger: number;       // °F (32-194)
  tempHighEnabled: boolean;
  // Low Temp trigger - activates when temp <= setpoint (e.g., for heating)
  tempLowTrigger: number;        // °F (32-194)
  tempLowEnabled: boolean;
  // High Humidity trigger - activates when humidity >= setpoint
  humidityHighTrigger: number;   // % (0-100)
  humidityHighEnabled: boolean;
  // Low Humidity trigger - activates when humidity <= setpoint
  humidityLowTrigger: number;    // % (0-100)
  humidityLowEnabled: boolean;
  // Transition settings - degrees/percent deviation per level step
  tempTransition: number;        // °F per level step (e.g., 2.0)
  humidityTransition: number;    // % per level step (e.g., 5.0)
  // Buffer settings - hysteresis to prevent rapid ON/OFF cycling
  tempBuffer: number;            // °F (0-8)
  humidityBuffer: number;        // % (0-10)
}

/**
 * Configuration for VPD mode (PRO / PRO+ / AI+ only)
 * Has 2 triggers for VPD-based climate control
 */
export interface VpdModeConfig {
  // High VPD trigger - air too dry for plant
  vpdHighTrigger: number;        // kPa
  vpdHighEnabled: boolean;
  // Low VPD trigger - air too moist
  vpdLowTrigger: number;         // kPa
  vpdLowEnabled: boolean;
  // Transition and buffer
  vpdTransition: number;         // kPa per level step (e.g., 0.10)
  vpdBuffer: number;             // kPa (0-0.5)
}

/** Configuration for Timer To On mode - countdown then turns ON */
export interface TimerToOnConfig {
  durationMinutes: number;       // Countdown duration (HH:MM stored as minutes)
}

/** Configuration for Timer To Off mode - countdown then turns OFF */
export interface TimerToOffConfig {
  durationMinutes: number;       // Countdown duration (HH:MM stored as minutes)
}

/** Configuration for Cycle mode - repeating ON/OFF durations */
export interface CycleModeConfig {
  durationOnMinutes: number;     // ON duration in minutes
  durationOffMinutes: number;    // OFF duration in minutes
}

/** Configuration for Schedule mode - daily ON/OFF clock times */
export interface ScheduleModeConfig {
  onTime: string;                // "HH:MM" 24h format
  offTime: string;               // "HH:MM" 24h format
  days: number[];                // 0-6 (Sun-Sat), empty = everyday
}

/** Configuration for Mode Programming node - matches AC Infinity's per-port model */
export interface ModeNodeConfig {
  // Controller & Port identification
  controllerId?: string;
  controllerName?: string;
  port?: number;
  portName?: string;

  // Device assignment
  deviceName?: string;           // "Cloudline T6"
  deviceType?: PortDeviceType;   // What kind of device
  controlType?: ControlType;     // PWM (0-10) or Outlet (ON/OFF)

  // Current mode
  mode?: DeviceModeType;

  // Level settings (0-10 for PWM, 0 or 1 for outlet)
  onLevel: number;               // Max level when triggered (default: 10)
  offLevel: number;              // Min level / baseline (default: 0)

  // Mode-specific configurations
  autoConfig?: AutoModeConfig;
  vpdConfig?: VpdModeConfig;
  timerToOnConfig?: TimerToOnConfig;
  timerToOffConfig?: TimerToOffConfig;
  cycleConfig?: CycleModeConfig;
  scheduleConfig?: ScheduleModeConfig;

  // Workflow priority
  priority?: number;             // Higher = takes precedence
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
  timer_to_on: "Timer → On",
  timer_to_off: "Timer → Off",
  cycle: "Cycle",
  schedule: "Schedule",
};

/** Labels for port device types (AC Infinity port programming) */
export const PORT_DEVICE_TYPE_LABELS: Record<PortDeviceType, string> = {
  inline_fan: "Inline Fan",
  clip_fan: "Clip Fan",
  light: "Grow Light",
  humidifier: "Humidifier",
  dehumidifier: "Dehumidifier",
  heater: "Heater",
  ac: "AC Unit",
  outlet: "Smart Outlet",
  heatmat: "Heat Mat",
  pump: "Water Pump",
};

/** Control type labels */
export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  pwm: "PWM (0-10)",
  outlet: "Outlet (ON/OFF)",
};

/** Smart defaults by device type - applied when device is selected */
export const DEVICE_SMART_DEFAULTS: Record<PortDeviceType, Partial<ModeNodeConfig>> = {
  inline_fan: {
    controlType: "pwm",
    mode: "auto",
    onLevel: 10,
    offLevel: 3,
    autoConfig: {
      tempHighTrigger: 80,
      tempHighEnabled: true,
      tempLowTrigger: 65,
      tempLowEnabled: false,
      humidityHighTrigger: 70,
      humidityHighEnabled: false,
      humidityLowTrigger: 40,
      humidityLowEnabled: false,
      tempTransition: 2.0,
      humidityTransition: 5.0,
      tempBuffer: 0,
      humidityBuffer: 0,
    },
  },
  clip_fan: {
    controlType: "pwm",
    mode: "on",
    onLevel: 4,
    offLevel: 0,
  },
  light: {
    controlType: "pwm",
    mode: "schedule",
    onLevel: 10,
    offLevel: 0,
    scheduleConfig: {
      onTime: "06:00",
      offTime: "00:00",  // 18/6 veg default
      days: [],
    },
  },
  humidifier: {
    controlType: "outlet",
    mode: "auto",
    onLevel: 1,
    offLevel: 0,
    autoConfig: {
      tempHighTrigger: 85,
      tempHighEnabled: false,
      tempLowTrigger: 65,
      tempLowEnabled: false,
      humidityHighTrigger: 70,
      humidityHighEnabled: false,
      humidityLowTrigger: 50,
      humidityLowEnabled: true,
      tempTransition: 2.0,
      humidityTransition: 5.0,
      tempBuffer: 0,
      humidityBuffer: 6,
    },
  },
  dehumidifier: {
    controlType: "outlet",
    mode: "auto",
    onLevel: 1,
    offLevel: 0,
    autoConfig: {
      tempHighTrigger: 85,
      tempHighEnabled: false,
      tempLowTrigger: 65,
      tempLowEnabled: false,
      humidityHighTrigger: 60,
      humidityHighEnabled: true,
      humidityLowTrigger: 40,
      humidityLowEnabled: false,
      tempTransition: 2.0,
      humidityTransition: 5.0,
      tempBuffer: 0,
      humidityBuffer: 4,
    },
  },
  heater: {
    controlType: "outlet",
    mode: "auto",
    onLevel: 1,
    offLevel: 0,
    autoConfig: {
      tempHighTrigger: 85,
      tempHighEnabled: false,
      tempLowTrigger: 65,
      tempLowEnabled: true,
      humidityHighTrigger: 70,
      humidityHighEnabled: false,
      humidityLowTrigger: 40,
      humidityLowEnabled: false,
      tempTransition: 2.0,
      humidityTransition: 5.0,
      tempBuffer: 4,
      humidityBuffer: 0,
    },
  },
  ac: {
    controlType: "outlet",
    mode: "auto",
    onLevel: 1,
    offLevel: 0,
    autoConfig: {
      tempHighTrigger: 85,
      tempHighEnabled: true,
      tempLowTrigger: 65,
      tempLowEnabled: false,
      humidityHighTrigger: 70,
      humidityHighEnabled: false,
      humidityLowTrigger: 40,
      humidityLowEnabled: false,
      tempTransition: 2.0,
      humidityTransition: 5.0,
      tempBuffer: 4,
      humidityBuffer: 0,
    },
  },
  outlet: {
    controlType: "outlet",
    mode: "off",
    onLevel: 1,
    offLevel: 0,
  },
  heatmat: {
    controlType: "outlet",
    mode: "on",
    onLevel: 1,
    offLevel: 0,
  },
  pump: {
    controlType: "outlet",
    mode: "cycle",
    onLevel: 1,
    offLevel: 0,
    cycleConfig: {
      durationOnMinutes: 15,
      durationOffMinutes: 45,
    },
  },
};

// ============================================================================
// Delay Node Types
// ============================================================================

/** Time unit for delay duration */
export type DelayTimeUnit = "seconds" | "minutes" | "hours";

/** Configuration for delay nodes */
export interface DelayNodeConfig {
  /** Duration value */
  duration: number;
  /** Time unit for the duration */
  unit: DelayTimeUnit;
}

/** Data payload for DelayNode */
export interface DelayNodeData {
  label: string;
  config: DelayNodeConfig;
}

/** Labels for delay time units */
export const DELAY_TIME_UNIT_LABELS: Record<DelayTimeUnit, string> = {
  seconds: "Seconds",
  minutes: "Minutes",
  hours: "Hours",
};

// ============================================================================
// Variable Node Types
// ============================================================================

/** Variable scope - workflow-local or global (cross-workflow) */
export type VariableScope = "workflow" | "global";

/** Variable operation types */
export type VariableOperation = "set" | "get" | "increment" | "decrement";

/** Variable value types */
export type VariableValueType = "number" | "string" | "boolean";

/** Configuration for variable nodes */
export interface VariableNodeConfig {
  /** Variable name */
  name: string;
  /** Variable scope */
  scope: VariableScope;
  /** Operation to perform */
  operation: VariableOperation;
  /** Value type */
  valueType: VariableValueType;
  /** Value for set operations */
  value?: string | number | boolean;
  /** Amount for increment/decrement */
  amount?: number;
}

/** Data payload for VariableNode */
export interface VariableNodeData {
  label: string;
  config: VariableNodeConfig;
  /** Current variable value (read-only, populated at runtime) */
  currentValue?: string | number | boolean;
}

/** Labels for variable scopes */
export const VARIABLE_SCOPE_LABELS: Record<VariableScope, string> = {
  workflow: "Workflow",
  global: "Global",
};

/** Labels for variable operations */
export const VARIABLE_OPERATION_LABELS: Record<VariableOperation, string> = {
  set: "Set",
  get: "Get",
  increment: "Increment",
  decrement: "Decrement",
};

/** Labels for variable value types */
export const VARIABLE_VALUE_TYPE_LABELS: Record<VariableValueType, string> = {
  number: "Number",
  string: "Text",
  boolean: "Boolean",
};

// ============================================================================
// Debounce Node Types
// ============================================================================

/** Configuration for debounce nodes (prevents rapid triggering) */
export interface DebounceNodeConfig {
  /** Minimum time between triggers in seconds */
  cooldownSeconds: number;
  /** Whether to execute on the leading edge (first trigger) */
  executeOnLead: boolean;
  /** Whether to execute on the trailing edge (after cooldown) */
  executeOnTrail: boolean;
}

/** Data payload for DebounceNode */
export interface DebounceNodeData {
  label: string;
  config: DebounceNodeConfig;
  /** Last execution timestamp (runtime) */
  lastExecutedAt?: string;
}

// ============================================================================
// Enhanced Sensor Threshold with Hysteresis
// ============================================================================

/** Extended sensor threshold config with hysteresis support */
export interface SensorThresholdTriggerConfigWithHysteresis extends SensorThresholdTriggerConfig {
  /** Enable hysteresis band to prevent rapid cycling */
  hysteresisEnabled?: boolean;
  /** Re-arm threshold - sensor must return past this value before re-triggering */
  reArmThreshold?: number;
}

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
  | "port_condition"
  | "delay"
  | "variable"
  | "debounce";

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
  | PortConditionNodeData
  | DelayNodeData
  | VariableNodeData
  | DebounceNodeData;

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
