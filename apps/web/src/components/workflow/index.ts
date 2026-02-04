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
export { DelayNode } from "./nodes/DelayNode";
export { VariableNode } from "./nodes/VariableNode";
export { DebounceNode } from "./nodes/DebounceNode";
export { VerifiedActionNode } from "./nodes/VerifiedActionNode";
export { PortConditionNode } from "./nodes/PortConditionNode";

// Palette component
export { NodePalette } from "./NodePalette";

// Properties panel (from PropertiesPanel.tsx)
export { PropertiesPanel } from "./PropertiesPanel";

// Conflict resolution
export { ConflictResolutionModal } from "./ConflictResolutionModal";

// Delete confirmation
export { DeleteWorkflowDialog } from "./DeleteWorkflowDialog";

// Manual trigger
export { ManualTriggerButton } from "./ManualTriggerButton";

// Rate limit indicator
export { RateLimitIndicator } from "./RateLimitIndicator";

// Dry run preview
export { DryRunPreview } from "./DryRunPreview";

// Save as template
export { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";

// Hysteresis visualization
export { HysteresisViz } from "./HysteresisViz";

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
  // Delay types
  DelayTimeUnit,
  DelayNodeConfig,
  DelayNodeData,
  // Variable types
  VariableScope,
  VariableOperation,
  VariableValueType,
  VariableNodeConfig,
  VariableNodeData,
  // Debounce types
  DebounceNodeConfig,
  DebounceNodeData,
  // Verified action types
  VerifiedActionNodeData,
  VerifiedActionNodeConfig,
  // Port condition types
  PortConditionNodeData,
  PortConditionNodeConfig,
  PortConditionOperator,
  // Hysteresis types
  SensorThresholdTriggerConfigWithHysteresis,
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
  DELAY_TIME_UNIT_LABELS,
  VARIABLE_SCOPE_LABELS,
  VARIABLE_OPERATION_LABELS,
  VARIABLE_VALUE_TYPE_LABELS,
} from "./types";
