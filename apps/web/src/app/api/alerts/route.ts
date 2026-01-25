/**
 * Alerts API
 *
 * GET /api/alerts - List all alerts for the authenticated user
 * POST /api/alerts/[id]/acknowledge - Acknowledge an alert
 * POST /api/alerts/[id]/snooze - Snooze an alert
 * POST /api/alerts/[id]/resolve - Manually resolve an alert
 */

import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import type { Alert, AlertStatus } from '@/types'

/**
 * GET /api/alerts
 * List all alerts for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as AlertStatus | null
    const controllerId = searchParams.get('controller_id')
    const alertType = searchParams.get('alert_type')

    // Build query
    let query = supabase
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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (controllerId) {
      query = query.eq('controller_id', controllerId)
    }

    if (alertType) {
      query = query.eq('alert_type', alertType)
    }

    const { data: alerts, error } = await query

    if (error) {
      console.error('Failed to fetch alerts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch alerts', details: error.message },
        { status: 500 }
      )
    }

    // Calculate statistics
    const stats = {
      total: alerts?.length || 0,
      active: alerts?.filter((a) => a.status === 'active').length || 0,
      snoozed: alerts?.filter((a) => a.status === 'snoozed').length || 0,
      acknowledged:
        alerts?.filter((a) => a.status === 'acknowledged').length || 0,
      resolved: alerts?.filter((a) => a.status === 'resolved').length || 0,
      byType: {
        offline:
          alerts?.filter((a) => a.alert_type === 'offline').length || 0,
        failed_commands:
          alerts?.filter((a) => a.alert_type === 'failed_commands').length || 0,
        low_health:
          alerts?.filter((a) => a.alert_type === 'low_health').length || 0,
      },
    }

    return NextResponse.json({
      alerts: alerts || [],
      stats,
    })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
