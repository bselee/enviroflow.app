'use client'

/**
 * AlertBanner Component
 *
 * Displays active alerts for controller connection issues at the top of the dashboard.
 *
 * Features:
 * - Shows all active alerts (not snoozed)
 * - Quick actions: Acknowledge, Snooze (12/24/48h), Reconnect
 * - Real-time updates via Supabase subscription
 * - Color-coded by alert type (offline=red, failed_commands=amber, low_health=red)
 * - Compact view when multiple alerts exist
 * - Auto-dismisses when alerts are resolved
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  X,
  Bell,
  BellOff,
  WifiOff,
  AlertCircle,
  Activity,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AlertWithController, SnoozeDuration } from '@/types'

interface AlertBannerProps {
  userId: string
}

export function AlertBanner({ userId }: AlertBannerProps) {
  const [alerts, setAlerts] = useState<AlertWithController[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const supabase = createClient()

  useEffect(() => {
    loadAlerts()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadAlerts()
          } else if (payload.eventType === 'UPDATE') {
            loadAlerts()
          } else if (payload.eventType === 'DELETE') {
            setAlerts((prev) =>
              prev.filter((a) => a.id !== (payload.old as { id: string }).id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  async function loadAlerts() {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(
          `
          *,
          controller:controllers(
            id,
            name,
            brand,
            status
          )
        `
        )
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load alerts:', error)
        return
      }

      setAlerts((data as AlertWithController[]) || [])
    } catch (error) {
      console.error('Error loading alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAcknowledge(alertId: string) {
    try {
      const { error } = await supabase.rpc('acknowledge_alert', {
        p_alert_id: alertId,
      })

      if (error) throw error

      // Optimistically update UI
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  async function handleSnooze(alertId: string, hours: SnoozeDuration) {
    try {
      const { error } = await supabase.rpc('snooze_alert', {
        p_alert_id: alertId,
        p_snooze_hours: hours,
      })

      if (error) throw error

      // Optimistically update UI
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch (error) {
      console.error('Failed to snooze alert:', error)
    }
  }

  function handleDismiss(alertId: string) {
    // Local dismiss (doesn't change database)
    setDismissedIds((prev) => new Set(prev).add(alertId))
  }

  function getAlertIcon(alertType: string) {
    switch (alertType) {
      case 'offline':
        return <WifiOff className="h-5 w-5" />
      case 'failed_commands':
        return <AlertCircle className="h-5 w-5" />
      case 'low_health':
        return <Activity className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
  }

  function getAlertColor(alertType: string) {
    switch (alertType) {
      case 'offline':
        return 'bg-red-500 text-white'
      case 'failed_commands':
        return 'bg-amber-500 text-white'
      case 'low_health':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id))

  if (loading || visibleAlerts.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between gap-4 rounded-lg p-4 ${getAlertColor(
            alert.alert_type
          )}`}
        >
          <div className="flex items-center gap-3 flex-1">
            {getAlertIcon(alert.alert_type)}
            <div className="flex-1">
              <p className="font-medium">{alert.message}</p>
              <p className="text-sm opacity-90">
                Controller: {alert.controller?.name || 'Unknown'} (
                {alert.controller?.brand || 'unknown'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reconnect button (only for offline alerts) */}
            {alert.alert_type === 'offline' && alert.controller && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // Navigate to controller page for reconnection
                  window.location.href = `/dashboard/controllers/${alert.controller_id}`
                }}
              >
                Reconnect
              </Button>
            )}

            {/* View Diagnostics button (for failed_commands and low_health) */}
            {(alert.alert_type === 'failed_commands' ||
              alert.alert_type === 'low_health') &&
              alert.controller && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    window.location.href = `/dashboard/controllers/${alert.controller_id}`
                  }}
                >
                  View Diagnostics
                </Button>
              )}

            {/* Snooze dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-white">
                  <BellOff className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSnooze(alert.id, 12)}>
                  Snooze 12 hours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSnooze(alert.id, 24)}>
                  Snooze 24 hours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSnooze(alert.id, 48)}>
                  Snooze 48 hours
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Acknowledge button */}
            <Button
              size="sm"
              variant="ghost"
              className="text-white"
              onClick={() => handleAcknowledge(alert.id)}
            >
              <Bell className="h-4 w-4" />
            </Button>

            {/* Dismiss button (local only) */}
            <Button
              size="sm"
              variant="ghost"
              className="text-white"
              onClick={() => handleDismiss(alert.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
