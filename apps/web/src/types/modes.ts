/**
 * Mode Programming System Types
 *
 * Defines types for device mode configurations across all supported modes:
 * - OFF: Device disabled
 * - ON: Continuous operation at fixed level
 * - AUTO: Temperature/humidity triggered automation
 * - VPD: Vapor pressure deficit triggered automation
 * - TIMER: Countdown timer with on/off behavior
 * - CYCLE: Repeating on/off cycles
 * - SCHEDULE: Daily time-based schedules
 */

// Device modes
export type DeviceMode = 'off' | 'on' | 'auto' | 'vpd' | 'timer' | 'cycle' | 'schedule'

// Mode metadata
export interface ModeInfo {
  id: DeviceMode
  name: string
  description: string
  icon: string // lucide icon name
  color: string // tailwind color
  supportedDeviceTypes: string[]
}

// Base configuration shared by all modes
export interface BaseModeConfig {
  mode: DeviceMode
  maxLevel: number // 0-10
  minLevel: number // 0-10
}

// ON mode - continuous operation at fixed level
export interface OnModeConfig extends BaseModeConfig {
  mode: 'on'
  level: number // 0-10
}

// AUTO mode - temperature/humidity triggered
export interface AutoModeConfig extends BaseModeConfig {
  mode: 'auto'
  tempTriggerHigh?: number
  tempTriggerLow?: number
  humidityTriggerHigh?: number
  humidityTriggerLow?: number
  deviceBehavior: 'cooling' | 'heating' | 'humidify' | 'dehumidify'
  transitionEnabled: boolean
  transitionSpeed: number // 1-10
  bufferEnabled: boolean
  bufferValue: number // degrees/percent
}

// VPD mode - vapor pressure deficit triggered
export interface VpdModeConfig extends BaseModeConfig {
  mode: 'vpd'
  vpdTriggerHigh: number // kPa
  vpdTriggerLow: number // kPa
  leafTempOffset: number // degrees
  transitionEnabled: boolean
  transitionSpeed: number
  bufferEnabled: boolean
  bufferValue: number
}

// TIMER mode - countdown timer
export interface TimerModeConfig extends BaseModeConfig {
  mode: 'timer'
  timerType: 'on' | 'off'
  timerDuration: number // seconds
  timerStartedAt?: string // ISO timestamp
}

// CYCLE mode - repeating on/off cycles
export interface CycleModeConfig extends BaseModeConfig {
  mode: 'cycle'
  cycleOnDuration: number // seconds
  cycleOffDuration: number // seconds
}

// SCHEDULE mode - daily time-based schedules
export interface ScheduleModeConfig extends BaseModeConfig {
  mode: 'schedule'
  schedules: ScheduleSlot[]
}

export interface ScheduleSlot {
  id: string
  startTime: string // HH:MM
  endTime: string // HH:MM
  days: number[] // 0-6, 0=Sunday
  level: number // 0-10
  enabled: boolean
}

// Union type for all mode configurations
export type ModeConfiguration =
  | { mode: 'off' }
  | OnModeConfig
  | AutoModeConfig
  | VpdModeConfig
  | TimerModeConfig
  | CycleModeConfig
  | ScheduleModeConfig

// Port mode state - runtime state for a device port
export interface PortModeState {
  port: number
  portName: string
  deviceType: string
  config: ModeConfiguration
  isOnline: boolean
  currentLevel: number
  lastUpdated: string
}

// Type guards for discriminating mode configurations
export function isOnModeConfig(config: ModeConfiguration): config is OnModeConfig {
  return config.mode === 'on'
}

export function isAutoModeConfig(config: ModeConfiguration): config is AutoModeConfig {
  return config.mode === 'auto'
}

export function isVpdModeConfig(config: ModeConfiguration): config is VpdModeConfig {
  return config.mode === 'vpd'
}

export function isTimerModeConfig(config: ModeConfiguration): config is TimerModeConfig {
  return config.mode === 'timer'
}

export function isCycleModeConfig(config: ModeConfiguration): config is CycleModeConfig {
  return config.mode === 'cycle'
}

export function isScheduleModeConfig(config: ModeConfiguration): config is ScheduleModeConfig {
  return config.mode === 'schedule'
}
