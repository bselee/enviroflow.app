/**
 * DEBUG: Check device_state_log table contents
 * GET /api/debug/device-state-log?limit=50
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
    const controllerId = request.nextUrl.searchParams.get('controllerId')

    const supabase = getSupabase()

    // Query device_state_log
    let query = supabase
      .from('device_state_log')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (controllerId) {
      query = query.eq('controller_id', controllerId)
    }

    const { data: logs, error: logsError } = await query

    if (logsError) {
      return NextResponse.json({
        error: 'Failed to query device_state_log',
        details: logsError.message,
        hint: logsError.hint,
      }, { status: 500 })
    }

    // Also get count of total records
    const { count } = await supabase
      .from('device_state_log')
      .select('*', { count: 'exact', head: true })

    // Get distinct devices
    const { data: devices } = await supabase
      .from('device_state_log')
      .select('device_name, controller_id')
      .limit(100)

    const uniqueDevices = [...new Set((devices || []).map(d => d.device_name))]

    return NextResponse.json({
      success: true,
      totalRecords: count,
      returnedRecords: logs?.length || 0,
      uniqueDevices,
      logs: logs || [],
      summary: {
        byTrigger: groupBy(logs || [], 'trigger'),
        byDevice: groupBy(logs || [], 'device_name'),
        timeRange: logs?.length ? {
          oldest: logs[logs.length - 1]?.recorded_at,
          newest: logs[0]?.recorded_at,
        } : null,
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Exception',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = String(item[key] || 'unknown')
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}
