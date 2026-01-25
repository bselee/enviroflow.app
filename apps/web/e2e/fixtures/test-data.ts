/**
 * Test Data Fixtures for E2E Tests
 *
 * Centralized test data to ensure consistency across all E2E tests.
 * Contains user credentials, controller data, room configurations, and more.
 */

export const TEST_USER = {
  email: 'e2e-test@enviroflow.test',
  password: 'TestPassword123!',
  name: 'E2E Test User',
}

export const TEST_USER_ALT = {
  email: 'e2e-test-alt@enviroflow.test',
  password: 'TestPassword456!',
  name: 'E2E Test User Alt',
}

// AC Infinity test credentials (mock)
export const AC_INFINITY_CREDENTIALS = {
  email: 'test@acinfinity.test',
  password: 'testpass123',
}

// Govee test credentials (mock)
export const GOVEE_CREDENTIALS = {
  email: 'test@govee.test',
  password: 'goveepass123',
}

// Inkbird test credentials (mock)
export const INKBIRD_CREDENTIALS = {
  email: 'test@inkbird.test',
  password: 'inkbirdpass123',
}

// Test room configurations
export const TEST_ROOMS = {
  growRoom: {
    name: 'E2E Grow Room',
    description: 'Test grow room for E2E tests',
    settings: {
      target_temp_min: 68,
      target_temp_max: 78,
      target_humidity_min: 45,
      target_humidity_max: 65,
      target_vpd_min: 0.8,
      target_vpd_max: 1.2,
    },
    latitude: 37.7749,
    longitude: -122.4194,
    timezone: 'America/Los_Angeles',
  },
  vegRoom: {
    name: 'E2E Veg Room',
    description: 'Vegetative growth test room',
    settings: {
      target_temp_min: 70,
      target_temp_max: 80,
      target_humidity_min: 50,
      target_humidity_max: 70,
      target_vpd_min: 0.8,
      target_vpd_max: 1.0,
    },
  },
  dryRoom: {
    name: 'E2E Dry Room',
    description: 'Drying room for harvest',
    settings: {
      target_temp_min: 60,
      target_temp_max: 70,
      target_humidity_min: 45,
      target_humidity_max: 55,
      target_vpd_min: 1.0,
      target_vpd_max: 1.5,
    },
  },
}

// Test controller configurations
export const TEST_CONTROLLERS = {
  acInfinity: {
    brand: 'ac_infinity',
    name: 'E2E AC Infinity Controller',
    credentials: AC_INFINITY_CREDENTIALS,
  },
  govee: {
    brand: 'govee',
    name: 'E2E Govee Sensor',
  },
  inkbird: {
    brand: 'inkbird',
    name: 'E2E Inkbird Thermostat',
    credentials: INKBIRD_CREDENTIALS,
  },
}

// Test schedule configurations
export const TEST_SCHEDULES = {
  basicLighting: {
    name: 'E2E Basic Light Schedule',
    description: 'Turn lights on at 8 AM and off at 8 PM',
    device_port: 1,
    trigger_type: 'time' as const,
    schedule: {
      days: [0, 1, 2, 3, 4, 5, 6], // All days
      start_time: '08:00',
      end_time: '20:00',
      action: 'on' as const,
    },
    is_active: true,
  },
  sunriseDimmer: {
    name: 'E2E Sunrise Dimmer',
    description: 'Gradual sunrise simulation',
    device_port: 1,
    trigger_type: 'sunrise' as const,
    schedule: {
      days: [0, 1, 2, 3, 4, 5, 6],
      start_time: '06:00',
      action: 'set_level' as const,
      level: 100,
      offset_minutes: 30,
    },
    is_active: true,
  },
}

// Test workflow configurations
export const TEST_WORKFLOWS = {
  basicTempControl: {
    name: 'E2E Basic Temperature Control',
    description: 'Turn on fan when temp exceeds threshold',
    is_active: true,
    dry_run_enabled: false,
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: {
          label: 'Temperature Sensor',
          sensorType: 'temperature',
        },
      },
      {
        id: 'condition-1',
        type: 'condition',
        position: { x: 300, y: 100 },
        data: {
          label: 'Temp > 78°F',
          operator: '>',
          value: 78,
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 500, y: 100 },
        data: {
          label: 'Turn On Fan',
          actionType: 'device_control',
          devicePort: 1,
          command: 'on',
        },
      },
    ],
    edges: [
      {
        id: 'e1-2',
        source: 'trigger-1',
        target: 'condition-1',
      },
      {
        id: 'e2-3',
        source: 'condition-1',
        target: 'action-1',
        sourceHandle: 'true',
      },
    ],
  },
}

// Test sensor reading data
export const TEST_SENSOR_READINGS = {
  temperature: {
    sensor_type: 'temperature',
    value: 72.5,
    unit: '°F',
    port: 1,
  },
  humidity: {
    sensor_type: 'humidity',
    value: 55.0,
    unit: '%',
    port: 1,
  },
  vpd: {
    sensor_type: 'vpd',
    value: 0.95,
    unit: 'kPa',
    port: null,
  },
}

// CSV export test data
export const CSV_EXPORT_HEADERS = [
  'timestamp',
  'controller_name',
  'sensor_type',
  'value',
  'unit',
  'port',
]

// Expected CSV structure for validation
export const EXPECTED_CSV_STRUCTURE = {
  minRows: 1, // At least header
  requiredColumns: CSV_EXPORT_HEADERS,
  dateFormat: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
}

// Activity log test data
export const TEST_ACTIVITY_LOGS = {
  deviceControl: {
    action_type: 'device_controlled',
    result: 'success',
  },
  workflowExecution: {
    action_type: 'workflow_executed',
    result: 'success',
  },
  controllerAdded: {
    action_type: 'controller_added',
    result: 'success',
  },
}

// Bulk operation test data
export const BULK_CONTROLLERS = [
  {
    brand: 'ac_infinity',
    name: 'E2E Bulk Controller 1',
    credentials: AC_INFINITY_CREDENTIALS,
  },
  {
    brand: 'ac_infinity',
    name: 'E2E Bulk Controller 2',
    credentials: AC_INFINITY_CREDENTIALS,
  },
  {
    brand: 'inkbird',
    name: 'E2E Bulk Controller 3',
    credentials: INKBIRD_CREDENTIALS,
  },
]

// Timeouts and waits (in milliseconds)
export const TIMEOUTS = {
  short: 2000,
  medium: 5000,
  long: 10000,
  veryLong: 30000,
}

// Selectors (data-testid attributes)
export const SELECTORS = {
  // Auth
  emailInput: '[name="email"]',
  passwordInput: '[name="password"]',
  submitButton: 'button[type="submit"]',
  logoutButton: '[data-testid="logout"]',

  // Controllers
  addControllerButton: '[data-testid="add-controller"]',
  controllerCard: '[data-testid="controller-card"]',
  brandCard: '[data-testid^="brand-"]',
  connectionSuccess: '[data-testid="connection-success"]',
  connectionError: '[data-testid="connection-error"]',

  // Rooms
  roomSelect: '[data-testid="room-select"]',
  createRoomButton: '[data-testid="create-room"]',
  roomCard: '[data-testid="room-card"]',

  // Devices
  deviceControlButton: '[data-testid^="device-control-"]',
  deviceStatusIndicator: '[data-testid^="device-status-"]',

  // Schedules
  createScheduleButton: '[data-testid="create-schedule"]',
  scheduleCard: '[data-testid="schedule-card"]',
  scheduleActive: '[data-testid="schedule-active"]',

  // Activity Log
  activityLogItem: '[data-testid="activity-log-item"]',
  activityLogFilter: '[data-testid="activity-log-filter"]',

  // Export
  exportButton: '[data-testid="export-data"]',
  exportFormatSelect: '[data-testid="export-format"]',

  // Dashboard
  dashboardCard: '[data-testid="dashboard-card"]',
  sensorReading: '[data-testid^="sensor-reading-"]',

  // Common
  saveButton: '[data-testid="save"]',
  cancelButton: '[data-testid="cancel"]',
  deleteButton: '[data-testid="delete"]',
  confirmButton: '[data-testid="confirm"]',
  loadingSpinner: '[data-testid="loading"]',
  errorMessage: '[data-testid="error-message"]',
  successMessage: '[data-testid="success-message"]',
}

// Helper function to generate unique test IDs
export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

// Helper function to wait for API response
export function getApiWaitTime(endpoint: string): number {
  if (endpoint.includes('/discover')) return TIMEOUTS.veryLong
  if (endpoint.includes('/controllers')) return TIMEOUTS.long
  if (endpoint.includes('/sensors')) return TIMEOUTS.medium
  return TIMEOUTS.short
}
