/**
 * Alert Snooze API
 *
 * POST /api/alerts/[id]/snooze - Snooze an alert for a specified duration
 *
 * Request body:
 * {
 *   "hours": 12 | 24 | 48
 * }
 */

import { createServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alertId = params.id

    // Parse request body
    const body = await request.json()
    const hours = body.hours as number

    if (![12, 24, 48].includes(hours)) {
      return NextResponse.json(
        { error: 'Invalid snooze duration. Must be 12, 24, or 48 hours.' },
        { status: 400 }
      )
    }

    // Verify alert belongs to user
    const { data: alert, error: checkError } = await supabase
      .from('alerts')
      .select('id, user_id')
      .eq('id', alertId)
      .single()

    if (checkError || !alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    if (alert.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Snooze the alert
    const { data, error } = await supabase.rpc('snooze_alert', {
      p_alert_id: alertId,
      p_snooze_hours: hours,
    })

    if (error) {
      console.error('Failed to snooze alert:', error)
      return NextResponse.json(
        { error: 'Failed to snooze alert', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Alert not found or already snoozed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Alert snoozed for ${hours} hours`,
      snooze_until: new Date(
        Date.now() + hours * 60 * 60 * 1000
      ).toISOString(),
    })
  } catch (error) {
    console.error('Error snoozing alert:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
