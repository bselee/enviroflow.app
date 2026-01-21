/**
 * EnviroFlow Shared TypeScript Types
 *
 * These types represent the database schema and API response structures.
 * They are designed to be consistent with the Supabase schema defined in
 * apps/automation-engine/supabase/migrations/20260120_complete_schema.sql
 *
 * IMPORTANT: All application types should be defined here. Do not create
 * separate type files to avoid duplication and conflicts.
 */

// =============================================================================
// Base Types
// =============================================================================

/**
 * Standard API response pattern for async operations
 * All service layer functions should return this structure
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

// =============================================================================
// Controller Types
// =============================================================================

/**
 * Supported controller brands
 */
export type ControllerBrand =
  | "ac_infinity"
  | "inkbird"
  | "govee"
  | "csv_upload"
  | "mqtt"
  | "custom";

/**
 * Controller status for availability in the brand list
 */
export type BrandStatus = "available" | "coming_soon";

/**
 * Sensor types supported by controllers
 */
export type SensorType =
  | "temperature"
  | "humidity"
  | "vpd"
  | "co2"
  | "light"
  | "ph"
  | "ec";

/**
 * Device types that can be controlled
 */
export type DeviceType =
  | "fan"
  | "light"
  | "outlet"
  | "heater"
  | "cooler"
  | "humidifier"
  | "dehumidifier";

/**
 * Controller capabilities structure
 */
export interface ControllerCapabilities {
  sensors?: SensorType[];
  devices?: DeviceType[];
  supportsDimming?: boolean;
  supportsScheduling?: boolean;
}

/**
 * Credential field configuration for brand-specific forms
 */
export interface CredentialField {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  required: boolean;
  placeholder?: string;
}

/**
 * Brand information returned by the brands API
 */
export interface Brand {
  id: ControllerBrand;
  name: string;
  description: string;
  logo?: string;
  requiresCredentials: boolean;
  credentialFields: CredentialField[];
  capabilities: ControllerCapabilities;
  marketShare?: number;
  status: BrandStatus;
  note?: string;
  helpUrl?: string;
  templateUrl?: string;
}

/**
 * Controller entity from database
 */
export interface Controller {
  id: string;
  user_id: string;
  brand: ControllerBrand;
  controller_id: string;
  name: string;
  credentials?: Record<string, unknown>;
  capabilities: ControllerCapabilities;
  is_online: boolean;
  last_seen: string | null;
  last_error: string | null;
  firmware_version: string | null;
  model: string | null;
  room_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Controller with optional room details (for joined queries)
 */
export interface ControllerWithRoom extends Controller {
  room?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Input for creating/adding a new controller
 */
export interface AddControllerInput {
  brand: ControllerBrand;
  name: string;
  credentials?: {
    email?: string;
    password?: string;
    [key: string]: unknown;
  };
  room_id?: string | null;
}

/**
 * Alias for AddControllerInput for backwards compatibility
 */
export type CreateControllerInput = AddControllerInput;

/**
 * Input for updating an existing controller
 */
export interface UpdateControllerInput {
  name?: string;
  room_id?: string | null;
  is_online?: boolean;
  credentials?: {
    email?: string;
    password?: string;
    [key: string]: unknown;
  };
}

/**
 * API response wrapper for controller operations
 */
export interface ControllerApiResponse<T = Controller> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Response from GET /api/controllers
 */
export interface ControllersListResponse {
  controllers: Controller[];
  count: number;
}

/**
 * Response from GET /api/controllers/brands
 */
export interface BrandsListResponse {
  brands: Brand[];
  totalBrands: number;
  availableCount: number;
  comingSoonCount: number;
}

// =============================================================================
// Room Types
// =============================================================================

/**
 * Room settings structure
 */
export interface RoomSettings {
  target_temp_min?: number;
  target_temp_max?: number;
  target_humidity_min?: number;
  target_humidity_max?: number;
  target_vpd_min?: number;
  target_vpd_max?: number;
}

/**
 * Room entity from database
 */
export interface Room {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  settings: RoomSettings;
  current_stage: string | null;
  stage_started_at: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

/**
 * Simplified room type for dropdown selections and lists.
 * Contains only the essential fields for identification.
 */
export interface RoomBasic {
  id: string;
  name: string;
  description?: string | null;
}

/**
 * Room with controllers populated via join
 */
export interface RoomWithControllers extends Room {
  controllers?: Controller[];
}

/**
 * Room with related data counts
 */
export interface RoomWithCounts extends Room {
  controller_count?: number;
  workflow_count?: number;
}

/**
 * Input for creating a new room
 */
export interface CreateRoomInput {
  name: string;
  description?: string;
  settings?: RoomSettings;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

/**
 * Input for updating an existing room
 */
export interface UpdateRoomInput {
  name?: string;
  description?: string | null;
  settings?: RoomSettings;
  current_stage?: string | null;
  stage_started_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string;
}

// =============================================================================
// Workflow Types
// =============================================================================

/**
 * React Flow node structure
 */
export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

/**
 * React Flow edge structure
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  label?: string;
}

/**
 * Workflow entity from database
 */
export interface Workflow {
  id: string;
  user_id: string;
  room_id: string | null;
  name: string;
  description: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_active: boolean;
  last_run: string | null;
  last_error: string | null;
  run_count: number;
  dry_run_enabled: boolean;
  growth_stage: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Workflow with optional room details (for joined queries)
 * Room is a simplified object with just id and name from the join
 */
export interface WorkflowWithRoom extends Workflow {
  room?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Input for creating a new workflow
 */
export interface CreateWorkflowInput {
  name: string;
  description?: string;
  room_id?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  is_active?: boolean;
  dry_run_enabled?: boolean;
  growth_stage?: string;
}

/**
 * Input for updating an existing workflow
 */
export interface UpdateWorkflowInput {
  name?: string;
  description?: string | null;
  room_id?: string | null;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  is_active?: boolean;
  dry_run_enabled?: boolean;
  growth_stage?: string | null;
}

// =============================================================================
// Sensor Reading Types
// =============================================================================

/**
 * Sensor reading entity from database
 */
export interface SensorReading {
  id: string;
  controller_id: string;
  user_id: string;
  port: number | null;
  sensor_type: SensorType;
  value: number;
  unit: string;
  is_stale: boolean;
  timestamp: string;
}

/**
 * Aggregated sensor data for a controller
 */
export interface ControllerSensorData {
  controller_id: string;
  readings: SensorReading[];
  latest_reading_at: string | null;
}

/**
 * Aggregated sensor data for a controller or room.
 * Provides the latest readings for each sensor type.
 */
export interface AggregatedSensorData {
  temperature: { value: number; unit: string; timestamp: string } | null;
  humidity: { value: number; unit: string; timestamp: string } | null;
  vpd: { value: number; unit: string; timestamp: string } | null;
  co2: { value: number; unit: string; timestamp: string } | null;
  light: { value: number; unit: string; timestamp: string } | null;
  ph: { value: number; unit: string; timestamp: string } | null;
  ec: { value: number; unit: string; timestamp: string } | null;
}

/**
 * Time series data point for charting.
 */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

/**
 * Options for fetching sensor readings.
 */
export interface SensorReadingsOptions {
  /** Controller IDs to fetch readings for */
  controllerIds?: string[];
  /** Sensor types to filter by */
  sensorTypes?: SensorType[];
  /** Maximum number of readings to fetch per controller */
  limit?: number;
  /** Time range in hours (default: 24) */
  timeRangeHours?: number;
}

// =============================================================================
// Activity Log Types
// =============================================================================

/**
 * Activity log result status
 */
export type ActivityLogResult = "success" | "failed" | "skipped" | "dry_run";

/**
 * Activity log action types
 */
export type ActivityActionType =
  | "workflow_executed"
  | "workflow_created"
  | "workflow_updated"
  | "workflow_deleted"
  | "controller_added"
  | "controller_removed"
  | "device_controlled"
  | "sensor_reading"
  | "alert_triggered"
  | "schedule_executed"
  | "user_login"
  | "user_logout"
  | "settings_changed";

/**
 * Activity log entity from database
 */
export interface ActivityLog {
  id: string;
  user_id: string;
  workflow_id: string | null;
  room_id: string | null;
  controller_id: string | null;
  action_type: string;
  action_data: Record<string, unknown>;
  result: ActivityLogResult | null;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
  /** Workflow name from join */
  workflow?: { name: string } | null;
  /** Room name from join */
  room?: { name: string } | null;
  /** Controller name from join */
  controller?: { name: string } | null;
}

/**
 * Activity log with related entity names
 */
export interface ActivityLogWithDetails extends ActivityLog {
  workflow_name?: string | null;
  room_name?: string | null;
  controller_name?: string | null;
}

/**
 * Formatted activity log for display.
 * Transforms raw database data into UI-friendly format.
 */
export interface FormattedActivityLog {
  id: string;
  timestamp: string;
  relativeTime: string;
  type: "info" | "warning" | "success" | "error";
  message: string;
  workflowName: string | null;
  roomName: string | null;
  controllerName: string | null;
  actionType: string;
  result: string | null;
  errorMessage: string | null;
}

/**
 * Filter options for activity logs
 */
export interface ActivityLogFilter {
  workflow_id?: string;
  room_id?: string;
  controller_id?: string;
  action_type?: string | string[];
  result?: ActivityLogResult | ActivityLogResult[];
  start_date?: string;
  end_date?: string;
}

/**
 * Options for fetching activity logs.
 */
export interface ActivityLogsOptions {
  /** Filter by room ID */
  roomId?: string;
  /** Filter by workflow ID */
  workflowId?: string;
  /** Filter by result type */
  result?: ActivityLogResult;
  /** Maximum number of logs to fetch */
  limit?: number;
  /** Time range in hours (default: 24) */
  timeRangeHours?: number;
}

// =============================================================================
// Growth Stage Types
// =============================================================================

/**
 * Growth stage entity from database
 */
export interface GrowthStage {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  stage_order: number;
  duration_days: number | null;
  target_temp_min: number | null;
  target_temp_max: number | null;
  target_humidity_min: number | null;
  target_humidity_max: number | null;
  target_vpd_min: number | null;
  target_vpd_max: number | null;
  light_hours: number;
  workflow_id: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// AI Insights Types
// =============================================================================

/**
 * AI insight recommendation structure
 */
export interface AiRecommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  action_type?: string;
}

/**
 * AI insight entity from database
 */
export interface AiInsight {
  id: string;
  user_id: string;
  room_id: string | null;
  query: string;
  insight: string;
  recommendations: AiRecommendation[];
  data_type: string | null;
  confidence: number | null;
  sensor_data: Record<string, unknown> | null;
  model_used: string;
  created_at: string;
}

// =============================================================================
// Dimmer Schedule Types
// =============================================================================

/**
 * Dimmer schedule type
 */
export type DimmerScheduleType = "sunrise" | "sunset" | "custom" | "dli_curve";

/**
 * Dimmer curve type for gradual transitions
 */
export type DimmerCurveType = "linear" | "sigmoid" | "exponential" | "logarithmic";

/**
 * Dimmer schedule entity from database
 */
export interface DimmerSchedule {
  id: string;
  user_id: string;
  controller_id: string;
  room_id: string | null;
  port: number;
  schedule_type: DimmerScheduleType;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  start_intensity: number;
  target_intensity: number;
  curve: DimmerCurveType;
  is_active: boolean;
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Realtime Event Types
// =============================================================================

/**
 * Supabase Realtime event types
 */
export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

/**
 * Generic Realtime payload structure
 */
export interface RealtimePayload<T> {
  eventType: RealtimeEventType;
  new: T | null;
  old: Partial<T> | null;
  schema: string;
  table: string;
  commit_timestamp: string;
}

// =============================================================================
// Analytics Types
// =============================================================================

/**
 * Date range filter for analytics queries
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Sensor trend data point for time-series charts
 */
export interface SensorTrendPoint {
  date: string;
  temp: number | null;
  humidity: number | null;
  vpd: number | null;
}

/**
 * Workflow execution statistics
 */
export interface WorkflowStat {
  id: string;
  name: string;
  executions: number;
  successRate: number;
  lastRun: string | null;
}

/**
 * Success/failure breakdown for pie charts
 */
export interface ExecutionBreakdown {
  status: "success" | "failed" | "skipped" | "dry_run";
  count: number;
  percentage: number;
}

/**
 * Per-room environmental compliance data
 */
export interface RoomCompliance {
  roomId: string;
  roomName: string;
  compliance: number;
  tempCompliance: number;
  humidityCompliance: number;
  vpdCompliance: number;
}

/**
 * Complete analytics data structure
 */
export interface AnalyticsData {
  /** Average workflows executed per day in the selected period */
  executionRate: number;
  /** Percentage of time sensors were within target ranges */
  targetCompliance: number;
  /** Estimated manual hours saved by automation */
  automationValue: number;
  /** Percentage of controllers currently online */
  uptime: number;
  /** Sensor data trends over time */
  sensorTrends: SensorTrendPoint[];
  /** Per-workflow execution statistics */
  workflowStats: WorkflowStat[];
  /** Execution result breakdown (success/failed/etc.) */
  executionBreakdown: ExecutionBreakdown[];
  /** Per-room environmental compliance */
  roomCompliance: RoomCompliance[];
  /** Total executions in the period */
  totalExecutions: number;
  /** Today's executions count */
  todayExecutions: number;
  /** Active workflow count */
  activeWorkflows: number;
}

/**
 * Hook options for customizing analytics queries
 */
export interface UseAnalyticsOptions {
  /** Date range for filtering data (defaults to last 7 days) */
  dateRange?: DateRange;
  /** Filter by specific room ID */
  roomId?: string;
  /** Filter by specific controller ID */
  controllerId?: string;
  /** User ID for fetching data (required for server-side) */
  userId?: string;
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
}

// =============================================================================
// Hook State Types
// =============================================================================

/**
 * Base hook state for data fetching hooks
 */
export interface UseQueryState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/**
 * Extended hook state with mutation loading states
 */
export interface UseMutationState {
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}
