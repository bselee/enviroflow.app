/**
 * Hooks Index
 *
 * Re-exports all custom hooks for convenient importing.
 * Types should be imported directly from @/types.
 *
 * @example
 * ```tsx
 * import {
 *   useRooms,
 *   useControllers,
 *   useWorkflows,
 *   useSensorReadings,
 *   useActivityLogs
 * } from "@/hooks";
 *
 * // Import types from @/types
 * import type { Room, Controller, Workflow } from "@/types";
 * ```
 */

// Room management hook
export { useRooms } from "./use-rooms";

// Controller management hook
export { useControllers } from "./use-controllers";

// Workflow management hook
export { useWorkflows } from "./use-workflows";

// Sensor readings hook
export { useSensorReadings, useRoomSensorReadings } from "./use-sensor-readings";

// Activity logs hook
export { useActivityLogs } from "./use-activity-logs";

// Analytics hook
export { useAnalytics } from "./use-analytics";

// Toast notifications
export { useToast, toast } from "./use-toast";

// Re-export commonly used types from @/types for backwards compatibility
// Prefer importing directly from @/types for new code
export type {
  // Room types
  Room,
  RoomWithControllers,
  RoomSettings,
  CreateRoomInput,
  UpdateRoomInput,
  // Controller types
  Controller,
  ControllerWithRoom,
  ControllerBrand,
  ControllerCapabilities,
  AddControllerInput,
  UpdateControllerInput,
  Brand,
  // Workflow types
  Workflow,
  WorkflowWithRoom,
  WorkflowNode,
  WorkflowEdge,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  // Sensor types
  SensorReading,
  SensorType,
  AggregatedSensorData,
  TimeSeriesPoint,
  SensorReadingsOptions,
  // Activity log types
  ActivityLog,
  ActivityLogResult,
  FormattedActivityLog,
  ActivityLogsOptions,
  // Analytics types
  AnalyticsData,
  DateRange,
  // Common types
  ApiResponse,
} from "@/types";
