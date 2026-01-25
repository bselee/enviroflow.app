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

// Dashboard data hook (consolidated)
export {
  useDashboardData,
  calculateVPD,
} from "./use-dashboard-data";
export type {
  DashboardDataOptions,
  TrendData,
  LatestSensorData,
  RoomSummary,
  DashboardMetrics,
  EnvironmentSnapshotData,
  UseDashboardDataReturn,
} from "./use-dashboard-data";

// Toast notifications
export { useToast, toast } from "./use-toast";

// User preferences hook
export {
  useUserPreferences,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_ROOM_PREFERENCES,
  calculateVPDStatus,
  calculateTempStatus,
  calculateHumidityStatus,
  getStatusColorClass,
  getStatusBgClass,
} from "./use-user-preferences";
export type {
  UserPreferences,
  RoomPreferences,
  TemperatureUnit,
  ViewMode,
  AnimationQuality,
  PrimaryMetric,
  TimelineMetric,
  MetricTolerance,
  MetricStatus,
  UseUserPreferencesReturn,
} from "./use-user-preferences";

// Onboarding hook
export { useOnboarding } from "./use-onboarding";

// Animation tier (performance optimization)
export {
  useAnimationTier,
  useAnimationEnabled,
  usePulseEnabled,
  useComplexEasingEnabled,
  useAnimationTierContext,
  AnimationTierProvider,
} from "./use-animation-tier";
export type {
  AnimationTier,
  UseAnimationTierReturn,
  AnimationTierProviderProps,
} from "./use-animation-tier";

// Geolocation hook
export { useGeolocation } from "./use-geolocation";
export type {
  UseGeolocationReturn,
  Coordinates,
} from "./use-geolocation";

// Date range hook
export { useDateRange, useDateRangeAsHours } from "./use-date-range";
export type {
  UseDateRangeReturn,
  UseDateRangeOptions,
} from "./use-date-range";

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
  DateRangePreset,
  DateRangeValue,
  // Common types
  ApiResponse,
} from "@/types";
