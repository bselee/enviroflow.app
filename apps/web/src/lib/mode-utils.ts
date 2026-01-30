/**
 * Mode Programming System Utilities
 *
 * Utility functions for working with device modes, configurations,
 * and related calculations (VPD, time parsing, validation, etc.)
 */

import { calculateLeafVPD } from './vpd-utils'
import type {
  DeviceMode,
  ModeConfiguration,
  ModeInfo,
  OnModeConfig,
  AutoModeConfig,
  VpdModeConfig,
  TimerModeConfig,
  CycleModeConfig,
  ScheduleModeConfig,
  ScheduleSlot,
} from '@/types/modes'
import {
  MODE_INFO,
  TEMP_RANGES,
  HUMIDITY_RANGES,
  LEVEL_RANGES,
  VPD_RANGES,
  TRANSITION_SPEED_RANGES,
  BUFFER_RANGES,
  TIMER_RANGES,
  CYCLE_RANGES,
  RECOMMENDED_SETTINGS,
} from './mode-constants'

/**
 * Get mode metadata
 */
export function getModeInfo(mode: DeviceMode): ModeInfo {
  return MODE_INFO[mode]
}

/**
 * Get default configuration for a mode
 */
export function getDefaultModeConfig(mode: DeviceMode): ModeConfiguration {
  const baseConfig = {
    maxLevel: LEVEL_RANGES.max,
    minLevel: 0,
  }

  switch (mode) {
    case 'off':
      return { mode: 'off' }

    case 'on':
      return {
        ...baseConfig,
        mode: 'on',
        level: 5,
      } as OnModeConfig

    case 'auto':
      return {
        ...baseConfig,
        mode: 'auto',
        tempTriggerHigh: 80,
        tempTriggerLow: 70,
        humidityTriggerHigh: 65,
        humidityTriggerLow: 45,
        deviceBehavior: 'cooling',
        transitionEnabled: true,
        transitionSpeed: TRANSITION_SPEED_RANGES.default,
        bufferEnabled: true,
        bufferValue: BUFFER_RANGES.temp.default,
      } as AutoModeConfig

    case 'vpd':
      return {
        ...baseConfig,
        mode: 'vpd',
        vpdTriggerHigh: 1.2,
        vpdTriggerLow: 0.8,
        leafTempOffset: -2,
        transitionEnabled: true,
        transitionSpeed: TRANSITION_SPEED_RANGES.default,
        bufferEnabled: true,
        bufferValue: BUFFER_RANGES.vpd.default,
      } as VpdModeConfig

    case 'timer':
      return {
        ...baseConfig,
        mode: 'timer',
        timerType: 'on',
        timerDuration: TIMER_RANGES.default,
      } as TimerModeConfig

    case 'cycle':
      return {
        ...baseConfig,
        mode: 'cycle',
        cycleOnDuration: CYCLE_RANGES.defaultOn,
        cycleOffDuration: CYCLE_RANGES.defaultOff,
      } as CycleModeConfig

    case 'schedule':
      return {
        ...baseConfig,
        mode: 'schedule',
        schedules: [],
      } as ScheduleModeConfig

    default:
      return { mode: 'off' }
  }
}

/**
 * Validate mode configuration
 */
export function validateModeConfig(config: ModeConfiguration): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config || !config.mode) {
    errors.push('Mode is required')
    return { valid: false, errors }
  }

  // OFF mode has no additional validation
  if (config.mode === 'off') {
    return { valid: true, errors: [] }
  }

  // Validate base config fields
  if ('maxLevel' in config) {
    if (config.maxLevel < LEVEL_RANGES.min || config.maxLevel > LEVEL_RANGES.max) {
      errors.push(`Max level must be between ${LEVEL_RANGES.min} and ${LEVEL_RANGES.max}`)
    }
  }

  if ('minLevel' in config) {
    if (config.minLevel < LEVEL_RANGES.min || config.minLevel > LEVEL_RANGES.max) {
      errors.push(`Min level must be between ${LEVEL_RANGES.min} and ${LEVEL_RANGES.max}`)
    }
  }

  if ('minLevel' in config && 'maxLevel' in config) {
    if (config.minLevel > config.maxLevel) {
      errors.push('Min level cannot be greater than max level')
    }
  }

  // Mode-specific validation
  switch (config.mode) {
    case 'on': {
      const onConfig = config as OnModeConfig
      if (onConfig.level < LEVEL_RANGES.min || onConfig.level > LEVEL_RANGES.max) {
        errors.push(`Level must be between ${LEVEL_RANGES.min} and ${LEVEL_RANGES.max}`)
      }
      break
    }

    case 'auto': {
      const autoConfig = config as AutoModeConfig

      // Temperature validation
      if (autoConfig.tempTriggerHigh !== undefined) {
        if (autoConfig.tempTriggerHigh < TEMP_RANGES.min || autoConfig.tempTriggerHigh > TEMP_RANGES.max) {
          errors.push(`High temp trigger must be between ${TEMP_RANGES.min}°F and ${TEMP_RANGES.max}°F`)
        }
      }

      if (autoConfig.tempTriggerLow !== undefined) {
        if (autoConfig.tempTriggerLow < TEMP_RANGES.min || autoConfig.tempTriggerLow > TEMP_RANGES.max) {
          errors.push(`Low temp trigger must be between ${TEMP_RANGES.min}°F and ${TEMP_RANGES.max}°F`)
        }
      }

      if (autoConfig.tempTriggerLow !== undefined && autoConfig.tempTriggerHigh !== undefined) {
        if (autoConfig.tempTriggerLow >= autoConfig.tempTriggerHigh) {
          errors.push('Low temp trigger must be less than high temp trigger')
        }
      }

      // Humidity validation
      if (autoConfig.humidityTriggerHigh !== undefined) {
        if (autoConfig.humidityTriggerHigh < HUMIDITY_RANGES.min || autoConfig.humidityTriggerHigh > HUMIDITY_RANGES.max) {
          errors.push(`High humidity trigger must be between ${HUMIDITY_RANGES.min}% and ${HUMIDITY_RANGES.max}%`)
        }
      }

      if (autoConfig.humidityTriggerLow !== undefined) {
        if (autoConfig.humidityTriggerLow < HUMIDITY_RANGES.min || autoConfig.humidityTriggerLow > HUMIDITY_RANGES.max) {
          errors.push(`Low humidity trigger must be between ${HUMIDITY_RANGES.min}% and ${HUMIDITY_RANGES.max}%`)
        }
      }

      if (autoConfig.humidityTriggerLow !== undefined && autoConfig.humidityTriggerHigh !== undefined) {
        if (autoConfig.humidityTriggerLow >= autoConfig.humidityTriggerHigh) {
          errors.push('Low humidity trigger must be less than high humidity trigger')
        }
      }

      // Device behavior validation
      if (!['cooling', 'heating', 'humidify', 'dehumidify'].includes(autoConfig.deviceBehavior)) {
        errors.push('Invalid device behavior')
      }

      // Transition validation
      if (autoConfig.transitionSpeed < TRANSITION_SPEED_RANGES.min || autoConfig.transitionSpeed > TRANSITION_SPEED_RANGES.max) {
        errors.push(`Transition speed must be between ${TRANSITION_SPEED_RANGES.min} and ${TRANSITION_SPEED_RANGES.max}`)
      }

      // Buffer validation
      if (autoConfig.bufferEnabled) {
        const maxBuffer = autoConfig.deviceBehavior.includes('humid')
          ? BUFFER_RANGES.humidity.max
          : BUFFER_RANGES.temp.max
        if (autoConfig.bufferValue < 0 || autoConfig.bufferValue > maxBuffer) {
          errors.push(`Buffer value must be between 0 and ${maxBuffer}`)
        }
      }
      break
    }

    case 'vpd': {
      const vpdConfig = config as VpdModeConfig

      if (vpdConfig.vpdTriggerLow < 0 || vpdConfig.vpdTriggerLow > 3) {
        errors.push('Low VPD trigger must be between 0 and 3 kPa')
      }

      if (vpdConfig.vpdTriggerHigh < 0 || vpdConfig.vpdTriggerHigh > 3) {
        errors.push('High VPD trigger must be between 0 and 3 kPa')
      }

      if (vpdConfig.vpdTriggerLow >= vpdConfig.vpdTriggerHigh) {
        errors.push('Low VPD trigger must be less than high VPD trigger')
      }

      if (vpdConfig.leafTempOffset < -10 || vpdConfig.leafTempOffset > 10) {
        errors.push('Leaf temp offset must be between -10°F and 10°F')
      }

      if (vpdConfig.transitionSpeed < TRANSITION_SPEED_RANGES.min || vpdConfig.transitionSpeed > TRANSITION_SPEED_RANGES.max) {
        errors.push(`Transition speed must be between ${TRANSITION_SPEED_RANGES.min} and ${TRANSITION_SPEED_RANGES.max}`)
      }

      if (vpdConfig.bufferEnabled) {
        if (vpdConfig.bufferValue < 0 || vpdConfig.bufferValue > BUFFER_RANGES.vpd.max) {
          errors.push(`Buffer value must be between 0 and ${BUFFER_RANGES.vpd.max} kPa`)
        }
      }
      break
    }

    case 'timer': {
      const timerConfig = config as TimerModeConfig

      if (!['on', 'off'].includes(timerConfig.timerType)) {
        errors.push('Timer type must be "on" or "off"')
      }

      if (timerConfig.timerDuration < TIMER_RANGES.min || timerConfig.timerDuration > TIMER_RANGES.max) {
        errors.push(`Timer duration must be between ${TIMER_RANGES.min} and ${TIMER_RANGES.max} seconds`)
      }
      break
    }

    case 'cycle': {
      const cycleConfig = config as CycleModeConfig

      if (cycleConfig.cycleOnDuration < CYCLE_RANGES.min || cycleConfig.cycleOnDuration > CYCLE_RANGES.max) {
        errors.push(`Cycle on duration must be between ${CYCLE_RANGES.min} and ${CYCLE_RANGES.max} seconds`)
      }

      if (cycleConfig.cycleOffDuration < CYCLE_RANGES.min || cycleConfig.cycleOffDuration > CYCLE_RANGES.max) {
        errors.push(`Cycle off duration must be between ${CYCLE_RANGES.min} and ${CYCLE_RANGES.max} seconds`)
      }
      break
    }

    case 'schedule': {
      const scheduleConfig = config as ScheduleModeConfig

      if (!Array.isArray(scheduleConfig.schedules)) {
        errors.push('Schedules must be an array')
        break
      }

      scheduleConfig.schedules.forEach((slot, index) => {
        if (!slot.id) {
          errors.push(`Schedule ${index + 1}: ID is required`)
        }

        if (!isValidTimeString(slot.startTime)) {
          errors.push(`Schedule ${index + 1}: Invalid start time format (use HH:MM)`)
        }

        if (!isValidTimeString(slot.endTime)) {
          errors.push(`Schedule ${index + 1}: Invalid end time format (use HH:MM)`)
        }

        if (!Array.isArray(slot.days) || slot.days.length === 0) {
          errors.push(`Schedule ${index + 1}: At least one day must be selected`)
        }

        if (slot.days.some(day => day < 0 || day > 6)) {
          errors.push(`Schedule ${index + 1}: Days must be between 0 (Sunday) and 6 (Saturday)`)
        }

        if (slot.level < LEVEL_RANGES.min || slot.level > LEVEL_RANGES.max) {
          errors.push(`Schedule ${index + 1}: Level must be between ${LEVEL_RANGES.min} and ${LEVEL_RANGES.max}`)
        }
      })
      break
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Convert mode configuration to API format
 */
export function toApiFormat(config: ModeConfiguration): Record<string, unknown> {
  // Convert camelCase to snake_case and flatten structure
  const apiConfig: Record<string, unknown> = {
    mode: config.mode,
  }

  if (config.mode === 'off') {
    return apiConfig
  }

  // Base fields
  if ('maxLevel' in config) {
    apiConfig.max_level = config.maxLevel
  }
  if ('minLevel' in config) {
    apiConfig.min_level = config.minLevel
  }

  // Mode-specific fields
  switch (config.mode) {
    case 'on':
      apiConfig.level = (config as OnModeConfig).level
      break

    case 'auto': {
      const autoConfig = config as AutoModeConfig
      apiConfig.temp_trigger_high = autoConfig.tempTriggerHigh
      apiConfig.temp_trigger_low = autoConfig.tempTriggerLow
      apiConfig.humidity_trigger_high = autoConfig.humidityTriggerHigh
      apiConfig.humidity_trigger_low = autoConfig.humidityTriggerLow
      apiConfig.device_behavior = autoConfig.deviceBehavior
      apiConfig.transition_enabled = autoConfig.transitionEnabled
      apiConfig.transition_speed = autoConfig.transitionSpeed
      apiConfig.buffer_enabled = autoConfig.bufferEnabled
      apiConfig.buffer_value = autoConfig.bufferValue
      break
    }

    case 'vpd': {
      const vpdConfig = config as VpdModeConfig
      apiConfig.vpd_trigger_high = vpdConfig.vpdTriggerHigh
      apiConfig.vpd_trigger_low = vpdConfig.vpdTriggerLow
      apiConfig.leaf_temp_offset = vpdConfig.leafTempOffset
      apiConfig.transition_enabled = vpdConfig.transitionEnabled
      apiConfig.transition_speed = vpdConfig.transitionSpeed
      apiConfig.buffer_enabled = vpdConfig.bufferEnabled
      apiConfig.buffer_value = vpdConfig.bufferValue
      break
    }

    case 'timer': {
      const timerConfig = config as TimerModeConfig
      apiConfig.timer_type = timerConfig.timerType
      apiConfig.timer_duration = timerConfig.timerDuration
      if (timerConfig.timerStartedAt) {
        apiConfig.timer_started_at = timerConfig.timerStartedAt
      }
      break
    }

    case 'cycle': {
      const cycleConfig = config as CycleModeConfig
      apiConfig.cycle_on_duration = cycleConfig.cycleOnDuration
      apiConfig.cycle_off_duration = cycleConfig.cycleOffDuration
      break
    }

    case 'schedule': {
      const scheduleConfig = config as ScheduleModeConfig
      apiConfig.schedules = scheduleConfig.schedules.map(slot => ({
        id: slot.id,
        start_time: slot.startTime,
        end_time: slot.endTime,
        days: slot.days,
        level: slot.level,
        enabled: slot.enabled,
      }))
      break
    }
  }

  return apiConfig
}

/**
 * Convert API format to mode configuration
 */
export function fromApiFormat(apiConfig: Record<string, unknown>): ModeConfiguration {
  const mode = apiConfig.mode as DeviceMode

  if (mode === 'off') {
    return { mode: 'off' }
  }

  // Base fields
  const baseConfig = {
    maxLevel: (apiConfig.max_level as number) ?? LEVEL_RANGES.max,
    minLevel: (apiConfig.min_level as number) ?? 0,
  }

  switch (mode) {
    case 'on':
      return {
        ...baseConfig,
        mode: 'on',
        level: (apiConfig.level as number) ?? 5,
      } as OnModeConfig

    case 'auto':
      return {
        ...baseConfig,
        mode: 'auto',
        tempTriggerHigh: apiConfig.temp_trigger_high as number | undefined,
        tempTriggerLow: apiConfig.temp_trigger_low as number | undefined,
        humidityTriggerHigh: apiConfig.humidity_trigger_high as number | undefined,
        humidityTriggerLow: apiConfig.humidity_trigger_low as number | undefined,
        deviceBehavior: (apiConfig.device_behavior as 'cooling' | 'heating' | 'humidify' | 'dehumidify') ?? 'cooling',
        transitionEnabled: (apiConfig.transition_enabled as boolean) ?? true,
        transitionSpeed: (apiConfig.transition_speed as number) ?? TRANSITION_SPEED_RANGES.default,
        bufferEnabled: (apiConfig.buffer_enabled as boolean) ?? true,
        bufferValue: (apiConfig.buffer_value as number) ?? BUFFER_RANGES.temp.default,
      } as AutoModeConfig

    case 'vpd':
      return {
        ...baseConfig,
        mode: 'vpd',
        vpdTriggerHigh: (apiConfig.vpd_trigger_high as number) ?? 1.2,
        vpdTriggerLow: (apiConfig.vpd_trigger_low as number) ?? 0.8,
        leafTempOffset: (apiConfig.leaf_temp_offset as number) ?? -2,
        transitionEnabled: (apiConfig.transition_enabled as boolean) ?? true,
        transitionSpeed: (apiConfig.transition_speed as number) ?? TRANSITION_SPEED_RANGES.default,
        bufferEnabled: (apiConfig.buffer_enabled as boolean) ?? true,
        bufferValue: (apiConfig.buffer_value as number) ?? BUFFER_RANGES.vpd.default,
      } as VpdModeConfig

    case 'timer':
      return {
        ...baseConfig,
        mode: 'timer',
        timerType: (apiConfig.timer_type as 'on' | 'off') ?? 'on',
        timerDuration: (apiConfig.timer_duration as number) ?? TIMER_RANGES.default,
        timerStartedAt: apiConfig.timer_started_at as string | undefined,
      } as TimerModeConfig

    case 'cycle':
      return {
        ...baseConfig,
        mode: 'cycle',
        cycleOnDuration: (apiConfig.cycle_on_duration as number) ?? CYCLE_RANGES.defaultOn,
        cycleOffDuration: (apiConfig.cycle_off_duration as number) ?? CYCLE_RANGES.defaultOff,
      } as CycleModeConfig

    case 'schedule': {
      const schedules = (apiConfig.schedules as Array<Record<string, unknown>>) ?? []
      return {
        ...baseConfig,
        mode: 'schedule',
        schedules: schedules.map(slot => ({
          id: slot.id as string,
          startTime: slot.start_time as string,
          endTime: slot.end_time as string,
          days: slot.days as number[],
          level: slot.level as number,
          enabled: slot.enabled as boolean,
        })),
      } as ScheduleModeConfig
    }

    default:
      return { mode: 'off' }
  }
}

/**
 * Calculate VPD from temperature and humidity
 *
 * @param tempF Temperature in Fahrenheit
 * @param humidity Relative humidity (0-100)
 * @param leafTempOffset Leaf temperature offset in Fahrenheit (default: -2, leaves are cooler)
 * @returns VPD in kPa
 */
export function calculateVpd(tempF: number, humidity: number, leafTempOffset: number = -2): number {
  // Note: leafTempOffset is negative because leaves are cooler than air
  // calculateLeafVPD expects a positive offset value (it subtracts internally)
  const offset = Math.abs(leafTempOffset)
  const vpd = calculateLeafVPD(tempF, humidity, offset)
  return vpd ?? 0 // Default to 0 if calculation fails
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  } else {
    const hours = Math.floor(seconds / 3600)
    const remainingMinutes = Math.floor((seconds % 3600) / 60)
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return -1
  }
  return hours * 60 + minutes
}

/**
 * Validate time string format (HH:MM)
 */
export function isValidTimeString(time: string): boolean {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)
}

/**
 * Check if device type supports a mode
 */
export function isModeSupported(mode: DeviceMode, deviceType: string): boolean {
  const modeInfo = MODE_INFO[mode]
  if (!modeInfo) return false

  // Wildcard means all device types supported
  if (modeInfo.supportedDeviceTypes.includes('*')) return true

  // Normalize device type (lowercase, remove spaces)
  const normalizedType = deviceType.toLowerCase().replace(/\s+/g, '')

  return modeInfo.supportedDeviceTypes.some(
    supportedType => normalizedType.includes(supportedType.toLowerCase())
  )
}

/**
 * Get recommended settings based on device type and mode
 */
export function getRecommendedSettings(
  deviceType: string,
  mode: DeviceMode
): Partial<ModeConfiguration> {
  const normalizedType = deviceType.toLowerCase().replace(/\s+/g, '')

  // Find matching device type in recommended settings
  for (const [type, settings] of Object.entries(RECOMMENDED_SETTINGS)) {
    if (normalizedType.includes(type)) {
      const modeSettings = settings[mode as keyof typeof settings]
      if (modeSettings) {
        return modeSettings as Partial<ModeConfiguration>
      }
    }
  }

  return {}
}

/**
 * Get VPD range for a growth stage
 */
export function getVpdRange(stage: keyof typeof VPD_RANGES) {
  return VPD_RANGES[stage]
}

/**
 * Determine growth stage from VPD value
 */
export function getGrowthStageFromVpd(vpd: number): string {
  if (vpd >= VPD_RANGES.lateFlowering.min) return 'Late Flowering'
  if (vpd >= VPD_RANGES.flowering.min) return 'Flowering'
  if (vpd >= VPD_RANGES.vegetative.min) return 'Vegetative'
  return 'Seedling/Clone'
}
