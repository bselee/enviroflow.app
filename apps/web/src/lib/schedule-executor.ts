/**
 * Schedule Executor
 *
 * Core logic for executing time-based device schedules.
 * Handles:
 * - Time-based schedules (daily, weekly)
 * - Sunrise/sunset schedules with dimming curves
 * - Cron expression schedules
 * - Retry logic with exponential backoff
 * - Rate limiting per controller
 * - Dry-run mode simulation
 *
 * @module lib/schedule-executor
 */

import type { createClient } from '@supabase/supabase-js'
import { decryptCredentials } from '@/lib/server-encryption'
import {
  getAdapter,
  isBrandSupported,
  type ControllerBrand,
  type ControllerCredentials,
  type ACInfinityCredentials,
  type InkbirdCredentials,
  type CSVUploadCredentials,
  type DeviceCommand,
  type CommandType,
} from '@enviroflow/automation-engine/adapters'
import {
  calculateDimmingValue,
  calculateSunrise,
  calculateSunset,
} from '@/lib/dimming-curves'

// ============================================
// Types
// ============================================

interface DeviceSchedule {
  id: string
  user_id: string
  controller_id: string
  room_id: string | null
  name: string
  description: string | null
  device_port: number
  trigger_type: 'time' | 'sunrise' | 'sunset' | 'cron'
  schedule: {
    days?: number[]
    start_time?: string
    end_time?: string
    action?: 'on' | 'off' | 'set_level'
    level?: number
    cron?: string
    offset_minutes?: number
    // For sunrise/sunset dimming
    duration_minutes?: number
    start_intensity?: number
    target_intensity?: number
    curve?: 'linear' | 'sigmoid' | 'exponential' | 'logarithmic'
  }
  is_active: boolean
  last_executed: string | null
  next_execution: string | null
  execution_count: number
  created_at: string
  updated_at: string
}

interface DBController {
  id: string
  user_id: string
  brand: string
  controller_id: string
  name: string
  credentials: string | Record<string, unknown>
  status: 'online' | 'offline' | 'error' | 'initializing'
  room_id: string | null
}

interface DBRoom {
  id: string
  latitude: number | null
  longitude: number | null
  timezone: string
}

interface ExecutionResult {
  scheduleId: string
  scheduleName: string
  controllerId: string
  controllerName: string
  status: 'success' | 'failed' | 'skipped' | 'dry_run'
  action: string
  value?: number
  error?: string
  timestamp: string
}

// ============================================
// Rate Limiting
// ============================================

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_COMMANDS_PER_CONTROLLER = 10

/**
 * Check if a controller has exceeded rate limits.
 * Rate limit: 10 commands per controller per minute
 */
function checkRateLimit(controllerId: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(controllerId)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(controllerId, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= MAX_COMMANDS_PER_CONTROLLER) {
    return false
  }

  entry.count++
  return true
}

/**
 * Clean up old rate limit entries (call periodically)
 */
function cleanupRateLimits(): void {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, entry] of entries) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key)
    }
  }
}

// ============================================
// Credential Building
// ============================================

function buildAdapterCredentials(
  brand: ControllerBrand,
  rawCredentials: Record<string, unknown>
): ControllerCredentials {
  switch (brand) {
    case 'ac_infinity':
      return {
        type: 'ac_infinity',
        email: (rawCredentials.email as string) || '',
        password: (rawCredentials.password as string) || '',
      } satisfies ACInfinityCredentials

    case 'inkbird':
      return {
        type: 'inkbird',
        email: (rawCredentials.email as string) || '',
        password: (rawCredentials.password as string) || '',
      } satisfies InkbirdCredentials

    case 'csv_upload':
      return {
        type: 'csv_upload',
      } satisfies CSVUploadCredentials

    default:
      throw new Error(`Cannot build credentials for unsupported brand: ${brand}`)
  }
}

// ============================================
// Schedule Matching
// ============================================

/**
 * Check if a schedule should execute at the current time.
 * Returns true if the schedule matches the current time and hasn't
 * executed recently (within the last minute).
 */
export function shouldExecuteSchedule(
  schedule: DeviceSchedule,
  room: DBRoom | null,
  now: Date = new Date()
): boolean {
  if (!schedule.is_active) {
    return false
  }

  // Don't execute if already executed within the last minute
  if (schedule.last_executed) {
    const lastExec = new Date(schedule.last_executed)
    const timeSinceLastExec = now.getTime() - lastExec.getTime()
    if (timeSinceLastExec < 60 * 1000) {
      return false
    }
  }

  const { trigger_type, schedule: scheduleData } = schedule

  switch (trigger_type) {
    case 'time': {
      // Check if current day matches schedule
      const currentDay = now.getDay()
      const days = scheduleData.days || []

      if (!days.includes(currentDay)) {
        return false
      }

      // Check if current time matches start_time
      if (!scheduleData.start_time) {
        return false
      }

      const [scheduleHour, scheduleMinute] = scheduleData.start_time
        .split(':')
        .map(Number)
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      // Match within the same minute
      return scheduleHour === currentHour && scheduleMinute === currentMinute
    }

    case 'sunrise':
    case 'sunset': {
      if (!room || room.latitude === null || room.longitude === null) {
        return false
      }

      // Calculate sunrise/sunset time
      const targetTime =
        trigger_type === 'sunrise'
          ? calculateSunrise(now, room.latitude, room.longitude, room.timezone)
          : calculateSunset(now, room.latitude, room.longitude, room.timezone)

      // Apply offset if specified
      const offsetMinutes = scheduleData.offset_minutes || 0
      const adjustedTime = new Date(
        targetTime.getTime() + offsetMinutes * 60 * 1000
      )

      // Match within the same minute
      return (
        adjustedTime.getHours() === now.getHours() &&
        adjustedTime.getMinutes() === now.getMinutes()
      )
    }

    case 'cron': {
      // For now, cron expressions are not fully implemented
      // TODO: Integrate a cron parser library
      return false
    }

    default:
      return false
  }
}

// ============================================
// Schedule Execution
// ============================================

/**
 * Execute a device schedule.
 * Handles command generation, adapter communication, retry logic, and logging.
 */
export async function executeSchedule(
  schedule: DeviceSchedule,
  controller: DBController,
  room: DBRoom | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  dryRun: boolean = false
): Promise<ExecutionResult> {
  const now = new Date()
  const { id: scheduleId, name, device_port, trigger_type, schedule: scheduleData } = schedule
  const { id: controllerId, name: controllerName, brand } = controller

  // Check rate limit
  if (!checkRateLimit(controllerId)) {
    return {
      scheduleId,
      scheduleName: name,
      controllerId,
      controllerName,
      status: 'failed',
      action: 'rate_limited',
      error: 'Rate limit exceeded (max 10 commands per minute)',
      timestamp: now.toISOString(),
    }
  }

  // Determine the action and value
  let action: CommandType = 'turn_on'
  let value: number | undefined

  // For sunrise/sunset dimming, calculate the current intensity
  if (
    (trigger_type === 'sunrise' || trigger_type === 'sunset') &&
    scheduleData.duration_minutes &&
    scheduleData.start_intensity !== undefined &&
    scheduleData.target_intensity !== undefined
  ) {
    // Calculate time since schedule started
    const startTime = schedule.last_executed
      ? new Date(schedule.last_executed)
      : now

    const elapsed = now.getTime() - startTime.getTime()
    const duration = scheduleData.duration_minutes * 60 * 1000

    value = calculateDimmingValue(
      scheduleData.start_intensity,
      scheduleData.target_intensity,
      elapsed,
      duration,
      scheduleData.curve || 'linear'
    )

    action = 'set_level'
  } else if (scheduleData.action) {
    // Standard action
    switch (scheduleData.action) {
      case 'on':
        action = 'turn_on'
        break
      case 'off':
        action = 'turn_off'
        break
      case 'set_level':
        action = 'set_level'
        value = scheduleData.level
        break
    }
  }

  // Dry run mode - simulate execution
  if (dryRun) {
    return {
      scheduleId,
      scheduleName: name,
      controllerId,
      controllerName,
      status: 'dry_run',
      action,
      value,
      timestamp: now.toISOString(),
    }
  }

  // Skip CSV upload controllers - they don't support control
  if (brand === 'csv_upload') {
    return {
      scheduleId,
      scheduleName: name,
      controllerId,
      controllerName,
      status: 'skipped',
      action,
      error: 'CSV controllers do not support device control',
      timestamp: now.toISOString(),
    }
  }

  // Check if brand is supported
  if (!isBrandSupported(brand)) {
    return {
      scheduleId,
      scheduleName: name,
      controllerId,
      controllerName,
      status: 'failed',
      action,
      error: `Unsupported brand: ${brand}`,
      timestamp: now.toISOString(),
    }
  }

  // Decrypt credentials
  let decryptedCredentials: Record<string, unknown>
  try {
    decryptedCredentials = decryptCredentials(controller.credentials)
  } catch (error) {
    return {
      scheduleId,
      scheduleName: name,
      controllerId,
      controllerName,
      status: 'failed',
      action,
      error: 'Failed to decrypt controller credentials',
      timestamp: now.toISOString(),
    }
  }

  // Execute with retry logic
  const maxRetries = 3
  let lastError: string | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get adapter
      const adapter = getAdapter(brand as ControllerBrand)
      const adapterCredentials = buildAdapterCredentials(
        brand as ControllerBrand,
        decryptedCredentials
      )

      // Connect to controller
      const connectionResult = await adapter.connect(adapterCredentials)

      if (!connectionResult.success) {
        lastError = connectionResult.error || 'Connection failed'

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          )
          continue
        }

        break
      }

      // Send device command
      const command: DeviceCommand = {
        type: action,
        value,
      }

      const commandResult = await adapter.controlDevice(
        connectionResult.controllerId,
        device_port,
        command
      )

      // Disconnect
      await adapter.disconnect(connectionResult.controllerId)

      if (!commandResult.success) {
        lastError = commandResult.error || 'Command failed'

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          )
          continue
        }

        break
      }

      // Success!
      return {
        scheduleId,
        scheduleName: name,
        controllerId,
        controllerName,
        status: 'success',
        action,
        value: commandResult.actualValue ?? value,
        timestamp: now.toISOString(),
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'

      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        )
      }
    }
  }

  // All retries exhausted
  return {
    scheduleId,
    scheduleName: name,
    controllerId,
    controllerName,
    status: 'failed',
    action,
    value,
    error: lastError || 'Command failed after 3 retries',
    timestamp: now.toISOString(),
  }
}

/**
 * Log schedule execution to activity_logs table.
 */
export async function logScheduleExecution(
  result: ExecutionResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  roomId: string | null
): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      controller_id: result.controllerId,
      room_id: roomId,
      action_type: 'schedule_executed',
      action_data: {
        schedule_id: result.scheduleId,
        schedule_name: result.scheduleName,
        action: result.action,
        value: result.value,
      },
      result: result.status,
      error_message: result.error || null,
      timestamp: result.timestamp,
    })
  } catch (error) {
    console.error('[ScheduleExecutor] Failed to log execution:', error)
  }
}

/**
 * Update schedule execution metadata.
 */
export async function updateScheduleMetadata(
  scheduleId: string,
  result: ExecutionResult,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {
      last_executed: result.timestamp,
      execution_count: supabase.rpc('increment', { x: 1 }),
      updated_at: new Date().toISOString(),
    }

    if (result.status === 'failed') {
      updates.last_error = result.error
    } else {
      updates.last_error = null
    }

    await supabase.from('device_schedules').update(updates).eq('id', scheduleId)
  } catch (error) {
    console.error('[ScheduleExecutor] Failed to update schedule metadata:', error)
  }
}

// Export rate limit cleanup for use in cron
export { cleanupRateLimits }
