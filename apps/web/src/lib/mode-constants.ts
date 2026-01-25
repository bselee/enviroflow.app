/**
 * Mode Programming System Constants
 *
 * Defines metadata, ranges, and default values for all device modes.
 */

import type { DeviceMode, ModeInfo } from '@/types/modes'

// Mode metadata with UI information
export const MODE_INFO: Record<DeviceMode, ModeInfo> = {
  off: {
    id: 'off',
    name: 'Off',
    description: 'Device disabled',
    icon: 'PowerOff',
    color: 'gray',
    supportedDeviceTypes: ['*'],
  },
  on: {
    id: 'on',
    name: 'On',
    description: 'Continuous operation at fixed level',
    icon: 'Power',
    color: 'green',
    supportedDeviceTypes: ['*'],
  },
  auto: {
    id: 'auto',
    name: 'Auto',
    description: 'Temperature/humidity triggered automation',
    icon: 'Thermometer',
    color: 'blue',
    supportedDeviceTypes: ['fan', 'heater', 'cooler', 'humidifier', 'dehumidifier'],
  },
  vpd: {
    id: 'vpd',
    name: 'VPD',
    description: 'Vapor pressure deficit triggered automation',
    icon: 'Leaf',
    color: 'purple',
    supportedDeviceTypes: ['fan', 'humidifier', 'dehumidifier'],
  },
  timer: {
    id: 'timer',
    name: 'Timer',
    description: 'Countdown timer for one-time on/off',
    icon: 'Timer',
    color: 'orange',
    supportedDeviceTypes: ['*'],
  },
  cycle: {
    id: 'cycle',
    name: 'Cycle',
    description: 'Repeating on/off cycles',
    icon: 'RefreshCw',
    color: 'cyan',
    supportedDeviceTypes: ['*'],
  },
  schedule: {
    id: 'schedule',
    name: 'Schedule',
    description: 'Daily time-based schedules',
    icon: 'Calendar',
    color: 'yellow',
    supportedDeviceTypes: ['*'],
  },
}

// VPD ranges for different growth stages
export const VPD_RANGES = {
  seedling: { min: 0.4, max: 0.8, label: 'Seedling/Clone' },
  vegetative: { min: 0.8, max: 1.2, label: 'Vegetative' },
  flowering: { min: 1.0, max: 1.5, label: 'Flowering' },
  lateFlowering: { min: 1.2, max: 1.6, label: 'Late Flowering' },
} as const

// Temperature ranges (Fahrenheit)
export const TEMP_RANGES = {
  min: 32,
  max: 120,
  idealMin: 68,
  idealMax: 82,
} as const

// Humidity ranges (percent)
export const HUMIDITY_RANGES = {
  min: 0,
  max: 100,
  idealMin: 40,
  idealMax: 60,
} as const

// Device level ranges
export const LEVEL_RANGES = {
  min: 0,
  max: 10,
} as const

// Transition speed ranges
export const TRANSITION_SPEED_RANGES = {
  min: 1,
  max: 10,
  default: 5,
} as const

// Buffer value ranges
export const BUFFER_RANGES = {
  temp: { min: 0, max: 10, default: 2 }, // degrees F
  humidity: { min: 0, max: 20, default: 5 }, // percent
  vpd: { min: 0, max: 0.5, default: 0.1 }, // kPa
} as const

// Timer duration ranges
export const TIMER_RANGES = {
  min: 60, // 1 minute
  max: 86400, // 24 hours
  default: 3600, // 1 hour
} as const

// Cycle duration ranges
export const CYCLE_RANGES = {
  min: 30, // 30 seconds
  max: 86400, // 24 hours
  defaultOn: 900, // 15 minutes
  defaultOff: 900, // 15 minutes
} as const

// Days of week
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
] as const

// Device behavior types for AUTO mode
export const DEVICE_BEHAVIORS = [
  { value: 'cooling', label: 'Cooling', description: 'Activate when temp is too high' },
  { value: 'heating', label: 'Heating', description: 'Activate when temp is too low' },
  { value: 'humidify', label: 'Humidify', description: 'Activate when humidity is too low' },
  { value: 'dehumidify', label: 'Dehumidify', description: 'Activate when humidity is too high' },
] as const

// Recommended settings by device type
export const RECOMMENDED_SETTINGS = {
  fan: {
    auto: {
      deviceBehavior: 'cooling',
      transitionEnabled: true,
      transitionSpeed: 5,
      bufferEnabled: true,
      bufferValue: 2,
    },
    vpd: {
      transitionEnabled: true,
      transitionSpeed: 5,
      bufferEnabled: true,
      bufferValue: 0.1,
    },
  },
  heater: {
    auto: {
      deviceBehavior: 'heating',
      transitionEnabled: true,
      transitionSpeed: 3,
      bufferEnabled: true,
      bufferValue: 2,
    },
  },
  cooler: {
    auto: {
      deviceBehavior: 'cooling',
      transitionEnabled: true,
      transitionSpeed: 3,
      bufferEnabled: true,
      bufferValue: 2,
    },
  },
  humidifier: {
    auto: {
      deviceBehavior: 'humidify',
      transitionEnabled: true,
      transitionSpeed: 5,
      bufferEnabled: true,
      bufferValue: 5,
    },
    vpd: {
      transitionEnabled: true,
      transitionSpeed: 5,
      bufferEnabled: true,
      bufferValue: 0.1,
    },
  },
  dehumidifier: {
    auto: {
      deviceBehavior: 'dehumidify',
      transitionEnabled: true,
      transitionSpeed: 5,
      bufferEnabled: true,
      bufferValue: 5,
    },
    vpd: {
      transitionEnabled: true,
      transitionSpeed: 5,
      bufferEnabled: true,
      bufferValue: 0.1,
    },
  },
  light: {
    schedule: {
      // Lights commonly use schedules
    },
  },
} as const
