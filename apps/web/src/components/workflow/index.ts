/**
 * Workflow Builder Components
 *
 * This module exports all components related to the visual workflow builder.
 * Use these components to create, edit, and display automation workflows.
 */

// Main builder component
export { WorkflowBuilder } from "./WorkflowBuilder";

// Properties panel
export { NodePropertiesPanel } from "./NodePropertiesPanel";

// Node components
export { TriggerNode } from "./nodes/TriggerNode";
export { SensorNode } from "./nodes/SensorNode";
export { ConditionNode } from "./nodes/ConditionNode";
export { ActionNode } from "./nodes/ActionNode";
export { DimmerNode } from "./nodes/DimmerNode";
export { NotificationNode } from "./nodes/NotificationNode";
export { ModeNode } from "./nodes/ModeNode";

// Palette component
export { NodePalette } from "./NodePalette";

// Properties panel (from PropertiesPanel.tsx)
export { PropertiesPanel } from "./PropertiesPanel";

// Type exports
export type {
  // Trigger types
  TriggerType,
  TriggerConfig,
  ScheduleTriggerConfig,
  SensorThresholdTriggerConfig,
  ManualTriggerConfig,
  TriggerNodeData,
  // Sensor types
  SensorType,
  ComparisonOperator,
  SensorNodeConfig,
  SensorNodeData,
  // Condition types
  LogicType,
  ConditionNodeConfig,
  ConditionNodeData,
  // Action types
  DeviceType,
  ActionVariant,
  ActionNodeConfig,
  DeviceState,
  ActionNodeData,
  // Dimmer types
  DimmerCurve,
  DimmerNodeConfig,
  DimmerNodeData,
  // Notification types
  NotificationPriority,
  NotificationChannel,
  NotificationNodeConfig,
  NotificationNodeData,
  // Mode programming types
  ModeNodeData,
  ModeNodeConfig,
  DeviceModeType,
  AutoModeConfig,
  VpdModeConfig,
  TimerModeConfig,
  CycleModeConfig,
  ScheduleModeConfig,
  // Workflow types
  WorkflowNodeType,
  WorkflowNodeData,
  WorkflowNode,
  WorkflowEdge,
  WorkflowDefinition,
  // UI state types
  NodePropertiesPanelState,
  WorkflowBuilderState,
} from "./types";

// Constants
export {
  SENSOR_TYPE_LABELS,
  SENSOR_TYPE_UNITS,
  OPERATOR_LABELS,
  DEVICE_TYPE_LABELS,
  ACTION_VARIANT_LABELS,
  DIMMER_CURVE_LABELS,
  NOTIFICATION_PRIORITY_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  MESSAGE_VARIABLES,
  MODE_LABELS,
} from "./types";
