/**
 * Alert Acknowledge API
 *
 * POST /api/alerts/[id]/acknowledge - Acknowledge an alert
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

    // Acknowledge the alert
    const { data, error } = await supabase.rpc('acknowledge_alert', {
      p_alert_id: alertId,
    })

    if (error) {
      console.error('Failed to acknowledge alert:', error)
      return NextResponse.json(
        { error: 'Failed to acknowledge alert', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Alert not found or already acknowledged' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged',
    })
  } catch (error) {
    console.error('Error acknowledging alert:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
