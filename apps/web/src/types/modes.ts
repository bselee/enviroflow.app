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

// ============================================
// Advance Automations (AC Infinity)
// Time-windowed mode overrides
// ============================================

/**
 * Advance Automation - Time-windowed mode override
 *
 * This is different from SCHEDULE mode. Advance Automations allow:
 * - Named automation programs (e.g., "Veg Phase", "Flower Phase")
 * - Time windows during which a specific mode runs
 * - The mode can be OFF, ON, AUTO, or CYCLE with full config
 *
 * Example: "9:00am - 5:00pm · AUTO · H 75°F / L 54°F · H 54% / L 39%"
 */
export interface AdvanceAutomation {
  /** Unique ID for this automation */
  id: string
  /** User-defined name (e.g., "Veg Auto", "Lights Out") */
  name: string
  /** Whether this automation is active */
  enabled: boolean
  /** Port number this automation applies to */
  port: number
  /** Start time in HH:MM format (24h) */
  startTime: string
  /** End time in HH:MM format (24h) */
  endTime: string
  /** Days of week (0=Sunday, 6=Saturday) - empty means everyday */
  days: number[]
  /** Mode to run during this time window */
  mode: DeviceMode
  /** Full mode configuration */
  modeConfig: ModeConfiguration
  /** Created timestamp */
  createdAt: string
  /** Last updated timestamp */
  updatedAt: string
}

/**
 * Advance Automations list for a device
 */
export interface DeviceAutomations {
  port: number
  portName: string
  automations: AdvanceAutomation[]
}

// ============================================
// Mode Summary Generation
// ============================================

/**
 * Generate a human-readable summary of a mode configuration
 * Format: "9:00am - 5:00pm · AUTO · H 75°F / L 54°F · H 54% / L 39%"
 */
export function generateModeSummary(
  config: ModeConfiguration,
  options?: {
    tempUnit?: 'F' | 'C'
    includeTime?: { startTime: string; endTime: string }
  }
): string {
  const parts: string[] = []
  const tempUnit = options?.tempUnit || 'F'

  // Add time window if provided
  if (options?.includeTime) {
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number)
      const period = hours >= 12 ? 'pm' : 'am'
      const h = hours % 12 || 12
      return `${h}:${minutes.toString().padStart(2, '0')}${period}`
    }
    parts.push(`${formatTime(options.includeTime.startTime)} - ${formatTime(options.includeTime.endTime)}`)
  }

  // Add mode name
  parts.push(config.mode.toUpperCase())

  // Add mode-specific details
  if (isAutoModeConfig(config)) {
    const triggers: string[] = []
    if (config.tempTriggerHigh !== undefined || config.tempTriggerLow !== undefined) {
      const high = config.tempTriggerHigh !== undefined ? `H ${config.tempTriggerHigh}°${tempUnit}` : ''
      const low = config.tempTriggerLow !== undefined ? `L ${config.tempTriggerLow}°${tempUnit}` : ''
      triggers.push([high, low].filter(Boolean).join(' / '))
    }
    if (config.humidityTriggerHigh !== undefined || config.humidityTriggerLow !== undefined) {
      const high = config.humidityTriggerHigh !== undefined ? `H ${config.humidityTriggerHigh}%` : ''
      const low = config.humidityTriggerLow !== undefined ? `L ${config.humidityTriggerLow}%` : ''
      triggers.push([high, low].filter(Boolean).join(' / '))
    }
    if (triggers.length > 0) {
      parts.push(...triggers)
    }
  } else if (isVpdModeConfig(config)) {
    const triggers: string[] = []
    if (config.vpdTriggerHigh !== undefined || config.vpdTriggerLow !== undefined) {
      const high = config.vpdTriggerHigh !== undefined ? `H ${config.vpdTriggerHigh}kPa` : ''
      const low = config.vpdTriggerLow !== undefined ? `L ${config.vpdTriggerLow}kPa` : ''
      triggers.push([high, low].filter(Boolean).join(' / '))
    }
    if (triggers.length > 0) {
      parts.push(...triggers)
    }
  } else if (isOnModeConfig(config)) {
    parts.push(`Level ${config.level}`)
  } else if (isTimerModeConfig(config)) {
    const duration = formatDuration(config.timerDuration)
    parts.push(`${config.timerType === 'on' ? 'To ON' : 'To OFF'} · ${duration}`)
  } else if (isCycleModeConfig(config)) {
    const onDur = formatDuration(config.cycleOnDuration)
    const offDur = formatDuration(config.cycleOffDuration)
    parts.push(`ON ${onDur} / OFF ${offDur}`)
  } else if (isScheduleModeConfig(config)) {
    if (config.schedules.length > 0) {
      const active = config.schedules.filter(s => s.enabled)
      if (active.length > 0) {
        const slot = active[0]
        const formatTime = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number)
          const period = hours >= 12 ? 'pm' : 'am'
          const h = hours % 12 || 12
          return `${h}:${minutes.toString().padStart(2, '0')}${period}`
        }
        parts.push(`${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`)
        if (active.length > 1) {
          parts.push(`+${active.length - 1} more`)
        }
      }
    }
  }

  return parts.join(' · ')
}

/**
 * Format seconds duration to human readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Generate a short badge-style mode label
 */
export function getModeBadgeLabel(config: ModeConfiguration): string {
  switch (config.mode) {
    case 'off': return 'OFF'
    case 'on': return 'ON'
    case 'auto': return 'AUTO'
    case 'vpd': return 'VPD'
    case 'timer': return isTimerModeConfig(config) ? (config.timerType === 'on' ? 'TIMER→ON' : 'TIMER→OFF') : 'TIMER'
    case 'cycle': return 'CYCLE'
    case 'schedule': return 'SCHED'
    default: return 'UNKNOWN'
  }
}
