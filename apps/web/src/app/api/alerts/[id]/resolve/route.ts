/**
 * Alert Resolve API
 *
 * POST /api/alerts/[id]/resolve - Manually resolve an alert
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

    // Resolve the alert
    const { error: updateError } = await supabase
      .from('alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to resolve alert:', updateError)
      return NextResponse.json(
        { error: 'Failed to resolve alert', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Alert resolved',
    })
  } catch (error) {
    console.error('Error resolving alert:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
