/**
 * Proactive Alerting System for Controller Connection Issues
 *
 * This module provides utilities for:
 * - Detecting alert conditions (offline, failed commands, low health)
 * - Creating and managing alerts with duplicate suppression
 * - Auto-resolving alerts when conditions improve
 * - Sending notifications (push, in-app, email digest)
 *
 * Alert triggers:
 * - offline: Controller offline > 30 minutes
 * - failed_commands: 3+ consecutive failed commands in last hour
 * - low_health: Health score < 50
 *
 * Duplicate suppression: Max 1 alert per controller per type per hour
 */

import { createClient } from '@supabase/supabase-js'
import type {
  Alert,
  AlertType,
  AlertMetadata,
  Controller,
  ActivityLog,
} from '@/types'
import {
  sendPushNotification,
  type NotificationCategory,
} from './push-notification-service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>

// ============================================
// Constants
// ============================================

const OFFLINE_THRESHOLD_MINUTES = 30
const FAILED_COMMAND_THRESHOLD = 3
const LOW_HEALTH_THRESHOLD = 50
const DUPLICATE_SUPPRESSION_HOURS = 1

// ============================================
// Alert Condition Detection
// ============================================

/**
 * Check if a controller is offline beyond threshold
 */
export function isOfflineOver30Min(controller: Controller): boolean {
  if (!controller.last_seen) {
    // Never seen means it's either new or offline
    const createdAt = new Date(controller.created_at)
    const minutesSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60)
    return minutesSinceCreation > OFFLINE_THRESHOLD_MINUTES
  }

  const lastSeenDate = new Date(controller.last_seen)
  const minutesOffline = (Date.now() - lastSeenDate.getTime()) / (1000 * 60)

  return minutesOffline > OFFLINE_THRESHOLD_MINUTES
}

/**
 * Get recent failed command count for a controller
 */
export async function getRecentFailedCommands(
  supabase: SupabaseClient,
  controllerId: string
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('activity_logs')
    .select('id')
    .eq('controller_id', controllerId)
    .eq('result', 'failed')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch failed commands:', error)
    return 0
  }

  return data?.length || 0
}

/**
 * Get latest health score for a controller
 */
export async function getHealthScore(
  supabase: SupabaseClient,
  controllerId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('controller_health')
    .select('score')
    .eq('controller_id', controllerId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data.score
}

// ============================================
// Alert Creation & Management
// ============================================

/**
 * Check if a similar alert was created recently (duplicate suppression)
 */
export async function hasDuplicateAlert(
  supabase: SupabaseClient,
  controllerId: string,
  alertType: AlertType
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_recent_alert', {
    p_controller_id: controllerId,
    p_alert_type: alertType,
    p_threshold_hours: DUPLICATE_SUPPRESSION_HOURS,
  })

  if (error) {
    console.error('Failed to check for duplicate alerts:', error)
    return false
  }

  return data === true
}

/**
 * Create a new alert
 */
export async function createAlert(
  supabase: SupabaseClient,
  userId: string,
  controllerId: string,
  alertType: AlertType,
  message: string,
  metadata: AlertMetadata = {}
): Promise<{ success: boolean; alert?: Alert; error?: string }> {
  // Check for duplicates
  const hasDuplicate = await hasDuplicateAlert(supabase, controllerId, alertType)

  if (hasDuplicate) {
    return {
      success: false,
      error: 'Duplicate alert suppressed',
    }
  }

  // Insert new alert
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      controller_id: controllerId,
      alert_type: alertType,
      message,
      metadata,
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Failed to create alert:', error)
    return {
      success: false,
      error: error?.message || 'Failed to create alert',
    }
  }

  return {
    success: true,
    alert: data as Alert,
  }
}

/**
 * Auto-resolve alerts when conditions improve
 */
export async function autoResolveAlerts(
  supabase: SupabaseClient,
  controllerId: string,
  alertType: AlertType
): Promise<number> {
  const { data, error } = await supabase.rpc('auto_resolve_alerts', {
    p_controller_id: controllerId,
    p_alert_type: alertType,
  })

  if (error) {
    console.error('Failed to auto-resolve alerts:', error)
    return 0
  }

  return data || 0
}

/**
 * Snooze an alert for a specified duration
 */
export async function snoozeAlert(
  supabase: SupabaseClient,
  alertId: string,
  snoozeHours: 12 | 24 | 48
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('snooze_alert', {
    p_alert_id: alertId,
    p_snooze_hours: snoozeHours,
  })

  if (error) {
    console.error('Failed to snooze alert:', error)
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: data === true,
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  supabase: SupabaseClient,
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('acknowledge_alert', {
    p_alert_id: alertId,
  })

  if (error) {
    console.error('Failed to acknowledge alert:', error)
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: data === true,
  }
}

/**
 * Reactivate snoozed alerts whose snooze period has expired
 */
export async function reactivateSnoozedAlerts(
  supabase: SupabaseClient
): Promise<number> {
  const { data: expiredAlerts, error: fetchError } = await supabase.rpc(
    'get_expired_snooze_alerts'
  )

  if (fetchError || !expiredAlerts || expiredAlerts.length === 0) {
    return 0
  }

  const alertIds = expiredAlerts.map((a: { id: string }) => a.id)

  const { error: updateError } = await supabase
    .from('alerts')
    .update({
      status: 'active',
      snoozed_until: null,
    })
    .in('id', alertIds)

  if (updateError) {
    console.error('Failed to reactivate snoozed alerts:', updateError)
    return 0
  }

  return alertIds.length
}

// ============================================
// Alert Checking Logic
// ============================================

export interface AlertCondition {
  type: AlertType
  message: string
  metadata: AlertMetadata
}

/**
 * Check all alert conditions for a controller
 */
export async function checkAlertConditions(
  supabase: SupabaseClient,
  controller: Controller
): Promise<AlertCondition[]> {
  const conditions: AlertCondition[] = []

  // Condition 1: Offline > 30 min
  if (isOfflineOver30Min(controller)) {
    const lastSeenDate = controller.last_seen
      ? new Date(controller.last_seen)
      : new Date(controller.created_at)
    const minutesOffline = Math.floor(
      (Date.now() - lastSeenDate.getTime()) / (1000 * 60)
    )

    conditions.push({
      type: 'offline',
      message: `${controller.name} has been offline for ${minutesOffline} minutes`,
      metadata: {
        offline_duration_minutes: minutesOffline,
        last_seen: controller.last_seen || controller.created_at,
      },
    })
  }

  // Condition 2: 3+ consecutive failed commands
  const failedCommands = await getRecentFailedCommands(supabase, controller.id)
  if (failedCommands >= FAILED_COMMAND_THRESHOLD) {
    conditions.push({
      type: 'failed_commands',
      message: `${controller.name} has ${failedCommands} failed commands in the last hour`,
      metadata: {
        failed_command_count: failedCommands,
      },
    })
  }

  // Condition 3: Health score < 50
  const healthScore = await getHealthScore(supabase, controller.id)
  if (healthScore !== null && healthScore < LOW_HEALTH_THRESHOLD) {
    conditions.push({
      type: 'low_health',
      message: `${controller.name} health score is critically low (${healthScore}/100)`,
      metadata: {
        health_score: healthScore,
      },
    })
  }

  return conditions
}

/**
 * Auto-resolve alerts when conditions are no longer met
 */
export async function checkAutoResolveConditions(
  supabase: SupabaseClient,
  controller: Controller
): Promise<number> {
  let resolvedCount = 0

  // Auto-resolve offline alerts if controller is online
  if (!isOfflineOver30Min(controller)) {
    const resolved = await autoResolveAlerts(supabase, controller.id, 'offline')
    resolvedCount += resolved
  }

  // Auto-resolve failed_commands alerts if recent failures < threshold
  const failedCommands = await getRecentFailedCommands(supabase, controller.id)
  if (failedCommands < FAILED_COMMAND_THRESHOLD) {
    const resolved = await autoResolveAlerts(
      supabase,
      controller.id,
      'failed_commands'
    )
    resolvedCount += resolved
  }

  // Auto-resolve low_health alerts if health improved
  const healthScore = await getHealthScore(supabase, controller.id)
  if (healthScore !== null && healthScore >= LOW_HEALTH_THRESHOLD) {
    const resolved = await autoResolveAlerts(supabase, controller.id, 'low_health')
    resolvedCount += resolved
  }

  return resolvedCount
}

// ============================================
// Notification Delivery
// ============================================

/**
 * Map alert type to notification category
 */
function getNotificationCategory(alertType: AlertType): NotificationCategory {
  switch (alertType) {
    case 'offline':
      return 'alert'
    case 'failed_commands':
      return 'warning'
    case 'low_health':
      return 'alert'
    default:
      return 'warning'
  }
}

/**
 * Send notification for an alert
 */
export async function sendAlertNotification(
  userId: string,
  alert: Alert,
  controllerName: string
): Promise<void> {
  const category = getNotificationCategory(alert.alert_type)

  await sendPushNotification({
    userId,
    title: 'Controller Alert',
    body: alert.message,
    category,
    priority: 'high',
    data: {
      alert_id: alert.id,
      alert_type: alert.alert_type,
      controller_id: alert.controller_id,
      controller_name: controllerName,
      actionType: 'controller_alert',
      actionUrl: `/dashboard?alert=${alert.id}`,
    },
  })
}

/**
 * Process all alerts for a controller
 */
export async function processControllerAlerts(
  supabase: SupabaseClient,
  controller: Controller
): Promise<{
  created: number
  resolved: number
  errors: string[]
}> {
  const errors: string[] = []
  let createdCount = 0
  let resolvedCount = 0

  try {
    // First, auto-resolve any alerts that no longer apply
    resolvedCount = await checkAutoResolveConditions(supabase, controller)

    // Then, check for new alert conditions
    const conditions = await checkAlertConditions(supabase, controller)

    // Create alerts for each condition
    for (const condition of conditions) {
      const result = await createAlert(
        supabase,
        controller.user_id,
        controller.id,
        condition.type,
        condition.message,
        condition.metadata
      )

      if (result.success && result.alert) {
        createdCount++

        // Send notification
        try {
          await sendAlertNotification(
            controller.user_id,
            result.alert,
            controller.name
          )
        } catch (notifError) {
          errors.push(
            `Failed to send notification for alert ${result.alert.id}: ${
              notifError instanceof Error ? notifError.message : 'Unknown error'
            }`
          )
        }
      } else if (result.error && result.error !== 'Duplicate alert suppressed') {
        errors.push(
          `Failed to create alert for ${controller.name}: ${result.error}`
        )
      }
    }
  } catch (error) {
    errors.push(
      `Failed to process alerts for ${controller.name}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }

  return {
    created: createdCount,
    resolved: resolvedCount,
    errors,
  }
}
