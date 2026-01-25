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
  | "ecowitt"
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
  | "ec"
  | "pressure"
  | "soil_moisture"
  | "wind_speed"
  | "pm25"
  | "water_level"
  | "uv"
  | "solar_radiation"
  | "rain";

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
  | "dehumidifier"
  | "pump"
  | "valve";

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
 * Controller status enum matching database CHECK constraint
 */
export type ControllerStatus = 'online' | 'offline' | 'error' | 'initializing';

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
  status: ControllerStatus;
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
  /** Pre-discovered device info (skips connection test, uses device metadata) */
  discoveredDevice?: DiscoveredDevice;
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
  status?: ControllerStatus;
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
  trigger_state: 'ARMED' | 'FIRED' | 'RESET';
  last_executed: string | null;
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
  port: number | null;
  sensor_type: SensorType;
  value: number;
  unit: string;
  is_stale: boolean;
  recorded_at: string;
  // Computed field for backwards compatibility
  timestamp?: string;
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
  /** Time range in hours (default: 24) - deprecated, use dateRange instead */
  timeRangeHours?: number;
  /** Date range for filtering readings (takes precedence over timeRangeHours) */
  dateRange?: DateRangeValue;
}

// =============================================================================
// Export Types
// =============================================================================

/**
 * Supported export formats for sensor data
 */
export type ExportFormat = "csv" | "json" | "pdf";

/**
 * Metadata for sensor data exports
 */
export interface ExportMetadata {
  controllerName: string;
  controllerId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  exportedAt: Date;
  totalReadings: number;
  sensorTypes: SensorType[];
}

/**
 * Summary statistics for a sensor type
 */
export interface SummaryStats {
  sensorType: SensorType;
  count: number;
  min: number;
  max: number;
  avg: number;
  latest: number;
  unit: string;
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
  | "controller_updated"
  | "controller_deleted"
  | "credential_update_attempt"
  | "credential_update_success"
  | "device_controlled"
  | "sensor_reading"
  | "alert_triggered"
  | "schedule_executed"
  | "user_login"
  | "user_logout"
  | "settings_changed";

/**
 * Activity log entity from database
 * Schema: apps/automation-engine/supabase/migrations/20260121_complete_schema.sql
 * Note: Database uses 'created_at' and 'details', but this interface provides
 * backwards compatibility aliases 'timestamp' and 'action_data'
 */
export interface ActivityLog {
  id: string;
  user_id: string;
  workflow_id: string | null;
  room_id: string | null;
  controller_id: string | null;
  action_type: string;
  /** JSONB field for error context and metadata (stored as 'details' in DB) */
  details?: Record<string, unknown>;
  /** Legacy alias for details (backwards compatibility) */
  action_data?: Record<string, unknown>;
  result: ActivityLogResult | null;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  /** Primary timestamp field (stored as 'created_at' in DB) */
  created_at?: string;
  /** Legacy alias for created_at (backwards compatibility) */
  timestamp?: string;
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
 * Note: Database uses temp_min/temp_max, not target_temp_min/target_temp_max
 */
export interface GrowthStage {
  id: string;
  name: string;
  description: string | null;
  stage_order: number;
  duration_days: number | null;
  /** Temperature minimum (database column: temp_min) */
  temp_min: number | null;
  /** Temperature maximum (database column: temp_max) */
  temp_max: number | null;
  /** Humidity minimum (database column: humidity_min) */
  humidity_min: number | null;
  /** Humidity maximum (database column: humidity_max) */
  humidity_max: number | null;
  /** VPD minimum (database column: vpd_min) */
  vpd_min: number | null;
  /** VPD maximum (database column: vpd_max) */
  vpd_max: number | null;
  light_hours: number;
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
 * Note: Database column is 'insight_text', TypeScript provides 'insight' alias for convenience
 */
export interface AiInsight {
  id: string;
  user_id: string;
  room_id: string | null;
  query: string;
  /** The AI-generated insight text (database column: insight_text) */
  insight_text: string;
  /** @deprecated Use insight_text instead - kept for backwards compatibility */
  insight?: string;
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
  workflow_id: string | null;
  controller_id: string;
  room_id: string | null;
  port: number;
  schedule_type: DimmerScheduleType;
  sunrise_time: string | null;
  sunset_time: string | null;
  min_level: number;
  max_level: number;
  duration_minutes: number;
  curve: DimmerCurveType;
  is_active: boolean;
  last_run: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Device Schedule Types
// =============================================================================

/**
 * Device schedule trigger type
 */
export type DeviceScheduleTrigger = 'time' | 'sunrise' | 'sunset' | 'cron';

/**
 * Device schedule action type
 */
export type DeviceScheduleAction = 'on' | 'off' | 'set_level';

/**
 * Device schedule configuration (stored as JSONB)
 */
export interface DeviceScheduleConfig {
  /** Days of week (0=Sunday, 6=Saturday) */
  days?: number[];
  /** Start time in HH:MM format */
  start_time?: string;
  /** End time in HH:MM format (optional) */
  end_time?: string;
  /** Action to perform */
  action?: DeviceScheduleAction;
  /** Intensity level for dimming (0-100) */
  level?: number;
  /** Cron expression if trigger_type is 'cron' */
  cron?: string;
  /** Offset from sunrise/sunset in minutes */
  offset_minutes?: number;
  /** Duration for dimming transitions */
  duration_minutes?: number;
  /** Start intensity for dimming */
  start_intensity?: number;
  /** Target intensity for dimming */
  target_intensity?: number;
  /** Dimming curve type */
  curve?: DimmerCurveType;
}

/**
 * Device schedule entity from database
 */
export interface DeviceSchedule {
  id: string;
  user_id: string;
  controller_id: string;
  room_id: string | null;
  name: string;
  description: string | null;
  device_port: number;
  trigger_type: DeviceScheduleTrigger;
  schedule: DeviceScheduleConfig;
  is_active: boolean;
  last_executed: string | null;
  next_execution: string | null;
  execution_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a device schedule
 */
export interface CreateDeviceScheduleInput {
  controller_id: string;
  room_id?: string | null;
  name: string;
  description?: string;
  device_port: number;
  trigger_type: DeviceScheduleTrigger;
  schedule: DeviceScheduleConfig;
  is_active?: boolean;
}

/**
 * Input for updating a device schedule
 */
export interface UpdateDeviceScheduleInput {
  name?: string;
  description?: string | null;
  device_port?: number;
  trigger_type?: DeviceScheduleTrigger;
  schedule?: DeviceScheduleConfig;
  is_active?: boolean;
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
 * Date range preset options for sensor analytics
 */
export type DateRangePreset = "today" | "7d" | "30d" | "90d" | "ytd" | "custom";

/**
 * Date range with optional preset identifier for sensor data filtering
 */
export interface DateRangeValue {
  from: Date;
  to: Date;
  preset?: DateRangePreset;
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
// Onboarding Types
// =============================================================================

/**
 * Onboarding step definition
 */
export interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  targetElement?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
}

/**
 * Onboarding state stored in localStorage
 */
export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  skippedSteps: string[];
  completedAt?: string;
  version: string;
}

/**
 * Analytics event for onboarding tracking
 */
export interface OnboardingAnalytics {
  stepId: string;
  action: "view" | "skip" | "complete" | "cta_click";
  timestamp: string;
  timeSpentSeconds?: number;
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

// =============================================================================
// Network Discovery Types
// =============================================================================

/**
 * A device discovered through cloud API or network scanning.
 */
export interface DiscoveredDevice {
  /** Unique device identifier from the cloud API */
  deviceId: string;
  /** Device code/serial number (if available) */
  deviceCode?: string;
  /** Human-readable device name */
  name: string;
  /** Controller brand */
  brand: ControllerBrand;
  /** Device model (e.g., "Controller 69", "ITC-308") */
  model?: string;
  /** Device type code (brand-specific) */
  deviceType?: number;
  /** Is device currently online */
  isOnline: boolean;
  /** Last online timestamp (ISO string) */
  lastSeen?: string;
  /** Firmware version (if available) */
  firmwareVersion?: string;
  /** IP address (for local network devices, if discoverable) */
  ipAddress?: string;
  /** MAC address (if available) */
  macAddress?: string;
  /** Whether this device is already registered in EnviroFlow */
  isAlreadyRegistered: boolean;
  /** Device capabilities summary */
  capabilities?: {
    sensors?: string[];
    devices?: string[];
    supportsDimming?: boolean;
  };
}

/**
 * Result of a discovery operation from the API.
 */
export interface DiscoveryResponse {
  /** Whether the discovery was successful */
  success: boolean;
  /** List of discovered devices */
  devices: DiscoveredDevice[];
  /** Total number of devices found */
  totalDevices: number;
  /** Number of devices already registered */
  alreadyRegisteredCount: number;
  /** Error message if discovery failed */
  error?: string;
  /** Additional error details */
  details?: string;
  /** Discovery source */
  source: string;
  /** Timestamp of the discovery (ISO string) */
  timestamp: string;
}

/**
 * Credentials required for cloud-based discovery.
 */
export interface DiscoveryCredentials {
  brand: ControllerBrand;
  email: string;
  password: string;
}

/**
 * Discovery state for UI components.
 */
export interface DiscoveryState {
  /** Whether a discovery is in progress */
  isScanning: boolean;
  /** Discovered devices */
  devices: DiscoveredDevice[];
  /** Error message if any */
  error: string | null;
  /** Last successful scan timestamp */
  lastScanAt: Date | null;
}

// =============================================================================
// Diagnostics Types
// =============================================================================

/**
 * Comprehensive diagnostic metrics for controller connection quality
 */
export interface DiagnosticMetrics {
  /** Response time in milliseconds */
  responseTime: number;
  /** Packet loss percentage (0-100) */
  packetLoss: number;
  /** Sync lag in seconds since last sync */
  syncLag: number;
  /** API call success rate percentage (0-100) */
  successRate: number;
  /** ISO timestamp of when diagnostics were run */
  lastChecked: string;
  /** Additional diagnostic details */
  details?: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
  };
}

/**
 * Status color based on metric thresholds
 */
export type MetricStatus = 'green' | 'yellow' | 'red';

/**
 * Historical diagnostic data point for trend charts
 */
export interface DiagnosticHistoryPoint {
  timestamp: string;
  responseTime: number;
  packetLoss: number;
  syncLag: number;
  successRate: number;
}

/**
 * Result of running a diagnostic test
 */
export interface DiagnosticTestResult {
  success: boolean;
  metrics: DiagnosticMetrics;
  error?: string;
}

// =============================================================================
// Alert Types
// =============================================================================

/**
 * Alert type for connection issues
 */
export type AlertType = 'offline' | 'failed_commands' | 'low_health';

/**
 * Alert status for lifecycle management
 */
export type AlertStatus = 'active' | 'acknowledged' | 'snoozed' | 'resolved';

/**
 * Alert entity from database
 */
export interface Alert {
  id: string;
  user_id: string;
  controller_id: string;
  alert_type: AlertType;
  message: string;
  status: AlertStatus;
  snoozed_until: string | null;
  metadata: AlertMetadata;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

/**
 * Metadata stored with alerts for context
 */
export interface AlertMetadata {
  health_score?: number;
  failed_command_count?: number;
  offline_duration_minutes?: number;
  last_seen?: string;
  [key: string]: unknown;
}

/**
 * Alert with controller details (for joined queries)
 */
export interface AlertWithController extends Alert {
  controller?: {
    id: string;
    name: string;
    brand: ControllerBrand;
    status: ControllerStatus;
  } | null;
}

/**
 * Options for snoozing alerts
 */
export type SnoozeDuration = 12 | 24 | 48;

/**
 * Input for creating a new alert
 */
export interface CreateAlertInput {
  controller_id: string;
  alert_type: AlertType;
  message: string;
  metadata?: AlertMetadata;
}

/**
 * Input for updating an alert
 */
export interface UpdateAlertInput {
  status?: AlertStatus;
  snoozed_until?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
}

/**
 * Alert statistics for dashboard
 */
export interface AlertStats {
  total: number;
  active: number;
  snoozed: number;
  acknowledged: number;
  resolved: number;
  byType: {
    offline: number;
    failed_commands: number;
    low_health: number;
  };
}

// =============================================================================
// Device Schedule Extended Types
// =============================================================================

// Type aliases for backward compatibility (canonical definitions are above)
export type ScheduleTriggerType = DeviceScheduleTrigger;
export type ScheduleAction = DeviceScheduleAction;
export type ScheduleConfig = DeviceScheduleConfig;

/**
 * Device schedule with controller details (for joined queries)
 */
export interface DeviceScheduleWithController extends DeviceSchedule {
  controller?: {
    id: string;
    name: string;
    brand: ControllerBrand;
    status: ControllerStatus;
    capabilities: ControllerCapabilities;
  } | null;
}

/**
 * Preview information for upcoming schedule execution
 */
export interface SchedulePreview {
  nextExecution: string | null;
  upcomingExecutions: string[];
  conflictingSchedules?: DeviceSchedule[];
}

// =============================================================================
// Controller Health Types
// =============================================================================

/**
 * Health metrics used for score calculation
 */
export interface HealthMetrics {
  uptimePercent: number;
  freshnessScore: number;
  errorRate: number;
  syncLagScore: number;
  uptimeHours: number;
  totalHours: number;
  latestReadingAge: number | null;
  errorCount: number;
  totalActions: number;
  avgSyncLag: number | null;
}

/**
 * Controller health score result
 */
export interface HealthScore {
  score: number;
  metrics: HealthMetrics;
  calculatedAt: Date | string;
}

/**
 * Health score with controller context
 */
export interface HealthScoreWithController extends HealthScore {
  controllerId: string;
  controllerName: string;
}

/**
 * Controller health entity from database
 */
export interface ControllerHealth {
  id: string;
  controller_id: string;
  score: number;
  metrics_snapshot: HealthMetrics;
  calculated_at: string;
  created_at: string;
}

/**
 * Health level classification
 */
export type HealthLevel = "healthy" | "warning" | "critical";

/**
 * Health indicator display properties
 */
export interface HealthIndicator {
  emoji: string;
  level: HealthLevel;
  color: string;
  bgColor: string;
}

/**
 * Health alert triggered by score drop
 */
export interface HealthAlert {
  controllerId: string;
  controllerName: string;
  userId: string;
  currentScore: number;
  previousScore: number;
  dropAmount: number;
}

/**
 * Controller with latest health score (for joined queries)
 */
export interface ControllerWithHealth extends Controller {
  health?: HealthScore | null;
}

